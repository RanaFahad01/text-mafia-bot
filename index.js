//Make your own config/config.json file and add the token there
//config.json is in the .gitignore so that we don't push the token to the repo by accident
const { token } = require("config/config.json");
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

client.on('ready', (client) => {
    console.log(`${client.user.username} is online.`);
});

client.login(token);
