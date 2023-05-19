
import fs from 'node:fs';
import assert from 'node:assert';

import _ from 'lodash';
import express from 'express';

import { OAuth2Client } from 'google-auth-library';

import config from './config';
import { makeDebug } from './utility';
import setupAuthentication from './authentication';
import connectToSlack from './slack';
import { HttpServer } from './http-server';
import passport from 'passport';
import tournamentRouter from './tournament-router';
import Socket from './socket';
import User from './users';

const debug = makeDebug('server');

// async function saveSession(req: Request) {
//     debug('saving session %j', req.session);
//     return new Promise<void>((resolve, reject) => {
//         req.session.save((error) => error ? reject(error) : resolve());
//     });
// }

const app = express()

//-----------------------------------------------------------------------------

app.set('x-powered-by', false);

//-----------------------------------------------------------------------------

app.use(express.urlencoded({extended: true, limit: '20kb'}));
app.use(express.json({limit: '20kb'}));

//-----------------------------------------------------------------------------

if (fs.existsSync('./site')) {
    app.use(express.static('./site'));
}
else {
    debug('Not serving static site');
}

//-----------------------------------------------------------------------------

setupAuthentication(app);

//-----------------------------------------------------------------------------

app.use((req, res, next) => {
    debug('%s %s %s %j %s %j',
        req.method,
        req.socket.remoteAddress,
        req.url,
        req.headers,
        req.session?.id,
        req.session);

    res.once('finish', () => {
        debug('%s %s %s %d %j %s %j',
        req.method,
        req.socket.remoteAddress,
        req.url,
        res.statusCode,
        res.getHeaders(),
        req.session?.id,
        req.session);
    });
    next();
});

/**
 * This one takes the user from
 * session.passport.user and deserializes it, placing the result in req.user
 */

app.use(passport.authenticate('session'));

//-----------------------------------------------------------------------------
// This is where the Google ID token response is sent.
// See https://developers.google.com/identity/gsi/web/reference/js-reference#CredentialResponse
//-----------------------------------------------------------------------------

app.get('/api/login/google', async (req, res) => {
    const { credential } = req.query
    if (!credential || !_.isString(credential)) {
        return res.sendStatus(400);
    }
    try {
        const client = new OAuth2Client(config.FT2_GSI_CLIENT_ID);
        const ticket = await client.verifyIdToken({
            idToken: credential,
            audience: config.FT2_GSI_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        assert(payload, 'Missing payload');
        debug('google login for %j', payload);
        const { sub, email, name, picture } = payload;
        assert(name, 'User missing name');
        assert(email, 'User missing email');

        const id = `G-${sub}`;
        const user = User.login({
            id,
            name,
            email,
            source: 'google',
            type: 'guest',
            displayName: name,
            notes: null,
            ourName: null,
            roles: [],
            prefs: {
                picture
            }
        });
        if (user.isBlocked) {
            return res.sendStatus(403);
        }
        await new Promise<void>((resolve, reject) => {
            req.login(user, (error) => error ? reject(error) : resolve())
        });
        res.redirect('/main');
    }
    catch (error) {
        debug('failed to verify google id token', error);
        res.sendStatus(500);
    }
});

app.get('/api/signout', (req, res) => {
    req.logout(() => {
        res.redirect('/?signout=1');
    });
});

//-----------------------------------------------------------------------------

if (!config.PRODUCTION) {
    app.use((req, res, next) => {
        if (!req.isAuthenticated()) {
            const bot = req.header('x-ft2-bot');
            if (bot) {
                const user = User.login({
                    id: bot,
                    name: bot,
                    displayName: bot,
                    ourName: null,
                    notes: null,
                    email: `${bot}@fortee2.com`,
                    source: 'test',
                    type: 'standard',
                    roles: [],
                    prefs: {}
                });
                return req.login(user, () => next());
            }
            const user = User.login({
                id: 'pablo',
                name: 'pablo',
                displayName: 'pablo',
                ourName: null,
                notes: null,
                email: `pablo@fortee2.com`,
                source: 'test',
                type: 'standard',
                roles: ['td'],
                prefs: {}
            });
            return req.login(user, () => next());
        }
        next();
    });
}

//-----------------------------------------------------------------------------

/**
 * This one will only allow requests that have a user, otherwise it's a 401
 */

app.use((req, res, next) => {
    debug('%j', req.user);
    if (req.isAuthenticated()) {
        if (req.user.isBlocked) {
            return res.sendStatus(403);
        }
        return next();
    }
    debug('unauthenticated', req.url);
    res.sendStatus(401);
});

/** Create the web server */

HttpServer.create(app);

/** Connect to Slack */

connectToSlack();

/** Where the game room sockets connect */

app.get('/join/:token', Socket.upgrade(false));

app.get('/watch/:token', Socket.upgrade(true));

/** The tournaments router */

app.use('/api/tournaments', tournamentRouter);
