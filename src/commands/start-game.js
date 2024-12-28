const { SlashCommandBuilder } = require('discord.js');

//The checks needed to do before starting a game
const { preliminaryChecks } = require('../utility/start-game/start-game-pre-checks');
//Other functions used in this command
const { gameSetUp } = require('../utility/start-game/start-game-utils');

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

        //Set up the game
        const game = await gameSetUp(interaction);
        //Cut the interaction short if there's not enough players
        if(!game){
            return;
        }

        //TODO: Continue the game logic from here

    }
}