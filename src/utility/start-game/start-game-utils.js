//Utility functions used in the start-game command

const {
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    ComponentType,
    PermissionFlagsBits,
    ChannelType, StringSelectMenuBuilder
} = require('discord.js');

const { MafiaPlayer, GameData, GameResult } = require('./classes/game-data');

/**
 * Pauses execution for the duration given
 * @param {number} duration_seconds Pause duration in seconds
 * @return {Promise<void>}
 */
async function pause(duration_seconds){
    const duration_milliseconds = duration_seconds * 1000;
    await new Promise(resolve => setTimeout(resolve, duration_milliseconds));
}

/**
 * Takes a poll via DM for the Detective or the Doctor
 * @param {import('discord.js').Snowflake} playerID ID of the Detective or the Doctor
 * @param {GameData} game The game currently going on
 * @param {import('discord.js').Client} client The client object
 * @param {boolean} officerType true if detective, false if doctor
 * @return {Promise<MafiaPlayer> | null} The player chosen
 */
async function takeDMPoll(playerID, game, client, officerType) {
    try {
        //Alive players
        const alivePlayers = game.alivePlayers;

        // Fetch the officer user
        const officer = await client.users.fetch(playerID);

        // Create the options for the String Select Menu
        //If it's a detective, the options will be everyone but himself
        const options = (officerType
                ? alivePlayers.filter(player => player.id !== playerID)
                : alivePlayers
        ).map(player => ({
            label: player.displayName,
            value: player.id,
        }));

        // Build the Select Menu
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('mafia_vote')
            .setPlaceholder( (officerType)? "Choose a player to reveal if they're mafia:" : "Choose a player to save:" )
            .addOptions(options);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        // Send a DM to the officer
        const dmMessage = await officer.send({
            content: (officerType)
                ? "Detective, choose a player to reveal their association to the mafia.\nVoting ends in 15 seconds."
                : "Doctor, choose a player to save from the mafia. It can be yourself too.\nVoting ends in 15 seconds.",
            components: [row]
        });

        // Create a collector to listen for the player's selection
        const collector = dmMessage.createMessageComponentCollector({
            componentType: ComponentType.StringSelect,
            time: 30_000 // Voting period is 30 seconds
        });

        // Handle the vote
        return new Promise((resolve) => {
            collector.on('collect', async (menuInteraction) => {
                // Get the selected Mafia player ID
                const selectedPlayerId = menuInteraction.values[0];
                const selectedPlayer = alivePlayers.find(player => player.id === selectedPlayerId);

                // In the edge case where selectedPlayer doesn't exist
                if (!selectedPlayer) {
                    await menuInteraction.reply({
                        content: 'Invalid selection. Please try again next time.',
                        ephemeral: true,
                    });
                    resolve(null);
                    collector.stop();
                    return;
                }

                // Acknowledge the vote
                // If doctor
                if(!officerType) {
                    await menuInteraction.reply({
                        content: `You voted for ${selectedPlayer.displayName}.`,
                        ephemeral: true
                    });
                } else {
                    //If detective
                    await menuInteraction.reply({
                        content: (selectedPlayer.isMafia)
                            ? `**You voted for ${selectedPlayer.displayName}, who IS a Mafia.**`
                            : `**You voted for ${selectedPlayer.displayName}, who is NOT a Mafia.**`,
                        ephemeral: true
                    });
                }

                // Return the selected player
                resolve(selectedPlayer);
                collector.stop(); // Stop the collector after a valid vote
            });

            collector.on('end', async (_, reason) => {
                if (reason !== 'user') {
                    // No vote was made in time
                    await officer.send('**You didn’t vote in time!**');
                    resolve(null);
                }
            });
        });
    } catch (error) {
        console.error('Failed to send DM or process vote:', error);
        return null;
    }
}

/**
 * Takes a channel poll and returns the choice that was most voted for
 * @param {import('discord.js').GuildTextBasedChannel} channel The channel to post the poll in
 * @param {GameData} game A `GameData` reference object containing information for the game that's going on
 * @param {boolean} isMafiaPoll Whether the poll is a mafia poll or not (false by default -> townspeople vote)
 * @return {Promise<MafiaPlayer> | null} The mafia player that was most voted on, null if tied
 */
async function takeChannelPoll(channel, game, isMafiaPoll= false){
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
    //If mafia poll, then only townspeople are the options
    let options;
    if(isMafiaPoll) {
        options = alivePlayers.filter(player => !player.isMafia).map((player) => ({
            label: player.displayName,
            value: player.id
        }));
    } else {
        options = alivePlayers.map((player) => ({
            label: player.displayName,
            value: player.id
        }));
    }

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
            time: 20_000  //Voting lasts for 20 seconds or 20,000ms
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
            /**
             * The most voted player
             * @type {MafiaPlayer}
             */
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
            await channel.send({
                content: resultMessage,
                ephemeral: false
            });

            //Return either the most voted player, or null if it's a tie
            resolve(tie? null : mostVotedPlayer);
        });
    }
    );

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

    //Make sure the bot itself has access
    permOverwrites.push({
        id: guild.members.me.id, // Bot's ID
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
    });

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

