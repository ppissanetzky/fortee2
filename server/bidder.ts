import assert from 'node:assert';
import _ from 'lodash';

// import { Table } from 'console-table-printer';
// import chalk from 'chalk';

import { Bone, Trump } from './core';

/**
 * A reasonable attempt at figuring out the offs and the total money they
 * can draw. Note that it doesn't know whether money is even an issue.
 */

function pointsForOffs(trump: Trump, bones: Bone[]): number {

    /** The unique set of money bones we can draw with all of our offs */
    const points = new Set<Bone>();

    bones.forEach((bone) => {
        /** Now, figure out all the money bones it can draw */
        Bone.MONEY.forEach((money) => {
            /** Only money bones in the same suit as this one */
            if (!money.is_same_suit(bone, trump)) {
                return;
            }
            /**
             * Exclude it if ours is bigger:
             * the 6.6 does not have a 6.4 off
             */
            if (bone.beats(trump, money)) {
                return;
            }
            /**
             * If this bone is the best one in the suit, it will not draw
             * the money. Mostly the 5.5
             */
            if (bone.bestInSuit(trump) === bone) {
                return;
            }
            /**
             * If I have another bone that could draw and beat this one
             * For example, we're looking at the 6.3 right now, which
             * can draw the 6.4 but I also have the 6.5
             * Not perfect, but it's a decent guess
             */
            if (bones.some((other) => money.is_same_suit(other, trump) &&
                other.beats(trump, money))) {
                return;
            }
            /** Put this money bone in the set */
            points.add(money);
        });
    });

    /** Now add up all the points that we can draw with our offs */
    return Array.from(points.values())
        .reduce((result, {money}) => result + money, 0);
}

export class TrumpStats {
    readonly trump: Trump;
    readonly bones: Bone[];
    /** The total points we can lose from our offs */
    readonly points: number = 0;
    /** How good it is where 0 is the worst and 100 is the best */
    readonly total: number = 0;

    constructor(trump: Trump, bones: Bone[]) {
        assert(bones.length === 7, 'Bad hand');
        this.trump = trump;
        this.bones = Bone.orderedForTrump(trump, bones);
        this.points = pointsForOffs(trump, bones);
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
    }

    /**
     * Returns an array of trump stats for the given possible trumps, ordered
     * best to worst.
     */
    static all(bones: Bone[], possible: Trump[] = Trump.ALL): TrumpStats[] {
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
}

// function printBones(bones: Bone[]): string {
//     return bones.map(({name}) => name).join('  ');
// }

// function toBones(names: string[]): Bone[] {
//     return names.map((name) => Bone.find(name));
// }

// const HANDS: Record<string, Bone[]> = {

//     rnd: Bone.pull().slice(0, 7),

//     best: Bone.ALL.filter((bone) => bone.has_suit(0)),

//     dbl: toBones(['0.0', '1.1', '2.2', '3.3', '4.4', '5.5', '6.6']),
//     sev: toBones(['4.3', '5.2', '6.1', '4.4', '5.3', '3.3', '6.2']),
//     '0': toBones(['5.0', '4.3', '2.0', '6.3', '0.0', '6.6', '2.2']),
//     '1': toBones(['5.2', '1.0', '4.0', '5.3', '6.0', '5.4', '5.1']),
//     '2': toBones(['5.4', '6.3', '4.0', '5.1', '1.0', '3.1', '3.0']),
//     '3': toBones(['5.1', '6.1', '4.0', '3.1', '2.1', '1.0', '3.0']),
//     '4': toBones(['6.5', '6.6', '6.4', '6.0', '0.0', '5.2', '4.1']),
//     '5': toBones(['5.2', '5.5', '4.2', '2.1', '3.2', '6.2', '2.2']),
// }

// const choice = process.argv[2];

// const bones = HANDS[choice || 'rnd'];

// if (!bones) {
//     console.error('Nope');
//     process.exit(1);
// }

// const stats = TrumpStats.all(bones);

// const table = new Table({
//     columns: [
//         {name: 'trump'},
//         {name: 'total'},
//         {name: 'points'},
//         {name: 'order'}
//     ],
//     rows: stats.map((stat) => ({
//         trump: stat.trump.name,
//         total: stat.total,
//         points: stat.points,
//         order: stat.bones.map(({name}) => name).join(' '),
//     }))
// });

// table.printTable();

// // {
// //     const bones = HANDS['rnd'];
// //     const table = new Table({
// //         sort: (row1, row2) => row2.pct - row1.pct
// //     });
// //     for (const trump of Trump.ALL/*.filter(({name}) => name === 'blanks' || name === 'nello-os-hi')*/) {
// //         const values = _.sortBy(Bone.ALL.map((bone) => ({bone, value: bone.value(bone, trump, true)})), 'value').reverse();
// //         const mask = values.map(({bone}, index) => bones.includes(bone) ? 27 - index : 0).reduce((result, n) => result + n, 0);
// //         const pct = Math.round(((mask - 21) / (168 - 21)) * 100);
// //         const points = pointsForOffs(trump, bones);
// //         table.addRow({
// //             trump: trump.name,
// //             bones: values.map(({bone}) => bones.includes(bone) ? chalk.bgWhite.black(bone.name) : bone.name).join(' '),
// //             pct,
// //             points
// //         });
// //     }
// //     table.printTable();
// // }


