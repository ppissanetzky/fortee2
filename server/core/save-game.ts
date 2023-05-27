import _ from 'lodash';
import { Game, Bone, Rules } from '.';
import { expected } from '../utility';
import type { ChatMessage } from '../game-room';
import { Table, printTable } from 'console-table-printer';
import chalk from 'chalk';

function inc(n: number, by: number): number {
    return Game.inc_player(n, by);
}

function array(n: PlayerIndex): PlayerIndex[] {
    return [n, inc(n, 1), inc(n, 2), inc(n, 3)];
}

type PlayerIndex = number;

type Pull = [PlayerIndex, string[]];
type Bid = [PlayerIndex, string];
type Play = [PlayerIndex, string];

interface Marks {
    US: number;
    THEM: number;
}

interface Trick {
    bones: Play[];
    winner: PlayerIndex;
    points: number;
}

interface Hand {
    bones: Pull[];
    bids: Bid[];
    high: Bid;
    trump: string;
    tricks: Trick[];
    stuck: boolean;
    made: boolean;
    renege?: PlayerIndex;
}

export interface Save {
    rules: Rules & { bones?: string[] };
    players: string[];
    hands: Hand[];
    marks: Marks;
}

export interface SaveWithMetadata extends Save {
    /* Which players were bots */
    bots: string[];
    /** The time that the game started */
    started: number;
    /** The time it ended */
    ended: number;
    /** Chat messages */
    chat: ChatMessage[];
    /** Tournament ID */
    tid?: number;
}

export default function saveGame(game: Game): Save {
    const hands: Hand[] = game.hands.map((hand) => ({
        bones: hand.pulled_bones.map((bones, index) => [
            index, _.sortBy(Bone.toList(bones)).reverse(),
        ]),
        bids: array(hand.first_bidder).map((index) => [
            index, hand.bids[index]?.toString() || '',
        ]),
        high: [hand.high_bidder, hand.high_bid.toString()],
        trump: expected(hand.trump).toString(),
        tricks: hand.tricks.map((trick) => ({
            bones: array(trick.trick_leader)
                /** In Nello, there will be a hole in the trick */
                .filter((index) => trick.trick_bones[index])
                .map((index) => [index, trick.trick_bones[index]?.toString()]),
            winner: trick.trick_winner,
            points: trick.trick_points
        })),
        stuck: hand.bid_forced,
        made: hand.bid_made,
        renege: hand.renege >= 0 ? hand.renege : undefined
    }));
    return {
        /** Not realy JSON, just has the bones (if any) as strings */
        rules: game.rules.toJSON(),
        players: game.players,
        hands,
        marks: game.marks
    };
}

export class SaveHelper {

    public readonly save: Save;

    constructor(save: Save) {
        this.save = save;
    }

    get winnerIndices(): number[] {
        return this.save.marks.US > this.save.marks.THEM
            ? [0, 2] : [1, 3];
    }

    get winners(): string[] {
        return this.winnerIndices.map((index) => this.save.players[index]);
    }

    get loserIndices(): number[] {
        return this.save.marks.US < this.save.marks.THEM
            ? [0, 2] : [1, 3];
    }

    get losers(): string[] {
        return this.loserIndices.map((index) => this.save.players[index]);
    }

    get score(): number[] {
        return [this.save.marks.US, this.save.marks.THEM].sort().reverse();
    }
}

export function printSave(save: Save) {
    // for (const hand of save.hands) {
    //     const bones = new Map(hand.bones);
    //     const bids = new Map(hand.bids);
    //     new Table({
    //         columns: [
    //             {name: 'name'},
    //             {name: 'bones'},
    //             {name: 'bid'},
    //             {name: 'trump'},
    //         ],
    //         rows: Array.from(bids.keys()).map((name) => ({
    //             name,
    //             bones: bones.get(name)?.join(' '),
    //             bid: bids.get(name),
    //             trump: hand.high.includes(name) ? hand.trump : ''
    //         }))
    //     })
    //     .printTable();

    //     const rows = hand.tricks.map((trick) => {
    //         const row = trick.bones.reduce((result, [name, bone], index) => {
    //             result[String(index)] = `${name === trick.winner ? chalk.bgRed(name) : name} ${bone}`;
    //             return result;
    //         }, {} as Record<string, any>);
    //         const us = `${save.players[0]}/${save.players[2]}`;
    //         const them = `${save.players[1]}/${save.players[3]}`;
    //         row[us] = [0, 2].includes(save.players.indexOf(trick.winner)) ? trick.points : '';
    //         row[them] = [1, 3].includes(save.players.indexOf(trick.winner)) ? trick.points : '';
    //         return row;
    //     });
    //     printTable(rows);
    // }
}
