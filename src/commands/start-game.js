const {SlashCommandBuilder, PermissionsBitField} = require("discord.js");

/**
 * Check if the bot has the needed permissions at the channel and guild levels
 * @param interaction The interaction object
 * @returns {Promise<string[]>} A string array of error messages for missing permissions, one string for each channel and guild permissions (2 strings max)
 */
async function checkBotPermissions(interaction) {

    /**
     * The Array of error messages
     * @type {string[]}
     */
    let errorMessages = [];

    //The bot's member object in the server
    const botMember = interaction.guild.members.me;

    //Check channel level permissions
    const requiredChannelPermissions = [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.ManageMessages
    ];
    const botChannelPermissions = interaction.channel.permissionsFor(botMember);
    const missingChannelPermissions = requiredChannelPermissions.filter(perm => !botChannelPermissions.has(perm));
    if(missingChannelPermissions.length > 0) {
        errorMessages.push(
            `I am missing these permissions in this channel: ${
                missingChannelPermissions.map(p =>
                    Object.keys(PermissionsBitField.Flags).find(key => PermissionsBitField.Flags[key] === p)
                ).join(', ')
            }`
        );
    }

    //Check server/guild level permissions
    const requiredGuildPermissions = [
        PermissionsBitField.Flags.ManageRoles,
        PermissionsBitField.Flags.ManageChannels
    ];
    const missingGuildPermissions = requiredGuildPermissions.filter(perm => !botMember.permissions.has(perm));
    if(missingGuildPermissions.length > 0) {
        // errorMessages.push(
        //     `I am missing these permissions in this server: ${
        //         missingGuildPermissions.map(p => `\`${p}\``).join(', ')
        //     }`
        // );
        errorMessages.push(
            `I am missing these permissions in this server: ${
                missingGuildPermissions.map(p =>
                    Object.keys(PermissionsBitField.Flags).find(key => PermissionsBitField.Flags[key] === p)
                ).join(', ')
            }`
        );
    }

    //For debugging - print all the errorMessages before returning them
    // for(let msg of errorMessages){
    //     console.log(msg);
    // }

    //Return the error messages
    return errorMessages;
}

/**
 * Check if the command user has the "Manage Channels" permission in the guild/server
 * @param interaction The interaction object
 * @returns {Promise<boolean>} true if the user has the permission, false if not
 */
async function checkUserPermission(interaction) {
    //Member object of the user
    const member = interaction.member;

    //Checking if they have the permission
    const hasManageChannels = member.permissions.has(PermissionsBitField.Flags.ManageChannels);

    return hasManageChannels;
}

/**
 * Run a series of preliminary checks before the game is run
 * @param interaction The interaction object
 * @returns {Promise<boolean>} true if there was a problem, false if there wasn't
 */
async function preliminaryChecks(interaction) {
    //Check if the command is being called from a DM
    const guild = interaction.guild;
    if(!guild) {
        await interaction.reply({
            content: 'This command can only be used in a server.',
            ephemeral: true
        });
        return true;
    }

    //Check if the user calling the command has the "Manage Channels" permission
    if(!(await checkUserPermission(interaction))){
        await interaction.reply({
            content: 'In order to start a game, you need to have the "Manage Channels" permission.',
            ephemeral: true
        });
        return true;
    }

    //Check if the bot itself has sufficient permissions on the channel and guild/server levels
    const permissionErrorMessages = await checkBotPermissions(interaction);
    if(!(permissionErrorMessages.length === 0)){
        await interaction.reply({
            content: `${permissionErrorMessages.join('\n')}`,
            ephemeral: true
        });
        return true;
    }

    return false;
}





module.exports = {
    //Basic command info
    data: new SlashCommandBuilder()
        .setName('start-mafia-game')
        .setDescription('Start a game of mafia!'),

    /**
     * This docstring gives intellisense for the interaction object
     * @param {import('commandkit').SlashCommandProps} param0
     */
    run: async ({interaction, client, handler}) => {

        //Run preliminary checks
        const preliminaryChecksResult = await preliminaryChecks(interaction);
        if(preliminaryChecksResult){
            return; //Cut the interaction short if there's a problem and my checker method has already replied to the interaction
        }

        //Todo: Continue development from here
        await interaction.reply({
            content: "Hello!"
        });

    }
}