import _ from 'lodash';

import { Database, Params } from './db';
import type { TournamentRow, Signups } from './tournament';
import TexasTime from './texas-time';

export interface TournamentRowWithCount extends TournamentRow {
    readonly count: number;
}

export interface UserInfo {
    id: string;
    name: string;
    prefs: Record<string, any>;
    roles: string[];
}

const database = new Database('tournaments', 2);

export function all(query: string, params?: Params) {
    return database.all(query, params);
}

export function first(query: string, params?: Params) {
    return database.first(query, params);
}

export function run(query: string, params?: Params) {
    return database.run(query, params);
}

export function getSignups(id: number): Signups {
    return new Map(database
        .all('SELECT user, partner FROM signups WHERE id = $id', { id })
        .map(({user, partner}) => [user, partner]));
}

export function isSignedUp(id: number, user: string): boolean {
    const row = database.first(
        `
        SELECT id FROM signups
        WHERE id = $id and user = $user
        `
        , { id, user });
    return row ? true : false;
}

export function signupExists(id: number, user: string, partner?: string): boolean {
    const row = database.first(
        `
        SELECT id FROM signups
        WHERE id = $id and user = $user and partner IS $partner
        `
        , { id, user, partner: partner || null });
    return row ? true : false;
}

export function addSignup(id: number, user: string, partner?: string | null): void {
    database.run(
        `
        INSERT OR REPLACE INTO signups
        (id, user, partner) VALUES ($id, $user, $partner)
        `
        , { id, user, partner: partner || null }
    );
}

export function deleteSignup(id: number, user: string): boolean {
    const changed = database.change(
        `
        DELETE from signups WHERE id = $id AND user = $user
        `
        , { id, user }
    );
    return changed !== 0;
}

export function getTournaments(date: TexasTime, limit: number): TournamentRowWithCount[] {
    return database.all(
        `
        SELECT tournaments.*, counts.count AS count
        FROM tournaments, counts
        WHERE
            date(start_dt) = date($date)
            AND time(start_dt) >= time($date, '-10 minutes')
            AND recurring = 0
            AND (finished = 0
                OR (finished = 1 AND datetime('now') < datetime(lmdtm, '+10 minutes'))
            )
            AND counts.id = tournaments.id
        ORDER BY start_dt
        LIMIT $limit
        `
        , { date: date.toString(), limit }
    );
}

export function getSignupsForUser(date: TexasTime, user: string): Map<number, string | null> {
    const rows = database.all(
        `
        SELECT tournaments.id AS id, signups.partner AS partner
        FROM tournaments, signups
        WHERE date(start_dt) = date($date)
            AND signups.id = tournaments.id
            AND signups.user = $user
        `
        , { date: date.toString(), user }
    );
    return new Map(rows.map(({id, partner}) => [id, partner]));
}

export function getUsers(): Record<string, string> {
    const rows = database.all('SELECT id, name FROM users');
    return rows.reduce((result, {id, name}) => {
        result[id] = name;
        return result;
    }, {});
}

export function getUser(id: string): UserInfo | undefined {
    const row = database.first(
        'SELECT name, roles, prefs FROM users WHERE id = $id', { id });
    if (row) {
        return {
            id,
            name: row.name,
            prefs: row.prefs ? JSON.parse(row.prefs) : {},
            roles: row.roles ? row.roles.split(',') : []
        };
    }
}

export function getTournament(id: number): TournamentRowWithCount | undefined {
    return database.first(
        `
        SELECT tournaments.*, counts.count AS count
        FROM tournaments, counts
        WHERE tournaments.id = $id AND counts.id = tournaments.id
        `
        , { id });
}

export function getRecurringTournaments(): TournamentRow[] {
    return database.all(
        `
        SELECT * FROM tournaments
        WHERE recurring != 0
        ORDER BY recurring, time(start_dt)
        `
    );
}
