//The preliminary checks needed before starting a game of Mafia in the server

const { PermissionsBitField } = require('discord.js');

/**
 * Check if the bot has the needed permissions at the channel and guild levels
 * @param {import('discord.js').Guild} guild The guild object of the server containing the interaction
 * @param {import('discord.js').GuildTextBasedChannel} channel The channel object of the channel containing the interaction
 * @returns {Promise<string[]>} A `string` array of error messages for missing permissions, one string for each channel and guild permissions (2 strings max)
 */
async function checkBotPermissions(guild, channel) {

    /**
     * The Array of error messages
     * @type {string[]}
     */
    let errorMessages = [];

    //The bot's member object in the server
    const botMember = guild.members.me;

    //Check channel level permissions
    const requiredChannelPermissions = [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.ManageMessages
    ];
    const botChannelPermissions = channel.permissionsFor(botMember);
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
 * @param {import('discord.js').GuildMember | APIInteractionGuildMember} member The member object of the command caller
 * @returns {Promise<boolean>} `true` if the user has the permission, `false` if not
 */
async function checkUserPermission(member) {
    //Checking if they have the permission
    const hasManageChannels = member.permissions.has(PermissionsBitField.Flags.ManageChannels);

    return hasManageChannels;
}

/**
 * Check if the game channel already exists
 * @param {import('discord.js').Guild} guild The guild object of the server containing the interaction
 * @returns {Promise<boolean>} `true` if game channel already exists, `false` otherwise
 */
async function gameChannelAlreadyExists(guild) {
    //The target channel name is "tb-mafia-bot-game"
    const targetName = "tb-mafia-bot-game";

    //All channels in the server
    const channels = await guild.channels.fetch();

    //Search for a channel with the target name
    const copycatChannel = channels.find(ch => ch.name === targetName);

    return !!(copycatChannel);
}

/**
 * Run a series of preliminary checks before the game is run
 * @param {import('discord.js').ChatInputCommandInteraction} interaction The interaction object
 * @returns {Promise<boolean>} `true` if there was a problem, `false` if there wasn't
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
    if(!(await checkUserPermission(interaction.member))){
        await interaction.reply({
            content: 'In order to start a game, you need to have the `Manage Channels` permission.',
            ephemeral: true
        });
        return true;
    }

    //Check if the bot itself has sufficient permissions on the channel and guild/server levels
    const permissionErrorMessages = await checkBotPermissions(interaction.guild, interaction.channel);
    if(!(permissionErrorMessages.length === 0)){
        await interaction.reply({
            content: `${permissionErrorMessages.join('\n')}`,
            ephemeral: true
        });
        return true;
    }

    //Check if the game channel already exists
    //(i.e. there's a game going on already or the server just has a channel with that name)
    if((await gameChannelAlreadyExists(guild))){
        await interaction.reply({
            content: `
There cannot be a channel named "tb-mafia-bot-game" in your server.
Please use the \`/info\` command for more information.
            `,
            ephemeral: true
        });
        return true;
    }

    return false;
}

module.exports = {
    preliminaryChecks
}