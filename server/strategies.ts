import _ from 'lodash';

import Strategy, { State, BidState, CallState } from './strategy';
import { Bid, Bone, Trump } from './core';
import { TrumpStats } from './bidder';
import { last, random } from './utility';

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
            const bones: Bone[] = unbeatable(trickBones, possible);
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
 * Bid based on trump stats
 */

class BidWithStats {

    decide(state: Readonly<State>, possible: Trump[] = Trump.ALL): TrumpStats | void {
        /** When we bid, we only know about the trumps in the rules */
        const allowed = TrumpStats.trumpsForRules(state.rules);
        const stats = TrumpStats.all(state.bones,
            _.intersection(allowed, possible))
            .filter(({trump, total, points}) => {
                /**
                 * Judgment call, drop everything below 70% and with 15
                 * or more points
                 */
                if (total < 70 || points >= 15) {
                    return false;
                }
                state.debug('looking at', trump.toString(), total, points);
                return true;
            });
        const [best] = stats;
        if (best) {
            state.debug('best is', best.trump.toString(), best.total, best.points);
            return best;
        }
        state.debug('no good trumps');
    }

    didMyPartnerBid(state: Readonly<State>): boolean {
        const partner = state.table.partner;
        state.debug(partner, state.bids);
        return state.bids.some(({bid, from}) =>
            !bid.is_pass && from === partner);
    }

    bid(state: Readonly<BidState>): Bid | void {
        const stats = this.decide(state);
        if (!stats) {
            return;
        }
        const { debug, possible } = state;
        /** A really good hand, bid the highest possible */
        if (stats.total === 100) {
            debug('i got a good hand!');
            return last(possible);
        }
        /** A middle of the road hand */
        if (stats.total >= 85) {
            let max = 30;
            switch (stats.points) {
                case 0:
                    max = 41;
                    break;
                case 5:
                    max = 36;
                    break;
                case 10:
                    max = 31;
                    break;
            }
            const bids = possible.filter(({points}) =>
                points >= 30 && points <= max);
            /** None of the possible bids are in my range */
            if (bids.length === 0) {
                debug(`i won't bid higher than`, max);
                return;
            }
            /** If I'm bidding last, might as well go low */
            if (state.bids.length === 3) {
                debug('bidding last, going low');
                return bids[0];
            }
            /** I don't know what to do next, so we'll pick a random one */
            debug('choosing random up to', max);
            return random(bids);
        }
        /** Something possibly worth bidding on */
        const [lowest] = possible;
        if (this.didMyPartnerBid(state)) {
            debug('my partner bid');
            /** This won't be a pass if we're stuck */
            return lowest;
        }
        /** Choose something random between lowest and 31 */
        debug('going low, or passing');
        return random(possible.filter(({points}) => points <= 31));
    }

    call(state: Readonly<CallState>): Trump | void {
        const stats = this.decide(state);
        return stats?.trump;
    }
}

export const Bid1 = new Strategy('bid 1', new BidWithStats());

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
