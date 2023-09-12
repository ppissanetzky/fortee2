import assert from 'node:assert';
import _ from 'lodash';

import { Rules } from './core';
import TexasTime from './texas-time';
import Tournament, { TournamentRow } from './tournament';
import { makeDebug } from './utility';
import { parse } from 'date-fns';

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
        case '': return 0;
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

export function validateTime(name: string, original: string, time: string): string {
    fa(time, `${name} time is empty`);
    let reference: Date | undefined = undefined;
    try {
        reference = TexasTime.parse(original).date;
    }
    catch (error) {
        void 0;
    }
    fa(reference, 'Invalid reference date');
    const date = parse(time, 'h:mm aaa', reference);
    fa(!isNaN(date.getTime()),
        `Invalid ${name} time "${time}", it must be hh:mm am/pm`);
    return new TexasTime(date).toString();
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

    const rules = validateRules(t.rules);

    const open = validateTime('Open', t.signup_start_dt, t.openTime);
    const close = validateTime('Close', t.signup_end_dt, t.closeTime);
    const start = validateTime('Start', t.start_dt, t.startTime);

    fif(TexasTime.toUTC(open) >= TexasTime.toUTC(close),
        'Close time has to be after open time');
    fif(TexasTime.toUTC(close) >= TexasTime.toUTC(start),
        'Start time has to be after close time');

    if (!t.recurring) {
        fif(t.signup_opened !== 0, 'This tournament is already open');
        fif(t.signup_closed !== 0, 'This tournament is closed');
        fif(t.started !== 0, 'This tournament started');
        fif(t.finished !== 0, 'This tournament is finished');
    }

    /** It is a new tournament */
    if (!t.id) {
        if (!t.recurring) {
            fif(TexasTime.minutesUntil(open) <= 0,
                'The tournament should open at least one minute from now');
        }
        fif(t.recurring_source !== 0, 'It should not have a recurring source');
    }

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
        recurring_source: t.recurring_source,
        host: t.host || null
    });
}
