import type { Bone, Trump, Bid } from './core';
import type { Team, Status } from './driver';

export interface OutgoingGlobalMessages {

    /**
     * When the user connects to the server
     */

    welcome: {
        /**
         * Your name
         */

        youAre: string;

        /**
         * If the user is hosting a game room, this will be the ID
         */

        hosting?: number;

        /**
         * The IDs of all the game rooms this user has been invited to
         */

        invited: number[];
    };
}

export interface RoomUpdate {
    full: boolean;
    started: boolean;
    players: string[];
    bots: string[];
}

export interface OutgoingGameRoomMessages {

    /**
     * Tell the user that just entered a game room, and give them
     * details about the room.
     */

    youEnteredGameRoom: RoomUpdate;

    /**
     * Whe someone enters the room, update
     */

    enteredGameRoom: RoomUpdate;

    /**
     * Tell everyone else this user has left
     */

    leftGameRoom: RoomUpdate & {
        name: string;
    }
}

export interface GameMessages {
    /**
     * A new hand is about to start, just notifies all the players
     * and it actually starts when they reply.
     */

    startingHand: null; /** Promise<void> */

    /**
     * Tells each player the bones they drew once the hand starts
     * or after a reshuffle
     */

    draw: { bones: Bone[]; };

    /**
     * Waiting on someone else to bid, doesn't require ack
     */

    waitingForBid: { from: string; };

    /**
     * Wait for this player to bid, one the possible bids
     */

    bid: { possible: Bid[]; }; /** Promise<Bid> */

    /**
     * A player has bid
     */

    bidSubmitted: { from: string; bid: Bid; };

    /**
     * Everyone passed, so we are going to reshuffle
     */

    reshuffle: null;

    /**
     * A player has won the bid
     */

    bidWon: { winner: string; bid: Bid; };

    /**
     * Waiting for someone else to call trumps
     */

    waitingForTrump: { from: string; };

    /**
     * This player calls trumps
     */

    call: { possible: Trump[]; }; /** Promise<Trump> */

    /**
     * A player called trumps
     */

    trumpSubmitted: { from: string; trump: Trump; };

    /**
     * Waiting for someone else to play
     */

    waitingForPlay: { from: string; };

    /**
     * This player plays a bone
     */

    play: { possible: Bone[]; }; /** Promise<Bone> */

    /**
     * Someone played a bone
     */

    playSubmitted: { from: string; bone: Bone; };

    /**
     * A trick is over
     */

    endOfTrick: { winner: string; points: number; status: Status; };

    /**
     * A hand is over. Will arrive right after endOfTrick
     */

    endOfHand: { winner: Team; made: boolean; status: Status; };

    /**
     * The game is over, will arrive right after endOfHand
     */

    gameOver: { status: Status; };
}

export type OutgoingMessages =
    OutgoingGlobalMessages &
    OutgoingGameRoomMessages &
    GameMessages;
