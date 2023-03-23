
import type { Bid, Trump, Bone } from './core';

export interface UserMessages {

    /**
     * When a user wants to create and host a game *
     */

    createGame: object;
}

export interface GameRoomMessages {

    /**
     * The host invites bot(s) to the game room
     */

    inviteBot: {
        fillRoom: boolean;
    }

    /**
     * The host starts the game
     */

    startGame: null

    /**
     * A user is ready to start the hand
     */

    readyToStartHand: null,

    /**
     * A user submits their bid
     */

    submitBid: {
        bid: Bid
    }

    /**
     * A user calls trump
     */

    callTrump: {
        trump: Trump;
    }

    /**
     * A user plays a bone
     */

    playBone: {
        bone: Bone;
    }
}

export type IncomingMessages = UserMessages & GameRoomMessages;
