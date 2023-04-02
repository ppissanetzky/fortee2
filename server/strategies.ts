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

/**
 * A helper to figure out all the bones in 'possible' that can beat all the
 * bones in 'against'
 */

function unbeatable(player: BasePlayer, against: Bone[], possible: Bone[]): Bone[] {
    const { lead , trump } = player;
    assert(trump);
    /** The highest value of all bones in 'against' */
    const value = Bone.highestValue(trump, against, lead?.bone);
    /** This happens if 'against' is empty, which is probably a bug */
    if (value < 0) {
        return [];
    }
    return possible.filter((bone) =>
        bone.value(lead?.bone || bone, trump, true) >= value);
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
            if (!remaining.some((bone) => bone.is_trump(trump))) {
                /** All trumps are gone */
                debug('all trumps are out');
                return;
            }
            const notTrumps = possible.filter((bone) => !bone.is_trump(trump));
            /** See if I have an unbeatable bone that is not a trump */
            const [winner] = unbeatable(player, remaining, notTrumps);
            if (winner) {
                debug('playing unbeatable that is not a trump');
                return winner;
            }
            /** See if my partner may have a trump */
            const partner = player.has(table.partner).filter((bone) =>
                bone.is_trump(trump));
            /** If they don't, this strategy doesn't apply */
            if (partner.length === 0) {
                debug('my partner has no trumps');
                return;
            }
            /**
             * I don't have an unbeatable that is not a trump, and my partner
             * may have a trump. See if the other team has any trumps.
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
                const withoutPartner = _.difference(remaining, partner);
                const [winner] = unbeatable(player, withoutPartner, notTrumps);
                if (winner) {
                    debug('only my partner can beat this one');
                    return winner;
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
            const [winner] = unbeatable(player, player.deepRemaining(), possible);
            if (winner) {
                debug('this is an unbeatable lead');
                return winner;
            }
        }
    }
}

export const WinWithMoney: Strategy = {
    name: 'win with money',
    async play(player: BasePlayer, possible: Bone[]): Promise<Bone | void> {
        const debug = player.debug.extend(this.name);
        const { trump } = player;
        assert(trump);
        const trick = player.trickBones;
        /** I am playing last */
        if (trick.length === 3) {
            /** My bones that can beat everything else in the trick */
            const bones = unbeatable(player, trick, possible);
            /** I don't have any, move on */
            if (bones.length === 0) {
                return;
            }
            debug('i can win with %o', Bone.toList(bones));
            /** See if any are money */
            const money = Bone.mostMoney(bones);
            if (money) {
                debug('winning with money, yo');
                return money;
            }
            // TODO: should we pick the first, or can we do better?
            const [first] = bones;
            debug('i cannot win with money, but i can win');
            return first;
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
            const [best] = unbeatable(player, player.deepRemaining(), possible);
            /** We have an unbeatable bone */
            if (best) {
                debug('no one can beat', best.toString());
                return best;
            }
        }
    }
}

