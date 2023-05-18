import * as db from './tournament-db';
import Dispatcher from './dispatcher';
import GameRoom from './game-room';
import { expected } from './utility';
import type { DatabaseConnection } from './db';
import { parseISO, formatISO, formatDistanceToNow } from 'date-fns';

export interface UserPrefs {
    picture?: string;
}

export type UserType = 'blocked' | 'guest' | 'standard';

export type UserRole = 'td' | 'admin';

export interface UserRow {
    id: string;
    /** Set at login time, only 'google' for now */
    source: string;
    /** This is the name that cam from the 'source' and should not be changed */
    name: string;
    /** From 'source', not editable */
    email: string;
    /** This is the name shown to everyone and can be edited by TDs */
    displayName: string;
    type: UserType
    roles: UserRole[];
    prefs: UserPrefs;
    /** Date */
    lastLogin?: number;

    /** THE FOLLOWING SHOULD NOT BE SENT TO USERS */

    /**
     * If 'name' is not the real name and we know what is, we can set it here
     * so that we know. No one else sees this name
     */
    ourName: string | null;
    /** Notes we keep */
    notes: string | null;
    hasNotes?: string;
}

export interface ExtendedUserRow extends UserRow {
    loginAge: string;
    hasNotes: string;
}

export interface UserUpdate {
    type?: UserType;
    displayName?: string;
    ourName?: string;
    roles?: UserRole[];
    notes?: string;
    prefs?: UserPrefs;
}

function decodeRow(row: any): ExtendedUserRow {
    row.type = row.type ? row.type : 'guest';
    row.roles = row.roles ? row.roles.split(',') : [];
    row.prefs = row.prefs ? JSON.parse(row.prefs) : {};
    row.lastLogin = row.lastLogin ? parseISO(row.lastLogin).getTime() : 0;
    row.loginAge = row.lastLogin ? formatDistanceToNow(new Date(row.lastLogin)) : '';
    row.hasNotes = row.notes ? 'yes' : '';
    return row as ExtendedUserRow;
}

function getUserRow(connection: DatabaseConnection, id: string): UserRow | undefined  {
    const row = connection.first(
        'SELECT * FROM users WHERE id = $id', { id });
    if (row) {
        return decodeRow(row);
    }
}

export interface UserEvents {
    changed: User;
    blocked: User;
}

export default class User {

    public static readonly events = new Dispatcher<UserEvents>();

    private row: UserRow;

    constructor(row: UserRow) {
        this.row = row;
    }

    toJSON() {
        const row: Partial<UserRow> = {...this.row};
        delete row.notes;
        delete row.ourName;
        delete row.hasNotes;
        return row;
    }

    get id(): string {
        return this.row.id;
    }

    get email(): string {
        return this.row.email;
    }

    get name(): string {
        return this.row.displayName || this.row.name;
    }

    get type(): UserType {
        return this.row.type;
    }

    get realName(): string {
        return this.row.name;
    }

    get roles(): UserRole [] {
        return this.row.roles;
    }

    get isBlocked(): boolean {
        return this.row.type === 'blocked';
    }

    get isGuest(): boolean {
        return this.row.type === 'guest';
    }

    get isStandard(): boolean {
        return this.row.type === 'standard';
    }

    get isTD(): boolean {
        return this.roles.includes('td');
    }

    get isAdmin(): boolean {
        return this.roles.includes('admin');
    }

    update(changes: UserUpdate) {
        const wasBlocked = this.isBlocked;
        const connection = db.connect();
        connection.run(
            `
            UPDATE users SET
                type = ifnull($type, type),
                displayName = ifnull($displayName, displayName),
                ourName = ifnull($ourName, ourName),
                roles = ifnull($roles, roles),
                notes = ifnull($notes, notes)
            WHERE
                id = $id
            `,
            {
                type: changes.type ?? null,
                displayName: changes.displayName ?? null,
                ourName: changes.ourName ?? null,
                roles: changes.roles ? changes.roles.join(',') : null,
                notes: changes.notes ?? null,

                id: this.id
            });
        /** Update by reading from the database */
        this.row = expected(getUserRow(connection, this.id));

        /** Special event when a user is blocked */
        if (this.isBlocked && !wasBlocked) {
            User.events.emit('blocked', this);
        }
        else {
            User.events.emit('changed', this);
        }
    }

    static getName(id: string) {
        const bot = GameRoom.isBot(id);
        if (bot) {
            return bot;
        }
        const user = User.get(id);
        return user?.name || '<unknown>';
    }

    static login(row: UserRow): User {
        const { id } = row;
        const connection = db.connect();
        const existing = getUserRow(connection, id);
        if (existing) {
            const now = new Date();
            connection.run(
                'UPDATE USERS SET lastLogin = $lastLogin WHERE id = $id',
                { id, lastLogin: formatISO(now) }
            );
            existing.lastLogin = now.getTime();
            return new User(existing);
        }
        return this.add(row);
    }

    public static get(id: string): User | undefined {
        const row = getUserRow(db.connect(), id);
        if (row) {
            return new User(row);
        }
    }

    private static add(row: UserRow): User {
        const now = new Date();
        db.run(`
            INSERT INTO users
                (id, name, type, prefs, roles, email, source, displayName, lastLogin, ourName)
            VALUES
                ($id, $name, $type, $prefs, $roles, $email, $source, $displayName, $lastLogin, $ourName)
        `, {
            ...row,
            ourName: `${row.name} - from ${row.source}`,
            lastLogin: formatISO(now),
            roles: row.roles.join(','),
            prefs: JSON.stringify(row.prefs)
        });
        row.lastLogin = now.getTime();
        return new User(row);
    }

    static listOf(type: UserType | 'all'): ExtendedUserRow[] {
        return db.all(
            `SELECT * FROM users WHERE type = $type OR $type = 'all' ORDER BY name`, { type })
            .map((row) => decodeRow(row));
    }
}


