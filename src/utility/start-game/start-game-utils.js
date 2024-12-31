//Utility functions used in the start-game command

const {
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    ComponentType,
    PermissionFlagsBits,
    ChannelType, StringSelectMenuBuilder
} = require('discord.js');

const { MafiaPlayer, GameData } = require('./classes/game-data');

/**
 * Takes a poll and returns the choice that was most voted for
 * @param {import('discord.js').GuildTextBasedChannel} channel The channel to post the poll in
 * @param {GameData} game A `GameData` reference object containing information for the game that's going on
 * @param {boolean} isMafiaPoll Whether the poll is a mafia poll or not (false by default -> townspeople vote)
 * @return {Promise<MafiaPlayer> | null} The mafia player that was most voted on, null if tied
 */
async function takePoll(channel, game, isMafiaPoll= false){
    /*
    If a Mafia vote, then:
        - Options will be only townspeople AND are alive
        - (Dead check for voters will be common logic)
    If not a Mafia vote, then:
        - Options will be only alive people (game.alivePlayers)
     */

    //Array of alive MafiaPlayers
    const alivePlayers = game.alivePlayers;
    //Array of dead MafiaPlayer IDs (Snowflake type IDs)
    const deadPlayerIDs = game.deadPlayerIDs;

    //Map for storing vote counts
    const voteMap = new Map();
    //Initializing: If it's a mafia vote, then only townspeople can be the options
    if(isMafiaPoll === true) {
        //Initialize that map with alive townspeople and 0 votes
        for (const player of alivePlayers){
            if(!player.isMafia){
                voteMap.set(player, 0);
            }
        }
    //If it's not (it's a townspeople vote), then all alive players are options
    } else {
        for (const player of alivePlayers){
            voteMap.set(player,0);
        }
    }

    //Create the select menu options
    const options = alivePlayers.map((player) => ({
        label: player.displayName,
        value: player.id
    }));

    //Build the select menu
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('mafia_vote_menu')
        .setPlaceholder('Select the player to vote for...')
        .addOptions(options);
    const row = new ActionRowBuilder()
        .addComponents(selectMenu);

    //Send the poll message to the channel
    //For mafia polls
    let initialMsg;
    if(isMafiaPoll === true) {
        initialMsg = await channel.send({
            content: 'Team Mafia, you will now vote for the next townsperson you want to kill.\nIn case of a draw, nobody dies.\nVoting ends in 10 seconds.',
            components: [row],
            ephemeral: false
        });
    //For townspeople polls
    } else {
        initialMsg = await channel.send({
            content: 'Townspeople, you will now vote for the next person you want to execute.\nIn case of a draw, nobody dies.\nVoting ends in 10 seconds.',
            components: [row],
            ephemeral: false
        });
    }

    //To return from the outside function, we use a promise:
    return new Promise((resolve) => {
        //Create a collector to listen for interactions
        const collector = initialMsg.createMessageComponentCollector({
            componentType: ComponentType.StringSelect,
            time: 10_000  //Voting lasts for 10 seconds or 10,000ms
        });

        collector.on('collect', async (menuInteract) => {
            const voter = menuInteract.user; //Guy who voted

            //Reject interaction if the guy is dead
            if(deadPlayerIDs.find((id) => id === voter.id)){
                await menuInteract.reply({
                   content: 'You are dead and cannot vote!',
                   ephemeral: true
                });
                return;
            }

            //Get the selected player's ID and increase their vote count
            const selectedPlayerID = menuInteract.values[0];
            const selectedPlayer = alivePlayers.find((player) => player.id === selectedPlayerID);

            if(selectedPlayer){
                voteMap.set(selectedPlayer, voteMap.get(selectedPlayer) + 1);

                //Acknowledge the vote
                await menuInteract.reply({
                    content: `You voted for ${selectedPlayer.displayName}.`,
                    ephemeral: true
                });
            }
        });

        collector.on('end', async () => {
            selectMenu.setDisabled(true);  //Disable the select menu
            const rowOff = new ActionRowBuilder().addComponents(selectMenu);

            await initialMsg.edit({
                content: 'Voting has ended!',
                components: [rowOff]
            });

            //Displaying the final votes
            let resultMessage = 'Voting results:\n';
            let maxVotes = 0;
            let mostVotedPlayer = null;
            let tie = false;

            for (const [player, votes] of voteMap.entries()) {
                resultMessage += `${player.displayName}: ${votes} votes\n`;

                if (votes > maxVotes) {
                    maxVotes = votes;
                    mostVotedPlayer = player;
                    tie = false; // Clear previous tie state
                } else if (votes === maxVotes) {
                    tie = true;
                }
            }

            //Post the results
            await initialMsg.followUp({
                content: resultMessage,
                ephemeral: false
            });

            //Return either the most voted player, or null if it's a tie
            resolve(tie? null : mostVotedPlayer);
        });
    });

}

/**
 * Creates a Mafia game channel and returns it
 * @param {import('discord.js').Guild} guild The guild object
 * @param {GameData} game The current game going on
 * @param {boolean} isMafiaTurn true if it's a mafia turn, false if townspeople
 * @return {import('discord.js').GuildTextBasedChannel} The created channel
 */
