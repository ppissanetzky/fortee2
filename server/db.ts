
import path from 'node:path';
import fs from 'fs';

import BetterSqlite3 from 'better-sqlite3';

import config from './config';
import { makeDebug } from './utility';

const { FT2_DB_PATH } = config;

type Params = Record<string, any>;

//-----------------------------------------------------------------------------
// A persistent connection
//-----------------------------------------------------------------------------

export class DatabaseConnection {

    private bs3: BetterSqlite3.Database;

    constructor(database: Database) {
        this.bs3 = database.open();
    }

    // Returns an array of rows - which can be empty
    all(query: string, params: Params) {
        const statement = this.bs3.prepare(query);
        return statement.all(params || {});
    }

    // Returns just the first row or undefined if there are no rows
    first(query: string, params: Params) {
        const statement = this.bs3.prepare(query);
        return statement.get(params || {});
    }

    // Returns the last row ID
    run(query: string, params: Params) {
        const statement = this.bs3.prepare(query);
        const info = statement.run(params || {});
        return info.lastInsertRowid as number;
    }

    // Returns the changes
    change(query: string, params: Params) {
        const statement = this.bs3.prepare(query);
        const info = statement.run(params || {});
        return info.changes;
    }

    transaction(func: () => void) {
        const executor = this.bs3.transaction(func);
        return executor();
    }

    statement(query: string) {
        return this.bs3.prepare(query);
    }

    function(name: string, f: (...args: any[]) => any) {
        this.bs3.function(name, f);
    }
}

//-----------------------------------------------------------------------------
// An async wrapper around sqlite that just stores the path and uses a new
// connection to run every statement or transaction
//-----------------------------------------------------------------------------

export class Database {

    private readonly name: string;
    private readonly file: string;
    private readonly version: number;
    private migrated: boolean;

    constructor(name: string, version: number) {
        this.name = name;
        this.file = path.join(FT2_DB_PATH, `${name}.db`);
        this.version = version;
        this.migrated = false;
        // Open it once now to migrate it if necessary
        this.open();
    }

    connect() {
        return new DatabaseConnection(this);
    }

    // Returns all the rows or an empty array
    all(query: string, params: Params = {}) {
        const connection = new DatabaseConnection(this);
        return connection.all(query, params);
    }

    // Returns the first row, or undefined
    first(query: string, params: Params = {}) {
        const connection = new DatabaseConnection(this);
        return connection.first(query, params);
    }

    // Returns the last row ID
    run(query: string, params: Params = {}) {
        const connection = new DatabaseConnection(this);
        return connection.run(query, params);
    }

    // Returns the number of changed rows
    change(query: string, params: Params = {}) {
        const connection = new DatabaseConnection(this);
        return connection.change(query, params);
    }

    transaction(func: any) {
        const connection = new DatabaseConnection(this);
        const all = connection.all.bind(connection);
        const run = connection.run.bind(connection);
        const change = connection.change.bind(connection);
        const first = connection.first.bind(connection);
        return connection.transaction(() => func({all, run, change, first}));
    }

    //-------------------------------------------------------------------------
    // Open and migrate the database if necessary
    //-------------------------------------------------------------------------

    open() {
        const {name, file, version, migrated} = this;
        const debug = makeDebug('db').extend(name);
        let db;
        try {
            db = new BetterSqlite3(file);
            // If we have already migrated it, return it
            if (migrated) {
                return db;
            }

            // Check the version with this pragma
            let [{user_version: userVersion}] = db.pragma('user_version');

            debug(name, 'database is version', userVersion, 'requesting version', version);

            // If it is already at the desired version mark it as migrated
            // and return it
            if (userVersion === version) {
                this.migrated = true;
                return db;
            }


            // If it is at a higher version than the desired one, there is
            // a problem and we should not continue.
            if (userVersion > version) {
                throw new Error(`It has later version ${userVersion}`);
            }

            // Now, try to get to the desired version
            while (userVersion < version) {
                // Look for a script to get us to the next version
                const nextVersion = userVersion + 1;
                const migrationScript = path.join(__dirname, 'database', name, `v${nextVersion}.sql`);
                debug('Migrating to version', nextVersion, 'with', migrationScript);

                // Load and execute the script. It should create its own
                // transaction
                const script = fs.readFileSync(migrationScript, 'utf-8');
                db.exec(script);

                // Now, read the new version, which the script should have set
                [{user_version: userVersion}] = db.pragma('user_version');

                // This is because the script didn't set it, so it is a
                // programmatic error
                if (userVersion !== nextVersion) {
                    throw new Error(`After running ${migrationScript}, the version is ${userVersion} and we were expecting ${nextVersion}`);
                }
            }

            // We reached the desired version, so add it to the map and return it
            debug(`Finished migrating ${file} to version ${version}`);
            this.migrated = true;
            return db;
        }
        catch (error) {
            // If we opened it, close it just for grins
            if (db) {
                db.close();
            }
            debug(`Failed to open database ${file} version ${version}`, error);
            throw error;
        }
    }
}
