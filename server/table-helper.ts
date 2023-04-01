import assert from 'node:assert';

interface Position {
    me: number;
    partner: number;
    left: number;
    right: number;
}

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
