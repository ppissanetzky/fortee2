
import { Database } from './db';

const db = new Database('chat', 1);

/** This is what comes from the browser */

export interface IncomigChatMessage {
    /** A user ID or channel */
    to: string;
    text: string;
}

/** Once we get it, we augment it */

export interface ChatMessage extends IncomigChatMessage {
    /** The user ID of the sender */
    from: string;
    /** The name of the sender */
    name: string;
    /** The title of the sender, if any */
    title?: string;
    extra?: Record<string, any>;
}

/** This is what we store in the database */

interface ChatRow {
    t: number;
    channel: string;
    userId: string;
    name: string;
    title: string | null;
    text: string;
    extra: string | null;
}

export interface OutgoingChatMessage {
    t: number;
    channel: string;
    name: string;
    title?: string;
    text: string;
    extra?: Record<string, any>;
}

export interface ChatHistory {
    channel: string;
    messages: OutgoingChatMessage[];
}

const MARK_READ = `
    REPLACE INTO read (userId, channel, t)
    VALUES ($userId, $channel, $t)`;

export default class ChatDatabase {

    static insert(channel: string, message: ChatMessage): OutgoingChatMessage {
        const { from: userId, name, title, text, extra } = message;
        const t = Date.now();
        const c = db.connect();
        c.transaction(() => {
            c.change(
                `
                    INSERT INTO chat
                    (t, channel, userId, name, title, text, extra)
                    VALUES
                    ($t, $channel, $userId, $name, $title, $text, $extra)
                `,
                {
                    t,
                    channel,
                    userId,
                    name,
                    title: title ?? null,
                    text,
                    extra: extra ? JSON.stringify(extra) : null
                } as ChatRow);
            /** Update read */
            c.change(MARK_READ, {userId, channel, t});
        });
        return {
            t,
            channel,
            name,
            title,
            text,
            extra
        };
    }

    static history(channel: string, after: number): OutgoingChatMessage[] {
        const rows = db.all(
            `
                SELECT * FROM chat
                WHERE
                    channel = $channel
                    AND t > $after
                ORDER BY t
            `,
            {channel, after}
        ) as ChatRow[];
        return rows.map(({t, name, title, text, extra}) => ({
            t,
            channel,
            name,
            title: title ? title : undefined,
            text,
            extra: extra ? JSON.parse(extra) : undefined
        }));
    }

    /** Marks this read as of marker */

    static read(userId: string, channel: string, t: number): void {
        db.change(MARK_READ, {userId, channel, t });
    }

    /** Returns the set of all unread channels for this user */

    static unread(userId: string): string[] {
        return db.all(
            `
            SELECT
                latest.channel AS channel
            FROM
                latest
            LEFT OUTER JOIN
                read
            ON
                read.channel = latest.channel AND read.userId = $userId
            WHERE
                (instr(latest.channel, $userId) > 0 OR instr(latest.channel, '#') = 1)
                AND (read.t IS NULL OR read.t < latest.t)
            `,
            {userId}).map(({channel}) => channel);
    }

    private constructor() { void 0 }
}
