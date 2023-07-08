import _ from 'lodash';
import parseDuration from 'parse-duration';

import * as db from './tournament-db';

/**
 * Converts a duration string from parse-duration to a SQLite modifier
 * @see https://github.com/jkroso/parse-duration#readme
*/

function durationToModifier(duration: any): string {
    if (duration && _.isString(duration)) {
        const ms = parseDuration(duration);
        if (ms && _.isSafeInteger(ms)) {
            return `-${Math.floor(Math.abs(ms) / 1000)} seconds`;
        }
    }
    return '-7 days';
}

export interface PublicStatHeader {
    text: string;
    value: string;
    align?: 'end';
}

export interface PublicStat {
    id: string;
    name: string;
    desc?: string;
    headers: PublicStatHeader[];
    generate(since: string): any[];
}

const STATS: PublicStat[] = [
    {
        id: 'tw',
        name: 'Tournament winners',
        headers: [
            {text: 'Tournament', value: 'name'},
            {text: 'Date', value: 'start_dt'},
            {text: 'Signups', value: 'signups', align: 'end'},
            {text: 'Winners', value: 'winners'}
        ],
        generate(since) {
            return db.all(
                `
                SELECT name, start_dt, count(distinct(signups.user)) AS signups, replace(winners, ',' , ' & ') AS winners
                FROM tournaments
                LEFT OUTER JOIN signups ON signups.id = tournaments.id
                WHERE
                    started = 1 AND
                    finished = 1 AND
                    recurring = 0 AND
                    winners LIKE '%,%' AND
                    datetime(start_dt, 'utc') > datetime('now', $since)
                GROUP BY name, start_dt, winners
                ORDER BY
                    datetime(start_dt) DESC
            `,
            {since});
        }
    },
    {
        id: 'tsc',
        name: 'Tournament signup count',
        desc: 'Includes only tournaments with at least one signup',
        headers: [
            {text: 'Tournament', value: 'name'},
            {text: 'Date', value: 'start_dt'},
            {text: 'Signups', value: 'signups', align: 'end'}
        ],
        generate(since) {
            return db.all(
                `
                SELECT name, start_dt, count(distinct(signups.user)) AS signups
                FROM tournaments
                LEFT OUTER JOIN signups ON signups.id = tournaments.id
                WHERE
                    recurring = 0 AND
                    datetime(start_dt, 'utc') > datetime('now', $since)
                GROUP BY name, start_dt
                HAVING signups > 0
                ORDER BY
                    datetime(start_dt) DESC
            `,
            {since});
        }
    }
];

export function getPublicStatsList() {
    return STATS.map(({id, name}) => ({text: name, value: id}));
}

export function getPublicStats(id: string, duration: any) {
    const stat = STATS.find((item) => item.id === id);
    if (!stat) {
        return;
    }
    const since = durationToModifier(duration);
    const rows = stat.generate(since);
    const { headers, desc } = stat;
    return {headers, desc, rows};
}
