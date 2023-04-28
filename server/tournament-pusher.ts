import assert from 'node:assert';

import _ from 'lodash';

import { Rules } from './core';
import Scheduler from './tournament-scheduler';
import PushServer from './push-server';
import { makeDebug } from './utility';
import Tournament, { State } from './tournament';
import { Status } from './driver';
import GameRoom from './game-room';
import { User } from './table-helper';

const debug = makeDebug('pusha-t');

export interface TournamentUpdate extends Partial<Status> {
    id: number;
    name: string;
    startTime: string;
    utcStartTime: number;
    openTime: string;
    closeTime: string;
    utcCloseTime: number;
    choosePartner: boolean;
    rules: string[];
    /** How many players are signed up for this one */
    count: number;
    /** The state of the tourney, only one will be true */
    open: boolean;
    wts: boolean;
    playing: boolean;
    canceled: boolean;
    done: boolean;
    later: boolean;
    /** The winners */
    winners?: string[];
    /** Player specific */
    signedUp: boolean;
    partner: string | null;
}

type TableStatus = 't' | 'hosting' | 'invited';

export interface TableUpdate {
    status?: TableStatus;
    url?: string;
    with?: User[];
    token?: string;
}

export default class TournamentPusher {

    private readonly scheduler = Scheduler.get();

    public readonly ps = new PushServer();

    constructor() {
        /** When a new socket connects, we send some initial info */
        this.ps.on('connected', (userId) => this.connected(userId));

        /** When something happens in a game room, we update that user */
        GameRoom.events
            .on('created', (room) => this.pushRoom(room))
            .on('closed', (room) => this.pushRoom(room));

        this.scheduler
            .on('registered', ({t}) => this.updateAll(t))
            .on('unregistered', ({t}) => this.updateAll(t))
            .on('signupOpen', (t) => this.updateAll(t))
            .on('signupClosed', (t) => this.updateAll(t))
            .on('canceled', (t) => this.updateAll(t))
            .on('failed', (t) => this.updateAll(t))
            .on('started', (t) => this.updateAll(t))
            .on('gameOver', ({t}) => this.updateAll(t))
            .on('tournamentOver', ({t}) => this.updateAll(t))

            .on('dropped', () => this.refresh())
            .on('newDay', () => this.refresh())

            .on('summonTable', ({t, room}) => this.updateSome(t, room.table.ids))
            .on('announceBye', ({t, user}) => this.updateOne(t, user));
    }

    private updateFor(t: Tournament, userId: string): TournamentUpdate {
        const driver = Scheduler.driver(t.id);
        const status = driver?.statusFor(userId) || {};
        return {
            id: t.id,
            name: t.name,
            startTime: t.startTime,
            utcStartTime: t.utcStartTime,
            openTime: t.openTime,
            closeTime: t.closeTime,
            utcCloseTime: t.utcCloseTime,
            choosePartner: t.choosePartner,
            rules: Rules.fromAny(t.rules).parts(),
            /** How many players are signed up for this one */
            count: t.signups.size,
            /** The state of the tourney, only one will be true */
            open: t.state === State.OPEN,
            wts: t.state === State.WTS,
            playing: t.state === State.PLAYING,
            canceled: t.state === State.CANCELED,
            done: t.state === State.DONE,
            later: t.state === State.LATER,
            /** The winners */
            winners: t.winners?.split(',') || undefined,
            /** Player specific */
            signedUp: t.isSignedUp(userId),
            partner: t.signups.get(userId) || null,
            /** Status from the tournament driver once it starts */
            ...status
        };
    }

    private updateAll(t: Tournament) {
        this.ps.forEach('tournament', (userId) =>
            this.updateFor(t, userId));
    }

    private updateOne(t: Tournament, userId: string) {
        const update = this.updateFor(t, userId);
        this.ps.pushToOne(userId, 'tournament', update);
    }

    private updateSome(t: Tournament, userIds: string[]) {
        for (const userId of userIds) {
            this.updateOne(t, userId);
        }
    }

    private nextTourneys(): Tournament[] {
        const tourneys = Array.from(this.scheduler.tourneys.values());
        /** We only send the next 4 to keep the clutter down */
        return _.sortBy(tourneys, 'utcStartTime').slice(0, 4);
    }

    /** A user just connected */

    private connected(userId: string) {
        const updates = this.nextTourneys()
            .map((t) => this.updateFor(t, userId));
        this.ps.pushToOne(userId, 'tournaments', updates);
        this.pushTable(userId);
    }

    /** A new day, or a tournament dropped off the list */

    private refresh() {
        const tourneys = this.nextTourneys();
        this.ps.forEach('tournaments', (userId) =>
             tourneys.map((t) => this.updateFor(t, userId)));
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
    }
}
