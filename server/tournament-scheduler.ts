
import assert from 'node:assert';
import _ from 'lodash';
import ms from 'ms';

import { makeDebug } from './utility';
import Dispatcher from './dispatcher';
import TexasTime from './texas-time';
import Tournament, { TournamentRow } from './tournament';
import config from './config';
import * as db from './tournament-db';
import UserNames from './user-names';
import TournamentDriver, { TournamentDriverEvents } from './tournament-driver';
import { Rules } from './core';

const debug = makeDebug('scheduler');

function insertTestTourneys() {
    if (config.PRODUCTION) {
        return;
    }
    db.run('delete from tournaments');
    const now = TexasTime.today();
    const d = now.date;
    d.setMinutes(d.getMinutes());
    const signup = new TexasTime(d).toString();
    d.setMinutes(d.getMinutes() + 1);
    const e = new TexasTime(d).toString();
    d.setMinutes(d.getMinutes() + 1);
    const s = new TexasTime(d).toString();

    const t = new Tournament({
        id: 0,
        name: `Today's test tournament`,
        type: 1,
        signup_start_dt: signup,
        signup_end_dt: e,
        start_dt: s,
        rules: JSON.stringify(new Rules()),
        partner: 2,
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
        host: 'bots'
    });
    t.saveWith({});
}


interface SchedulerEvents extends TournamentDriverEvents {
    signupOpen: Tournament;
    signupClosed: Tournament;
    started: Tournament;
    canceled: Tournament;
    failed: Tournament;
    registered: {
        t: Tournament;
        user: string;
        partner?: string;
    },
    unregistered: {
        t: Tournament;
        user: string;
    },
    dropped: number,
    newDay: undefined,
}

export default class Scheduler extends Dispatcher<SchedulerEvents> {

    public static get(): Scheduler {
        if (!this.instance) {
            this.instance = new Scheduler();
        }
        return this.instance;
    }

    public static driver(id: number): TournamentDriver | undefined {
        return this.get().drivers.get(id);
    }

    private static instance?: Scheduler;

    public readonly tourneys = new Map<number, Tournament>();

    public readonly drivers = new Map<number, TournamentDriver>();

    private constructor() {
        super();
        this.loadToday();
    }

    private loadToday(): void {
        // insertTestTourneys();

        const today = TexasTime.today();

        for (const t of this.todaysTournaments(today)) {
            this.tourneys.set(t.id, new Tournament(t));
            debug('loaded', t.id, t.start_dt, t.name);
        }

        for (const t of this.todaysRecurringTournaments(today)) {
            const instance = this.createRecurringInstance(today, t);
            if (instance) {
                this.tourneys.set(instance.id, instance);
            }
        }

        debug('have', this.tourneys.size, 'to schedule');

        const now = TexasTime.today();
        for (const t of this.tourneys.values()) {
            const ms = Math.max(100, now.msUntil(TexasTime.parse(t.signup_start_dt)));
            debug('signup in', ms, 'for', t.id, t.signup_start_dt, t.name);
            setTimeout(() => this.openSignup(t), ms);
        }

        const tomorrow = TexasTime.midnight();
        const m = now.msUntil(tomorrow) + 30000;
        debug('tomorrow', tomorrow.toString(), 'in', m);
        setTimeout(() => {
            this.loadToday();
            this.emit('newDay', undefined);
        }, m);
    }

    /**
     * Loads all recurring tournaments that don't already have an instance
     * for today
     */

    private todaysRecurringTournaments(today: TexasTime): TournamentRow[] {
        const date = today.dateString;
        const dow = today.dayOfWeek;
        return db.all(
            `
            SELECT * FROM tournaments
            WHERE
                (recurring = $dow OR recurring = 8 OR
                (recurring = 9 AND $dow in (1, 2, 3, 4, 5)))
                AND id NOT IN (
                    SELECT recurring_source FROM tournaments AS other
                    WHERE date(other.start_dt) = date($date)
                )
            ORDER BY
                time(start_dt)
            `
            , { date, dow }
        );
    }

    private todaysTournaments(today: TexasTime): TournamentRow[] {
        const date = today.toString();
        return db.all(
            `
            SELECT * FROM tournaments
            WHERE
                date(start_dt) = date($date)
                AND time(start_dt) > time($date)
                AND started = 0
                AND finished = 0
                AND scheduled = 0
                AND recurring = 0
            ORDER BY
                start_dt
            `
            , { date }
        );
    }

