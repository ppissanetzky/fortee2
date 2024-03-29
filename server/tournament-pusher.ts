import _ from 'lodash';

import { Rules } from './core';
import Scheduler from './tournament-scheduler';
import PushServer, { type Users } from './push-server';
import { makeDebug } from './utility';
import Tournament, { State } from './tournament';
import { GameStatus, Status } from './tournament-driver';
import GameRoom from './game-room';
import { User as TableUser } from './table-helper';
import Chatter from './chatter';
import User from './users';

const debug = makeDebug('pusha-t');

type Signup = [string, string | null];

export interface TournamentUpdate {
    id: number;
    name: string;
    startTime: string;
    utcStartTime: number;
    openTime: string;
    closeTime: string;
    utcCloseTime: number;
    choosePartner: boolean;
    fullRules: Rules;
    rules: string[];
    signups: Signup[];
    /** How many players are signed up for this one */
    count: number;
    /** The state of the tourney, only one will be true */
    open: boolean;
    wts: boolean;
    playing: boolean;
    canceled: boolean;
    done: boolean;
    later: boolean;
    /** The games when the tournament runs */
    games: null | GameStatus[][];
}

function makeTournamentUpdate(t: Tournament): TournamentUpdate {
    const games = t.driver?.gameStatus || null;
    const signups = Array.from(t.signups.entries()).map(([s, p]) =>
        [User.getName(s), p ? User.getName(p) : null] as Signup);
    const rules = Rules.fromAny(t.rules);
    return {
        id: t.id,
        name: t.name,
        startTime: t.startTime,
        utcStartTime: t.utcStartTime,
        openTime: t.openTime,
        closeTime: t.closeTime,
        utcCloseTime: t.utcCloseTime,
        choosePartner: t.choosePartner,
        fullRules: rules.toJSON(),
        rules: rules.parts(),
        signups,
        /** How many players are signed up for this one */
        count: t.signups.size,
        /** The state of the tourney, only one will be true */
        open: t.state === State.OPEN,
        wts: t.state === State.WTS,
        playing: t.state === State.PLAYING,
        canceled: t.state === State.CANCELED,
        done: t.state === State.DONE,
        later: t.state === State.LATER,
        games
    };
}

export interface UserUpdate extends Partial<Status> {
    id: number;
    signedUp: boolean;
    partner: string | null;
}

export interface SummonTable {
    name: string;
    url: string;
}

function makeUserUpdate(t: Tournament, userId: string): UserUpdate {
    const status = t.driver?.statusFor(userId) || {};
    return {
        id: t.id,
        signedUp: t.isSignedUp(userId),
        partner: t.signups.get(userId) || null,
        /** Status from the tournament driver once it starts */
        ...status
    };
}

type TableStatus = 't' | 'hosting' | 'invited';

export interface TableUpdate {
    status?: TableStatus;
    url?: string;
    with?: TableUser[];
    tid?: number;
    token?: string;
}

export default class TournamentPusher {

    private readonly scheduler = Scheduler.get();

    private readonly chatter: Chatter

    public readonly ps = new PushServer();

    constructor() {
        this.chatter = new Chatter(this.ps);

        /**
         * When a new socket connects, we send some initial info. We do it in
         * the next tick to allow other, more important connected messages to
         * go out sooner
         */
        this.ps.on('connected', ({userId}) =>
            process.nextTick(() => this.connected(userId)));

        /** When something happens in a game room, we update that user */
        GameRoom.events
            .on('created', (room) => this.pushRoom(room))
            .on('closed', (room) => this.pushRoom(room))
            .on('joined', () => this.pushUserStatus())
            .on('left', () => this.pushUserStatus())

        this.scheduler
            .on('registered', ({t}) => this.updateAll(t))
            .on('unregistered', ({t}) => this.updateAll(t))
            .on('signupOpen', (t) => {
                this.updateAll(t);
                this.chatter.systemMessage(`The ${t.name} tournament is now open`);
            })
            .on('signupClosed', (t) => this.updateAll(t))
            .on('canceled', (t) => this.updateAll(t))
            .on('failed', (t) => this.updateAll(t))
            .on('started', (t) => this.updateAll(t))
            .on('gameOver', ({t}) => this.updateAll(t))
            .on('tournamentOver', ({t}) => this.updateAll(t))
            .on('gameUpdate', (status) => this.ps.pushToAll('game', status))

            .on('updated', () => this.refresh())
            .on('added', () => this.refresh())
            .on('reload', () => this.refresh())
            .on('dropped', () => this.refresh())

            .on('summonTable', ({t, room}) => this.summonTable(t, room))
            .on('announceBye', ({t, user}) => this.updateOne(t, user));
    }