async function createGameChannel(guild, game, isMafiaTurn = true){
    //Array of allowed players (In case of Mafia turn, only mafias can see it)
    const players = isMafiaTurn? game.mafias: game.players;
    const channelName = isMafiaTurn? 'mafia-only-channel-mafia-bot-game': 'tb-mafia-bot-game';

    //Permission overwrites
    const permOverwrites = players.map((player) => ({
        id: player.id,
        allow: [PermissionFlagsBits.ViewChannel]
    }));

    //Deny access to @everyone
    permOverwrites.push({
        id: guild.roles.everyone.id, //@everyone role ID
        deny: [PermissionFlagsBits.ViewChannel]
    });

    //Create the channel
    const channel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        permissionOverwrites: permOverwrites
    });

    //Ping all the users
    const welcomeMsg = isMafiaTurn? `Welcome to Round ${game.round}, Mafia members!\n`: `Welcome to Mafia!\n`;
    const mentions = players.map( (player) => `<@${player.id}>`).join(', ');
    await channel.send({
        content: `${welcomeMsg + mentions}`,
        ephemeral: false
    });

    //Return the channel
    return channel;
}


//Kill player,takes MafiaPlayer object to kill, returns void
//Killing logic:
//- Remove dead player from aliveplayers array using his ID
//- Push dead player's ID to deadPlayersIDs array


//runRound(game) will run a whole round

//runGame(game) will run a whole game using runRounds until there's a conclusion




/**
 * Set up the game:
 * - Collect the users
 * - Set up the roles
 * - Return the GameData
 * @param {import('discord.js').ChatInputCommandInteraction} interaction The interaction object
 * @returns {Promise<GameData> | null} A GameData object for the game going on OR `null` if there weren't enough players
 */
async function gameSetUp(interaction){
    /**
     * The users who signed up
     * @type {User[]}
     */
    let playerUsers = [];

    //Set up the buttons and add them to an ActionRow
    const buttonSignUp = new ButtonBuilder()
        .setCustomId('signup')
        .setLabel('Join game lobby')
        .setStyle(ButtonStyle.Success);
    const buttonSignOut = new ButtonBuilder()
        .setCustomId('signout')
        .setLabel('Leave game lobby')
        .setStyle(ButtonStyle.Danger);
    const rowOn = new ActionRowBuilder()
        .addComponents(buttonSignUp, buttonSignOut);

    //Create the initial message and store it in a variable
    const initialMsg = await interaction.reply({
        content: 'Click **Join game lobby** to join the game, and **Leave game lobby** in case you change your mind.\nRegistration closes in 20 seconds.',
        components: [rowOn],
        ephemeral: false
    });

    // Return a Promise that resolves when the collector ends
    return new Promise((resolve) => {
        //Create a collector that collects interactions from the buttons
        const collector = initialMsg.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 20_000,
        });

        // Handle button interactions
        collector.on('collect', async (btnInteract) => {
            const intUser = btnInteract.user;

            if (btnInteract.customId === 'signup') {
                if (!playerUsers.find((u) => u.id === intUser.id)) {
                    if(playerUsers.length > 9) //Max players are 10
                    {
                        await btnInteract.reply({
                            content: 'Sorry, lobby is already full. (10 players)',
                            ephemeral: true,
                        });
                    } else {
                        playerUsers.push(intUser);
                        await btnInteract.reply({
                            content: 'You are now in the lobby!',
                            ephemeral: true,
                        });
                    }
                } else {
                    await btnInteract.reply({
                        content: 'You are already in the lobby.',
                        ephemeral: true,
                    });
                }
            } else if (btnInteract.customId === 'signout') {
                playerUsers = playerUsers.filter((u) => u.id !== intUser);

                await btnInteract.reply({
                    content: 'You have left the lobby.',
                    ephemeral: true,
                });
            }
        });

        // On collector end
        collector.on('end', async () => {
            buttonSignUp.setDisabled();
            buttonSignOut.setDisabled();

            const rowOff = new ActionRowBuilder().addComponents(buttonSignUp, buttonSignOut);

            await initialMsg.edit({
                components: [rowOff],
            });

            // Check player count
            if (playerUsers.length < 5) {
                await interaction.followUp({
                    content: 'In order to start a game, you need to have at least 5 players in the lobby.',
                    ephemeral: false,
                });
                resolve(null); // Resolve with null if there aren't enough players
            } else {
                const game = new GameData(playerUsers);
                game.assignRoles();

                //Display all the players in the game
                const players = game.players.map(p => p.username).join('\n');
                await interaction.followUp({
                    content: `The players for the upcoming game are:\n${players}`,
                    ephemeral: false
                });

                //DEVELOPMENT ONLY: Display all the role-holders in the game
                const townspeople = game.townspeople.map(p => p.displayName).join(', ');
                const mafias = game.mafias.map(p => p.displayName).join(', ');
                const detective = game.detective?.displayName;
                const doctor = game.doctor?.displayName;
                //DEVELOPMENT ONLY: Take a random person from the alive players and make them dead
                const chosenDeadPlayer = this.alivePlayers.pop();
                this.deadPlayerIDs.push(chosenDeadPlayer.id);

                await interaction.followUp({
                    content: `The roles for the upcoming game:
- The townspeople:
  - ${townspeople}
- The mafia(s):
  - ${mafias}
- The detective (undefined if none):
  - ${detective}
- The doctor (undefined if none):
  - ${doctor}
- The randomly chosen dead player:
  - ${chosenDeadPlayer.displayName}
                    `
                })

                //DEVELOPMENT ONLY: TEST VOTING HERE FIRST






                resolve(game); // Resolve with the GameData object
            }
        });
    });

    }




module.exports = {
    gameSetUp
}