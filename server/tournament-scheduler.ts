
import { zonedTimeToUtc, utcToZonedTime } from 'date-fns-tz';
import { getDay, parseISO } from 'date-fns';

import { Database } from './db';

const database = new Database('tournaments', 0);

/**
 * Wraps around a date that is always US/Central, just so I won't
 * make mistakes.
 */

class TexasTime {

    /** This one parses the tournament dates that look like 2023-03-13 22:30 */

    static parse(date: string): TexasTime {
        return new TexasTime(zonedTimeToUtc(date, 'US/Central'));
    }

    static today(): TexasTime {
        return new TexasTime(utcToZonedTime(Date.now(), 'US/Central'));
    }

    public readonly date: Date;

    private constructor(date: Date) {
        this.date = date;
    }

    /** Returns 1-7 where 1 is Monday  */
    get dayOfWeek(): number {
        /** This one returns 0 for Sunday */
        const day = getDay(this.date);
        return day === 0 ? 7 : day;
    }
}

interface TournamentRow {
    id: number; // 217173,
    name: string; // '[QT] Time To Go Straight  (S)',
    type: number; // 1,
    signup_start_dt: string; // '2023-03-13 22:15',
    signup_end_dt: string; // '2023-03-13 22:29',
    start_dt: string; // '2023-03-13 22:30',
    rules: string; // 'AllPass=FORCE,NelloAllowed=NEVER,NelloDoublesHIGH=NO,NelloDoublesLOW=NO,NelloDoublesHIGH_SUIT=YES,NelloDoublesLOW_SUIT=NO,PlungeAllowed=NO,SevensAllowed=NO,FollowMeDoublesHIGH=YES,FollowMeDoublesLOW=NO,FollowMeDoublesHIGH_SUIT=NO,FollowMeDoublesLOW_SUIT=NO,PlungeMinMarks=2,PlungeMaxMarks=2,MinBid=30,ForcedMinBid=30',
    partner: number; // 2,
    seed: number; // 1,
    timezone: string; // 'CST',
    signup_opened: number; // 1,
    signup_closed: number; // 1,
    started: number; // 1,
    scheduled: number; // 0,
    finished: number; // 1,
    ladder_id: number; // 0,
    ladder_name: string; //  '',
    lmdtm: string; // '1450003559',
    invitation: number; // 1,
    /**
     * 0 if it is not recurring
     * 1-7 for Monday to Sunday
     * 8 for every day
     * 9 for week days
     */
    recurring: number; // 1,
    invitees: string; // '',
    prize: string; // '',
    winners: string; // '',
    recurring_source: number; // 0,
    host: string; // 'rednsassy'
}

const db = database.connect();

db.function('texas_time', (s: string) => {
    return TexasTime.parse(s).date.toISOString();
});

function loadTodaysRecurringTournaments() {
    const today = TexasTime.parse('2023-03-01');
    const dow = today.dayOfWeek;
    console.log(dow);
    return db.all(
        `
        SELECT *, texas_time(start_dt) as tt FROM tournaments
        WHERE
            (recurring = $dow OR recurring = 8 OR
            (recurring = 9 AND $dow in (1, 2, 3, 4, 5)))
        `
        , { dow }
    );
}

const today = TexasTime.parse('2023-03-01');
console.log('Right now is', today, today.dayOfWeek);

for (const row of loadTodaysRecurringTournaments()) {
    const tt = TexasTime.parse(row.start_dt);
    console.log(row.id, row.start_dt, tt.dayOfWeek, row.recurring, row.tt, row.name);
}
