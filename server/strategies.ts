import assert from 'node:assert';

import type { BasePlayer } from './base-player';
import { Bid, Trump, Bone } from './core';
import { TrumpStats } from './bidder';

export interface Strategy {
    readonly name: string;
    bid?: (player: BasePlayer, possible: Bid[]) => Promise<Bid | void>;
    call?: (player: BasePlayer, possible: Trump[]) => Promise<Trump | void>;
    play?: (player: BasePlayer, possible: Bone[]) => Promise<Bone | void>;
}

export class BasicStrategy implements Strategy {
    name = 'pass all the time, unless we get stuck';
    async bid(player: BasePlayer, possible: Bid[]): Promise<Bid | void> {
        /** The lowest possible bid will be 'pass' unless we got stuck */
        const [bid] = possible;
        return bid;
    }
    async call(player: BasePlayer, possible: Trump[]): Promise<Trump | void> {
        /**
         * Will get called if we get stuck or we're calling trumps for our
         * partner
         */
        return TrumpStats.best(possible, player.bones);
    }
    async play(player: BasePlayer, possible: Bone[]): Promise<Bone | void> {
        const { lead , trump } = player;
        assert(trump);
        /** No lead, so we're leading */
        if (!lead) {
            const [bone] = Bone.orderedForTrump(trump, possible);
            return bone;
        }
        const [bone] = lead.bone.ordered(trump, possible);
        return bone;
    }
}

