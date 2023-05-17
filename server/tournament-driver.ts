import assert from 'node:assert';
import _ from 'lodash';

import Tournament from './tournament';
import Dispatcher from './dispatcher';
import GameRoom, { GameRoomStatus } from './game-room';
import { TableBuilder } from './table-helper';
import { Rules } from './core';
import { expected, makeDebug } from './utility';
import nextBotName from './bot-names';
import ms from 'ms';
import User from './users';

function user(id: string) {
    return {id, name: User.getName(id)};
}

export class Team {

    static bye = new Team('', '');

    public readonly users: string[];

    public disq = false;

    constructor(a: string, b: string) {
        this.users = [a, b];
    }

    clone(): Team {
        if (this === Team.bye) {
            return this;
        }
        const [a, b] = this.users;
        return new Team(a, b);
    }

    get isBye(): boolean {
        return this === Team.bye;
    }

    get namesOrBye(): 'bye' | string[] {
        if (this.isBye) {
            return 'bye';
        }
        return this.users.map((id) => User.getName(id));
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

    public readonly driver: TournamentDriver;
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

    constructor(driver: TournamentDriver, id: number, round: number) {
        this.driver = driver;
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

    otherTeam(team: Team): Team {
        const [result] = _.difference(this.teams, [team]);
        assert(result);
        return result;
    }

    get status(): GameStatus {
        return {
            tid: this.driver.t.id,
            id: this.id,
            round: this.round,
            us: this.teams[0]?.namesOrBye,
            them: this.teams[1]?.namesOrBye,
            disq: {
                us: this.teams[0]?.disq,
                them: this.teams[1]?.disq,
            },
            started: this.started,
            finished: this.finished,
            room: this.room?.status
        }
    }

    update() {
        this.driver.emit('gameUpdate', this.status);
    }

    gameOver(winners: string[]) {
        this.driver.emit('gameOver', {
            t: this.driver.t,
            round: this.round,
            winners
        });
    }

    tournamentOver(winners: Team): void {
        assert(!this.next_game);
        this.finished = true;
        this.driver.winners = winners.users.map((userId) => User.getName(userId));
        this.driver.emit('tournamentOver', {
            t: this.driver.t,
            winners
        });
        this.update();
    }

    async advanceTeam(team: Team): Promise<void> {
        assert(team);
        assert(this.teams.includes(team));
        assert(!team.isBye);
        this.finished = true;
        const winners = team.users;
        this.gameOver(winners);
        const { next_game } = this;
        if (!next_game) {
            return this.tournamentOver(team);
        }
        next_game.teams.push(team.clone());
        return next_game.start();
    }

    async start(): Promise<void> {

        const { driver, next_game, teams } = this;

        let debug = makeDebug('t-game')
            .extend(`t${driver.t.id}-r${this.round}-g${this.id}`);

        /**
         * This one is not ready to start, we'll try again when another
         * game finishes
         */

        if (teams.length < 2) {
            debug('waiting for teams');
            this.update();
            return Promise.resolve();
        }

        /** Gather the byes, could be 0, 1 or 2 */
        const byes = teams.filter((team) => team.isBye);

        debug('has', byes.length, 'byes');

        /** This is the final game and we got here because a bye was advanced */
        if (!next_game && byes.length > 0) {
            this.started = true;
            this.finished = true;
            /**
             * This can happen when earlier teams were disqualified
             * If it is the final game, no one wins, the tourney fails
             */
            if (byes.length === 2) {
                debug('both byes at final game, failing');
                this.update();
                throw new Error('No teams made it to the final game');
            }
            /** We should not get here with zero byes */
            debug('one bye at final game');
            const winners = expected(this.bye);
            return this.tournamentOver(winners);
        }

        /**
         * Now, we know there is a next game and 2 teams, but there could
         * still be 0, 1 or 2 byes
         */
        const other = this.bye;
        if (other) {
            assert(next_game);

            /** Announce the bye if there is only one bye */
            if (!other.isBye) {
                for (const user of other.users) {
                    if (!GameRoom.isBot(user)) {
                        driver.emit('announceBye', {
                            t: driver.t,
                            round: this.round,
                            user
                        });
                    }
                }
            }

            /** Advance this team to the next game, note that it could be a bye */
            next_game.teams.push(other.clone());
            this.started = true;
            this.finished = true;
            this.update();
            return Promise.resolve(next_game.start());
        }

        /** No byes, we can set-up the game */
        const table = new TableBuilder([
            user(teams[0].users[0]),
            user(teams[1].users[0]),
            user(teams[0].users[1]),
            user(teams[1].users[1])
        ]);

        return new Promise((resolve, reject) => {

            const room = new GameRoom({
                rules: Rules.fromAny(driver.t.rules),
                table,
                tournament: driver.t
            });

            debug = debug.extend(`room-${room.id}`);

            debug('starting with %j', table);

            this.room = room;

            this.update();

            room.on('userJoined', (user) => {
                debug('joined', user);
                this.update();
            });

            room.on('userLeft', (user) => {
                debug('left', user);
                this.update();
            });

            room.on('gamePaused', () => {
                debug('paused');
                this.update();
            });

            room.on('gameResumed', () => {
                debug('resumed');
                this.update();
            });

            room.on('endOfHand', () => this.update());
            room.on('gameIdle', () => this.update());

            room.once('expired', (status) => {
                debug('room expired %j', status);
                this.update();
                const teams = [
                    {status: status.us, team: this.teams[0]},
                    {status: status.them, team: this.teams[1]}
                ];
                /** All the teams where every user is connected */
                const connected = teams.filter(({status: {team}}) =>
                    team.every(({connected}) => connected)).map(({team}) => team);
                /**
                 * Only one team is connected, so we can blame the other one and
                 * advance this one. The other options are: 1) both teams are
                 * connected, or neither is connected. We can't make a decision
                 * based on either of those.
                 */
                if (connected.length === 1) {
                    const [winners] = connected;
                    this.otherTeam(winners).disq = true;
                    return resolve(this.advanceTeam(winners));
                }
                /** Teams that have no outstanding messages are responsive */
                const responsive = teams.filter(({status: {team}}) =>
                    team.every(({outstanding}) => !outstanding)).map(({team}) => team);
                /** Same as above */
                if (responsive.length === 1) {
                    const [winners] = responsive;
                    this.otherTeam(winners).disq = true;
                    return resolve(this.advanceTeam(winners));
                }
                /** Now, let's look at marks */
                let leading: Team | undefined = undefined;
                if (status.us.marks > status.them.marks) {
                    leading = this.teams[0];
                } else if (status.them.marks > status.us.marks) {
                    leading = this.teams[1];
                }
                /** If one is leading, we're going to advance that one */
                if (leading) {
                    this.otherTeam(leading).disq = true;
                    return resolve(this.advanceTeam(leading));
                }
                /**
                 * Neither is leading, we're going to advance a bye - both
                 * teams get disqualified
                 */

                this.teams.forEach((team) => team.disq = true);

                /** This is the final game, so the tournament has no winners */
                if (!next_game) {
                    debug('no winners, both teams in final table disqualified');
                    this.finished = true;
                    reject(new Error('Both final teams disqualified'));
                    this.update();
                    return;
                }
                /** Otherwise, we push a bye for the next game */
                this.finished = true;
                this.update();
                next_game.teams.push(Team.bye);
                this.gameOver([]);
                resolve(next_game.start());
            });

            room.once('closed', () => this.update());

            room.once('gameStarted', () => {
                debug('started');
                this.started = true;
                this.update();
            });

            room.once('gameError', (error) => {
                debug('error', error);
                this.finished = true;
                reject(error);
                this.update();
            });

            room.once('gameOver', ({save}) => {
                const team = save.winnerIndices.includes(0)
                    ? this.teams[0] : this.teams[1];
                resolve(this.advanceTeam(team));
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

export interface GameStatus {
    tid: number;
    id: number;
    round: number;
    /** Names in the bracket, undefined if not assigned yet, or 'bye' */
    us?: 'bye' | string[];
    /** Names in the bracket, undefined if not assigned yet, or 'bye' */
    them?: 'bye' | string[];
    disq: {
        us: boolean,
        them: boolean
    };
    started: boolean;
    finished: boolean;
    room?: GameRoomStatus;
}

export interface GameOver {
    t: Tournament;
    round: number;
    /** User IDs */
    winners: string[];
}

export interface TournamentOver {
    t: Tournament;
    winners: Team;
}

export interface TournamentDriverEvents {
    /** Something changed in a game */
    gameUpdate: GameStatus;

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
     * The name of the partner that the player got after signup
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
            const partner = team.other(userId);
            this.actualPartner = partner ? User.getName(partner) : undefined;

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
                this.url = room.url;
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

    get gameStatus(): GameStatus[][] {
        return this.rounds.map((games) => games.map((game) => game.status));
    }

    /**
     * Pairs up all the signups and returns teams as well as one
     * person who got dropped (or none)
     */

    private pickTeams(): [Team[], string | undefined] {
        /** Get the signups in a map of user/partner and shuffle it */
        const signups = new Map(_.shuffle(Array.from(this.t.signups.entries())));

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
            const game = new Game(this, i + 1, 1);
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

                const game = new Game(this, game_id, round);

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
            await Promise.all(this.rounds[0].map((game) => game.start()));
        }
        catch (error) {
            this.debug('failed with', error);
            this.failed = true;
            throw error;
        }
    }
}
