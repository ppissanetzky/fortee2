import _ from 'lodash';
import express from 'express';
import parseDuration from 'parse-duration';

import { Database } from './db';
import { database as tdb } from './tournament-db';

const router = express.Router();

export default router;

const db = new Database('stats', 1).connect();

db.run('ATTACH DATABASE $file AS t', { file: tdb.file });

export type StatType =
    'gr-latency' |
    'bid' |
    'call' |
    'play' |
    't-play' |
    't-win';

/** The definition of a stat */

interface Stat {
    name: string;
    units: string;
    format: Intl.NumberFormatOptions;
    group: 'sum' | 'avg';
    convert(n: number): number;
}

function convertMs(n: number): number {
    return n / 1000;
}

function noConvert(n: number): number {
    return n;
}

const STATS: Record<StatType, Stat> = {

    'gr-latency': {
        name: 'Game latency',
        units: 'ms',
        format: {maximumFractionDigits: 0},
        group: 'avg',
        convert(n) {
            return Math.floor(n)
        }
    },
    'bid': {
        name: 'Bid time',
        units: 'sec',
        format: {minimumFractionDigits: 3},
        group: 'avg',
        convert: convertMs
    },
    'call': {
        name: 'Trump call time',
        units: 'sec',
        format: {minimumFractionDigits: 3},
        group: 'avg',
        convert: convertMs
    },
    'play': {
        name: 'Play time',
        units: 'sec',
        format: {minimumFractionDigits: 3},
        group: 'avg',
        convert: convertMs
    },
    't-play': {
        name: 'Tournaments played',
        units: 'count',
        format: {maximumFractionDigits: 0},
        group: 'sum',
        convert: noConvert
    },
    't-win': {
        name: 'Tournaments won',
        units: 'count',
        format: {maximumFractionDigits: 0},
        group: 'sum',
        convert: noConvert
    }
};

const INSERT = db.statement(
    `INSERT INTO stats VALUES ($type, unixepoch(), $key, $value)`);

export function writeStat(type: StatType, key: string, value: number) {
    process.nextTick(() => {
        INSERT.run({type, key, value});
    });
}

function read(type: StatType, stat: Stat, sinceMs = 0) {
    const group = stat.group === 'avg' ? 'AVG' : 'SUM';
    const rows = db.all(
        `
        SELECT
            users.displayName AS name,
            ${group}(value) AS value
        FROM
            stats, t.users AS users
        WHERE
            stats.type = $type AND stats.key = users.id
            AND ($since = 0 OR time > unixepoch() - $since)
        GROUP BY 1
        ORDER BY 1 COLLATE NOCASE ASC
        `, { type, since: Math.floor(sinceMs / 1000) });
    rows.forEach((row) => row.value = stat.convert(row.value));
    return rows;
}

router.get('/list', (req, res) => {
    res.json(Array.from(Object.entries(STATS)).map(([key, stat]) => ({
        value: key,
        text: stat.name
    })));
});

router.get('/read/:type', (req, res) => {
    const { params: { type }, query: { s } } = req;
    const stat = STATS[type as StatType];
    if (!stat) {
        return res.sendStatus(404);
    }
    const since = _.isString(s) ? parseDuration(s) : 0;
    if (_.isNull(since)) {
        return res.sendStatus(400);
    }
    res.json({
        name: stat.name,
        units: stat.units,
        format: stat.format,
        stats: read(type as StatType, stat, since)
    });
});
