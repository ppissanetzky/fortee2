import assert from 'node:assert';
import _ from 'lodash';

import Player from './player';
import type {
    BidSubmitted, Draw, EndOfHand, EndOfTrick, GameOver, PlaySubmitted, StartingGame, TrumpSubmitted,
    YourBid, YourCall, YourPlay } from './outgoing-messages';
import { Bid , Bone, Trump } from './core';
import TableHelper from './table-helper';
import type { Strategy } from './strategies';

function random<T>(from: T[]): T {
    assert(from.length > 0);
    const result = _.sample(from);
    assert(result);
    return result;
}

export class BasePlayer implements Player {

    private readonly strategies: Strategy[] = [];

    public readonly name: string;

    public table?: TableHelper;
    public bones: Bone[] = [];
    public bids: BidSubmitted[] = [];
    public winningBid?: BidSubmitted;
    public trump?: Trump;
    public trick: PlaySubmitted[] = [];
    public pile: PlaySubmitted[][] = [];

    constructor(name: string) {
        this.name = name;
    }

    /** Add a strategy */

    with(strategy: Strategy): this {
        this.strategies.push(strategy);
        return this;
    }

    /** The lead play, unless we're leading in which case it is undefined */

    get lead(): PlaySubmitted | undefined {
        const [ lead ] = this.trick;
        return lead;
    }

    get leading(): boolean {
        return this.lead ? false : true;
    }

    /** Returns all bones played up to now, EXCLUDING the current trick */

    get played(): Bone[] {
        return _.flatten(this.pile).map(({bone}) => bone);
    }

    /**
     * Returns all the bones that have not been played and are also not
     * in the 'exclude' array.
     */

    remaining(exclude: Bone[] = []): Bone[] {
        return _.difference(Bone.ALL, this.played, exclude);
    }

    // #region Player protocol

    startingGame({ table } : StartingGame ): void {
        this.table = new TableHelper(this.name, table);
    }

    startingHand(): Promise<void> {
        this.bones = [];
        this.bids = [];
        this.winningBid = undefined;
        this.trump = undefined;
        this.trick = [];
        this.pile = [];
        return Promise.resolve();
    }

    draw({ bones } : Draw): void {
        this.bones = bones;
    }

    waitingForBid(): void { void 0 }

    async bid({ possible } : YourBid): Promise<Bid> {
        for (const strategy of this.strategies) {
            if (strategy.bid) {
                const bid = await strategy.bid(this, possible);
                if (bid) {
                    return bid;
                }
            }
        }
        return random(possible);
    }

    bidSubmitted(msg : BidSubmitted): void {
        this.bids.push(msg);
    }

    reshuffle(): void {
        this.bones = [];
        this.bids = [];
    }

    bidWon(msg : BidSubmitted): void {
        this.winningBid = msg;
    }

    waitingForTrump(): void { void 0 }

    async call({ possible } : YourCall): Promise<Trump> {
        for (const strategy of this.strategies) {
            if (strategy.call) {
                const trump = await strategy.call(this, possible);
                if (trump) {
                    return trump;
                }
            }
        }
        return random(possible);
    }

    trumpSubmitted({ trump } : TrumpSubmitted): void {
        this.trump = trump;
    }

    waitingForPlay(): void { void 0}

    async play({ possible } : YourPlay): Promise<Bone> {
        for (const strategy of this.strategies) {
            if (strategy.play) {
                const bone = await strategy.play(this, possible);
                if (bone) {
                    return bone;
                }
            }
        }
        return random(possible);
    }

    playSubmitted(msg : PlaySubmitted): void {
        this.trick.push(msg);
    }

    async endOfTrick(msg: EndOfTrick): Promise<void> {
        this.pile.push(this.trick);
        this.trick = [];
    }

    async endOfHand(msg: EndOfHand): Promise<void> { void 0 }

    gameOver(msg: GameOver): void { void 0 }

    // #endregion
}

// async endOfTrick({ winner, points, status } : EndOfTrick): Promise<void> {
//     // this.debug(winner,
//     //     'won the trick with', points, `point${points === 1 ? '' : 's'}`);
//     // this.debug('US', status.US.points, 'THEM', status.THEM.points);
// }

// async endOfHand({ winner, made, status } : EndOfHand): Promise<void> {
//     // this.debug('hand over');
//     // this.debug(winner, made ? 'made the bid' : 'set');
//     // this.debug('US', status.US.marks, 'marks',
//     //     ':', 'THEM', status.THEM.marks, 'marks');
// }

// gameOver({ status } : GameOver): void {
//     // this.debug('game over');
//     // this.debug(status);
// }
