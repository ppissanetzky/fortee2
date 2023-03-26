import assert from 'node:assert';
import _ from 'lodash';
import { Bid, Bone, Trump } from './core';
import { Status } from './driver';
import { RandomPlayer } from './player';
import getNextBotName from './bot-names';
import { TrumpStats } from './bidder';

export default class RandomBot extends RandomPlayer {

    private bones?: Bone[];
    private trump?: Trump;
    private lead?: Bone;

    constructor() {
        super(getNextBotName());
    }

    protected delay(): Promise<void> {
        return new Promise((resolve) => {
            setTimeout(resolve, _.random(1500, 3500));
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

    endOfTrick({ winner, points, status } : { winner: string, points: number, status: Status }): void {
        this.lead = undefined;
    }
}

export class PassBot extends RandomBot {

    async bid({ possible } : { possible: Bid[] }): Promise<Bid> {
        const [lowest] = possible;
        await this.delay();
        return lowest;
//        return super.bid({possible: [lowest]});
    }

}
