import assert from 'node:assert';

import _ from 'lodash';
import express, { NextFunction, Request, Response } from 'express';

import Scheduler from './tournament-scheduler';
import { makeDebug } from './utility';
import { TableBuilder } from './table-helper';
import GameRoom from './game-room';
import Socket from './socket';
import TournamentPusher from './tournament-pusher';
import tdRouter from './td-router';
import statsRouter from './stats';
import { fail, fif, fa, validateRules, AppError } from './validate';
import User from './users';

const debug = makeDebug('t-router');

const pusher = new TournamentPusher();

const router = express.Router();

export default router;

const upgrade = pusher.ps.upgrade();

/** The WS upgrade route for the main page */

router.get('/tws', upgrade);

/** The tournament tracker upgrade */

router.get('/track/:id', (req, res, next) => {
    const id = parseInt(req.params.id, 10);
    if (!id || isNaN(id)) {
        return res.sendStatus(400);
    }
    const t = Scheduler.get().tourneys.get(id);
    if (!t) {
        return res.sendStatus(404);
    }
    upgrade(req, res, next);
});

/**
 * The main page calls this both to get role information and to see whether
 * it gets a 401 and needs to auth
 */

router.get('/me', async (req, res) => {
    const { user } = req;
    assert(user);
    debug('you %j', user);
    res.json(user);
});

/** These could be done with the WS */

router.get('/signup/:id/:partner', (req, res) => {
    const { user } = req;
    assert(user);
    try {
        fif(!user.isStandard, 'guest');
        const { params } = req;
        const id = parseInt(params.id, 10);
        const partner = params.partner === 'null' ? null : params.partner;
        const scheduler = Scheduler.get();
        const t = scheduler.tourneys.get(id);
        fif(!t, 'invalid-tournament');
        assert(t);
        fif(!t.isOpen, 'not-open');
        fif(partner && !User.get(partner), 'invalid-partner');

        /** This will add it to the database and push an update */
        scheduler.register(t.id, user.id, partner);

        res.json({});
    }
    catch (error) {
        fail('oops');
    }
});

router.get('/dropout/:id', (req, res) => {
    const { user } = req;
    assert(user);
    try {
        fif(!user.isStandard, 'guest');
        const { params } = req;
        const id = parseInt(params.id, 10);
        const scheduler = Scheduler.get();
        const t = scheduler.tourneys.get(id);
        fif(!t, 'invalid-tournament');
        assert(t);
        fif(!t.isOpen, 'not-open');
        /** This will add it to the database and push an update */
        scheduler.unregister(id, user.id);
        res.json({});
    }
    catch (error) {
        fail('oops');
    }
});

router.post('/start-game', express.json(), (req, res) => {
    const { user, body } = req;
    assert(user);
    debug('custom game %j', body);
    const { partner, left, right } = body;
    const players: string [] = [user.id, partner, left, right].filter((p) => p);
    fif(_.uniq(players).length !== players.length, 'You have duplicate players');
    interface User { id: string; name: string; }
    const users = new Map<string, User>(players.map((userId) => {
        const info = User.get(userId);
        fif(!info, 'Something is wrong with the players');
        assert(info);
        return [userId, {id: userId, name: info.name}];
    }));
    const rules = validateRules(body.rules);

    fif(Socket.isConnected(user.id),
        'You are already connected, maybe you left a tab open?');

    for (const user of users.values()) {
        fif(!pusher.ps.has(user.id),
            `${user.name} is not here, ask them to come to this site`);
    }

    const table = new TableBuilder([
        users.get(user.id) || null,
        users.get(left) || null,
        users.get(partner) || null,
        users.get(right) || null
    ]);

    const {url} = new GameRoom({rules, table});

    res.json({url});
});

router.get('/decline/:token', (req, res) => {
    const { user, params: { token } } = req;
    fa(user, 'Invalid user');
    fa(token, 'Empty token');
    const room = GameRoom.rooms.get(token);
    fa(room, 'Invalid room');
    fa(room.decline(user.id, user.name), 'Not in room');
    res.sendStatus(200);
});

// router.post('/ss', express.json(), (req, res) => {
//     console.log(JSON.stringify(req.body));
//     res.sendStatus(200);
// });

/** The TD router */

router.use('/td', tdRouter);

/** The stats router */

router.use('/stats', statsRouter);

/**-----------------------------------------------------------------------------
 * MUST BE LAST
 * -----------------------------------------------------------------------------
 */

router.use((error: any, req: Request, res: Response, next: NextFunction) => {
    if (error instanceof AppError) {
        return res.json({error: error.message});
    }
    next(error);
});
