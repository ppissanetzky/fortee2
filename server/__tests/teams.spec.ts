import { jest, expect, test, describe } from '@jest/globals';
import _ from 'lodash';

import * as db from '../tournament-db';

jest.mock('../tournament-db');

const getSignups = jest.spyOn(db, 'getSignups');

import Tournament from '../tournament';
import TournamentDriver, { Team } from '../tournament-driver';

describe('team counts', () => {

    test.each([
        /** player count, resulting number of teams, player dropped */
        [0, 0, undefined],
        [1, 0, '0'],
        [2, 1, undefined],
        [3, 1, expect.any(String)],
        [4, 2, undefined],
        [5, 2, expect.any(String)]

    ])('with %d player(s) it should have %d team(s)', (count, teams, dropped) => {
        const signups: string[] = [];
        for (let i = 0; i < count; i++) {
            signups.push(`${i}`);
        }
        expect(signups).toHaveLength(count);
        expect(_.uniq(signups)).toHaveLength(count);
        getSignups.mockReturnValueOnce(new Map(signups.map((item) => [item, null])));
        const tournament = new Tournament({
            id: 1,
            name: ``,
            type: 1,
            signup_start_dt: '',
            signup_end_dt: '',
            start_dt: '1970-01-01 00:00',
            rules: '',
            partner: 1,
            seed: 0,
            timezone: 'CST',
            signup_opened: 0,
            signup_closed: 0,
            started: 0,
            scheduled: 0,
            finished: 0,
            ladder_id: 0,
            ladder_name: '',
            lmdtm: '',
            invitation: 0,
            recurring: 0,
            invitees: '',
            prize: '',
            winners: '',
            recurring_source: 0,
            host: ''
        });
        const driver = new TournamentDriver(tournament);
        expect(driver.teams).toHaveLength(teams);
        expect(driver.dropped).toEqual(dropped);
        const all: string [] = [
            ...(driver.dropped ? [driver.dropped] : []),
            ..._.flatten(driver.teams.map(({users}) => users))
        ];
        expect(all.sort()).toEqual(signups);
    });
});

describe('partner matching', () => {

    type Signup = [string, string | null];
    type Pair = [string, string];

    const s = (a: string, b: string | null): Signup => [a, b];
    const p = (a: string, b: string): Pair => [a, b];

    test.each([
        [
            /** Neither picked a partner, but they get matched */
            [s('a', null), s('b', null)],
            [p('a', 'b')]
        ],
        [
            /** A match made in heaven */
            [s('a', 'b'), s('b', 'a')],
            [p('a', 'b')]
        ],
        [
            /** b and c picked each other, a gets dropped */
            [s('a', 'b'), s('b', 'c'), s('c', 'b')],
            [p('b', 'c')]
        ],
        [
            /** a and b match */
            [s('a', 'b'), s('c', 'a'), s('d', 'a'), s('b', 'a')],
            [p('a', 'b'), p('c', 'd')]
        ],

    ])('match', (signups: Signup[], pairs: Pair[]) => {
        getSignups.mockReturnValueOnce(new Map(signups));
        const tournament = new Tournament({
            id: 1,
            name: ``,
            type: 1,
            signup_start_dt: '',
            signup_end_dt: '',
            start_dt: '1970-01-01 00:00',
            rules: '',
            partner: 2,
            seed: 0,
            timezone: 'CST',
            signup_opened: 0,
            signup_closed: 0,
            started: 0,
            scheduled: 0,
            finished: 0,
            ladder_id: 0,
            ladder_name: '',
            lmdtm: '',
            invitation: 0,
            recurring: 0,
            invitees: '',
            prize: '',
            winners: '',
            recurring_source: 0,
            host: ''
        });
        const { teams } = new TournamentDriver(tournament);
        expect(teams).toHaveLength(pairs.length);
        expect(teams.map(({users}) => users.sort())).toEqual(pairs);
    });
});

describe('brackets', () => {

    function createTournament() {
        return new Tournament({
            id: 1,
            name: ``,
            type: 1,
            signup_start_dt: '',
            signup_end_dt: '',
            start_dt: '1970-01-01 00:00',
            rules: '',
            partner: 1,
            seed: 0,
            timezone: 'CST',
            signup_opened: 0,
            signup_closed: 0,
            started: 0,
            scheduled: 0,
            finished: 0,
            ladder_id: 0,
            ladder_name: '',
            lmdtm: '',
            invitation: 0,
            recurring: 0,
            invitees: '',
            prize: '',
            winners: '',
            recurring_source: 0,
            host: ''
        });
    }

    const signups = (count: number): Map<string, string | null> => {
        const result = new Map();
        for (let i = 0; i < count; i++) {
            result.set(`${i}`, null);
        }
        expect(result.size).toBe(count);
        expect(_.uniq(Array.from(result.keys()))).toHaveLength(count);
        return result;
    };

    test('returns empty with no signups', () => {
        getSignups.mockReturnValueOnce(new Map());
        const tournament = createTournament();
        const { games, rounds } = new TournamentDriver(tournament);
        expect(games.size).toBe(0);
        expect(rounds).toHaveLength(0);
    });

    test('validate 4 teams', () => {
        getSignups.mockReturnValueOnce(signups(8));
        const tournament = createTournament();
        const { games, rounds } = new TournamentDriver(tournament);
        expect(games.size).toBe(3);
        expect(rounds).toHaveLength(2);
        for (const game of rounds[0]) {
            expect(game.started).toBe(false);
            expect(game.finished).toBe(false);
            expect(game.teams).toHaveLength(2);
            for (const team of game.teams) {
                expect(team.users).toEqual(expect.arrayContaining(
                    [expect.stringMatching(/\d/), expect.stringMatching(/\d/)]
                ));
            }
            expect(game.previous_games).toHaveLength(0);
            expect(game.next_game).toBe(rounds[1][0]);
        }
        expect(rounds[1]).toHaveLength(1);
        const [game] = rounds[1];
        expect(game.started).toBe(false);
        expect(game.finished).toBe(false);
        expect(game.teams).toHaveLength(0);
        expect(game.previous_games).toHaveLength(2);
        expect(game.previous_games[0]).toBe(rounds[0][0]);
        expect(game.previous_games[1]).toBe(rounds[0][1]);
        expect(game.next_game).toBeUndefined();
    });

    test('validate 5 teams', () => {
        getSignups.mockReturnValueOnce(signups(10));
        const tournament = createTournament();
        const { games, rounds } = new TournamentDriver(tournament);
        expect(games.size).toBe(7);
        expect(rounds).toHaveLength(3);
        expect(rounds[0]).toHaveLength(4);
        expect(rounds[1]).toHaveLength(2);
        expect(rounds[2]).toHaveLength(1);
        const byes = rounds[0].filter((game) => game.bye);
        /** 3 of the 4 games in round 1 have byes */
        expect(byes).toHaveLength(3);
        /** Make sure no game has two byes */
        const bad = rounds[0].filter(({teams}) =>
            teams.every((team) => team === Team.bye));
        expect(bad).toHaveLength(0);
    });
});
