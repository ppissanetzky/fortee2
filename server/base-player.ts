import assert from 'node:assert';
import _ from 'lodash';

import Player from './player';
import type {
    BidSubmitted, Draw, EndOfHand, EndOfTrick, GameOver, PlaySubmitted, StartingGame, TrumpSubmitted,
    YourBid, YourCall, YourPlay } from './outgoing-messages';
import { Bid , Bone, Trump } from './core';
import TableHelper from './table-helper';
import type { Strategy } from './strategies';
import { Debugger, makeDebug } from './utility';

function random<T>(from: T[]): T {
    assert(from.length > 0);
    const result = _.sample(from);
    assert(result);
    return result;
}

export class BasePlayer implements Player {

    public readonly debug: Debugger;

    public strategies: Strategy[] = [];

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
        this.debug = makeDebug(this.name);
    }

    /** Add a strategy */

    with(...strategies: Strategy[]): this {
        strategies.forEach((strategy) => this.strategies.push(strategy));
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
     * This is a list of all POSSIBLE bones this player may have, given
     * our knowledge: the pile, our hand and any time this player didn't
     * follow suit
     */

    has(name: string): Bone[] {
        assert(this.table?.players.includes(name));
        const { trump } = this;
        assert(trump);
        /** Start with all the bones that we have not seen yet */
        let has = this.remaining();
        /** Now, look at each trick where this player followed */
        for (const trick of this.pile) {
            const [lead] = trick;
            /** If this player was the lead, we cannot learn anything */
            if (lead.from === name) {
                continue;
            }
            /** Find what this player played */
            const played = trick.find((play) => play.from === name);
            /** In the case of Nello, this player may not have played */
            if (!played) {
                continue;
            }
            /**
             * If their play was not in the same suit as the lead,
             * we can remove all bones in the same suit */
            if (!played.bone.is_same_suit(lead.bone, trump)) {
                this.debug(name, 'did not follow', lead.bone.toString());
                has = has.filter((bone) =>
                    !bone.is_same_suit(lead.bone, trump));
            }
        }
        return has;
    }

    deepRemaining(): Bone[] {
        const { lead, table } = this;
        assert(table);
        /** The list of players that will play after me */
        const after = table.after(lead?.from || this.name);
        if (after.length === 0) {
            return this.remaining();
        }
        return after.reduce((result, name) =>
            _.union(result, this.has(name)), [] as Bone[]);
    }

    /**
     * Returns all the bones that have not been played, are not in my hand,
     * and are also not in the 'exclude' array.
     */

    remaining(exclude: Bone[] = []): Bone[] {
        return _.difference(Bone.ALL, this.bones, this.played, exclude);
    }

    // #region Player protocol

    startingGame({ table } : StartingGame ): void {
        this.table = new TableHelper(this.name, table);
    }

    async startingHand(): Promise<void> {
        this.bones = [];
        this.bids = [];
        this.winningBid = undefined;
        this.trump = undefined;
        this.trick = [];
        this.pile = [];
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
                    this.debug.extend(strategy.name)('bid', bid.toString());
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
                    this.debug.extend(strategy.name)('called', trump.toString());
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
                    this.debug.extend(strategy.name)('played', bone.toString());
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
        msg;
        this.pile.push(this.trick);
        this.trick = [];
    }

    async endOfHand(msg: EndOfHand): Promise<void> {
        msg;
    }

    gameOver(msg: GameOver): void {
        msg;
    }

    // #endregion
}
