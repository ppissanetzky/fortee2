import assert from 'node:assert';

import _ from 'lodash';
import express from 'express';
import { WebSocket } from 'ws';

import Scheduler from './tournament-scheduler';
import TexasTime from './texas-time';
import * as db from './tournament-db';
import Tournament, { State } from './tournament';
import { Rules } from './core';
import { expected, makeDebug } from './utility';
import WsServer from './ws-server';

const debug = makeDebug('t-router');

const router = express.Router();

export default router;

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

router.get('/', async (req, res) => {
    const { user } = req;
    assert(user);
    const today = TexasTime.today();
    const users = db.getUsers();
    delete users[user.id];
    const signups = db.getSignupsForUser(today, user.id)
    const tournaments = db.getTournaments(today, 4)
        .map((row) => externalT(user, signups, row));
    res.json({users, tournaments, you: user.name});
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


