const { MafiaPlayer } = require('./mafia-player');

/**
 * Represents a game
 */
class GameData {
    /**
     * Creates a game of Mafia from an array of `User` objects
     * @param {import('discord.js').User[]} players An array of users who signed up to play the game
     */
    constructor(players) {
        /**
         * Array of all the players in the game, achieved by creating a MafiaPlayer object from each User who signed up
         * @type {MafiaPlayer[]}
         */
        this.players = players.map(player => new MafiaPlayer(player));

        // Game roles
        /**
         * Array of MafiaPlayer objects who are not Mafias
         * @type {MafiaPlayer[]}
         */
        this.townspeople = [];

        /**
         * Array of MafiaPlayer objects who are Mafias
         * @type {MafiaPlayer[]}
         */
        this.mafias = [];

        /**
         * The MafiaPlayer object for the Detective
         * @type {MafiaPlayer}
         */
        this.detective = null;

        /**
         * The MafiaPlayer object for the Doctor
         * @type {MafiaPlayer}
         */
        this.doctor = null;

        // Additional game properties
        this.round = 1; // Keep track of the game round
        this.isNight = false; // Whether it's currently night phase
    }

    // Method to assign roles
    assignRoles() {
        /**
         * @type {MafiaPlayer[]}
         */
        const shuffledPlayers = this.shuffleArray([...this.players]); // Shuffle players for random role assignment

        const numOfPlayers = shuffledPlayers.length;  // Number of players in the game

        /*
        Role assignment criteria:
        - 1 Mafia per 4 people
        - 1 Detective for 6+ people
        - 1 Doctor for 8+ people
         */
        const numOfMafias = Math.max(1, Math.floor(numOfPlayers / 4));

        //Assign the mafia role to the last x members where x is numOfMafias
        this.mafias = shuffledPlayers.splice(-numOfMafias);
        for(let m of this.mafias){
            m.isMafia = true;
        }

        //Assign the non-mafia members
        this.townspeople = [...shuffledPlayers];

        //Assign detective
        if(numOfPlayers >= 6){
            //Assign doctor
            if(numOfPlayers >= 8){
                this.doctor = shuffledPlayers.at(-2);
            }
            this.detective = shuffledPlayers.at(-1);
        }
    }

    // Utility to shuffle an array using the Fisher-Yates Shuffle
    shuffleArray(array) {
        const copiedArray = [...array]; // Create a shallow copy of the array
        for (let i = copiedArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [copiedArray[i], copiedArray[j]] = [copiedArray[j], copiedArray[i]];
        }
        return copiedArray;
    }
}

module.exports = {
    GameData
}
