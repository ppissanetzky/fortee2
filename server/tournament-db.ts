
import { Database, DatabaseConnection, Params } from './db';
import type { TournamentRow, Signups } from './tournament';
import TexasTime from './texas-time';

const database = new Database('tournaments', 4);

export function connect(): DatabaseConnection {
    return database.connect();
}

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

export function getTournament(id: number): TournamentRow | undefined {
    return database.first(
        `
        SELECT * FROM tournaments WHERE id = $id
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

export function deleteTournament(id: number): number {
    return database.change('DELETE FROM tournaments WHERE id = $id', { id });
}
