import { Bid, Bone, Game, Rules, Team, Trump } from './core';

export interface GameState {
    rules: string[];
    US: {
        marks: number;
        points: number;
    };
    THEM: {
        marks: number;
        points: number;
    };
    bids: Record<string, Bid>;
    bidWinner?: string;
    trump: Record<string, Trump>;
    plays: Record<string, Bone>;
    trickWinner?: string;
    bones: (string | Bone)[];
    stack: boolean;
    pile: {
        US: Bone[][];
        THEM: Bone[][];
    };
}

function playerIndexArray(first: number, count: number): number[] {
    const result = [];
    let p = first;
    for (let i = 0; i < count; i++) {
        result.push(p);
        p = Game.inc_player(p);
    }
    return result;
}

/**
 * The state of a game as the play page expects it - can be for a target user
 * or none at all (for watchers)
 */

export function gameState(game: Game, target?: string): GameState {
    const hand = game.hands.at(-1);
    const bids: Record<string, Bid> = {};
    let bidWinner: string | undefined = undefined;
    const trump: Record<string, Trump> = {};
    const plays: Record<string, Bone> = {};
    let trickWinner: string | undefined = undefined;
    const bones: (string | Bone)[] = ['null', 'null', 'null', 'null',
        'null', 'null', 'null'];
    let stack = false;
    if (hand) {
        if (hand.bid_count) {
            playerIndexArray(hand.first_bidder, hand.bid_count)
                .forEach((p) => {
                    bids[game.players[p]] = hand.bids[p];
                });
        }
        if (hand.high_bidder >= 0) {
            bidWinner = game.players[hand.high_bidder];
            if (hand.trump) {
                trump[game.players[hand.high_bidder]] = hand.trump;
            }
        }
        if (hand.trick_leader >= 0) {
            playerIndexArray(hand.trick_leader, hand.trick_bones.length)
                .forEach((p) => {
                    plays[game.players[p]] = hand.trick_bones[p];
                });
        }
        const trick = hand.this_trick;
        if (trick && trick.trick_winner >= 0) {
            trickWinner = game.players[trick.trick_winner];
        }
        /** Bones left for the target player */
        if (target) {
            const p = game.players.indexOf(target);
            if (p >= 0) {
                for (let i = 0; i < 7; i++) {
                    const bone = hand.bones_left[p][i];
                    if (bone) {
                        bones[i] = bone;
                    }
                }
            }
        }
        if (hand.high_bid && hand.high_bid.points >= 42) {
            stack = true;
        }
    }
    const pile = (team: Team): Bone[][] => {
        if (!hand) {
            return [];
        }
        return hand.tricks
            .filter(({trick_winner}) => trick_winner >= 0 &&
                Game.team_for_player(trick_winner) === team)
            .map(({trick_bones}) => trick_bones);
    }
    return {
        rules: game.rules.parts(),
        US: {
            marks: game.marks.US,
            points: hand?.points.US || 0
        },
        THEM: {
            marks: game.marks.THEM,
            points: hand?.points.THEM || 0
        },
        bids,
        bidWinner,
        trump,
        plays,
        trickWinner,
        bones,
        stack,
        pile: {
            US: pile('US'),
            THEM: pile('THEM')
        }
    }
}
