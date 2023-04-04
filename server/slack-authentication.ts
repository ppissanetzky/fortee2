import assert from 'node:assert';

import type { Express, Request } from 'express';
import { Issuer, generators, BaseClient } from 'openid-client';

import GameRoom from './game-room';
import { makeDebug } from './utility';
import config, { off } from './config';

const debug = makeDebug('slack-auth');

declare module 'express-session' {
    interface SessionData {
        codeVerifier?: string;
    }
}

/**
 * The URL used to get the OpenID configuration from Slack, the "issuer"
 * @see https://api.slack.com/authentication/sign-in-with-slack
 */

const SLACK_DISCOVER_URL = 'https://slack.com/.well-known/openid-configuration';

export function setupSlackAuthentication(app: Express) {

    if (off(config.FT2_SLACK_ON)) {
        return;
    }

    /** Do this once, starting now */

    const promiseForIssuer = Issuer.discover(SLACK_DISCOVER_URL);

    /** Creates a client once we have the issuer details */

    async function createClient(redirectUri: string): Promise<BaseClient> {
        const issuer = await promiseForIssuer;
        return new issuer.Client({
            client_id: config.FT2_SLACK_CLIENT_ID,
            client_secret: config.FT2_SLACK_CLIENT_SECRET,
            redirect_uris: [redirectUri],
            response_types: ['code']
        });
    }

    function playUri(token: string) {
        return `${config.FT2_SITE_BASE_URL}/play/?t=${token}`;
    }

    function redirectUri(token: string) {
        return `${config.FT2_SERVER_BASE_URL}/slack-login/${token}`;
    }

    app.get('/slack-auth/:token', async (req, res) => {
        const { params: { token } } = req;

        const room = GameRoom.rooms.get(token);

        /** No room with this token */

        if (!room) {
            debug(`Invalid room ${token}`);
            return res.sendStatus(404);
        }

        try {
            const id = req.user?.id;

            if (id) {
                /** The room is not for this user */

                assert(room.table.has(id), `Room ${token} is not for user ${id}`);

                /**
                 * Otherwise, we have the right room, the user is signed in and
                 * the user is part of the room: they can play
                 */

                return res.redirect(playUri(token));
            }

            /** Otherwise, no one is signed in */

            /** Make a challenge verification code and save it in the session */

            const codeVerifier = generators.codeVerifier();
            req.session.codeVerifier = codeVerifier;
            await new Promise<void>((resolve, reject) => {
                req.session.save((error) => error ? reject(error) : resolve());
            });

            /** Create the OpenId client */

            const client = await createClient(redirectUri(token));

            /** Get the Slack auth URL */

            const url = client.authorizationUrl({
                scope: 'openid email profile',
                code_challenge: generators.codeChallenge(codeVerifier),
                code_challenge_method: 'S256',
            });

            /** Go there */

            res.redirect(url);
        }
        catch (error) {
            res.sendStatus(403);
            req.logout({keepSessionInfo: false}, () => undefined);
            throw error;
        }
    });

    app.get('/slack-login/:token', async (req, res) => {
        const { params: { token } } = req;

        const room = GameRoom.rooms.get(token);

        /** No room with this token */

        if (!room) {
            debug(`Invalid room ${token}`);
            return res.sendStatus(404);
        }

        try {
            /** Pull the challenge verifier from the session */
            const { codeVerifier } = req.session;
            assert(codeVerifier, 'Missing session.codeVerifier');
            req.session.codeVerifier = undefined;

            /** Verify the code */
            const client = await createClient(redirectUri(token));
            const { access_token } = await client.callback(redirectUri(token),
                client.callbackParams(req),
                {code_verifier: codeVerifier});
            assert(access_token, 'Missing access_token');

            /** Get the user info */
            const userInfo = await client.userinfo(access_token);
            debug('userinfo %j', userInfo);
            assert(userInfo.ok, 'User info not ok');
            const { sub: id, name } = userInfo;
            assert(id, 'Missing user ID');
            assert(name, `Missing name for ${id}`);

            if (!room.table.has(id)) {
                debug(`Room ${token} is not for user ${id}`);
                return res.sendStatus(403);
            }

            /** All is good, sign-in this user */
            await new Promise<void>((resolve, reject) => {
                req.login({id, name},
                    (error) => error ? reject(error) : resolve());
            });

            assert(req.user, 'User came out wrong');
            assert(req.user.id === id, 'User ID came out wrong');
            assert(req.user.name, 'User name came out wrong');

            /** Go play */
            res.redirect(playUri(token));
        }
        catch (error) {
            res.sendStatus(401);
            req.logout({keepSessionInfo: false}, () => undefined);
            throw error;
        }
    });
}
