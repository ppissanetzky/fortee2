
import * as db from './tournament-db';
import Dispatcher from './dispatcher';
import GameRoom from './game-room';

export interface UserPrefs {
    picture?: string;
    displayName?: string;
}

export type UserType = 'blocked' | 'guest' | 'standard';

export type UserRole = 'td' | 'admin';

export interface UserRow {
    id: string;
    name: string;
    email: string;
    type: UserType
    source: string;
    roles: UserRole[];
    prefs: UserPrefs;
}

function decodeRow(row: any): UserRow {
    row.type = row.type ? row.type : 'guest';
    row.roles = row.roles ? row.roles.split(',') : [];
    row.prefs = row.prefs ? JSON.parse(row.prefs) : {};
    return row as UserRow;
}

function getUserRow(id: string): UserRow | undefined  {
    const row = db.first('SELECT * FROM users WHERE id = $id', { id });
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

    private readonly row: UserRow;

    constructor(row: UserRow) {
        this.row = row;
    }

    toJSON() {
        return this.row;
    }

    get id(): string {
        return this.row.id;
    }

    get email(): string {
        return this.row.email;
    }

    get name(): string {
        return this.row.prefs.displayName || this.row.name;
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

    update(type: UserType, prefs: UserPrefs) {
        const wasBlocked = this.isBlocked;
        db.run(
            'UPDATE users SET type = $type, prefs = $prefs WHERE id = $id',
            { type, prefs: JSON.stringify(prefs), id: this.id});
        this.row.type = type;
        this.row.prefs = prefs;
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

    static get(id: string): User | undefined {
        const row = getUserRow(id);
        if (row) {
            return new User(row);
        }
    }

    static add(row: UserRow): User {
        db.run(`
            INSERT INTO users (id, name, type, prefs, roles, email, source)
            VALUES ($id, $name, $type, $prefs, $roles, $email, $source)
        `, {
            ...row,
            roles: row.roles.join(','),
            prefs: JSON.stringify(row.prefs)
        });
        return new User(row);
    }

    static listOf(type: UserType): UserRow[] {
        return db.all(
            'SELECT * FROM users WHERE type = $type ORDER BY name', { type })
            .map((row) => decodeRow(row));
    }
}


