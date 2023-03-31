import assert from 'node:assert';
import _ from 'lodash';
import { Bid, Bone, Trump } from './core';
import { Status } from './driver';
import Player, { RandomPlayer } from './player';
import getNextBotName from './bot-names';
import { TrumpStats } from './bidder';
import { makeDebug } from './utility';

export default class RandomBot extends RandomPlayer {

    private readonly fastAF?: boolean;

    protected bones?: Bone[];
    protected trump?: Trump;
    protected lead?: Bone;

    constructor(fastAF?: boolean) {
        super(getNextBotName());
        this.fastAF = fastAF;
    }

    protected delay(): Promise<void> {
        return new Promise((resolve) => {
            if (this.fastAF) {
                return resolve();
            }
            setTimeout(resolve, _.random(500, 2000));
        });
    }

    startingHand(): Promise<void> {
        this.debug('starting hand');
        return this.delay();
    }

    draw({ bones } : { bones: Bone[] }): void {
        this.bones = bones;
        this.debug('drew %o', this.bones.map(({id}) => id));
    }

    async call({ possible } : { possible: Trump[] }): Promise<Trump> {
        assert(this.bones, 'I haz no bonez');
        await this.delay();
        return TrumpStats.best(possible, this.bones);
    }

    trumpSubmitted({ from, trump } : { from: string, trump: Trump; }): void {
        this.trump = trump;
    }

    async play({ possible } : { possible: Bone[] }): Promise<Bone> {
        assert(this.trump, 'I haz no trumpz');
        await this.delay();
        // The bot is leading
        if (!this.lead) {
            const [bone] = Bone.orderedForTrump(this.trump, possible);
            return bone;
        }
        const [bone] = this.lead.ordered(this.trump, possible);
        return bone;
    }

    playSubmitted({ from, bone } : { from: string, bone: Bone }): void {
        if (!this.lead) {
            this.lead = bone;
        }
    }

    async endOfTrick({ winner, points, status } : { winner: string, points: number, status: Status }): Promise<void> {
        this.lead = undefined;
    }
}

export class PassBot extends RandomBot {

    constructor(fastAF?: boolean) {
        super(fastAF);
    }

    async bid({ possible } : { possible: Bid[] }): Promise<Bid> {
        const [lowest] = possible;
        await this.delay();
        return lowest;
//        return super.bid({possible: [lowest]});
    }
}

interface BoneWithPlayer {
    readonly name: string;
    readonly bone: Bone;
}

export class DebugBot extends PassBot {

    private dbg = makeDebug('bot');
    protected partner = '';
    protected players: string[] = [];
    protected trick: BoneWithPlayer[] = [];
    protected pile: BoneWithPlayer[][] = [];

    constructor() {
        super(true);
        this.dbg = this.dbg.extend(this.name);
    }

    protected debug(arg: any, ...args: any[]): void {
        this.dbg(arg, ...args);
    }

    /**
     * Returns all bones played up to this point, EXCLUDING
     * the current trick
     */

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

    table({ table } : { table: string[] }) {
        let index = table.indexOf(this.name);
        assert(index >= 0);
        index += 2;
        if (index > 3) {
            index -= 4;
        }
        this.players = table;
        this.partner = table[index];
        this.debug('partner', this.partner);
    }

    async play({ possible } : { possible: Bone[] }): Promise<Bone> {
        const {trump} = this;
        assert(trump);

        const result = await super.play({possible});

        /** short-circuit when there's only one possible play */
        if (possible.length === 1) {
            return result;
        }

        /** The lead play for this trick, undefined if we're leading */
        const [lead] = this.trick;

        /** We don't know how to lead yet */
        if (!lead) {
            return result;
        }

        /**
         * All the bones that have not been played yet, including any in the
         * current trick
         */

        /** If my partner has already played */
        const partnerBone = this.trick.find(({name}) => name === this.partner)?.bone;

        if (partnerBone) {
            /** My partner is leading */
            if (partnerBone === lead.bone) {
                this.debug('my partner lead', lead.bone.id);

                /** My partner's bone will definitely win */
                if (partnerBone.beatsAll(trump, this.remaining())) {
                    this.debug('my partner will win');

                    /** Get the best money bone and, if we have one, play it */
                    const mostMoney = Bone.mostMoney(possible);
                    if (mostMoney) {
                        this.debug('i got money', mostMoney.id);
                        return mostMoney;
                    }
                }
            }
        }

        /** Throw trash */
        const trash = Bone.trash(trump, possible);
        this.debug('throwing trash', trash.id);
        return trash;
    }

    playSubmitted(msg : { from: string, bone: Bone }): void {
        super.playSubmitted(msg);
        this.trick.push({name: msg.from, bone: msg.bone});
    }

    async endOfTrick(msg : { winner: string, points: number, status: Status }): Promise<void> {
        const result = await super.endOfTrick(msg);
        this.pile.push(this.trick);
        this.trick = [];
        return result;
    }
}
