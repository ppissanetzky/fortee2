import assert from 'node:assert';

export default class Bid {

    public static readonly PASS = new Bid('pass', 1, 0, 0, 0);

    public static readonly ALL: Bid[] = [
        Bid.PASS,
        new Bid('30',       2,  30,  30, 1),
        new Bid('31',       3,  31,  31, 1),
        new Bid('32',       4,  32,  32, 1),
        new Bid('33',       5,  33,  33, 1),
        new Bid('34',       6,  34,  34, 1),
        new Bid('35',       7,  35,  35, 1),
        new Bid('36',       8,  36,  36, 1),
        new Bid('37',       9,  37,  37, 1),
        new Bid('38',      10,  38,  38, 1),
        new Bid('39',      11,  39,  39, 1),
        new Bid('40',      12,  40,  40, 1),
        new Bid('41',      13,  41,  41, 1),
        new Bid('1-mark',  14,  42,  42, 1),
        new Bid('2-marks', 15,  42,  84, 2),
        new Bid('3-marks', 16,  42, 126, 3),
        new Bid('4-marks', 17,  42, 168, 4),
        new Bid('5-marks', 18,  42, 210, 5)
    ];

    private constructor(
        public readonly name: string,
        public readonly order: number,
        public readonly points: number,
        public readonly total: number,
        public readonly marks: number )
    {}

    toString() {
        return this.name;
    }

    get is_pass(): boolean {
        return this === Bid.PASS;
    }

    bid_one_less(): Bid | undefined {
        return Bid.ALL.find((bid) => bid.order === this.order - 1);
    }

    bid_one_more(): Bid | undefined {
        return Bid.ALL.find((bid) => bid.order === this.order + 1);
    }

    static find(name: string): Bid {
        const result = this.ALL.find((bid) => bid.name === name);
        assert(result, `Invalid bid "${name}"`);
        return result;
    }

    static find_bid_one_less(name: string): Bid | undefined {
        return this.find(name)?.bid_one_less();
    }

    static find_bid_one_more(name: string): Bid | undefined {
        return this.find(name)?.bid_one_more();
    }

    static find_bid_for_total_points(total: number): Bid {
        return this.ALL.find((bid) => bid.total === total) || this.PASS;
    }
}
