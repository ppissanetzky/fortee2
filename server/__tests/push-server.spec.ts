import { jest, expect, test, describe } from '@jest/globals';
import assert from 'node:assert';

jest.mock('ws');
import WebSocket from 'ws';

import WsServer from '../ws-server';
import PushServer from '../push-server';
import User from '../users';
import type { Request, Response } from 'express';

/** Get it now, so the single instance is created */

const server = WsServer.get();

describe('push-server', () => {

    type Pair = [WebSocket, User];

    function makePair(name: string): Pair {
        return [new WebSocket(null), new User({
            id: `id-for-${name}`,
            source: 'google',
            name,
            email: `${name}@example.com`,
            displayName: name,
            type: 'standard',
            roles: [],
            prefs: {},
            ourName: null,
            notes: null
        })];
    }

    test('it can be created', () => {
        const ps = new PushServer();
        expect(ps).toBeDefined();
    });

    test('upgrade works', async () => {
        const ps = new PushServer();

        jest.spyOn(server, 'upgrade').mockResolvedValueOnce(makePair('Z'));
        const nextZ = jest.fn();
        await ps.upgrade()({query: {}} as Request, {} as Response, nextZ);
        expect(nextZ).not.toHaveBeenCalled();

        const [ws, a] = makePair('a');
        jest.spyOn(server, 'upgrade').mockResolvedValueOnce([ws, a]);
        const send = jest.spyOn(ws, 'send');
        const next = jest.fn();
        await ps.upgrade()({query: {}} as Request, {} as Response, next);
        expect(next).not.toHaveBeenCalled();

        expect(send).toHaveBeenCalledTimes(1);

        const message = send.mock.lastCall?.[0];

        assert(typeof message === 'string');

        const online = JSON.parse(message);

        expect(online).toEqual(expect.objectContaining({
            type: 'online',
            message: [
                expect.objectContaining({text: 'a'}),
                expect.objectContaining({text: 'Z'})
            ]
        }));
    });
});
