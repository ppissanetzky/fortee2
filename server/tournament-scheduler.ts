
import assert from 'node:assert';
import _ from 'lodash';
import ms from 'ms';

import { expected, makeDebug } from './utility';
import Dispatcher from './dispatcher';
import TexasTime from './texas-time';
import Tournament, { State, TournamentRow } from './tournament';
import * as db from './tournament-db';
import TournamentDriver, { TournamentDriverEvents } from './tournament-driver';
import { fail, fif } from './validate';

const debug = makeDebug('scheduler');

interface SchedulerEvents extends TournamentDriverEvents {
    signupOpen: Tournament;
    signupClosed: Tournament;
    started: Tournament;
    canceled: Tournament;
    failed: Tournament;
    registered: {
        t: Tournament;
        user: string;
        partner?: string | null;
    },
    unregistered: {
        t: Tournament;
        user: string;
    },
    dropped: number;
    reload: undefined;
    updated: Tournament;
    added: Tournament;
}

type TimeoutPair = [number, NodeJS.Timeout];

class TimeoutSet {

    private list: TimeoutPair[] = [];

    add(id: number, cb: () => void, m: number): void {
        const timeout = setTimeout(() => {
            this.list = this.list.filter(([, other]) => other !== timeout);
            cb();
        }, m);
        this.list.push([id, timeout]);
    }

    delete(id: number) {
        this.list = this.list.filter(([other, timeout]) => {
            if (other === id) {
                clearTimeout(timeout);
                return false;
            }
            return true;
        });
    }

    clear() {
        this.list.forEach(([, timeout]) => clearTimeout(timeout));
        this.list = [];
    }

}

export default class Scheduler extends Dispatcher<SchedulerEvents> {

    public static get(): Scheduler {
        if (!this.instance) {
            this.instance = new Scheduler();
        }
        return this.instance;
    }

    public static tourneys(): Tournament[] {
        const scheduler = this.get();
        scheduler.dump();
        const results = _.sortBy(Array.from(scheduler.tourneys.values()), 'utcStartTime');
        debug('Returning', results.length);
        debug('Returning %j', results);
        return results;
    }

    private static instance?: Scheduler;

    private readonly timeouts = new TimeoutSet();

    public readonly tourneys = new Map<number, Tournament>();

    private constructor() {
        super();
        this.loadToday();
    }

    public reload() {
        this.timeouts.clear();
        this.tourneys.clear();
        this.loadToday();
        this.emit('reload', undefined);
    }

    private dump() {
        debug('Have', this.tourneys.size);
        for (const t of this.tourneys.values()) {
            debug(t.id, t.name, t.startTime, t.recurring_source, t.utcStartTime);
        }
    }

    public reloadOne(tid: number): boolean {
        const isNew = !this.tourneys.has(tid);
        const today = TexasTime.today();
        const [loaded] = this.todaysTournaments(today).filter(({id}) => id === tid);
        if (!loaded) {
            return false;
        }
        const t = new Tournament(loaded);
        if (t.state !== State.LATER) {
            return false;
        }
        debug('Loaded %j', t);
        /** Remove existing timers for this one */
        this.timeouts.delete(tid);

        /** Change it in our map */
        this.dump();
        this.tourneys.set(tid, t);
        debug('Added', t.id, tid, t.name);
        this.dump();
        const m = Math.max(5000, today.msUntil(TexasTime.parse(t.signup_start_dt)));
        debug('signup in', ms(m), 'for', tid, t.signup_start_dt, t.name);
        this.timeouts.add(tid, () => this.openSignup(expected(t)), m);
        if (isNew) {
            this.emit('added', t)
        }
        else {
            this.emit('updated', t);
        }
        return true;
    }

    public delete(tid: number): boolean {
        /** If the tournament is not being scheduled, that's fine */
        if (!this.tourneys.has(tid)) {
            return true;
        }
        const row = db.getTournament(tid);
        if (!row) {
            return false;
        }
        const t = new Tournament(row);
        if (t.state !== State.LATER) {
            return false;
        }
        this.timeouts.delete(tid);
        this.tourneys.delete(tid);
        this.emit('reload', undefined);
        return true;
    }

    private loadToday(): void {

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
            const m = Math.max(100, now.msUntil(TexasTime.parse(t.signup_start_dt)));
            debug('signup in', ms(m), 'for', t.id, t.signup_start_dt, t.name);
            this.timeouts.add(t.id, () => this.openSignup(t), m);
        }

        const tomorrow = TexasTime.midnight();
        const m = now.msUntil(tomorrow) + ms('30s');
        debug('tomorrow', tomorrow.toString(), 'in', ms(m));
        this.timeouts.add(-1, () => this.reload(), m);
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
        const m = Math.max(100, now.msUntil(TexasTime.parse(t.signup_end_dt)));
        this.timeouts.add(t.id, () => this.closeSignup(t), m);
        debug('signup close in', ms(m), t.id, t.signup_end_dt, t.name);
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
            this.timeouts.add(id, () => {
                this.tourneys.delete(id);
                this.emit('dropped', id);
            }, ms('5m'));
            return;
        }

        const now = TexasTime.today();
        const m = Math.max(100, now.msUntil(TexasTime.parse(t.start_dt)));
        debug('start in', ms(m), t.id, t.signup_end_dt, t.name);
        this.timeouts.add(id, () => this.start(driver), m);
    }

    private async start(driver: TournamentDriver) {
        const { t } = driver;
        const { id } = t;

        t.saveWith({
            scheduled: 1,
            started: 1
        });
        t.driver = driver;

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
        driver.on('gameUpdate', (event) => this.emit('gameUpdate', event));

        try {
            await driver.run();
        }
        catch (error) {
            t.saveWith({finished: 1});
            this.emit('failed', t);
        }
        finally {
            if (!t.finished) {
                t.saveWith({finished: 1});
            }
            /** Keep the tourney around for a few minutes */
            this.timeouts.add(id, () => {
                this.tourneys.delete(id);
                this.emit('dropped', id);
            }, ms('10m'));
        }
    }

    public register(id: number, user: string, partner: string | null): [Tournament, boolean] {
        const t = this.tourneys.get(id);
        assert(t, `Invalid tournament ${id}`);
        assert(t.signup_opened && !t.signup_closed, `Signup is not open for ${id}`);
        /** Can't be your own partner */
        fif(user === partner, 'yourself');
        /** Not invited */
        fif(t.invitation && t.invitees && !t.invitees.includes(user), 'not-invited');
        for (const other of this.tourneys.values()) {
            /** Skip this one */
            if (other === t) {
                continue;
            }
            switch (other.state) {
                case State.CANCELED:
                case State.DONE:
                case State.LATER:
                    break;
                case State.OPEN:
                case State.WTS:
                    fif(other.isSignedUp(user), 'already-registered');
                    break;
                case State.PLAYING:
                    fif(other.driver?.stillIn.has(user), 'still-in-t');
                    break;
            }
        }

        /** Check to see if it already exists */
        if (t.isSignedUpWith(user, partner)) {
            return [t, false];
        }

        /** In the DB */
        t.register(user, partner);

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
        if (!t.unregister(user)) {
            return [t, false];
        }
        this.emit('unregistered', {
            t,
            user
        });
        return [t, true];
    }
}
