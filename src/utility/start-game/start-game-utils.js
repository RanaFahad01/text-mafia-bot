//Utility functions used in the start-game command

const {
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    ComponentType,
    PermissionFlagsBits,
    ChannelType, StringSelectMenuBuilder
} = require('discord.js');

const { MafiaPlayer } = require('./classes/mafia-player');
const { GameData } = require('./classes/game-data');

/**
 * Takes a poll and returns the choice that was most voted for
 * @param {import('discord.js').GuildTextBasedChannel} channel The channel to post the poll in
 * @param {GameData} game A `GameData` reference object containing information for the game that's going on
 * @param {boolean} isMafiaPoll Whether the poll is a mafia poll or not (false by default -> townspeople vote)
 * @return {MafiaPlayer} The mafia player that was most voted on
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

    //Create a collector to listen for interactions
    const collector = initialMsg.createMessageComponentCollector({
        componentType: ComponentType.StringSelect,
        time: 10_000  //Voting lasts for 10 seconds or 10,000ms
    });


}

//Create channel, takes (channel-name, allow-user-IDs)
//Returns channel







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