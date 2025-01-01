const { SlashCommandBuilder } = require('discord.js');

//The checks needed to do before starting a game
const { preliminaryChecks } = require('../utility/start-game/start-game-pre-checks');
//Other functions and classes used in this command
const { gameSetUp, runGame } = require('../utility/start-game/start-game-utils');
const { GameResult } = require('../utility/start-game/classes/game-data')
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

        //Run the game
        const gameResult = await runGame(game, interaction.client, interaction.guild);

        //Process and post the results
        const winningTeam = (gameResult.winnerTeam)? 'mafia': 'townspeople';
        const mentions = gameResult.winners.map(winner => `<@${winner.id}>`).join('\n');
        await interaction.followUp({
            content: `The game was won by the ${winningTeam}! The member(s) of the winning team are:\n${mentions}`,
            ephemeral: false
        });

    }
}