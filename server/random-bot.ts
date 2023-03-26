import assert from 'node:assert';
import _ from 'lodash';
import { Bid, Bone, Trump } from './core';
import { Status } from './driver';
import { RandomPlayer } from './player';
import getNextBotName from './bot-names';
import { TrumpStats } from './bidder';

export default class RandomBot extends RandomPlayer {

    private readonly fastAF?: boolean;

    private bones?: Bone[];
    private trump?: Trump;
    private lead?: Bone;

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
