import assert from 'node:assert';
import _ from 'lodash';

import Tournament from './tournament';
import Dispatcher from './dispatcher';
import UserNames from './user-names';
import GameRoom from './game-room';
import { TableBuilder } from './table-helper';
import { Rules } from './core';
import { SaveHelper } from './core/save-game';
import { expected, makeDebug } from './utility';
import nextBotName from './bot-names';
import config from './config';

async function user(id: string) {
    const name = GameRoom.isBot(id);
    if (name) {
        return {id, name};
    }
    return UserNames.user(id);
}

export class Team {

    static bye = new Team('', '');

    public readonly users: string[];

    constructor(a: string, b: string) {
        this.users = [a, b];
    }

    public has(userId: string): boolean {
        return this.users.includes(userId);
    }

    public other(userId: string): string | undefined {
        const i = this.users.indexOf(userId);
        if (i >= 0) {
            return i === 0 ? this.users[1] : this.users[0];
        }
    }
}

export class Game {

    public readonly id: number;
    public readonly teams: Team[] = [];
    public readonly round;
    public started = false;
    public finished = false;
    public col = -1;
    public row = -1;
    public readonly previous_games: Game[] = [];
    public next_game?: Game;
    public room?: GameRoom;

    constructor(id: number, round: number) {
        this.id = id;
        this.round = round;
    }

    has(userId: string): Team | undefined {
        return this.teams.find((team) => team.has(userId));
    }

    /** If the game has a bye, returns the other team */
    get bye(): Team | undefined {
        const [a, b] = this.teams;
        if (a === Team.bye) {
            return b;
        }
        if (b === Team.bye) {
            return a;
        }
    }

    async start(driver: TournamentDriver): Promise<void> {

        const debug = makeDebug('t-game')
            .extend(`t${driver.t.id}-r${this.round}-g${this.id}`);

        const { bye } = this;

        if (bye) {
            /** Announce the bye */
            for (const user of bye.users) {
                if (!GameRoom.isBot(user)) {
                    driver.emit('announceBye', {
                        t: driver.t,
                        round: this.round,
                        user
                    });
                }
            }

            /** Advance this team to the next game */
            const next_game = expected(this.next_game);
            next_game.teams.push(bye);
            this.started = true;
            this.finished = true;
            return Promise.resolve(next_game.start(driver));
        }

        const { teams } = this;

        /**
         * This one is not ready to start, we'll try again when another
         * game finishes
         */
        if (teams.length < 2) {
            return Promise.resolve();
        }

        const table = new TableBuilder([
            await user(teams[0].users[0]),
            await user(teams[1].users[0]),
            await user(teams[0].users[1]),
            await user(teams[1].users[1])
        ]);

        debug('starting with %j', table);

        return new Promise((resolve, reject) => {

            const room = new GameRoom({
                rules: Rules.fromAny(driver.t.rules),
                table,
                tournament: driver.t
            });

            this.room = room;

            room.on('userJoined', (user) => {
                debug('joined', user);
            });

            room.on('userLeft', (user) => {
                debug('left', user);
            });

            room.on('gamePaused', () => {
                debug('paused');
            });

            room.on('gameResumed', () => {
                debug('resumed');
            });

            room.once('gameStarted', () => {
                debug('started');
                this.started = true;
            });

            room.once('gameError', (error) => {
                debug('error', error);
                this.room = undefined;
                this.finished = true;
                reject(error);
            });

            room.once('gameOver', ({save}) => {
                this.room = undefined;
                this.finished = true;
                /** These are the winners, they advance */
                const [a, b] = save.winnerIndices;
                const winners = new Team(
                    expected(table.table[a]).id,
                    expected(table.table[b]).id);
                debug('game over %j', winners);

                /** Keep track of the losers */
                const losers = save.loserIndices.map((i) =>
                    expected(table.table[i]).id);
                losers.forEach((loser) => driver.losers.add(loser));

                /** Emit an event */
                driver.emit('gameOver', {
                    t: driver.t,
                    round: this.round,
                    winners: winners.users,
                    losers
                });

                const { next_game } = this;
                /** The final game is over! */
                if (!next_game) {
                    debug('tournament over %j', save.winners);
                    driver.winners = save.winners;
                    driver.emit('tournamentOver', {
                        t: driver.t,
                        winners,
                        room,
                        save
                    });
                    return resolve();
                }
                /** Otherwise, this team advances */
                next_game.teams.push(winners);
                /** Now, try to start the next game */
                resolve(next_game.start(driver));
            });

            driver.emit('summonTable', {
                t: driver.t,
                round: this.round,
                room
            });
        });
    }
}

