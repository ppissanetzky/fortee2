
import TexasTime from './texas-time';
import * as db from './tournament-db';

/** A row from the database */

export interface TournamentRow {
    id: number; // 217173,
    name: string; // '[QT] Time To Go Straight  (S)',
    type: number; // 1,
    signup_start_dt: string; // '2023-03-13 22:15',
    signup_end_dt: string; // '2023-03-13 22:29',
    start_dt: string; // '2023-03-13 22:30',
    rules: string; // 'AllPass=FORCE,NelloAllowed=NEVER,NelloDoublesHIGH=NO,NelloDoublesLOW=NO,NelloDoublesHIGH_SUIT=YES,NelloDoublesLOW_SUIT=NO,PlungeAllowed=NO,SevensAllowed=NO,FollowMeDoublesHIGH=YES,FollowMeDoublesLOW=NO,FollowMeDoublesHIGH_SUIT=NO,FollowMeDoublesLOW_SUIT=NO,PlungeMinMarks=2,PlungeMaxMarks=2,MinBid=30,ForcedMinBid=30',
    /**
     * 1 - random partner
     * 2 - choose partner
     */
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

export const enum State {

    /** Open not started or finished */
    OPEN     = 'open',
    /** Closed, not started or finished */
    WTS      = 'wts',
    /** Closed, started, not finished */
    PLAYING  = 'playing',
    /** Closed, not started, finished */
    CANCELED = 'canceled',
    /** Not open, closed, started, finished */
    DONE     = 'done',
    /** Not open, not closed, not started, not finished */
    LATER    = 'later',
}

export default class Tournament implements Readonly<TournamentRow> {

    private row: TournamentRow;

    constructor(row: TournamentRow) {
        this.row = row;
    }

    toJSON() {
        return this.row;
    }

    get id(): number { return this.row.id; }
    get name(): string { return this.row.name; }
    get type(): number { return this.row.type; }
    get signup_start_dt(): string { return this.row.signup_start_dt; }
    get signup_end_dt(): string { return this.row.signup_end_dt; }
    get start_dt(): string { return this.row.start_dt; }
    get rules(): string { return this.row.rules; }
    get partner(): number { return this.row.partner; }
    get seed(): number { return this.row.seed; }
    get timezone(): string { return this.row.timezone; }
    get signup_opened(): number { return this.row.signup_opened; }
    get signup_closed(): number { return this.row.signup_closed; }
    get started(): number { return this.row.started; }
    get scheduled(): number { return this.row.scheduled; }
    get finished(): number { return this.row.finished; }
    get ladder_id(): number { return this.row.ladder_id; }
    get ladder_name(): string { return this.row.ladder_name; }
    get lmdtm(): string { return this.row.lmdtm; }
    get invitation(): number { return this.row.invitation; }
    get recurring(): number { return this.row.recurring; }
    get invitees(): string { return this.row.invitees; }
    get prize(): string { return this.row.prize; }
    get winners(): string { return this.row.winners; }
    get recurring_source(): number { return this.row.recurring_source; }
    get host(): string { return this.row.host; }

    get state(): State {
        if (this.finished) {
            return this.started ? State.DONE : State.CANCELED;
        }
        if (this.started) {
            return State.PLAYING;
        }
        if (!this.signup_opened) {
            return State.LATER;
        }
        if (!this.signup_closed) {
            return State.OPEN;
        }
        return State.WTS;
    }

    get minutesTilOpen(): number {
        return TexasTime.minutesUntil(this.signup_start_dt);
    }

    get minutesTilClose(): number {
        return TexasTime.minutesUntil(this.signup_end_dt);
    }

    get minutesTilStart(): number {
        return TexasTime.minutesUntil(this.start_dt);
    }

    get startTime(): string {
        return TexasTime.parse(this.start_dt).timeString;
    }

    get openTime(): string {
        return TexasTime.parse(this.signup_start_dt).timeString;
    }

    get closeTime(): string {
        return TexasTime.parse(this.signup_end_dt).timeString;
    }

    get isOpen(): boolean {
        return Boolean(this.signup_opened && !this.signup_closed
            && !this.started && !this.finished);
    }

    get choosePartner(): boolean {
        return this.partner === 2;
    }

    saveWith(updates: Partial<TournamentRow>): this {
        const row = {...this.row, ...updates};
        row.id = db.run(
            `
                INSERT OR REPLACE INTO tournaments
                (
                    id,
                    name,
                    type,
                    signup_start_dt,
                    signup_end_dt,
                    start_dt,
                    rules,
                    partner,
                    seed,
                    timezone,
                    signup_opened,
                    signup_closed,
                    started,
                    scheduled,
                    finished,
                    ladder_id,
                    ladder_name,
                    lmdtm,
                    invitation,
                    recurring,
                    invitees,
                    prize,
                    winners,
                    recurring_source,
                    host
                )
                VALUES
                (
                    CASE WHEN $id = 0 THEN NULL ELSE $id END,
                    $name,
                    $type,
                    $signup_start_dt,
                    $signup_end_dt,
                    $start_dt,
                    $rules,
                    $partner,
                    $seed,
                    $timezone,
                    $signup_opened,
                    $signup_closed,
                    $started,
                    $scheduled,
                    $finished,
                    $ladder_id,
                    $ladder_name,
                    $lmdtm,
                    $invitation,
                    $recurring,
                    $invitees,
                    $prize,
                    $winners,
                    $recurring_source,
                    $host
                )
            `, row
        );
        this.row = row;
        return this;
    }

    signups() {
        return db.getSignups(this.id);
    }

    isSignedUp(user: string) {
        return db.isSignedUp(this.id, user);
    }

}
