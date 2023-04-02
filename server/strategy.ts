import assert from 'node:assert';
import _ from 'lodash';

import type { BasePlayer } from './base-player';
import { Bid, Trump, Bone } from './core';
import { makeDebug, Debugger } from './utility';
import TableHelper from './table-helper';
import type { BidSubmitted, PlaySubmitted } from './outgoing-messages';

function expected<T>(value: T): NonNullable<T> {
    assert(value);
    return value;
}

function random<T>(from: T[]): T {
    assert(from.length > 0);
    return expected(_.sample(from));
}

class State {

    protected readonly player: BasePlayer;

    public debug: Debugger;

    constructor(player: BasePlayer) {
        this.player = player;
        this.debug = makeDebug(player.name);
    }

    for(name: string): this {
        this.debug = makeDebug(this.name).extend(name);
        return this;
    }

    get name(): string {
        return this.player.name;
    }

    get table(): TableHelper {
        return expected(this.player.table);
    }

    get bones(): Bone[] {
        return this.player.bones;
    }

    get bids(): BidSubmitted[] {
        return this.player.bids;
    }
}

class BidState extends State {
    readonly possible: Bid[];

    constructor(player: BasePlayer, possible: Bid[]) {
        super(player);
        this.possible = possible;
    }
}

class CallState extends State {
    readonly possible: Trump[];

    constructor(player: BasePlayer, possible: Trump[]) {
        super(player);
        this.possible = possible;
    }

    get winningBid(): BidSubmitted {
        return expected(this.player.winningBid)
    }
}

class PlayState extends State {

    readonly possible: Bone[];

    /** All bones played up to now, EXCLUDING the current trick */

    readonly played = _.flatten(this.pile).map(({bone}) => bone);

    /**
     * All the bones that have not been played and are not in my hand.
     * Also, excludes any bones we know following players don't have
     */

    readonly remaining;

    constructor(player: BasePlayer, possible: Bone[]) {
        super(player);
        this.possible = possible;

        /** Everyone that is playing after me */
        const after = this.table.after(this.lead?.from || this.name);

        /** If there is no one playing after me, we can't do better */
        if (after.length === 0) {
            this.remaining = _.difference(Bone.ALL, this.bones, this.played);
        }
        /** Otherwise, take into account any time they haven't followed suit */
        else {
            this.remaining = after.reduce((result, name) =>
                _.union(result, this.has(name)), [] as Bone[]);
        }
    }

    get trump(): Trump {
        return expected(this.player.trump);
    }

    get trick(): PlaySubmitted[] {
        return this.player.trick;
    }

    get pile(): PlaySubmitted[][] {
        return this.player.pile;
    }

    /** The lead play, unless we're leading in which case it is undefined */

    get lead(): PlaySubmitted | undefined {
        const [ lead ] = this.trick;
        return lead;
    }

    /** Whether we're leading or not */

    get leading(): boolean {
        return this.lead ? false : true;
    }

    /** Just the bones in the current trick */

    get trickBones(): Bone[] {
        return this.trick.map(({bone}) => bone);
    }

    /**
     * This is a list of all POSSIBLE bones this player may have, given
     * our knowledge: the pile, our hand and any time this player didn't
     * follow suit
     */

    has = function(this: PlayState, name: string): Bone[] {
        assert(this.table.players.includes(name));
        const { trump } = this;
        /** Start with all the bones that we have not seen yet */
        let has = _.difference(Bone.ALL, this.bones, this.played);
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
    .bind(this);

    /**
     * A helper to figure out all the bones in 'possible' that can beat all the
     * bones in 'against'
     */

    unbeatable = function(this: PlayState, against: Bone[], possible: Bone[]): Bone[] {
        const { trump, lead } = this;
        /** The highest value of all bones in 'against' */
        const value = Bone.highestValue(trump, against, lead?.bone);
        /** This happens if 'against' is empty, which is probably a bug */
        if (value < 0) {
            return [];
        }
        return possible.filter((bone) =>
            bone.value(lead?.bone || bone, trump, true) >= value);
    }
    .bind(this);
}

interface Impl {
    bid?: (state: Readonly<BidState>) => Bid | void;
    call?: (state: Readonly<CallState>) => Trump | void;
    play?: (state: Readonly<PlayState>) => Bone | void;
}

export default class Strategy {

    public readonly name: string;

    private readonly impl: Impl;

    public constructor(name: string, impl: Impl) {
        this.name = name;
        this.impl = impl;
    }

    bid(state: BidState): Bid | void {
        return this.impl.bid?.(state.for(this.name));
    }

    call(state: CallState): Trump | void {
        return this.impl.call?.(state.for(this.name));
    }

    play(state: PlayState): Bone | void {
        return this.impl.play?.(state.for(this.name));
    }
}

export class Strategies {

    private readonly strategies: Strategy[];

    constructor(...strategies: Strategy[]) {
        this.strategies = [...strategies];
    }

    add(...strategies: Strategy[]): void {
        for (const strategy of strategies) {
            this.strategies.push(strategy);
        }
    }

    async bid(player: BasePlayer, possible: Bid[]): Promise<Bid> {
        const state = new BidState(player, possible);
        for (const strategy of this.strategies) {
            const bid = strategy.bid(state);
            if (bid) {
                state.debug('bid', bid.toString());
                return bid;
            }
        }
        const bid = random(possible);
        state.for('random').debug('bid', bid.toString());
        return bid;
    }

    async call(player: BasePlayer, possible: Trump[]): Promise<Trump> {
        const state = new CallState(player, possible);
        for (const strategy of this.strategies) {
            const trump = strategy.call(state);
            if (trump) {
                state.debug('called', trump.toString());
                return trump;
            }
        }
        const trump = random(possible);
        state.for('random').debug('called', trump.toString());
        return trump;
    }

    async play(player: BasePlayer, possible: Bone[]): Promise<Bone> {
        const state = new PlayState(player, possible);
        /** Short-circuit when there is only one choice */
        if (possible.length === 1) {
            const [bone] = possible;
            state.for('no choice').debug('played', bone.toString());
            return bone;
        }
        for (const strategy of this.strategies) {
            const bone = strategy.play(state);
            if (bone) {
                state.debug('played', bone.toString());
                return bone;
            }
        }
        const bone = random(possible);
        state.for('random').debug('played', bone.toString());
        return bone;
    }
}
