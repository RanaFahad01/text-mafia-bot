const {SlashCommandBuilder} = require("discord.js");
module.exports = {
    //Basic command info
    data: new SlashCommandBuilder().setName('info').setDescription('Display info about Text-Based Mafia Bot'),

    run: async ({interaction, client, handler}) => {
        //NOTE: Don't mess with the indentation!
        //I know it looks ugly but the discord parser messes up if there's any unnecessary indentation
        return interaction.reply({
            content: `## The Text-Based Mafia Bot
Play a game of mafia right in the comfort of your discord server, without the need for voice chat!

### Requirements to run the \`start-mafia-game\` command:
- The user calling the command must have the \`Manage Channels\` permission.
- A game of mafia can have a maximum of 10 players
- There cannot be two games of Mafia in progress at the same time in the same server.
- There must not be another channel named \`tb-mafia-bot-game\` in the server. Either there's a game already going on, or you need to rename that channel.
- The bot must have these permissions at the channel level:
  - \`View Channel\`
  - \`Send Messages\`
  - \`Manage Messages\`
- The bot must have these permissions at the server level:
  - \`Manage Roles\`
  - \`Manage Channels\``,
            ephemeral: true,
        });

    }
}