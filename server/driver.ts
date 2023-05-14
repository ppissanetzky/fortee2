import assert from 'node:assert';

import { Bid, Bone, Trump, Rules, Game, STEP, Team } from './core';
import type Player from './player';
import saveGame, { type Save } from './core/save-game';
import ms from 'ms';
import Dispatcher from './dispatcher';
import { GameMessages, StartingGame } from './outgoing-messages';
import { ChatMessage } from './game-room';

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

    public winner?: Team;

    constructor(game: Game) {
        this.US = new TeamStatus(game, 'US');
        this.THEM = new TeamStatus(game, 'THEM');

        const hand = game.this_hand;
        this.bid = hand.high_bid;
        this.trump = hand.trump;

        if (hand.renege >= 0) {
            this.renege = game.players[hand.renege];
        }

        this.winner = game.winningTeam;
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
    /** Chat messages */
    chat: ChatMessage[];
}

export class TimeOutError extends Error {}
export class StopError extends Error {}

export interface GameDriverEvents {
    /** A message sent to itself when it is stopped by the room */
    stop: undefined;
}

export default class GameDriver extends Dispatcher<GameDriverEvents & GameMessages> {

    private readonly players: Player[];
    private readonly maxIdleMs: number;
    private ran = false;

    private lastTime = 0;
    private idle = false;

    private get connected(): Player[] {
        return this.players.filter(({connected}) => connected);
    }

    public readonly game: Game;

    public constructor(rules: Rules, players: Player[], maxIdleMs: number) {
        super();
        assert(players.length === 4, 'Too few players');
        this.players = players;
        this.maxIdleMs = maxIdleMs;
        const table = players.map(({name}) => name);
        const msg: StartingGame = {
            table,
            rules,
            desc: rules.parts()
        };
        this.all((player) => player.startingGame(msg));
        this.emit('startingGame', msg);
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
                    const tick = ms('30s')
                    interval = setInterval(() => {
                        const time = Date.now() - this.lastTime;
                        if (time > this.maxIdleMs) {
                            clearInterval(interval);
                            this.emit('gameIdle', {
                                time,
                                idle: ms(time),
                                expiresIn: ms(this.maxIdleMs - time)
                            });
                            return reject(new TimeOutError(`idle for ${Math.floor(time / 1000)} seconds`));
                        }
                        if (time >= tick) {
                            this.idle = true
                            const msg = {
                                time,
                                idle: ms(time),
                                expiresIn: ms(this.maxIdleMs - time)
                            };
                            this.emit('gameIdle', msg);
                            this.all((player) => player.gameIdle(msg));
                        }
                    }, tick);
                }
                this.once('stop', () => {
                    clearInterval(interval);
                    reject(new StopError());
                });
                const finished = (save: Save) => {
                    clearInterval(interval);
                    resolve(save);
                };
                this.next().then(finished, reject);
            });
            const ended = Date.now();
            const bots = this.players.filter(({human}) => !human)
                .map(({name}) => name);
            const chat: ChatMessage[] = [];
            return {
                ...save,
                started,
                ended,
                bots,
                chat
            };
        }
        finally {
            this.emitter.removeAllListeners();
        }
    }

    public stop() {
        this.emit('stop', undefined);
    }

    private all(cb: Callback): void {
        this.connected.forEach(cb);
    }

    private not(name: string, cb: Callback): void {
        const result = this.connected.filter((player) => player.name !== name);
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
        /** If it was idle, it is no longer idle */
        if (this.idle) {
            this.emit('gameIdle', {
                time: 0,
                idle: '',
                expiresIn: ''
            });
            this.idle = false;
        }
        switch (this.game.next_step) {
            case STEP.START_HAND: {
                    this.emit('startingHand', null);
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
                    this.emit('waitingForBid', {from});
                    const bid = await this.just(from).bid({possible});
                    const result = this.game.player_bid(from, bid);
                    this.not(from, (player) => player.bidSubmitted({from, bid}));
                    this.emit('bidSubmitted', {from, bid});
                    if (result === 'BID_RESHUFFLE') {
                        this.all((player) => player.reshuffle(null));
                        this.emit('reshuffle', null);
                        this.all((player) =>
                            player.draw({bones: this.bones(player.name)}));
                    }
                    else if (result === 'BID_DONE') {
                        const index = this.game.this_hand.high_bidder;
                        const bid = this.game.this_hand.high_bid;
                        const from = this.players[index].name;
                        this.all((player) =>
                            player.bidWon({from, bid}));
                        this.emit('bidWon', {from, bid});
                    }
                }
                break;
            case STEP.TRUMP: {
                    const [from , possible] = this.game.get_trump_caller();
                    this.not(from, (player) => player.waitingForTrump({from}));
                    this.emit('waitingForTrump', {from});
                    const trump = await this.just(from).call({possible});
                    this.game.player_trump(from, trump);
                    this.all((player) => player.trumpSubmitted({from, trump}));
                    this.emit('trumpSubmitted', {from, trump});
                }
                break;
            case STEP.PLAY: {
                    const [from , possible, all] = this.game.get_next_player();
                    this.not(from, (player) => player.waitingForPlay({from}));
                    this.emit('waitingForPlay', {from});
                    const bone = await this.just(from).play({possible, all});
                    this.all((player) => player.playSubmitted({from, bone}));
                    this.emit('playSubmitted', {from, bone});
                    const result = this.game.player_play(from, bone);
                    if (result.trick_over) {
                        const winner = this.game.players[result.trick_winner];
                        const points = result.trick_points;
                        const status = new Status(this.game);
                        this.emit('endOfTrick', {winner, points, status});
                        await Promise.all(this.players.map((player) =>
                            player.endOfTrick({winner, points, status})
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
                        this.emit('endOfHand', {winner, made, status});
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
                    this.emit('gameOver', {status});
                    // TODO: What else can we do here?
                    return saveGame(this.game);
                }
            default:
                assert(false, 'Invalid step');
        }
        return this.next();
    }
}
