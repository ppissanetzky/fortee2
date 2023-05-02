import assert from 'node:assert';

import { Bid, Bone, Trump, Rules, Game, STEP, Team } from './core';
import type Player from './player';
import saveGame, { type Save } from './core/save-game';
import ms from 'ms';
import Dispatcher from './dispatcher';

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

    public readonly renege?: string;

    constructor(game: Game) {
        this.US = new TeamStatus(game, 'US');
        this.THEM = new TeamStatus(game, 'THEM');

        const hand = game.this_hand;
        this.bid = hand.high_bid;
        this.trump = hand.trump;

        if (hand.renege >= 0) {
            this.renege = game.players[hand.renege];
        }
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

export class TimeOutError extends Error {}

export interface GameDriverEvents {
    endOfHand: Status;
    /** Idle ms */
    idle: number;
}

export default class GameDriver extends Dispatcher<GameDriverEvents> {

    private readonly players: Player[];
    private readonly game: Game;
    private readonly maxIdleMs: number;
    private ran = false;

    private lastTime = 0;

    public constructor(rules: Rules, players: Player[], maxIdleMs: number) {
        super();
        assert(players.length === 4, 'Too few players');
        this.players = players;
        this.maxIdleMs = maxIdleMs;
        const table = players.map(({name}) => name);
        this.all((player) => player.startingGame({
            table,
            rules,
            desc: rules.parts()
        }));
        this.game = new Game(table, rules);
    }

    public async run(): Promise<SaveWithMetadata> {
        assert(!this.ran);
        this.ran = true;
        try {
            const started = Date.now();
            this.lastTime = started;

            const save = await new Promise<Save>((resolve, reject) => {
                let interval: NodeJS.Timer;
                if (this.maxIdleMs > 0) {
                    const tick = ms('10s')
                    interval = setInterval(() => {
                        const time = Date.now() - this.lastTime;
                        if (time > this.maxIdleMs) {
                            clearInterval(interval);
                            this.emit('idle', time);
                            reject(new TimeOutError(`idle for ${Math.floor(time / 1000)} seconds`));
                        }
                        else if (time >= tick) {
                            this.emit('idle', time);
                            this.all((player) => player.gameIdle({
                                idle: ms(time),
                                expiresIn: ms(this.maxIdleMs - time)
                            }));
                        }
                    }, tick);
                }
                const finished = (save: Save) => {
                    clearInterval(interval);
                    resolve(save);
                };
                this.next().then(finished, reject);
            });
            const ended = Date.now();
            const bots = this.players.filter(({human}) => !human)
                .map(({name}) => name);
            return {
                ...save,
                started,
                ended,
                bots
            };
        }
        finally {
            this.emitter.removeAllListeners();
        }
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
        this.lastTime = Date.now();
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
                    const [from , possible, all] = this.game.get_next_player();
                    this.not(from, (player) => player.waitingForPlay({from}));
                    const bone = await this.just(from).play({possible, all});
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
                        const status = new Status(this.game);
                        this.emit('endOfHand', status);
                        await Promise.all(this.players.map((player) =>
                            player.endOfHand({winner, made, status})));
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
