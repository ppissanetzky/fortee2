import { opendir, readFile } from 'node:fs/promises';
import _, { add } from 'lodash';
import express from 'express';
import parseDuration from 'parse-duration';

import { Database } from './db';
import { database as tdb } from './tournament-db';
import path from 'node:path';
import config from './config';
import { SaveWithMetadata } from './core/save-game';
import { getUnixTime } from 'date-fns';
import Tournament from './tournament';
import { makeDebug } from './utility';
import ms from 'ms';

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

/** Returns a collection of stat tables that are public */

router.get('/public', (req, res) => {
    /** Tournament winner history */
    // const winners = tdb.all(
    //     `
    //     SELECT * FROM tournaments
    //     WHERE
    //         recurring = 0 AND finished = 1
    //         AND winners IS NOT NULL AND winners != ''
    //     ORDER BY
    //         date(start_dt) DESC
    //     `
    // )
    res.sendStatus(404);
});

router.get('/game/search', async (req, res) => {
    const { query: { d, q } } = req;
    const date = _.isString(d) ? d : undefined;
    if (!date) {
        return res.sendStatus(400);
    }
    const search = _.isString(q) ? q.toLowerCase() : undefined;
    if (!search) {
        return res.sendStatus(400);
    }
    const games = tdb.all(
        `
        SELECT gid, games.started, games.players, games.score, tournaments.name AS t
        FROM games
        LEFT JOIN tournaments ON tid = tournaments.id
        WHERE
            date(games.started, 'unixepoch') = date($date)
            AND like($search, games.players)
        ORDER BY games.started
        `, {
            date,
            search: `%${search}%`
        }
    )
    res.json({games});
});

router.get('/game/:gid', async (req, res) => {
    const { params: { gid } } = req;
    if (!gid || !_.isString(gid)) {
        return res.sendStatus(400);
    }
    const row = tdb.first(
        `
        SELECT fname, tournaments.*
        FROM games
        LEFT JOIN tournaments ON tid = tournaments.id
        WHERE gid = $gid
        `,
        { gid: parseInt(gid, 10)});
    if (!row) {
        return res.sendStatus(404);
    }
    const { fname } = row;
    delete row.fname;
    const contents = await readFile(
        path.join(config.FT2_SAVE_PATH, fname), 'utf-8');
    const save = JSON.parse(contents) as SaveWithMetadata;
    res.json({
        t: row,
        save
    });
});

/** Back-fill the database with game files on disk */

setTimeout(async () => {
    const debug = makeDebug('games-bf');
    debug('started');
    let added = 0;
    const existing = new Set<string>(db.all('SELECT fname FROM games', {})
        .map(({fname}) => fname));
    const dir = await opendir(config.FT2_SAVE_PATH);
    for await (const dirent of dir) {
        const { name } = dirent;
        if (name.endsWith('.json')) {
            if (existing.has(name)) {
                continue;
            }
            debug('loading', name);
            try {
                const contents = await readFile(
                    path.join(config.FT2_SAVE_PATH, name), 'utf-8');
                const save = JSON.parse(contents) as SaveWithMetadata;
                db.run(`
                    INSERT INTO games
                    VALUES (null, $name, $started, $players, $score, $tid)
                    `,
                    {
                        name,
                        started: getUnixTime(save.started),
                        players: save.players.join(','),
                        score: `${save.marks?.US}-${save.marks?.THEM}`,
                        tid: save.tid ?? null
                    });
                added++;
            }
            catch (error) {
                debug('failed to process', name, error);
            }
        }
    }
    debug('done, added', added);
}, ms('5s'));
