import assert from 'node:assert';

import _ from 'lodash';
import express, { NextFunction, Request, Response } from 'express';
import { WebSocket } from 'ws';

import Scheduler from './tournament-scheduler';
import TexasTime from './texas-time';
import * as db from './tournament-db';
import Tournament, { State } from './tournament';
import { Rules } from './core';
import { expected, makeDebug } from './utility';
import WsServer from './ws-server';
import { TableBuilder, User } from './table-helper';
import GameRoom, { Invitation } from './game-room';
import { get } from 'node:https';

const debug = makeDebug('t-router');

const router = express.Router();

export default router;

class AppError extends Error {
    constructor(message: string) {
        super(message);
    }
}

function fail(message: string): never {
    throw new AppError(message);
}

const scheduler = Scheduler.get();

/** A map for a specific user's signups. Maps T id to the chosen partner */

type Signups = Map<number, string | null>;

function externalT(user: Express.User, signups: Signups, row: db.TournamentRowWithCount) {
    const t = new Tournament(row);
    const driver = Scheduler.driver(t.id);
    const status = driver?.statusFor(user.id) || {};
    return {
        id: t.id,
        name: t.name,
        startTime: t.startTime,
        openTime: t.openTime,
        closeTime: t.closeTime,
        choosePartner: t.choosePartner,
        rules: Rules.fromAny(t.rules).parts(),
        /** How many players are signed up for this one */
        count: row.count,
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
        signedUp: signups.has(t.id),
        partner: signups.get(t.id) || null,
        /** Status from the tournament driver once it starts */
        ...status
    }
}

function getInvitationFor(user: Express.User): Invitation | undefined {
    for (const room of GameRoom.rooms.values()) {
        if (!room.t && room.table.hasOther(user.id)) {
            return room.invitation
        }
    }
}

router.get('/', async (req, res) => {
    const { user } = req;
    assert(user);
    const today = TexasTime.today();
    const users = db.getUsers();
    delete users[user.id];
    const signups = db.getSignupsForUser(today, user.id)
    const tournaments = db.getTournaments(today, 4)
        .map((row) => externalT(user, signups, row));
    const invitation = getInvitationFor(user)
    res.json({
        users,
        you: user.name,
        tournaments,
        invitation
    });
});

router.get('/signup/:id/:partner', (req, res) => {
    const { user } = req;
    assert(user);
    try {
        if (!db.getUser(user.id)) {
            throw 'invalid-user';
        }
        const { params } = req;
        const id = parseInt(params.id, 10);
        const partner = params.partner === 'null' ? null : params.partner;
        const row = db.getTournament(id);
        if (!row) {
            throw 'invalid-tournament';
        }
        const t = new Tournament(row);
        if (!t.isOpen) {
            throw 'not-open';
        }
        if (partner && !db.getUser(partner)) {
            throw 'invalid-partner';
        }
        db.addSignup(t.id, user.id, partner);

        const signups = new Map<number, string | null>([[t.id, partner]]);
        res.json({tournament: externalT(user, signups,
            expected(db.getTournament(id)))});
    }
    catch (error) {
        if (_.isString(error)) {
            return res.json({error});
        }
        res.json({error: 'oops'});
    }
});

router.get('/dropout/:id', (req, res) => {
    const { user } = req;
    assert(user);
    try {
        if (!db.getUser(user.id)) {
            throw 'invalid-user';
        }
        const { params } = req;
        const id = parseInt(params.id, 10);
        const row = db.getTournament(id);
        if (!row) {
            throw 'invalid-tournament';
        }
        const t = new Tournament(row);
        if (!t.isOpen) {
            throw 'not-open';
        }
        db.deleteSignup(id, user.id);

        const signups = new Map();
        res.json({tournament: externalT(user, signups,
            expected(db.getTournament(id)))});
    }
    catch (error) {
        if (_.isString(error)) {
            return res.json({error});
        }
        res.json({error: 'oops'});
    }
});

const sockets = new Map<WebSocket, Express.User>();

function socketsFor(userId: string): WebSocket[] | undefined {
    const result: WebSocket[] = [];
    for (const [ws, user] of sockets.entries()) {
        if (user.id === userId) {
            result.push(ws);
        }
    }
    if (result.length > 0) {
        return result;
    }
}

