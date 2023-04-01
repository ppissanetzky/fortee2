import assert from 'node:assert';
import _ from 'lodash';

import type { BasePlayer } from './base-player';
import { Bid, Trump, Bone } from './core';
import { TrumpStats } from './bidder';

export interface Strategy {
    readonly name: string;
    bid?: (player: BasePlayer, possible: Bid[]) => Promise<Bid | void>;
    call?: (player: BasePlayer, possible: Trump[]) => Promise<Trump | void>;
    play?: (player: BasePlayer, possible: Bone[]) => Promise<Bone | void>;
}

export const PassStrategy: Strategy = {
    name: 'pass',
    async bid(player: BasePlayer, possible: Bid[]): Promise<Bid | void> {
        /** The lowest possible bid will be 'pass' unless we got stuck */
        const [bid] = possible;
        return bid;
    }
}

export const Forced: Strategy = {
    name: 'no choice',
    async play(player: BasePlayer, possible: Bone[]): Promise<Bone | void> {
        if (possible.length === 1) {
            return possible[0];
        }
    }
}

/**
 * Play the first possible. This is used on other bots to make them
 * consistent for testing
 */

export const PlayFirst: Strategy = {
    name: 'first',
    async play(player: BasePlayer, possible: Bone[]): Promise<Bone | void> {
        return possible[0];
    }
}

export const NoMoneyOnUncertainLead: Strategy = {
    name: 'no money lead',
    async play(player: BasePlayer, possible: Bone[]): Promise<Bone | void> {
        const debug = player.debug.extend(this.name);
        const { lead, trump } = player;
        assert(trump);
        if (!lead) {
            const [best] = Bone.orderedForTrump(trump, possible)
                .filter((bone) => !bone.is_money);
            if (best) {
                debug('leading my best, trying to avoid money');
                return best;
            }
        }
    }
}

export const TryToKeepMyPartnersTrumps: Strategy = {
    name: 'keep partner trumps',
    async play(player: BasePlayer, possible: Bone[]): Promise<Bone | void> {
        const debug = player.debug.extend(this.name);
        const { lead, trump, table } = player;
        assert(trump);
        assert(table);
        if (!lead) {
            const remaining = player.deepRemaining();
            const notTrumps = possible.filter((bone) => !bone.is_trump(trump));
            /** See if I have an unbeatable bone that is not a trump */
            const [unbeatable] = notTrumps.filter((bone) =>
                bone.beatsAll(trump, remaining));
            if (unbeatable) {
                debug('playing unbeatable that is not a trump');
                return unbeatable;
            }
            /**
             * I don't have an unbeatable that is not a trump, see if the other
             * team has any trumps.
             */
            const have = table.others.reduce((result, other) =>
                _.union(result, player.has(other)), [] as Bone[])
                .filter((bone) => bone.is_trump(trump));

            if (have.length === 0) {
                debug('the other team has no trumps');
                /**
                 * Now, see if I have a bone that is unbeatable, or only
                 * beatable by my partner's trumps
                 */
                const partner = player.has(table.partner);
                const withoutPartner = _.difference(remaining, partner);
                const [unbeatable] = Bone.orderedForTrump(trump, notTrumps)
                    .filter((bone) => bone.beatsAll(trump, withoutPartner));
                if (unbeatable) {
                    debug('only my partner can beat this one');
                    return unbeatable;
                }
            }
        }
    }
}

export const UnbeatableLead: Strategy = {
    name: 'unbeatable lead',
    async play(player: BasePlayer, possible: Bone[]): Promise<Bone | void> {
        const debug = player.debug.extend(this.name);
        const { lead, trump } = player;
        assert(trump);
        if (!lead) {
            const remaining = player.deepRemaining();
            const [best] = possible.filter((bone) => bone.beatsAll(trump, remaining));
            if (best) {
                debug('this is an unbeatable lead');
                return best;
            }
        }
    }
}

export const Trash: Strategy = {
    name: 'trash',
    async play(player: BasePlayer, possible: Bone[]): Promise<Bone | void> {
        const { lead, trump } = player;
        assert(trump);
        if (lead) {
            return Bone.trash(trump, possible);
        }
    }
}

export const FallbackStrategy: Strategy = {
    name: 'fallback',
    async bid(player: BasePlayer, possible: Bid[]): Promise<Bid | void> {
        /** The lowest possible bid will be 'pass' unless we got stuck */
        const [bid] = possible;
        return bid;
    },
    async call(player: BasePlayer, possible: Trump[]): Promise<Trump | void> {
        /**
         * Will get called if we get stuck or we're calling trumps for our
         * partner
         */
        return TrumpStats.best(possible, player.bones);
    },
    async play(player: BasePlayer, possible: Bone[]): Promise<Bone | void> {
        const debug = player.debug.extend(this.name);
        const { lead, trump } = player;
        assert(trump);
        /** No lead, so we're leading */
        if (!lead) {
            /** We try to throw our best bone */
            const bones = Bone.orderedForTrump(trump, possible);
            debug('i am leading, these are the best %o', Bone.toList(bones));
            const [bone] = bones;
            return bone;
        }
        /** We try to throw our best bone */
        const bones = lead.bone.ordered(trump, possible);
        debug('i am not leading, best are %o', Bone.toList(bones));
        const [bone] = bones;
        return bone;
    }
}

export const MoneyForPartner: Strategy = {
    name: 'give my partner money',
    async play(player: BasePlayer, possible: Bone[]): Promise<Bone | void> {
        const debug = player.debug.extend(this.name);
        const { trump, lead, table } = player;
        assert(trump);
        assert(table);

        /** If my partner lead */
        if (lead && table.isPartner(lead.from)) {
            debug('my partner lead', lead.bone.toString());
            /** TODO: I think we could do better with a deepRemaining for the lead */
            if (lead.bone.beatsAll(trump, player.remaining())) {
                debug('my partner will win');
                /** Get the best money bone and, if we have one, play it */
                const mostMoney = Bone.mostMoney(possible);
                if (mostMoney) {
                    debug('i got money', mostMoney.toString());
                    return mostMoney;
                }
            }
        }
    }
}

/**
 * When we're following and we have an unbeatable bone
 */

export const TakeTheLead: Strategy = {
    name: 'try to take the lead',
    async play(player: BasePlayer, possible: Bone[]): Promise<Bone | void> {
        const debug = player.debug.extend(this.name);
        const {lead, trump} = player;
        assert(trump);

        if (lead) {
            const [best] = lead.bone.ordered(trump, player.deepRemaining());
            /** We have an unbeatable bone */
            if (possible.includes(best)) {
                debug('no one can beat', best.toString());
                return best;
            }
        }
    }
}

