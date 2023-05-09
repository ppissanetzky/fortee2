import assert from 'node:assert';

import _ from 'lodash';
import express from 'express';

import * as db from './tournament-db';
import Tournament, { State } from './tournament';
import { Rules } from './core';
import { makeDebug } from './utility';
import { fa, fif, validateTournament } from './validate';
import Scheduler from './tournament-scheduler';
import User, { UserPrefs, UserType } from './users';

const debug = makeDebug('td-router');

const router = express.Router();

export default router;

function toJson(t: Tournament): Record<string, any> {
    const { recurring } = t;
    const rules = Rules.fromAny(t.rules);
    let every = '';
    switch (recurring) {
        case 1: every = 'Monday'; break;
        case 2: every = 'Tuesday'; break;
        case 3: every = 'Wednesday'; break;
        case 4: every = 'Thursday'; break;
        case 5: every = 'Friday'; break;
        case 6: every = 'Saturday'; break;
        case 7: every = 'Sunday'; break;
        case 8: every = 'Every day'; break;
        case 9: every = 'Weekdays'; break;
    }
    return {
        ...t.toJSON(),
        every,
        rules,
        rulesDesc: rules.parts().join(', '),
        startTime: t.startTime,
        openTime: t.openTime,
        closeTime: t.closeTime
    };
}

/**-----------------------------------------------------------------------------
 * Routes that have to be guarded by user roles after here
 * -----------------------------------------------------------------------------
 */

router.use((req, res, next) => {
    const { user } = req;
    assert(user);
    if (user.roles.includes('td')) {
        return next();
    }
    return res.sendStatus(403);
});

router.get('/', (req, res) => {
    const tournaments = db.getRecurringTournaments().map((row) =>
        toJson(new Tournament(row)));
    res.json({tournaments});
});

router.get('/today', (req, res) => {
    const tournaments = Scheduler.tourneys().map((t) => toJson(t));
    res.json({tournaments});
});

router.post('/save', express.json(), (req, res) => {
    const { body } = req;
    debug('saving %j', body);
    const t = validateTournament(body);
    debug('validated %j', t.toJSON());
    const scheduler = Scheduler.get();
    const scheduled = scheduler.tourneys.get(t.id);
    fif(scheduled && scheduled.state !== State.LATER,
        'Cannot change a tournament after it opens');
    t.save();
    if (!t.recurring) {
        fif(!scheduler.reloadOne(t.id), 'Something went wrong rescheduling');
    }
    res.json({tournament: toJson(t)});
});

router.get('/delete/:tid', (req, res) => {
    const { params: { tid } } = req;
    debug('deleting', tid);
    const id = parseInt(tid, 10);
    fif(isNaN(id) || !_.isSafeInteger(id) || id <= 0, 'Invalid tournament');
    fif(!Scheduler.get().delete(id), 'Tournament not found');
    db.deleteTournament(id);
    res.json({});
});

router.get('/reload', (req, res) => {
    Scheduler.get().reload();
    res.sendStatus(200);
});

router.get('/users/:type', (req, res) => {
    const { params: { type } } = req;
    res.json(User.listOf(type as UserType));
});

router.post('/save/user', express.json(), (req, res) => {
    const { body } = req;
    debug('saving %j', body);
    const existing = User.get(body.id);
    fa(existing, 'Invalid user');
    const { type , prefs } = body;
    fif(!['guest', 'standard', 'blocked'].includes(type), 'Invalid type');
    fa(prefs && _.isObject(prefs), 'Invalid prefs');
    existing.update(type as UserType, prefs as UserPrefs);
    res.json({});
});
