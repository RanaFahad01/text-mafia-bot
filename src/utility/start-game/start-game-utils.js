//Utility functions used in the start-game command

const {
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    ComponentType,
    PermissionFlagsBits,
    ChannelType
} = require('discord.js');

/**
 * Send the initial message and collect users who sign up for the game
 * @param {import('discord.js').ChatInputCommandInteraction} interaction The interaction object
 * @returns {Promise<User[]>} An array of User objects - one for each user who signed up
 */
async function collectUsers(interaction){
    /**
     * The users who signed up
     * @type {User[]}
     */
    let chosenUsers = [];

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

    //TODO: Continue development from here
}

module.exports = {
    collectUsers
}