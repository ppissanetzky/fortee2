import assert from 'node:assert';

import express from 'express';

import * as db from './tournament-db';
import Tournament from './tournament';
import { Rules } from './core';
import { makeDebug } from './utility';
import { validateTournament } from './validate';

const debug = makeDebug('td-router');

const router = express.Router();

export default router;

/**-----------------------------------------------------------------------------
 * Routes that have to be guarded by user roles after here
 * -----------------------------------------------------------------------------
 */

router.use((req, res, next) => {
    const { user } = req;
    assert(user);
    const info = db.getUser(user.id);
    if (info?.roles.includes('td')) {
        return next();
    }
    return res.sendStatus(403);
});

router.get('/', (req, res) => {
    const tournaments = db.getRecurringTournaments().map((row) => {
        const t = new Tournament(row);
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
    });
    res.json({tournaments});
});

router.post('/save', express.json(), (req, res) => {
    const { body } = req;
    debug('saving %j', body);
    const t = validateTournament(body);
    debug('validated %j', t.toJSON());
    // TODO: actually save it
    res.json({});
});