export interface AnnounceBye {
    t: Tournament;
    user: string;
    round: number;
}

export interface SummonTable {
    t: Tournament;
    round: number;
    room: GameRoom;
}

export interface GameOver {
    t: Tournament;
    round: number;
    /** User IDs */
    winners: string[];
    /** User IDs */
    losers: string[];
}

export interface TournamentOver {
    t: Tournament;
    winners: Team;
    save: SaveHelper;
    room: GameRoom;
}

export interface TournamentDriverEvents {
    /** Tell this user that they have a bye in this round */
    announceBye: AnnounceBye;

    /** Tell this player to come to this room */
    summonTable: SummonTable;

    /** A game is over */
    gameOver: GameOver;

    /** It's over */
    tournamentOver: TournamentOver;
}

/**
 * The status of a player in the tournament, MUST be JSON-able
 */

export class Status {

    /**
     * This just tells us that this status exists
     */
    readonly isOn = true;

    /**
     * Whether the player made it into the tournament:
     *  signed up and didn't get dropped
     */
    readonly inTourney: boolean = false;

    /**
     * True if the player made it into the tournament and had a bye, even
     * if the player already lost or the tournament is over
     */
    readonly hasBye: boolean = false;

    /**
     * Whether the player is still playing in the tournament:
     *  made it in and has not lost yet
     */
    readonly stillPlaying: boolean = false;

    /**
     * The ID of the partner that the player got after signup
     */
    readonly actualPartner?: string = undefined;

    /**
     * Whether there is a room for this player right now
     */
    readonly hasRoom: boolean = false;

    /**
     * If the player is supposed to be a in a room, the URL to play
     */
    readonly url?: string = undefined;

    /**
     * The names of all the players in the room, if in a room. This is also
     * an indication that the player should be in the room
     */
    readonly positions?: string[] = undefined;

    /**
     * Winner names, signals that the tournament is over and did not fail
     */
    readonly winners?: string[] = undefined;

    /**
     * If there was a problem and it failed. It is over
     */
    readonly failed: boolean = false;

    constructor (driver: TournamentDriver, userId: string) {
        this.winners = driver.winners;
        this.failed = driver.failed;

        for (const game of driver.games.values()) {
            const team = game.has(userId);
            if (!team) {
                continue;
            }
            /** We found the partner */
            this.actualPartner = team.other(userId);

            /** The user is definitely here */
            this.inTourney = true;

            /** The user had a bye in this game */
            const { bye } = game;
            if (bye && bye.has(userId)) {
                this.hasBye = true;
            }

            /** Still playing */
            if (!game.finished) {
                this.stillPlaying = true;
            }

            const { room } = game;
            if (room) {
                this.hasRoom = true;
                this.url = `${config.FT2_SERVER_BASE_URL}/play/${room.token}`
                this.positions = [...room.positions];
            }
        }
    }
}

export default class TournamentDriver extends Dispatcher<TournamentDriverEvents> {

    public readonly t: Tournament;

    /** An array of player pairs in no particular order */
    public readonly teams: Team[];

    /** If there was an odd number of players, one gets dropped */
    public readonly dropped: string | undefined;

    /** All of the games by ID */
    public readonly games: Map<number, Game>;

    /** The rounds */
    public readonly rounds: Game[][];

    /** User IDs that lost their games */
    public readonly losers = new Set<string>();

    /** The names of the winners, once it is over */
    public winners?: string[] = undefined;

    /** If it failed */
    public failed = false;

    private readonly debug;

    constructor(t: Tournament) {
        super();
        this.t = t;
        this.debug = makeDebug('t-driver').extend(`t${t.id}`);
        [this.teams, this.dropped] = this.pickTeams();
        [this.games, this.rounds] = this.createBracket();
    }

    get canceled(): boolean {
        return this.rounds.length === 0;
    }

    statusFor(userId: string): Status {
        return new Status(this, userId);
    }

    /**
     * Pairs up all the signups and returns teams as well as one
     * person who got dropped (or none)
     */

