//Make your own src/.env file and add the token there
//The .env file is in the .gitignore so that the developer doesn't push the token to the repo by accident
require('dotenv').config();
const { Client,
    GatewayIntentBits } = require('discord.js');

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

client.login(process.env.TOKEN);