    private updateAll(t: Tournament) {
        this.ps.pushToAll('tournament', makeTournamentUpdate(t));
        this.ps.forEach('user', (userId) => makeUserUpdate(t, userId));
        this.pushUserStatus();
    }

    private updateOne(t: Tournament, userId: string, room?: GameRoom) {
        this.ps.pushToOne(userId, 'tournament', makeTournamentUpdate(t));
        this.ps.pushToOne(userId, 'user', makeUserUpdate(t, userId));
        if (room) {
            this.ps.pushToOne(userId, 'summon', {
                name: t.name,
                url: room.url
            });
        }
    }

    private summonTable(t: Tournament, room: GameRoom) {
        const userIds: string[] = room.table.ids;
        for (const userId of userIds) {
            this.updateOne(t, userId, room);
        }
    }

    private nextTourneys(): Tournament[] {
        const tourneys = Array.from(this.scheduler.tourneys.values())
            .filter((t) => t.state !== State.CANCELED)
        return _.sortBy(tourneys, (t) => t.utcStartTime);
    }

    /** A user just connected */

    private connected(userId: string) {
        const tourneys = this.nextTourneys();
        const updates = tourneys.map((t) => makeTournamentUpdate(t));
        this.ps.pushToOne(userId, 'tournaments', updates);
        tourneys.forEach((t) =>
            this.ps.pushToOne(userId, 'user', makeUserUpdate(t, userId)));
        this.pushTable(userId);
        this.pushUserStatus();
    }

    /** A new day, or a tournament dropped off the list */

    private refresh() {
        this.ps.userIds.forEach((userId) => this.connected(userId));
        this.pushUserStatus();
    }

    private pushTable(userId: string) {
        const map = Array.from(GameRoom.rooms.values())
            .filter(({table}) => table.has(userId))
            .reduce((result, room) => {
                if (room.t) {
                    result.set('t', room);
                }
                if (room.table.host?.id === userId) {
                    result.set('hosting', room);
                }
                result.set('invited', room);
                return result;
            }, new Map<TableStatus, GameRoom>());

        const result: TableUpdate = {};

        (['t', 'hosting', 'invited'] as TableStatus[]).some((status) => {
            const room = map.get(status);
            if (room) {
                result.status = status;
                result.url = room.url;
                result.token = room.token;
                result.tid = room.t?.id;
                result.with = room.table.users()
                    .filter((user) => user.id !== userId);
                return true;
            }
        });

        debug('table for %s : %j', userId, result);

        this.ps.pushToOne(userId, 'table', result);
    }

    private pushRoom(room: GameRoom) {
        room.table.users().forEach(({id}) => this.pushTable(id));
        this.pushUserStatus();
    }

    private pushUserStatus() {
        const result: Users = {};
        const rooms = Array.from(GameRoom.rooms.values());
        const tourneys = Array.from(Scheduler.get().tourneys.values()).filter((t) => {
            switch (t.state) {
                case State.CANCELED:
                case State.DONE:
                case State.LATER:
                    return false
            }
            return true;
        });
        this.ps.userIds.forEach((userId) => {
            /** Check the rooms first */
            for (const room of rooms) {
                if (room.connected.includes(userId)) {
                    result[userId] = room.t ? 'playing-in-t' : 'playing';
                    return;
                }
                const { table } = room;
                if (table.has(userId)) {
                    result[userId] = room.t ? 'playing-in-t' : 'invited';
                    return;
                }
            }
            /** Now, look at tourneys */
            for (const t of tourneys) {
                if (t.isSignedUp(userId)) {
                    switch (t.state) {
                        case State.PLAYING:
                            if (t.driver?.stillIn.has(userId)) {
                                result[userId] = 'playing-in-t';
                                return;
                            }
                            break;
                        case State.OPEN:
                        case State.WTS:
                            result[userId] = 'signed-up';
                            break;
                    }
                }
            }
        });
        this.ps.pushToAll('users', result);
    }
}
