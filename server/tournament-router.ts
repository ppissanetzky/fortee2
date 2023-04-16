import assert from 'node:assert';

import _ from 'lodash';
import express from 'express';

import Scheduler from './tournament-scheduler';
import TexasTime from './texas-time';
import * as db from './tournament-db';
import Tournament, { State } from './tournament';
import { Rules } from './core';
import { expected } from './utility';
import GameRoom from './game-room';
import config from './config';

const router = express.Router();

export default router;

const scheduler = Scheduler.get();

type Signups = Map<number, string | null>;


function findGameRoom(t: Tournament, user: string): GameRoom | undefined {
    for (const room of GameRoom.rooms.values()) {
        if (room.t && room.t.id === t.id) {
            if (room.table.has(user)) {
                return room;
            }
        }
    }
}

function externalT(user: Express.User, signups: Signups, row: db.TournamentRowWithCount) {
    const t = new Tournament(row);
    let table
    if (t.state === State.PLAYING) {
        const room = findGameRoom(t, user.id);
        if (room) {
            table = {
                players: room.positions,
                connected: _.pull(Array.from(room.names), user.name),
                url: `${config.FT2_SERVER_BASE_URL}/play/${room.token}`
            }
        }
    }
    return {
        id: t.id,
        name: t.name,
        startTime: t.startTime,
        openTime: t.openTime,
        closeTime: t.closeTime,
        choosePartner: t.choosePartner,
        rules: Rules.fromAny(t.rules).parts(),
        /** How many players are signed up for this one */
        count: row.count,
        /** Whether the calling player is signed up */
        signedUp: signups.has(t.id),
        /** Partner, if signed up */
        partner: signups.get(t.id) || null,
        /** The state of the tourney, only one will be true */
        open: t.state === State.OPEN,
        wts: t.state === State.WTS,
        playing: t.state === State.PLAYING,
        canceled: t.state === State.CANCELED,
        done: t.state === State.DONE,
        later: t.state === State.LATER,
        /** If playing and this user is in it, info about the table */
        table
    }
}


router.get('/', async (req, res) => {
    const { user } = req;
    assert(user);
    const today = TexasTime.today();
    const users = db.getUsers();
    delete users[user.id];
    const signups = db.getSignupsForUser(today, user.id)
    const tournaments = db.getTournaments(today, 4)
        .map((row) => externalT(user, signups, row));
    res.json({users, tournaments, you: user.name});
});

router.get('/signup/:id/:partner', (req, res) => {
    const { user } = req;
    assert(user);
    try {
        if (!db.getUser(user.id)) {
            throw 'invalid-user';
        }
        const { params } = req;
        const id = parseInt(params.id, 10);
        const partner = params.partner === 'null' ? null : params.partner;
        const row = db.getTournament(id);
        if (!row) {
            throw 'invalid-tournament';
        }
        const t = new Tournament(row);
        if (!t.isOpen) {
            throw 'not-open';
        }
        if (partner && !db.getUser(partner)) {
            throw 'invalid-partner';
        }
        db.addSignup(t.id, user.id, partner);

        const signups = new Map<number, string | null>([[t.id, partner]]);
        res.json({tournament: externalT(user, signups,
            expected(db.getTournament(id)))});
    }
    catch (error) {
        if (_.isString(error)) {
            return res.json({error});
        }
        res.json({error: 'oops'});
    }
});

router.get('/dropout/:id', (req, res) => {
    const { user } = req;
    assert(user);
    try {
        if (!db.getUser(user.id)) {
            throw 'invalid-user';
        }
        const { params } = req;
        const id = parseInt(params.id, 10);
        const row = db.getTournament(id);
        if (!row) {
            throw 'invalid-tournament';
        }
        const t = new Tournament(row);
        if (!t.isOpen) {
            throw 'not-open';
        }
        db.deleteSignup(id, user.id);

        const signups = new Map();
        res.json({tournament: externalT(user, signups,
            expected(db.getTournament(id)))});
    }
    catch (error) {
        if (_.isString(error)) {
            return res.json({error});
        }
        res.json({error: 'oops'});
    }
});
