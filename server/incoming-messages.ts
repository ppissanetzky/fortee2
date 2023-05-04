
import type { Bid, Trump, Bone } from './core';

export interface GameRoomMessages {

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

export type IncomingMessages = GameRoomMessages;
