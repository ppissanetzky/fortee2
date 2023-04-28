import _ from 'lodash';

import { Rules } from './core';
import TexasTime from './texas-time';
import Tournament, { TournamentRow } from './tournament';
import { makeDebug } from './utility';

const debug = makeDebug('validate');

export class AppError extends Error {
    constructor(message: string) {
        super(message);
    }
}

export function fail(message: string): never {
    throw new AppError(message);
}

export function fif(expression: any, message: string) {
    if (expression) {
        fail(message);
    }
}

export function fa(expression: any, message: string): asserts expression {
    if (!expression) {
        fail(message);
    }
}

export function validateEvery(every: string): number {
    switch (every) {
        case 'Monday': return 1;
        case 'Tuesday': return 2;
        case 'Wednesday': return 3;
        case 'Thursday': return 4;
        case 'Friday': return 5;
        case 'Saturday': return 6;
        case 'Sunday': return 7;
        case 'Every day': return 8;
        case 'Weekdays': return 9;
    }
    fail('Invalid recurring days');
}

const TIME_RX = /^(?<h>\d\d):(?<m>\d\d) (?<ap>[ap])m$/;

export function validateTime(name: string, time: string): string {
    fa(time, `${name} time is empty`);
    const message = `Invalid ${name} time "${time}", it must be hh:mm am/pm`;
    time = time.padStart(8, '0')
    const matches = time.match(TIME_RX);
    fa(matches, message);
    const { groups } = matches;
    fa(groups, message);
    const { h, m, ap } = groups;
    let hn = parseInt(h, 10);
    fa(_.isSafeInteger(hn) && hn >= 0 && hn <= 12, message);
    const mn = parseInt(m);
    fa(_.isSafeInteger(mn) && mn >= 0 && mn <= 59, message);
    if (ap === 'p') {
        hn += 12;
        fif(hn > 23, message);
    }
    return `${String(hn).padStart(2, '0')}:${String(mn).padStart(2, '0')}`;
}

export function validateRules(rules: any): Rules {
    fif(!rules, 'Invalid rules');
    if (_.isString(rules)) {
        if (rules === 'default') {
            return new Rules();
        }
        return validateRules(Rules.fromAny(rules));
    }
    if (!(rules instanceof Rules)) {
        if (_.isObject(rules)) {
            return validateRules(JSON.stringify(rules));
        }
        fail('Bad rules');
    }
    fif(rules.follow_me_doubles.length === 0, 'Empty follow-me doubles');
    fif(rules.plunge_max_marks < rules.plunge_min_marks, 'Plunge marks are wrong');
    fif(rules.nello_doubles.length === 0, 'Empty nello doubles');
    return rules;
}

export function validateTournament(t: Record<string, any>): Tournament {
    fif(!_.isSafeInteger(t.id), 'Invalid ID');
    // TODO: if not 0, see if it exists
    fif(!t.name, 'Tournament name is blank');
    fif(![1, 2].includes(t.partner), 'Invalid partner');
    const recurring = validateEvery(t.every);
    t.openTime = validateTime('Open', t.openTime);
    t.closeTime = validateTime('Close', t.closeTime);
    t.startTime = validateTime('Start', t.startTime);

    const rules = validateRules(t.rules);

    const date = TexasTime.today().dateString;

    const open = `${date} ${t.openTime}`;
    const close = `${date} ${t.closeTime}`;
    const start = `${date} ${t.startTime}`;

    fif(TexasTime.toUTC(open) >= TexasTime.toUTC(close),
        'Close time has to be after open time');
    fif(TexasTime.toUTC(close) >= TexasTime.toUTC(start),
        'Start time has to be after close time');

    return new Tournament({
        id: t.id,
        name: t.name,
        type: 1,
        signup_start_dt: open,
        signup_end_dt:  close,
        start_dt:  start,
        rules: JSON.stringify(rules),
        partner: t.partner,
        seed: 1,
        timezone: 'CST',
        signup_opened: 0,
        signup_closed: 0,
        started: 0,
        scheduled: 0,
        finished: 0,
        ladder_id: null,
        ladder_name: null,
        invitation: 0,
        recurring,
        invitees: null,
        prize: null,
        winners: '',
        recurring_source: 0,
        host: t.host || null
    });
}
