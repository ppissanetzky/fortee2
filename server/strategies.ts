import _ from 'lodash';

import Strategy from './strategy';
import { Bone } from './core';
import { TrumpStats } from './bidder';

/**
 * Lowest possible bid - used to force test bots to pass
 */

export const Pass = new Strategy('pass', {
    bid({possible}) {
        /** The lowest possible bid will be 'pass' unless we got stuck */
        const [bid] = possible;
        return bid;
    }
});

/**
 * Play the first possible. This is used on other bots to make them
 * consistent for testing
 */

export const PlayFirst = new Strategy('first', {
    play({possible}) {
        const [first] = possible;
        return first;
    }
});

/**
 * Avoid playing money when leading
 */

export const NoMoneyOnUncertainLead = new Strategy('no money lead', {
    play({debug, leading, trump, possible}) {
        if (!leading) {
            return;
        }
        const [best] = Bone.orderedForTrump(trump, possible)
            .filter((bone) => !bone.is_money);
        if (best) {
            debug('leading my best, trying to avoid money');
            return best;
        }
    }
});

/**
 * Try not to pull my partner's trumps when there are some left and I'm leading
 */

export const KeepPartnerTrumps = new Strategy('keep partner trumps', {
    play({debug, leading, trump, table, possible, has, remaining, unbeatable}) {
        if (!leading) {
            return;
        }
        if (!remaining.some((bone) => bone.is_trump(trump))) {
            /** All trumps are gone */
            debug('all trumps are out');
            return;
        }
        const notTrumps = possible.filter((bone) => !bone.is_trump(trump));
        /** See if I have an unbeatable bone that is not a trump */
        const [winner] = unbeatable(remaining, notTrumps);
        if (winner) {
            debug('playing unbeatable that is not a trump');
            return winner;
        }
        /** See if my partner may have a trump */
        const partner = has(table.partner).filter((bone) =>
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
            _.union(result, has(other)), [] as Bone[])
            .filter((bone) => bone.is_trump(trump));

        if (have.length === 0) {
            debug('the other team has no trumps');
            /**
             * Now, see if I have a bone that is unbeatable, or only
             * beatable by my partner's trumps
             */
            const withoutPartner = _.difference(remaining, partner);
            const [winner] = unbeatable(withoutPartner, notTrumps);
            if (winner) {
                debug('only my partner can beat this one');
                return winner;
            }
        }
    }
});

/**
 * If we have an unbeatable lead, play it
 */

export const UnbeatableLead = new Strategy('unbeatable lead', {
    play({debug, leading, possible, remaining, unbeatable}) {
        if (!leading) {
            return;
        }
        const [winner] = unbeatable(remaining, possible);
        if (winner) {
            debug('this is an unbeatable lead');
            return winner;
        }
    }
});

/**
 * When we're playing last, try to win the trick with money. If we can't
 * win with money, win it with something else
 */

export const WinWithMoney = new Strategy('win with money', {
    play({debug, trick, trickBones, unbeatable, possible}) {
        /** I am playing last */
        if (trick.length === 3) {
            /** My bones that can beat everything else in the trick */
            const bones = unbeatable(trickBones, possible);
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
});

/**
 * Follow with our worst bone
 */

export const Trash = new Strategy('trash', {
    play({leading, trump, possible}) {
        if (!leading) {
            return Bone.trash(trump, possible);
        }
    }
});

/**
 * A somewhat sensible fallback
 */

export const Fallback = new Strategy('fallback', {
    bid({possible}) {
        /** The lowest possible bid will be 'pass' unless we got stuck */
        const [bid] = possible;
        return bid;
    },
    call({possible, bones}) {
        return TrumpStats.best(possible, bones);
    },
    play({debug, lead, trump, possible}) {
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
});

/**
 * When my partner leads, try to throw some money
 */

export const MoneyForPartner = new Strategy('give my partner money', {
    play({debug, trump, lead, table, possible, remaining}) {
        /** If my partner lead */
        if (lead && table.isPartner(lead.from)) {
            debug('my partner lead', lead.bone.toString());
            /** TODO: I think we could do better with a deepRemaining for the lead */
            if (lead.bone.beatsAll(trump, remaining)) {
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
});

/**
 * When we're following and we have an unbeatable bone
 */

export const TakeTheLead = new Strategy('try to take the lead', {
    play({debug, leading, possible, unbeatable, remaining}) {
        if (leading) {
            return;
        }
        const winners = unbeatable(remaining, possible);
        if (winners.length === 0) {
            return;
        }
        const money = Bone.mostMoney(winners);
        if (money) {
            debug('no one can beat money', money.toString());
            return money;
        }
        /** We have an unbeatable bone */
        const [winner] = winners;
        debug('no one can beat', winner.toString());
        return winner;
    }
});
