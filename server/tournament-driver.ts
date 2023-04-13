import assert from 'node:assert';
import _ from 'lodash';

import Tournament from './tournament';

export class Team {
    public readonly users: string[];

    constructor(a: string, b: string) {
        this.users = [a, b];
    }
}

export default class TournamentDriver {

    public readonly t: Tournament;
    public readonly teams: Team[];
    public readonly dropped: string | undefined;

    constructor(t: Tournament) {
        this.t = t;
        [this.teams, this.dropped] = this.pickTeams();
    }

    private pickTeams(): [Team[], string | undefined] {
        /** Get the signups in a map of user/partner */
        // TODO: randomize
        const signups = this.t.signups();

        /** Put all the players in a reject pile */
        const rejects = new Set(signups.keys());

        /** The teams */
        const teams: Team[] = [];

        /** Try to match up partners */
        if (this.t.choosePartner) {

            /** Iterate over the signups */
            for (const [user, partner] of signups.entries()) {

                /** We've already dealt with this one */
                if (!rejects.has(user)) {
                    continue;
                }

                /** This player didn't choose a partner, so he stays in the pile */
                if (!partner) {
                    continue;
                }

                /** The partner is already taken */
                if (!rejects.has(partner)) {
                    continue;
                }

                /** If the partner didn't pick this player, no match */
                if (signups.get(partner) !== user) {
                    continue;
                }

                /** We have a match */
                teams.push(new Team(user, partner));
                rejects.delete(user);
                rejects.delete(partner);
            }
        }

        let dropped: string | undefined;

        /** If we have an odd number, we have to drop someone */
        if (rejects.size % 2 !== 0) {
            dropped = _.sample(Array.from(rejects.values()));
            assert(dropped);
            rejects.delete(dropped);
        }

        assert(rejects.size % 2 === 0);

        /** Create random teams from everyone left in the pile */

        const left = Array.from(rejects.values());

        while (left.length > 0) {
            const [a , b] = [left.pop(), left.pop()];
            assert(a);
            assert(b);
            teams.push(new Team(a, b));
        }

        return [teams, dropped];
    }

}
