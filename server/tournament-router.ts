import assert from 'node:assert';

import _ from 'lodash';
import express, { NextFunction, Request, Response } from 'express';
import fetch from 'node-fetch';

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
import { State } from './tournament';
import config from './config';

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
    fif(!user.isStandard, 'guest');
    const { params } = req;
    const id = parseInt(params.id, 10);
    const partner = params.partner === 'null' ? null : params.partner;
    const scheduler = Scheduler.get();
    const t = scheduler.tourneys.get(id);
    fa(t, 'invalid-tournament');
    fif(!t.isOpen, 'not-open');
    fif(partner && !User.get(partner), 'invalid-partner');

    /** This will add it to the database and push an update */
    scheduler.register(t.id, user.id, partner);

    res.json({});
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

router.get('/users', (req, res) => {
    type UserStatus =
        'playing-in-t' |
        'playing' |
        'invited' |
        'signed-up';
    const result: Record<string, UserStatus> = {};
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
    pusher.ps.userIds.forEach((userId) => {
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
    res.json(result);
});

router.post('/issue', express.json(), async (req, res) => {
    const { user, body } = req;
    if (!user) {
        return res.sendStatus(403);
    }
    if (!body?.text) {
        return res.sendStatus(400);
    }
    const url = 'https://api.github.com/repos/ppissanetzky/fortee2/issues';
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'Authorization': `Bearer ${config.FT2_GH_TOKEN}`,
        },
        body: JSON.stringify({
            title: `Automatic by ${user.name}`,
            body: body.text
        })
    });
    if (response.status !== 201) {
        return res.sendStatus(500);
    }
    res.sendStatus(200);
});

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
