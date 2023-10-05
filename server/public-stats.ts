import _ from 'lodash';
import parseDuration from 'parse-duration';
import ms from 'ms';

import * as db from './tournament-db';
import { readStat } from './stats';

/**
 * Converts a duration string from parse-duration to a SQLite modifier
 * @see https://github.com/jkroso/parse-duration#readme
*/

function durationToModifier(duration: any): [string, number] {
    if (duration && _.isString(duration)) {
        const m = parseDuration(duration);
        if (m && _.isSafeInteger(m)) {
            return [`-${Math.floor(Math.abs(m) / 1000)} seconds`, Math.abs(m)];
        }
    }
    return ['-7 days', ms('7d')];
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
    generate(since: string, m: number): any[];
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
    },
    {
        id: 'uw',
        name: 'Tournament wins',
        headers: [
            {text: 'Name', value: 'name'},
            {text: 'Wins', value: 'value'},
        ],
        generate(since, m) {
            const rows = readStat('t-win', m);
            if (!rows) {
                return [];
            }
            return _.sortBy(rows, 'value').reverse();
        }
    },
    {
        id: 'tsp',
        name: 'Tournaments made',
        headers: [
            {text: 'Date', value: 'day'},
            {text: 'Made', value: 'made', align: 'end'},
            {text: 'Total', value: 'total', align: 'end'},
            {text: 'Percent', value: 'percent', align: 'end'},
        ],
        generate(since, m) {
            return db.all(
                `
                    SELECT
                        date(start_dt) as day,
                        total(tournaments.started) AS made,
                        count(tournaments.id) as total,
                        format('%6.2f', 100 * total(tournaments.started) / count(tournaments.id)) as percent
                    FROM tournaments
                    WHERE recurring = 0 AND
                        date(start_dt, 'utc') > date('now', $since)
                    GROUP BY 1 ORDER BY 1 DESC
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
    const [since, m] = durationToModifier(duration);
    const rows = stat.generate(since, m);
    const { headers, desc } = stat;
    return {headers, desc, rows};
}
