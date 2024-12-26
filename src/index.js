//Make your own src/.env file and add the token there
//The .env file is in the .gitignore so that the developer doesn't push the token to the repo by accident

require('dotenv').config();
const {
    Client,
    GatewayIntentBits
} = require('discord.js');

//The CommandKit library handles event and command handling/loading for us
const { CommandKit } = require('commandkit');

const { join } = require('node:path');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessagePolls
    ],
});
/*
   Excluded, but I might need them in the future:
           GatewayIntentBits.GuildMembers,
           GatewayIntentBits.MessageContent
*/

//Initialize CommandKit
new CommandKit({
    client,
    eventsPath: join(__dirname, 'events'),
    commandsPath: join(__dirname, 'commands'),
    bulkRegister: true
});

//Log the bot in with the token
client.login(process.env.TOKEN);
