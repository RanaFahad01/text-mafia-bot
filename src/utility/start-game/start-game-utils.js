//Utility functions used in the start-game command

const {
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    ComponentType,
    PermissionFlagsBits,
    ChannelType
} = require('discord.js');

const { MafiaPlayer } = require('./classes/mafia-player');
const { GameData } = require('./classes/game-data');

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
                    playerUsers.push(intUser);
                    await btnInteract.reply({
                        content: 'You are now in the lobby!',
                        ephemeral: true,
                    });
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
                const townspeople = game.townspeople.map(p => p.username).join(', ');
                const mafias = game.mafias.map(p => p.username).join(', ');
                const detective = game.detective?.username;
                const doctor = game.doctor?.username;
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

                resolve(game); // Resolve with the GameData object
            }
        });
    });

    }




module.exports = {
    gameSetUp
}