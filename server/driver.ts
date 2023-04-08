import assert from 'node:assert';

import { Bid, Bone, Trump, Rules, Game, STEP, Team } from './core';
import type Player from './player';
import saveGame, { type Save } from './core/save-game';

export { Rules, Bid, Bone, Trump, Game, Team };

class TeamStatus {
    readonly players: string[] = [];
    /**
     * Points and pile for the current hand
     */
    readonly points: number = 0;
    readonly pile: Bone[][] = [];
    /**
     * Marks won so far
     */
    readonly marks: number = 0;

    constructor(game: Game, team: Team) {
        for (const [index, player] of game.players.entries()) {
            if (Game.team_for_player(index) === team) {
                this.players.push(player);
            }
        }
        const hand = game.this_hand;
        this.points = hand.points[team];
        this.pile = hand.tricks.filter((trick) =>
            Game.team_for_player(trick.trick_winner) == team
        ).map(({trick_bones}) => trick_bones);
        this.marks = game.marks[team];
    }
}

export class Status {

    public readonly US: TeamStatus;
    public readonly THEM: TeamStatus;

    public readonly bid: Bid;
    public readonly trump: Trump | undefined;

    constructor(game: Game) {
        this.US = new TeamStatus(game, 'US');
        this.THEM = new TeamStatus(game, 'THEM');

        const hand = game.this_hand;
        this.bid = hand.high_bid;
        this.trump = hand.trump;
    }
}

type Callback = (player: Player) => void;

export interface SaveWithMetadata extends Save {
    /* Which players were bots */
    bots: string[];
    /** The time that the game started */
    started: number;
    /** The time it ended */
    ended: number;
}

export default class GameDriver {

    /**
     * Starts a new game and resolves when the game is over.
     *
     */

    static async start(rules: Rules, players: Player[]): Promise<SaveWithMetadata> {
        const started = Date.now();
        const driver = new GameDriver(rules, players);
        const save = await driver.next();
        const ended = Date.now();
        const bots = players.filter(({human}) => !human).map(({name}) => name);
        return {
            ...save,
            started,
            ended,
            bots
        };
    }

    private readonly players: Player[];
    private readonly game: Game;

    private constructor(rules: Rules, players: Player[]) {
        assert(players.length === 4, 'Too few players');
        this.players = players;
        const table = players.map(({name}) => name);
        this.all((player) => player.startingGame({table, rules}));
        this.game = new Game(table, rules);
    }

    private all(cb: Callback): void {
        this.players.forEach(cb);
    }

    private not(name: string, cb: Callback): void {
        const result = this.players.filter((player) => player.name !== name);
        assert(result.length === 3, 'Not has wrong count');
        result.forEach(cb);
    }

    private just(name: string): Player {
        const result = this.players.find((player) => player.name === name);
        assert(result, `Player ${name} not found`);
        return result;
    }

    private index(name: string): number {
        const result = this.players.findIndex((player) => player.name === name);
        assert(result >= 0 && result <= 3, `Player ${name} not found`);
        return result;
    }

    private bones(name: string): Bone[] {
        return this.game.this_hand.bones_left[this.index(name)];
    }

    private async next(): Promise<Save> {
        switch (this.game.next_step) {
            case STEP.START_HAND: {
                    await Promise.all(this.players.map((player) =>
                        player.startingHand()));
                    this.game.start_hand();
                    this.all((player) =>
                        player.draw({bones: this.bones(player.name)}));
                }
                break;
            case STEP.BID: {
                    const [from, possible] = this.game.get_next_bidder();
                    this.not(from, (player) => player.waitingForBid({from}));
                    const bid = await this.just(from).bid({possible});
                    const result = this.game.player_bid(from, bid);
                    this.not(from, (player) => player.bidSubmitted({from, bid}));
                    if (result === 'BID_RESHUFFLE') {
                        this.all((player) => player.reshuffle(null));
                        this.all((player) =>
                            player.draw({bones: this.bones(player.name)}));
                    }
                    else if (result === 'BID_DONE') {
                        const index = this.game.this_hand.high_bidder;
                        const bid = this.game.this_hand.high_bid;
                        this.all((player) =>
                            player.bidWon({from: this.players[index].name, bid}));
                    }
                }
                break;
            case STEP.TRUMP: {
                    const [from , possible] = this.game.get_trump_caller();
                    this.not(from, (player) => player.waitingForTrump({from}));
                    const trump = await this.just(from).call({possible});
                    this.game.player_trump(from, trump);
                    this.all((player) => player.trumpSubmitted({from, trump}));
                }
                break;
            case STEP.PLAY: {
                    const [from , possible] = this.game.get_next_player();
                    this.not(from, (player) => player.waitingForPlay({from}));
                    const bone = await this.just(from).play({possible});
                    this.all((player) => player.playSubmitted({from, bone}));
                    const result = this.game.player_play(from, bone);
                    if (result.trick_over) {
                        const winner = this.game.players[result.trick_winner];
                        const points = result.trick_points;
                        await Promise.all(this.players.map((player) =>
                            player.endOfTrick({winner, points, status: new Status(this.game)})
                        ));
                    }
                    if (result.hand_over) {
                        if (result.early_finish) {
                            // TODO: Here we could skip calling finish hand, which
                            // would take us to EARLY_FINISH
                        }
                        const winner = result.winning_team;
                        assert(winner, 'Missing winner');
                        const made = result.bid_made;
                        this.game.finish_hand(result);
                        await Promise.all(this.players.map((player) =>
                            player.endOfHand({winner, made, status: new Status(this.game)})));
                    }
                }
                break;
            case STEP.EARLY_FINISH: {
                    assert(false, 'Should not get early finish');
                    this.game.play_it_out(true);
                }
                break;
            case STEP.GAME_OVER: {
                    const status = new Status(this.game);
                    this.all((player) => player.gameOver({status}));
                    // TODO: What else can we do here?
                    return saveGame(this.game);
                }
            default:
                assert(false, 'Invalid step');
        }
        return this.next();
    }
}