    private createRecurringInstance(today: TexasTime, t: TournamentRow): Tournament | undefined {
        assert(t.recurring);

        /** The new start date time for this instance */
        const start = today.withTimeFrom(TexasTime.parse(t.start_dt));

        /** See if the start time is earlier than now */
        if (today.minutesUntil(start) < 5) {
            debug('expired', t.id, start.toString(), t.name);
            return;
        }

        /** Create and save the new instance */
        const instance = new Tournament(t).saveWith({
            id: 0,
            start_dt: start.toString(),
            signup_start_dt: today.withTimeFrom(TexasTime.parse(t.signup_start_dt)).toString(),
            signup_end_dt: today.withTimeFrom(TexasTime.parse(t.signup_end_dt)).toString(),
            signup_opened: 0,
            signup_closed: 0,
            started: 0,
            scheduled: 0,
            finished: 0,
            invitees: '',
            winners: '',
            recurring: 0,
            recurring_source: t.id
        });

        debug('created', instance.id, instance.start_dt, instance.name);

        return instance;
    }

    private openSignup(t: Tournament) {
        if (!t.signup_opened) {
            t.saveWith({
                signup_opened: 1
            });
            debug('signup opened for', t.id, t.signup_start_dt, t.name);
            this.emit('signupOpen', t);
        }

        const now = TexasTime.today();
        const ms = Math.max(100, now.msUntil(TexasTime.parse(t.signup_end_dt)));
        setTimeout(() => this.closeSignup(t), ms);
        debug('signup close in', ms, t.id, t.signup_end_dt, t.name);
    }

    private closeSignup(t: Tournament) {
        const { id } = t;
        if (!t.signup_closed) {
            t.saveWith({
                signup_closed: 1
            });
            debug('signup closed for', id, t.signup_end_dt, t.name);
            this.emit('signupClosed', t);
        }

        const driver = new TournamentDriver(t);

        if (driver.canceled) {
            t.saveWith({
                finished: 1
            });
            debug('canceled', id, t.start_dt, t.name);
            this.emit('canceled', t);
            setTimeout(() => {
                this.tourneys.delete(id);
                this.emit('dropped', id);
            }, ms('10m'));
            return;
        }

        const now = TexasTime.today();
        const m = Math.max(100, now.msUntil(TexasTime.parse(t.start_dt)));
        debug('start in', m, t.id, t.signup_end_dt, t.name);
        setTimeout(() => this.start(driver), m);
    }

    private async start(driver: TournamentDriver) {
        const { t } = driver;
        const { id } = t;

        t.saveWith({
            scheduled: 1,
            started: 1
        });
        this.drivers.set(id, driver);
        debug('started', id, t.start_dt, t.name);
        this.emit('started', t);

        driver.on('announceBye', (event) => this.emit('announceBye', event));
        driver.on('summonTable', (event) => this.emit('summonTable', event));
        driver.on('gameOver', (event) => this.emit('gameOver', event));
        driver.on('tournamentOver', (event) => {
            const winners = driver.winners?.join(',') || '';
            t.saveWith({
                finished: 1,
                winners
            });
            this.emit('tournamentOver', event)
        });

        try {
            await driver.run();
        }
        catch (error) {
            this.emit('failed', t);
        }
        finally {
            t.saveWith({
                finished: 1,
            });
            /** Keep them around for 10 minutes */
            setTimeout(() => {
                this.tourneys.delete(id);
                this.drivers.delete(id);
                this.emit('dropped', id);
            }, ms('10m'));
        }
    }

    public register(id: number, user: string, partner = ''): [Tournament, boolean] {
        assert(user);
        const t = this.tourneys.get(id);
        assert(t, `Invalid tournament ${id}`);
        assert(t.signup_opened && !t.signup_closed, `Signup is not open for ${id}`);
        assert(user !== partner, 'Yourself as partner?');
        if (t.invitation && t.invitees && !t.invitees.includes(user)) {
            assert(false, 'Not invited');
        }
        for (const other of this.tourneys.values()) {
            if (other === t) {
                continue;
            }
            if (other.signup_opened && !other.started && !other.finished) {
                if (other.isSignedUp(user)) {
                    assert(false, `Already registered for ${other.id}`);
                }
            }
            // TODO: check if this user is still playing in other
        }

        /** Check to see if it already exists */
        if (db.signupExists(id, user, partner)) {
            return [t, false];
        }

        /** In the DB */
        db.addSignup(id, user, partner);

        /** To prime the user names database */
        UserNames.get(user);
        UserNames.get(partner);

        this.emit('registered', {
            t,
            user,
            partner
        });
        return [t, true];
    }

    public unregister(id: number, user: string): [Tournament, boolean] {
        assert(user);
        const t = this.tourneys.get(id);
        assert(t, `Invalid tournament ${id}`);
        assert(t.signup_opened && !t.signup_closed, `Signup not open for ${id}`);
        assert(t.isSignedUp(user), `Not signed up for ${id}`);
        if (!db.deleteSignup(id, user)) {
            return [t, false];
        }
        this.emit('unregistered', {
            t,
            user
        });
        return [t, true];
    }
}