import _ from 'lodash';
import path from 'node:path';
import type { Express } from 'express';
import session from 'express-session';
import passport from 'passport';
import sqlite from 'better-sqlite3';
import ms from 'ms';
import OurUser from './users';
import config from './config';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Store = require('better-sqlite3-session-store')(session);

/**
 * The shape of our Express user
 */

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Express {
        // eslint-disable-next-line @typescript-eslint/no-empty-interface
        interface User extends OurUser {}
    }
}

export default function setupAuthentication(app: Express): void {

    app.use(session({
        name: config.FT2_SESSION_COOKIE_NAME,
        secret: config.FT2_SESSION_SECRET,
        saveUninitialized: false,
        resave: false,
        proxy: config.PRODUCTION ? false : true,
        cookie: {
            secure: config.PRODUCTION ? true : false,
            httpOnly: true,
            path: '/',
            /** Using 'strict' breaks sign-in-with-slack */
            sameSite: 'lax'
        },
        store: new Store({
            client: new sqlite(path.join(config.FT2_DB_PATH, 'sessions.db')),
            expired: {
              clear: true,
              intervalMs: ms('15m')
            }
        })
    }));

    /**
     * This one is called when a new user object is returned by the strategy's
     * callback. It is meant to serialize that into session.passport.user
     */

    passport.serializeUser((user, done) => done(null, user.id));

    /**
     * This one is called to take session.passport.user and put the result
     * in req.user
     */

    passport.deserializeUser((id: any, done) => {
        if (!_.isString(id)) {
            return done(null, false);
        }
        done(null, OurUser.get(id) || false);
    });
}