/**
 * Updates the channel's permissions for the discussion phase in a Mafia game.
 * @param {import('discord.js').GuildTextBasedChannel} channel The text channel where the game is played.
 * @param {import('discord.js').Snowflake[]} playerIDs Array of player IDs participating in the game.
 * @param {import('discord.js').Snowflake[]} deadPlayerIDs Array of dead player IDs
 * @param {boolean} allowSendMessages Whether to allow or deny sending messages.
 */
async function updateChannelPermissions(channel, playerIDs, deadPlayerIDs, allowSendMessages) {
    try {
        // Loop through all players and update their permissions
        // Dead players will always not be able to send messages
        for (const playerID of playerIDs) {
            await channel.permissionOverwrites.edit(playerID, {
                [PermissionFlagsBits.SendMessages]: (deadPlayerIDs.includes(playerID))
                    ? false
                    : allowSendMessages
            });
        }

        console.log(`Successfully ${allowSendMessages ? 'allowed' : 'denied'} message permissions for players.`);
    } catch (error) {
        console.error('Error updating channel permissions:', error);
    }
}

/**
 * Kills the player
 * @param {MafiaPlayer} targetPlayer The player to kill
 * @param {GameData} game The game going on
 * @return {Promise<void>}
 */
async function killPlayer(targetPlayer, game){
    //Remove the target player from the alive players array based on his ID
    game.alivePlayers = game.alivePlayers.filter((pl) => pl.id !== targetPlayer.id);

    //Push his ID into the deadPlayerIDs array
    game.deadPlayerIDs.push(targetPlayer.id);
}

/**
 * Runs a whole round, starting from nighttime (mafia vote) and ending with daytime (townspeople vote)
 * @param {GameData} game The game currently going on
 * @param {import('discord.js').GuildTextBasedChannel} mainChannel The text channel where the game is played.
 * @param {import('discord.js').Guild} guild The guild object
 * @param {Client} client The client object
 * @return {Promise<void>}
 */
async function runRound(game, mainChannel, guild, client){
    //For each round, the game starts with nighttime (everyone is asleep)
    //Since everyone is asleep, nobody can send messages at the start of a round

    const allPlayerIDs = game.players.map(player => player.id);

    //Send the initial message at the start of a round
    await mainChannel.send({
        content: `\n\n**Round ${game.round} begins!**\nThe Mafia will now decide on their victim.\n`
    });

    //Pause for 5 seconds
    await pause(5);

    //Create a channel for the mafia
    const mafiaChannel = await createGameChannel(guild, game);

    //Pause for 5 seconds
    await pause(5);

    //Notify the mafia about discussion period
    await mafiaChannel.send({
        content: `Your discussion period has started! It will end in 1 minute and voting will begin.\n`,
        ephemeral: false
    });

    //Pause for 1 minute
    await pause(60);

    //Take away the mafia's send_message permissions
    await updateChannelPermissions(
        mafiaChannel,
        game.mafias.map(mafia => mafia.id),
        game.deadPlayerIDs,
        false
    );

    //Take the mafia poll
    const mafiaPollResult = await takeChannelPoll(mafiaChannel, game, true);

    //Pause for 2 seconds
    await pause(2);

    //Delete the mafia channel
    await mafiaChannel.delete();

    //Notify the townspeople of the vote ending
    await mainChannel.send({
        content: `The mafia vote has ended!`
    });

    //Wait 3 seconds
    await pause(3);

    //If there is a doctor, notify the townspeople and get the doctor's vote
    let doctorPollResult;
    if(game.doctor){
        await mainChannel.send({
            content: `The doctor will now decide on who to save.`
        });
        await pause(1);  //Pause for 1 second

        doctorPollResult = await takeDMPoll(game.doctor.id, game, client, false);

        await pause(3);
    }
    //If there is a detective, notify the townspeople and get the detective's vote
    if(game.detective){
        await mainChannel.send({
            content: `The detective will now investigate someone.`
        });
        await pause(1);  //Pause for 1 second

        await takeDMPoll(game.detective.id, game, client, true);
    }

    //Now that the polls are done, we have to give a statement to the public about the night

    //If the mafia chose someone
    if(mafiaPollResult){

        //If the doctor chose someone
        if(doctorPollResult){

            //If the doctor's choice and the mafia's choice is the same, nothing happens
            //Otherwise, the target dies.
            if(!(mafiaPollResult.id === doctorPollResult.id)){
                //Kill the player (RIP)
                await killPlayer(mafiaPollResult, game);

                //Make the statement (Mafia chose + doctor chose + doctor didn't save)
                await mainChannel.send({
                    content: `**During the night, the mafia chose ${mafiaPollResult.displayName} as their victim and were successful in killing them.**\nMay they rest in peace.`
                });
                await pause(5);  //Pause for 5 seconds
            } else if(mafiaPollResult.id === doctorPollResult.id) {
                //If the doctor's choice is the same as the mafia's choice

                //Make the statement (Mafia chose + doctor chose + doctor saved)
                await mainChannel.send({
                    content: `**During the night, the mafia chose their victim but were unable to kill them!**`
                });
                await pause(5);  //Pause for 5 seconds
            }

        }
        //If the doctor didn't choose someone but the mafia did
        else {
            //Kill the player (RIP)
            await killPlayer(mafiaPollResult, game);

            //Make the statement (Mafia chose + doctor didn't choose)
            await mainChannel.send({
                content: `**During the night, the mafia chose ${mafiaPollResult.displayName} as their victim and were successful in killing them.**\nMay they rest in peace.`
            });
            await pause(5);  //Pause for 5 seconds
        }

    }
    else {
        //Make the statement (Mafia didn't choose)
        await mainChannel.send({
            content: `**The sun rises on the town and everyone wakes up. No casualties tonight.**`
        });
        await pause(5);  //Pause for 5 seconds
    }

    //Talk about the discussion period
    await mainChannel.send({
        content: `\n\n**Discussion time will start in 3 seconds and will go for 3 minutes.**\n**You can discuss on who you think the mafia is, and then vote to have them executed.**`
    });
    await pause(3);  //Pause for 3 seconds

    //Start discussion (give them perms to talk)
    await updateChannelPermissions(
        mainChannel,
        allPlayerIDs,
        game.deadPlayerIDs,
        true
    );

    //DEVELOPMENT: MAKE DISCUSSION TIME 1 MIN INSTEAD OF 3 MIN
    await pause(60);  //Pause for 3 minutes

    //Take away talking perms
    await updateChannelPermissions(
        mainChannel,
        allPlayerIDs,
        game.deadPlayerIDs,
        false
    );

    //Take the townspeople vote
    const townspeopleVoteResult = await takeChannelPoll(mainChannel, game);
    await pause(1);

    //Results based on the vote
    //If townspeople could agree on a person
    if(townspeopleVoteResult){
        await killPlayer(townspeopleVoteResult, game);
        await mainChannel.send({
            content: (townspeopleVoteResult.isMafia)
                ? `\n\n**The townspeople voted, and thus ${townspeopleVoteResult.displayName} was executed.\nIt was later revealed that they were a mafia.**`
                : `\n\n**The townspeople voted, and thus ${townspeopleVoteResult.displayName} was executed.\nThey were not a mafia and will be missed by their family.**`
        });
    } else {
        //If they couldn't
        await mainChannel.send({
            content: `\n\n**The townspeople could not decide on who to execute, so everyone gets to live for today.**`
        });
    }

    //Everyone goes back to sleep
    await mainChannel.send({
        content: `\nAfter a long day of being lazy, the townspeople go back to sleep.\n`
    });
    await pause(5);

}

