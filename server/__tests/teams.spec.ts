import { jest, expect, test } from '@jest/globals';

import * as db from '../tournament-db';

jest.mock('../tournament-db');

const getSignups = jest.spyOn(db, 'getSignups');

import Tournament from '../tournament';
import TournamentDriver from '../tournament-driver';

const tournament = new Tournament({
    id: 1,
    name: ``,
    type: 1,
    signup_start_dt: '',
    signup_end_dt: '',
    start_dt: '',
    rules: '',
    partner: 1,
    seed: 0,
    timezone: 'CST',
    signup_opened: 0,
    signup_closed: 0,
    started: 0,
    scheduled: 0,
    finished: 0,
    ladder_id: 0,
    ladder_name: '',
    lmdtm: '',
    invitation: 0,
    recurring: 0,
    invitees: '',
    prize: '',
    winners: '',
    recurring_source: 0,
    host: ''
});

test('it works with no signups', () => {
    getSignups.mockReturnValueOnce(new Map());
    const driver = new TournamentDriver(tournament);
    expect(driver.teams).toHaveLength(0);
    expect(driver.dropped).toBeUndefined();
});
