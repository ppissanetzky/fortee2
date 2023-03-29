
import type { Bid, Trump, Bone } from './core';

export interface UserMessages {

    /**
     * When a user wants to join a game room.
     * 'token' is the game room token
     */

    joinGame: {
        token: string;
    }

}

export interface GameRoomMessages {

    /**
     * The host invites bot(s) to the game room
     */

    inviteBot: {
        fillRoom: boolean;
        fastAF?: boolean;
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

    /**
     * After a trick or hand are over, the player acknowledges
     */

    readyToContinue: null
}

export type IncomingMessages = UserMessages & GameRoomMessages;
