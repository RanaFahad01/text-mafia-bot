const { User } = require('discord.js');

/**
 * Represents a Mafia player in the game
 * @extends User The User class in discordJS
 */
class MafiaPlayer extends User {
    /**
     * Creates a new Mafia Player from a User object
     * @param {User} user The User object
     * @param {boolean} isMafia Whether it's a mafia or not
     */
    constructor(user, isMafia = false) {
        super(user.client, user); // Pass the user object and client to the parent class
        this.isMafia = isMafia; // Add the custom property
    }
}

module.exports = {
    MafiaPlayer
}