router.get('/tws', async (req, res, next) => {
    try {
        const ws = await WsServer.get().upgrade(req);
        const user = expected(req.user);
        sockets.set(ws, user);
        ws.once('close', () => sockets.delete(ws));
    }
    catch (error) {
        next(error);
    }
});

function pushUpdate(id: number) {
    const row = db.getTournament(id);
    if (!row) {
        debug('no row for update to', id);
        return;
    }
    const allSignups = db.getSignups(id);
    for (const [ws, user] of sockets.entries()) {
        const signups = new Map<number, string | null>();
        if (allSignups.has(user.id)) {
            signups.set(id, allSignups.get(user.id) || null);
        }
        const tournament = externalT(user, signups, row);
        debug('push update', id, 'to', user.id, user.name);
        ws.send(JSON.stringify({tournament}));
    }
}

function push(thing: Record<string, any>) {
    debug('push %j', thing);
    for (const ws of sockets.keys()) {
        ws.send(JSON.stringify(thing));
    }
}

function pushToUser(user: Express.User, thing: Record<string, any>): boolean {
    const sockets = socketsFor(user.id);
    if (sockets) {
        const message = JSON.stringify(thing);
        sockets.forEach((ws) => {
            debug('push to %s %j', user.name, thing);
            ws.send(message);
        });
        return true;
    }
    return false;
}

scheduler.on('registered', ({t}) => pushUpdate(t.id));
scheduler.on('unregistered', ({t}) => pushUpdate(t.id));
scheduler.on('signupOpen', ({id}) => pushUpdate(id));
scheduler.on('signupClosed', ({id}) => pushUpdate(id));
scheduler.on('canceled', ({id}) => pushUpdate(id));
scheduler.on('failed', ({id}) => pushUpdate(id));
scheduler.on('started', ({id}) => pushUpdate(id));
scheduler.on('gameOver', ({t}) => pushUpdate(t.id));
scheduler.on('tournamentOver', ({t}) => pushUpdate(t.id));

scheduler.on('dropped', (id) => push({drop: id}));
scheduler.on('newDay', () => push({tomorrow: 1}));

// TODO: these could be sent only to the interested parties

scheduler.on('summonTable', ({t}) => pushUpdate(t.id));
scheduler.on('announceBye', ({t}) => pushUpdate(t.id));


router.post('/start-game', express.json(), (req, res) => {
    const { user, body } = req;
    assert(user);
    debug('custom game %j', body);
    const { partner, left, right, rules } = body;
    const players: string [] = [user.id, partner, left, right].filter((p) => p);
    if (_.uniq(players).length !== players.length) {
        return fail('You have duplicate players');
    }
    const users = new Map<string, Express.User>(players.map((userId) => {
        const name = db.getUser(userId);
        if (!name) {
            return fail('Something is wrong with the players');
        }
        return [userId, {id: userId, name}];
    }));
    let r: Rules;
    if (rules === 'default') {
        r = new Rules();
    }
    else {
        try {
            r = Rules.fromAny(JSON.stringify(rules));
        }
        catch (error) {
            return fail('The rules are invalid');
        }
    }
    assert(r);

    if (WsServer.isConnected(user.id)) {
        return fail(`You are already connected, maybe you left a tab open?`);
    }

    for (const user of users.values()) {
        if (!socketsFor(user.id)) {
            return fail(`${user.name} is not here, ask them to come to this site`);
        }
    }

    const table = new TableBuilder([
        users.get(user.id) || null,
        users.get(left) || null,
        users.get(partner) || null,
        users.get(right) || null
    ]);

    const room = new GameRoom({rules: r, table});

    for (const other of users.values()) {
        if (other.id !== user.id) {
            pushToUser(other, {
                invitation: room.invitation
            });
        }
    }

    room.gone.then(() => {
        for (const other of users.values()) {
            pushToUser(other, {drop: 'invitation'});
        }
    });

    res.json({url: room.url});
});

router.use((error: any, req: Request, res: Response, next: NextFunction) => {
    if (error instanceof AppError) {
        return res.json({error: error.message});
    }
    next(error);
});
