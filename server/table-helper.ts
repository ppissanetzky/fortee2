import assert from 'node:assert';
import _ from 'lodash';

interface Position {
    me: number;
    partner: number;
    left: number;
    right: number;
}

const HOST = 0;
const LEFT = 1;
const PARTNER = 2;
const RIGHT = 3;

const POSITIONS: Record<number, Position> = {
    0: { me: 0, partner: 2, left: 1, right: 3 },
    1: { me: 1, partner: 3, left: 2, right: 0 },
    2: { me: 2, partner: 0, left: 3, right: 1 },
    3: { me: 3, partner: 1, left: 0, right: 2 },
};

export default class TableHelper {

    public readonly players: string[];
    public readonly position: Position;

    constructor(me: string, players: string[]) {
        assert(me);
        assert(players.length === 4);
        assert(players.every((player) => player));
        const index = players.indexOf(me);
        assert(index >= 0 && index < 4);
        this.players = players;
        this.position = POSITIONS[index];
    }

    get name(): string {
        return this.players[this.position.me];
    }

    get partner(): string {
        return this.players[this.position.partner];
    }

    get left(): string {
        return this.players[this.position.left];
    }

    get right(): string {
        return this.players[this.position.right];
    }

    get others(): string[] {
        return [
            this.players[this.position.left],
            this.players[this.position.right]
        ];
    }

    isPartner(name: string) {
        return this.partner === name;
    }

    /** Returns all the players after me, given this lead player */
    after(lead: string): string[] {
        assert(this.players.includes(lead));
        const result = [...this.players];
        while (result[0] !== lead) {
            const first = result.shift();
            assert(first);
            result.push(first);
        }
        while (result.shift() !== this.name) {
            void 0;
        }
        return result;
    }
}


type UserId = string;
type Name = string;

export interface User {
    id: UserId;
    name?: Name;
}

type Table = (User | null)[];

export class TableBuilder {

    static parse(json: string): TableBuilder {
        const outer = JSON.parse(json);
        assert(outer && _.isObject(outer));
        const { table } = outer as TableBuilder;
        assert(_.isArray(table));
        assert(table.length === 4);
        table.forEach((item) => {
            if (item !== null) {
                assert(item && _.isObject(item));
                const { id, name } = item as User;
                assert(id && _.isString(id));
                assert(name && _.isString(name));
            }
        });
        return new TableBuilder(table);
    }

    public readonly table: Table;

    constructor(table: Table = [null, null, null, null]) {
        this.table = table;
    }

    private set(index: number, pair: User | null) {
        assert(index >=0 && index < 4);
        if (pair) {
            assert(pair.id);
            assert(!this.has(pair.id));
        }
        this.table[index] = pair;
    }

    get host(): User | null {
        return this.table[HOST];
    }

    set host(pair: User | null) {
        this.set(HOST, pair);
    }

    get left(): User | null {
        return this.table[LEFT];
    }

    set left(pair: User | null) {
        this.set(LEFT, pair);
    }

    get partner(): User | null {
        return this.table[PARTNER];
    }

    set partner(pair: User | null) {
        this.set(PARTNER, pair);
    }

    get right(): User | null {
        return this.table[RIGHT];
    }

    set right(pair: User | null) {
        this.set(RIGHT, pair);
    }

    get ids(): string[] {
        return this.table.reduce((result, item) => {
            if (item) {
                result.push(item.id);
            }
            return result;
        }, [] as string[]);
    }

    get otherIds(): string[] {
        return this.table.reduce((result, item, index) => {
            if (index !== HOST && item) {
                result.push(item.id);
            }
            return result;
        }, [] as string[]);
    }

    addOther(pair: User) {
        if (!this.table[LEFT]) {
            return this.set(LEFT, pair);
        }
        if (!this.table[RIGHT]) {
            return this.set(RIGHT, pair);
        }
        assert(false);
    }

    setName(id: UserId, name: Name) {
        const pair = this.has(id);
        assert(pair);
        pair.name = name;
    }

    has(id: UserId): User | null {
        assert(id);
        for (const pair of this.table) {
            if (pair && pair.id === id) {
                return pair;
            }
        }
        return null;
    }

    idFor(name: Name): string | null {
        assert(name);
        for (const pair of this.table) {
            if (pair && pair.name === name) {
                return pair.id;
            }
        }
        return null;
    }
}
