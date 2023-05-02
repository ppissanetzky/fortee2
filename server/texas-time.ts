import assert from 'node:assert';

import _ from 'lodash';
import { utcToZonedTime, zonedTimeToUtc } from 'date-fns-tz';
import { differenceInMilliseconds, differenceInMinutes, format,
    getDay, parse, addDays  } from 'date-fns';

function convert(tt: string | TexasTime): TexasTime {
    return _.isString(tt) ? TexasTime.parse(tt) : tt;
}

const SHORT_FORMAT = 'yyyy-LL-dd HH:mm';
const LONG_FORMAT = 'yyyy-LL-dd HH:mm:ss';

const TZ = 'US/Central';

/**
 * Wraps around a date that is always US/Central, just so I won't
 * make mistakes.
 */

export default class TexasTime {

    /**
     * This one parses the tournament dates that look like 2023-03-13 22:30
     * It also supports seconds, for testing
     */

    static parse(date: string): TexasTime {
        const format = date.length === SHORT_FORMAT.length ?
            SHORT_FORMAT : LONG_FORMAT;
        const parsed = parse(date, format, new Date());
        assert(!isNaN(parsed.getTime()), `Invalid date "${date}"`);
        return new TexasTime(parsed);
    }

    /** The current date in TX time */

    static today(): TexasTime {
        return new TexasTime(utcToZonedTime(Date.now(), TZ));
    }

    static midnight(): TexasTime {
        const date = addDays(this.today().date, 1);
        date.setHours(0, 0);
        return new TexasTime(date);
    }

    static toUTC(date: string): number {
        const t = TexasTime.parse(date);
        return zonedTimeToUtc(t.date, TZ).getTime();
    }

    public readonly date: Date;

    public constructor(date: Date) {
        this.date = new Date(date);
    }

    toString(withSeconds = false): string {
        return format(this.date, withSeconds ? LONG_FORMAT : SHORT_FORMAT);
    }

    get dateString(): string {
        return format(this.date, 'yyyy-LL-dd');
    }

    get timeString(): string {
        return format(this.date, 'h:mm aaa');
    }

    /** Returns 1-7 where 1 is Monday  */
    get dayOfWeek(): number {
        /** This one returns 0 for Sunday */
        const day = getDay(this.date);
        return day === 0 ? 7 : day;
    }

    get time(): number {
        return this.date.getTime();
    }

    withTimeFrom(other: TexasTime): TexasTime {
        const date = new Date(this.date);
        date.setHours(other.date.getHours(), other.date.getMinutes());
        return new TexasTime(date);
    }

    minutesUntil(other: TexasTime): number {
        return differenceInMinutes(other.date, this.date);
    }

    static minutesUntil(other: TexasTime | string ): number {
        return this.today().minutesUntil(convert(other));
    }

    msUntil(other: TexasTime): number {
        return differenceInMilliseconds(other.date, this.date);
    }
}
