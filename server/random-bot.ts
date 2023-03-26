import assert from 'node:assert';
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

    draw({ bones } : { bones: Bone[] }): void {
        this.bones = bones;
    }

    async call({ possible } : { possible: Trump[] }): Promise<Trump> {
        assert(this.bones, 'I haz no bonez');
        return TrumpStats.best(possible, this.bones);
    }

    trumpSubmitted({ from, trump } : { from: string, trump: Trump; }): void {
        this.trump = trump;
    }

    async play({ possible } : { possible: Bone[] }): Promise<Bone> {
        assert(this.trump, 'I haz no trumpz');
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
        return lowest;
//        return super.bid({possible: [lowest]});
    }

}
