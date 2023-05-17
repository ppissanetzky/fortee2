
import { Database } from './db';

const database = new Database('stats', 1);
const db = database.connect();

const INSERT = db.statement(
    `INSERT INTO stats VALUES ($type, unixepoch(), $key, $value)`);

export function writeStat(type: string, key: string, value: number) {
    process.nextTick(() => {
        INSERT.run({type, key, value});
    });
}
