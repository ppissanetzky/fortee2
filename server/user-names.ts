import assert from 'node:assert';
import { App } from '@slack/bolt';

import * as db from './tournament-db';
import { makeDebug } from './utility';

const debug = makeDebug('user-names');

const SELECT = 'SELECT name FROM users WHERE id = $id';
const INSERT = 'INSERT OR REPLACE INTO users (id, name) VALUES ($id, $name)';

type Row = undefined | { name: string };

class Deferred<T> {
    public promise: Promise<T>;
    public resolve!: (value: T) => void;
    public reject!: (value: T) => void;

    constructor() {
        this.promise = new Promise<T>((resolve, reject) => {
            this.resolve = resolve;
            this.reject = reject;
        });
    }
}

export default class UserNames {

    static start(app: App): void {
        this.deferred.resolve(app);
        debug('started');
    }

    private static deferred = new Deferred<App>();

    private constructor() { void 0 }

    static put(id: string, name: string) {
        if (!(id && name)) {
            debug(`invalid put "${id}" "${name}"`);
            return;
        }
        const row = db.first(SELECT, { id }) as Row;
        if (row?.name === name) {
            return;
        }
        db.run(INSERT, { id, name });
        debug('saved "%s" "%s"', id, name);
    }

    static async get(id?: string): Promise<string | void> {
        if (!id) {
            return;
        }
        const row = db.first(SELECT, { id }) as Row;
        if (row) {
            return row.name;
        }
        const app = await UserNames.deferred.promise;
        try {
            const info = await app.client.users.info({user: id});
            if (!info.ok) {
                debug('failed to look up "%s": %j', id, info);
                return;
            }
            const name = info.user?.profile?.real_name;
            if (!name) {
                debug('no name for "%s" : %j', id, info);
                return;
            }
            db.run(INSERT, { id, name });
            return name;
        }
        catch (error) {
            debug('failed to look up "%s"', id, error);
        }
    }

    static async expected(id: string): Promise<string> {
        const result = await this.get(id);
        assert(result, `No name for ${id}`);
        return result;
    }

    static async user(id: string) {
        const name = await this.expected(id);
        return { id, name };
    }
}