//runGame(game, client) will run a whole game using runRounds until there's a conclusion
/**
 * Runs a whole game of mafia using the runRound method until the win condition is met
 * @param {GameData} game The game to run
 * @param {Client} client The bot's client object
 * @param {import('discord.js').Guild} guild The guild object
 * @return {GameResult} The result of the game
 */
async function runGame(game, client, guild){
    //The main slash command file will call the runGame method after gameSetUp is done

    //1. Make the main channel
    const mainChannel = await createGameChannel(guild, game, false);

    //2. Put everyone to sleep there
    await updateChannelPermissions(
        mainChannel,
        game.players.map(player => player.id),
        game.deadPlayerIDs,
        false
    );

    //3. A loop will run until the game is over
    // - The mafias win if the number of alive mafias >= number of alive townspeople
    // - The townspeople win if the number of alive mafias === 0

    let aliveTownsPeopleAmount;
    let aliveMafiasAmount;

    while (true) {
        //Run a round
        await runRound(game, mainChannel, guild, client);
        //Pause a second
        await pause(1);
        //Update the conditions
        aliveTownsPeopleAmount = game.townspeople.filter(person => !game.deadPlayerIDs.includes(person.id)).length;
        aliveMafiasAmount = game.mafias.filter(mafia => !game.deadPlayerIDs.includes(mafia.id)).length;

        //Check the conditions to break the loop
        if(aliveMafiasAmount >= aliveTownsPeopleAmount){
            return new GameResult(true, game.mafias);
        } else if (aliveMafiasAmount === 0) {
            return new GameResult(false, game.townspeople);
        }

        //If none of the win conditions are met, the game will keep on going
        game.round = game.round + 1;
    }
}



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
                playerUsers = playerUsers.filter((u) => u.id !== intUser.id);

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
                // //DEVELOPMENT ONLY: Take a random person from the alive players and make them dead
                // const chosenDeadPlayer = game.alivePlayers.pop();
                // game.deadPlayerIDs.push(chosenDeadPlayer.id);

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
                    `
                })

                // //DEVELOPMENT ONLY: TEST VOTING HERE FIRST
                //
                // //Run a simple DM test for the detective
                // //Display the chosen person
                // await interaction.followUp({
                //     content: `The chosen person is ${(chosenPlayer)? chosenPlayer.displayName: '(None, there was a draw!)'}`
                // });



                resolve(game); // Resolve with the GameData object
            }
        });
    });

    }




module.exports = {
    gameSetUp,
    runGame
}