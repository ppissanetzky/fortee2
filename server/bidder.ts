import assert from 'node:assert';
import _ from 'lodash';
import { Table, printTable } from 'console-table-printer';
import chalk from 'chalk';

// import { Table } from 'console-table-printer';
// import chalk from 'chalk';

import { Bone, Trump, Rules } from './core';

function offs(trump: Trump, bones: Bone[]): [number, Bone[]] {
    const result: Bone[] = [];

    let remaining = Bone.orderedForTrump(trump, _.difference(Bone.ALL, bones));

    for (const bone of Bone.orderedForTrump(trump, bones)) {
        const pulled: Bone[] = [];
        for (const other of remaining) {
            if (pulled.length === 3) {
                break;
            }
            if (other.is_same_suit(bone, trump)) {
                pulled.push(other);
            }
        }
        if (!bone.beatsAll(trump, pulled)) {
            [...pulled, bone].forEach((pull) => {
                if (pull.is_money) {
                    result.push(pull);
                }
            });
        }
        remaining = _.difference(remaining, pulled);
    }
    return [result.reduce((total, bone) => total + bone.money, 0), result];
}


export class TrumpStats {
    readonly trump: Trump;
    readonly bones: Bone[];
    /** The total points we can lose from our offs */
    readonly points: number = 0;
    /** The list of money bones we may draw */
    readonly money: Bone[] = [];
    /** How good it is where 0 is the worst and 100 is the best */
    readonly total: number = 0;
    /** If it is the best */
    readonly best: boolean;

    constructor(trump: Trump, bones: Bone[]) {
        assert(bones.length === 7, 'Bad hand');
        this.trump = trump;
        this.bones = Bone.orderedForTrump(trump, bones);
        [this.points, this.money] = offs(trump, bones);

        const ordered = Bone.orderedForTrump(trump, Bone.ALL);
        const hand = new Set(bones);
        const total = ordered.reduce((result, bone, index) => {
            if (hand.has(bone)) {
                return result + 27 - index;
            }
            return result;
        }, 0);
        /**
         * If we have the best 7 bones, the total is 168. If we have the worst
         * 7, the total is 21. So, we calculate a 0-100 out of that.
         */
        this.total = Math.round(((total - 21) / (168 - 21)) * 100);

        /** This should be pretty close to a lay down */
        this.best = total === 100 && this.points === 0;

        /** Now, we boost up or down based on the points we lose */
        const boost = new Map<number, number>([
            [ 0, 1.25],
            [ 5, 1.15],
            [10, 1.05],
            [20, 0.90],
            [25, 0.80],
            [30, 0.70]
        ]);
        this.total = Math.min(100, Math.round(this.total * (boost.get(this.points) || 1)));
    }

    /**
     * Returns an array of trump stats for the given possible trumps, ordered
     * best to worst.
     */
    static all(bones: Bone[], possible: Trump[]): TrumpStats[] {
        /** All the trumps that have a numeric suit */
        const stats = possible.map((trump) => new TrumpStats(trump, bones));
        return _.sortBy(stats, ({total}) => -total);
    }

    /**
     * Returns the trump with the best stats
     */
    static best(possible: Trump[], bones: Bone[]): Trump {
        const [{ trump }] = this.all(bones, possible);
        return trump;
    }

    static print(bones: Bone[], possible: Trump[]) {
        const stats = this.all(bones, possible);
        printTable(stats.map((stat) => ({
            trump: stat.trump.toString(),
            bones: Bone.orderedForTrump(stat.trump, bones).map((bone) => bone.toString()).join('  '),
            total: stat.total,
            points: stat.points,
            $: Bone.toList(stat.money).join('  ')
        })))
    }

    static trumpsForRules(rules: Rules): Trump[] {
        const result = ['blanks', 'ones', 'twos', 'threes', 'fours', 'fives',
            'sixes', 'doubles'];
        if (rules.sevens_allowed) {
            result.push('sevens');
        }
        if (rules.follow_me_doubles.includes('HIGH')) {
            result.push('follow-me-hi');
        }
        if (rules.follow_me_doubles.includes('LOW')) {
            result.push('follow-me-lo');
        }
        if (rules.follow_me_doubles.includes('HIGH_SUIT')) {
            result.push('follow-me-os-hi');
        }
        if (rules.follow_me_doubles.includes('LOW_SUIT')) {
            result.push('follow-me-os-lo');
        }
        return result.map((id) => Trump.find(id));
    }
}

// TrumpStats.print(Bone.pull().slice(0, 7), TrumpStats.trumpsForRules(new Rules()));
