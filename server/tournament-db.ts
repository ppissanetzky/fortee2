import _ from 'lodash';

import { Database, Params } from './db';

const database = new Database('tournaments', 0);

export function all(query: string, params?: Params) {
    return database.all(query, params);
}

export function run(query: string, params?: Params) {
    return database.run(query, params);
}

export function getSignups(id: number): Map<string, string | null> {
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

export function addSignup(id: number, user: string, partner?: string): void {
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
