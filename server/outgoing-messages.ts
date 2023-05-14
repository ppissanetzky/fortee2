import type { Bone, Trump, Bid , Rules} from './core';
import type { Team, Status } from './driver';
import type { ChatMessage } from './game-room';
import type { GameState } from './game-state';
import User from './users';

export interface OutgoingGlobalMessages {

    /**
     * When the user connects to the server
     */

    welcome: {
        /** Your name */
        youAre: string;
        /** Your user */
        you: User;
    };
}

export interface RoomUpdate {
    hosting: boolean;
    full: boolean;
    started: boolean;
    paused: boolean;
    players: string[];
    bots: string[];
    /** The list of user names that have a socket - are connected */
    connected: string[];
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

    /** A user declined the invitation */

    declined: {
        id: string;
        name: string;
    }

    /** Chat messages */

    chat: ChatMessage[];

    /** State of the game */

    gameState: GameState;
}

export interface StartingGame {
    table: string[];
    rules: Rules;
    /** An array of descriptive rule parts */
    desc: string[];
}

export interface Draw {
    bones: Bone[];
}

export interface Waiting {
    from: string;
}

export interface YourBid {
    possible: Bid[];
}

export interface BidSubmitted {
    from: string;
    bid: Bid;
}

export interface YourCall {
    possible: Trump[];
}

export interface TrumpSubmitted {
    from: string;
    trump: Trump;
}

export interface YourPlay {
    possible: Bone[];
    all: Bone[];
}

export interface PlaySubmitted {
    from: string;
    bone: Bone;
}

export interface EndOfTrick {
    winner: string;
    points: number;
    status: Status;
}

export interface EndOfHand {
    winner: Team;
    made: boolean;
    status: Status;
}

export interface GameOver {
    status: Status;
}

export interface GameError {
    error?: string;
}

export interface GameIdle {
    time: number;
    idle: string;
    expiresIn: string;
}

export interface GameMessages {
    /**
     * The table, sent once when the game is started
     */
    startingGame: StartingGame;

    /**
     * A new hand is about to start, just notifies all the players
     * and it actually starts when they reply.
     */

    startingHand: null; /** Promise<void> */

    /**
     * Tells each player the bones they drew once the hand starts
     * or after a reshuffle
     */

    draw: Draw;

    /**
     * Waiting on someone else to bid, doesn't require ack
     */

    waitingForBid: Waiting;

    /**
     * Wait for this player to bid, one the possible bids
     */

    bid: YourBid; /** Promise<Bid> */

    /**
     * A player has bid
     */

    bidSubmitted: BidSubmitted;

    /**
     * Everyone passed, so we are going to reshuffle
     */

    reshuffle: null;

    /**
     * A player has won the bid
     */

    bidWon: BidSubmitted;

    /**
     * Waiting for someone else to call trumps
     */

    waitingForTrump: Waiting;

    /**
     * This player calls trumps
     */

    call: YourCall; /** Promise<Trump> */

    /**
     * A player called trumps
     */

    trumpSubmitted: TrumpSubmitted;

    /**
     * Waiting for someone else to play
     */

    waitingForPlay: Waiting;

    /**
     * This player plays a bone
     */

    play: YourPlay; /** Promise<Bone> */

    /**
     * Someone played a bone
     */

    playSubmitted: PlaySubmitted;

    /**
     * A trick is over
     */

    endOfTrick: EndOfTrick;

    /**
     * A hand is over. Will arrive right after endOfTrick
     */

    endOfHand: EndOfHand;

    /**
     * The game is over, will arrive right after endOfHand
     */

    gameOver: GameOver;

    /**
     * There was an error during the game, it is not playable
     * any more
     */

    gameError: GameError;

    /**
     * The game has been idle and may expire soon, or if time === 0 it is no
     * longer idle.
     */

    gameIdle: GameIdle;
}

export type OutgoingMessages =
    OutgoingGlobalMessages &
    OutgoingGameRoomMessages &
    GameMessages;
