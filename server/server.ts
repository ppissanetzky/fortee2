
import fs from 'node:fs';
import assert from 'node:assert';

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

app.get('/api/google-login/:credential', async (req, res) => {
    const { params: { credential } } = req;
    if (!credential) {
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
        const user = User.get(id) || User.add({
            id,
            name,
            email,
            source: 'google',
            type: 'guest',
            roles: [],
            prefs: {
                displayName: name,
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

//-----------------------------------------------------------------------------

// if (!config.PRODUCTION) {
//     app.use((req, res, next) => {
//         if (!req.isAuthenticated()) {
//             const bot = req.header('x-ft2-bot');
//             if (bot) {
//                 return req.login({id: bot, name: bot}, () => next());
//             }
//             return req.login({id: 'pablo', name: 'pablo'}, () => next());
//         }
//         next();
//     });
// }

//-----------------------------------------------------------------------------

/**
 * This one will only allow requests that have a user, otherwise it's a 401
 */

app.use((req, res, next) => {
    debug('%o', req.user);
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

app.get('/join/:token', Socket.upgrade());

app.get('/watch/:token', Socket.watch());

/** The tournaments router */

app.use('/api/tournaments', tournamentRouter);
