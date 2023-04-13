import assert from 'node:assert';

export default class Trump {

    public static readonly ALL: Trump[] = [
        new Trump('blanks'         ,   0,  false,  true,    false ,  false,  true,   false ),
        new Trump('ones'           ,   1,  false,  true,    false ,  false,  true,   false ),
        new Trump('twos'           ,   2,  false,  true,    false ,  false,  true,   false ),
        new Trump('threes'         ,   3,  false,  true,    false ,  false,  true,   false ),
        new Trump('fours'          ,   4,  false,  true,    false ,  false,  true,   false ),
        new Trump('fives'          ,   5,  false,  true,    false ,  false,  true,   false ),
        new Trump('sixes'          ,   6,  false,  true,    false ,  false,  true,   false ),
        new Trump('doubles'        ,  -1,  false,  true,    true  ,  true,   true,   false ),
        new Trump('follow-me-hi'   ,  -1,  false,  true,    false ,  false,  false,  false ),
        new Trump('follow-me-lo'   ,  -1,  false,  false,   false ,  false,  false,  false ),
        new Trump('follow-me-os-hi',  -1,  false,  true,    true  ,  false,  false,  false ),
        new Trump('follow-me-os-lo',  -1,  false,  false,   true  ,  false,  false,  false ),
        new Trump('nello-hi'       ,  -1,  true,   true,    false ,  false,  false,  true  ),
        new Trump('nello-lo'       ,  -1,  true,   false,   false ,  false,  false,  true  ),
        new Trump('nello-os-hi'    ,  -1,  true,   true,    true  ,  false,  false,  true  ),
        new Trump('nello-os-lo'    ,  -1,  true,   false,   true  ,  false,  false,  true  ),
        new Trump('sevens'         ,  -1,  false,  true,    false ,  false,  false,  true  ),
        new Trump('plunge'         ,  -1,  false,  true,    false ,  false,  true,   true  ),
    ];

    private constructor(
        public readonly name: string,
        public readonly suit: number,
        public readonly nello: boolean,
        public readonly double_hi: boolean,
        public readonly double_os: boolean,
        public readonly double_trump: boolean,
        public readonly has_trump: boolean,
        public readonly needs_42: boolean)
    {}

    public static find(name: string): Trump {
        const result = this.ALL.find((trump) => trump.name === name);
        assert(result, `Couldn't find trump "${name}"`);
        return result;
    }

    toString(): string {
        return this.name;
    }
}