    private pickTeams(): [Team[], string | undefined] {
        /** Get the signups in a map of user/partner and shuffle it */
        const signups = new Map(_.shuffle(Array.from(this.t.signups().entries())));

        /** No one signed up, we're done */
        if (signups.size === 0) {
            return [[], undefined];
        }

        /** Put all the players in a reject pile */
        const rejects = new Set(signups.keys());

        /** If the host is 'bots', fill the teams with bots */
        if (this.t.host === 'bots') {
            const count = rejects.size;
            let max = 8;
            while (count > max) {
                max *= 2;
            }
            for (let i = 0; i < max - count; i++) {
                rejects.add(`:bot:${nextBotName()}`);
            }
        }

        /** The teams */
        const teams: Team[] = [];

        /** Try to match up partners */
        if (this.t.choosePartner) {

            /** Iterate over the signups */
            for (const [user, partner] of signups.entries()) {

                /** We've already dealt with this one */
                if (!rejects.has(user)) {
                    continue;
                }

                /** This player didn't choose a partner, so he stays in the pile */
                if (!partner) {
                    continue;
                }

                /** The partner is already taken */
                if (!rejects.has(partner)) {
                    continue;
                }

                /** If the partner didn't pick this player, no match */
                if (signups.get(partner) !== user) {
                    continue;
                }

                /** We have a match */
                teams.push(new Team(user, partner));
                rejects.delete(user);
                rejects.delete(partner);
            }
        }

        let dropped: string | undefined;

        /** If we have an odd number, we have to drop someone */
        if (rejects.size % 2 !== 0) {
            dropped = _.sample(Array.from(rejects.values()));
            assert(dropped);
            rejects.delete(dropped);
        }

        assert(rejects.size % 2 === 0);

        /** Create random teams from everyone left in the pile */

        const left = Array.from(rejects.values());

        while (left.length > 0) {
            const [a , b] = [left.pop(), left.pop()];
            assert(a);
            assert(b);
            teams.push(new Team(a, b));
        }

        return [teams, dropped];
    }


    private createBracket(): [Map<number, Game>, Game[][]] {

        const { teams } = this;

        const team_count = teams.length;

        /** Not enough teams, return empty */
        if (team_count < 4) {
            return [new Map(), []];
        }

        let game_count = 2;

        while (team_count > (2 * game_count)) {
            game_count *= 2
        }

        let byes = (game_count * 2) - team_count;

        const round_count = Math.floor(Math.log2(game_count)) + 1

        const rounds: Game[][] = [];
        const games = new Map<number, Game>();

        for (let i = 0; i < round_count; i++) {
            rounds.push([]);
        }

        for (let i = 0; i < game_count; i++) {
            const game = new Game(i + 1, 1);
            rounds[0].push(game);
            games.set(game.id, game);
        }

        function populate_game(index: number, round: number, byes: number, top: number, bottom: number) {
            const game = rounds[round][index];
            assert(game);
            game.teams.push(teams[top]);
            top += 1
            if (byes > 0) {
                game.teams.push(Team.bye);
                byes -= 1;
                game.started = true;
                game.finished = true;
            }
            else {
                game.teams.push(teams[bottom]);
                bottom -= 1;
            }
            game.row = index * 2;
            return [byes, top, bottom];
        }

        let top_team = 0;
        let bot_team = teams.length - 1;

        for (let i = 0; i < game_count / 2; i++) {
            const top_bracket = i;
            [byes, top_team, bot_team] =
                populate_game(top_bracket, 0, byes, top_team, bot_team);
            const bot_bracket = game_count - (1 + i);
            [byes, top_team, bot_team] =
                populate_game(bot_bracket, 0, byes, top_team, bot_team);
        }

        let round_games = game_count / 2;
        let row = 1;
        let game_id = game_count + 1;

        for (let round = 2; round < round_count + 1; round++) {

            const col = 2 * (round - 1);

            for (let i = 0; i < round_games; i++) {

                const game = new Game(game_id, round);

                rounds[round - 1].push(game);

                games.set(game.id, game);

                const previous1 = rounds[round - 2][i * 2];
                const previous2 = rounds[round - 2][(i * 2) + 1];

                game.previous_games.push(previous1);
                game.previous_games.push(previous2);

                previous1.next_game = game;
                previous2.next_game = game;

                game.col = col;
                game.row = row + ((game_count / round_games) * i * 2);

                game_id += 1
            }

            row += Math.floor(Math.pow(2, round - 1));

            round_games /= 2;
        }

        return [games, rounds];
    }

    async run() {
        /** Let'er rip! */
        try {
            await Promise.all(this.rounds[0].map((game) => game.start(this)));
        }
        catch (error) {
            this.failed = true;
            throw error;
        }
    }
}
