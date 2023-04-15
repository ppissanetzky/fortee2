import assert from 'node:assert';

import { App, BlockAction, BlockElementAction } from '@slack/bolt';

import { Actions, Button, Message, Section, setIfTruthy, SlackMessageDto, UserSelect } from 'slack-block-builder';
import config from './config';
import Tournament from './tournament';
import Scheduler from './tournament-scheduler';
import { expected, makeDebug } from './utility';
import { AnnounceBye, SummonTable, TournamentOver } from './tournament-driver';
import { startRoomConversation } from './slack';
import GameRoom from './game-room';

const debug = makeDebug('slack-t-msngr');

function messageWithMetadata(t: Tournament, message: SlackMessageDto): any {
    const { id } = t
    return Object.assign({} as Record<string, any>, message, {
        metadata: {
            event_type: 'tournament',
            event_payload: { id }
        }
    });
}

function mention(id: string): string {
    const name = GameRoom.isBot(id);
    if (name) {
        return `:robot_face: ${name}`;
    }
    return `<@${id}>`;
}

export default class SlackTournamentMessenger {

    static start(app: App) {
        if (!this.instance) {
            this.instance = new SlackTournamentMessenger(app);
        }
        return this.instance;
    }

    private static instance?: SlackTournamentMessenger;

    private readonly app: App;
    private channel: string;
    private readonly scheduler: Scheduler;

    /** A map from tournament ID to Slack ts for its thread */

    private readonly threads = new Map<number, string>();

    private constructor(app: App) {
        this.app = app;
        this.channel = config.PRODUCTION ? 'general' : 'ignore';
        this.scheduler = Scheduler.get();
        this.start();
    }

    private async start() {
        debug('start');

        /**
         * This is so that we can get the existing threads before we
         * start handling events from the scheduler, which will come
         * very quickly
         */

        const ready = this.findThreads();

        this.scheduler
            .on('signupOpen', (t) => ready.then(() => this.signupOpen(t)))
            .on('signupClosed', (t) => ready.then(() => this.signupClosed(t)))
            .on('canceled', (t) => ready.then(() => this.canceled(t)))
            .on('started', (t) => ready.then(() => this.started(t)))
            .on('registered', (event) => ready.then(() => this.registered(event)))
            .on('unregistered', (event) => ready.then(() => this.unregistered(event)))

            .on('announceBye', (event) => ready.then(() => this.announceBye(event)))
            .on('summonTable', (event) => ready.then(() => this.summonTable(event)))
            .on('tournamentOver', (event) => ready.then(() => this.tournamentOver(event)))
            .on('failed', (t) => ready.then(() => this.tournamentFailed(t)));

        /** When someone clicks the 'register' action on a message */

        this.app.action({type: 'block_actions', action_id: 'register-action'},
            async ({ack, body}) => {
                await ack();
                this.register(body);
            });

        this.app.action({type: 'block_actions', action_id: 'unregister-action'},
            async ({ack, body}) => {
                await ack();
                this.unregister(body);
            });

        this.app.action('register-partner-action', async ({ack}) => ack());

        debug('attached');
    }

    private async findThreads(): Promise<void> {
        const list = await this.app.client.conversations.list({
            types: 'public_channel,private_channel',
            exclude_archived: true,
        });
        if (!list.ok) {
            debug('failed to list channels : %j', list);
            return;
        }
        const channel = list.channels?.find(({name}) => name === this.channel);
        if (!channel || !channel.id) {
            debug('did not find channel', this.channel);
            return;
        }
        debug('channel is %s %j', this.channel, channel);

        this.channel = channel.id;

        const response = await this.app.client.conversations.history({
            channel: this.channel,
            include_all_metadata: true,
        });
        if (!response.ok) {
            debug('failed to find threads : %j', response);
            return;
        }
        const { messages } = response;
        if (!messages) {
            debug('no messages returned');
            return;
        }
        debug('looking at %d messages', messages.length);
        const { tourneys } = this.scheduler;
        for (const message of messages) {
            if (message.metadata?.event_type === 'tournament') {
                const { ts } = message;
                const payload = message.metadata?.event_payload as any;
                if (ts && payload) {
                    const id: number = payload.id;
                    if (!tourneys.has(id)) {
                        debug('thread is for old tourney', ts, id, message.text);
                    }
                    else {
                        this.threads.set(id, ts);
                        debug('found thread', ts, id, message.text);
                    }
                }
            }
        }
        debug('found', this.threads.size, 'threads');
    }

    private async postMessage(t: Tournament, message: any) {
        message.ts = this.threads.get(t.id);
        const response = message.ts
            ? await this.app.client.chat.update(message)
            : await this.app.client.chat.postMessage(message);
        debug('posted %j', response);
        if (response.ok && response.ts) {
            debug('ts', message.ts, 'new ts', response.ts);
            this.threads.set(t.id, response.ts);
        }
    }

    /** When a user presses the register button in the tourney message */

    private async register(action: BlockAction<BlockElementAction>) {
        debug('register %j', action);
        const { user, message } = action;
        try {
            assert(user, 'missing user');
            assert(message, 'missing message');
            const { metadata } = message;
            assert(metadata, 'missing metadata');
            const { event_payload: { id } } =  metadata;
            assert(id, 'missing id');
            const partner = action.state?.values?.['register-block']?.['register-partner-action']?.selected_user;
            const [t, added] = this.scheduler.register(id, user.id, partner || '');
            const text = `You're registered for *${t.name}* at ${t.startTime}, good luck!`;
            await this.app.client.chat.postEphemeral({
                channel: action.container.channel_id,
                user: user.id,
                text
            });
            if (added) {
                if (partner) {
                    const text = `<@${user.id}> signed up for the *${t.name}* tournament at ${t.startTime} with you as a partner`
                    await this.app.client.chat.postMessage({
                        channel: partner,
                        text
                    });
                }
            }
        }
        catch (error) {
            debug('register failed', error);
            if (error instanceof Error) {
                const text = `Something went wrong trying to register: ${error.message}`;
                await this.app.client.chat.postEphemeral({
                    channel: action.container.channel_id,
                    user: user.id,
                    text
                });
            }
        }
    }

    /** When a user presses the un-register button in the tourney message */

    private async unregister(action: BlockAction<BlockElementAction>) {
        debug('unregister %j', action);
        const { user, message } = action;
        try {
            assert(user, 'missing user');
            assert(message, 'missing message');
            const { metadata } = message;
            assert(metadata, 'missing metadata');
            const { event_payload: { id } } =  metadata;
            assert(id, 'missing id');
            const [t, removed] = this.scheduler.unregister(id, user.id);
            if (removed) {
                const text = `You dropped out of the *${t.name}* tournament at ${t.startTime}`;
                await this.app.client.chat.postEphemeral({
                    channel: action.container.channel_id,
                    user: user.id,
                    text
                });
            }
        }
        catch (error) {
            debug('unregister failed', error);
            if (error instanceof Error) {
                const text = `Something went wrong trying to unregister: ${error.message}`;
                await this.app.client.chat.postEphemeral({
                    channel: action.container.channel_id,
                    user: user.id,
                    text
                });
            }
        }
    }

    private async signupOpen(t: Tournament) {
        const text =
              `:trophy: *${t.name}* starts at ${t.startTime}\n`
            + `Signup is now open for ${t.minutesTilClose} minutes`;
        const message = messageWithMetadata(t,
            Message({channel: this.channel})
                .text(text)
                .blocks(
                    Section()
                        .text(text),
                    Actions()
                        .blockId('register-block')
                        .elements(
                        setIfTruthy(t.choosePartner,
                            UserSelect().actionId('register-partner-action')
                        ),
                        Button()
                            .primary(true)
                            .actionId('register-action')
                            .text('Sign up'),
                        Button()
                            .danger(true)
                            .actionId('unregister-action')
                            .text('Drop out')
                    )

                )
                .buildToObject());
        this.postMessage(t, message);
    }

    private async signupClosed(t: Tournament) {
        const text =
              `:trophy: *${t.name}* starts at ${t.startTime}\n`
            + `Signup is now closed`;
        const message = messageWithMetadata(t,
            Message({channel: this.channel})
                .text(text)
                .blocks(Section().text(text))
                .buildToObject());
        this.postMessage(t, message);
    }

    private async canceled(t: Tournament) {
        const text =
              `:trophy: *${t.name}* has been canceled :face_holding_back_tears:`;
        const message = messageWithMetadata(t,
            Message({channel: this.channel})
                .text(text)
                .blocks(Section().text(text))
                .buildToObject());
        this.postMessage(t, message);
    }

    private async started(t: Tournament) {
        const text =
              `:trophy: *${t.name}* started\nGood luck!`;
        const message = messageWithMetadata(t,
            Message({channel: this.channel})
                .text(text)
                .blocks(Section().text(text))
                .buildToObject());
        this.postMessage(t, message);
    }

    private async registered({t, user, partner}: {t: Tournament, user: string, partner?: string}) {
        const ts = this.threads.get(t.id);
        if (!ts) {
            return;
        }
        let text = `<@${user}> signed up`;
        if (partner) {
            text += ` with <@${partner}>`;
        }
        text += `\nWe have ${t.signups().size}`;
        this.app.client.chat.postMessage(
            Message({channel: this.channel})
                .threadTs(ts)
                .text(text)
                .buildToObject()
        );
    }

    private async unregistered({t, user}: {t: Tournament, user: string}) {
        const ts = this.threads.get(t.id);
        if (!ts) {
            return;
        }
        let text = `<@${user}> dropped out`;
        text += `\nWe have ${t.signups().size || 'no one'}`;
        this.app.client.chat.postMessage(
            Message({channel: this.channel})
                .threadTs(ts)
                .text(text)
                .buildToObject()
        );
    }

    private async announceBye(event: AnnounceBye) {
        const { t , user, round } = event;
        const ts = expected(this.threads.get(t.id));
        const text = `${mention(user)} you have a bye in round ${round}, hang tight`;
        this.app.client.chat.postMessage(
            Message({channel: this.channel})
                .threadTs(ts)
                .text(text)
                .buildToObject()
        );
    }

    private async summonTable(event: SummonTable) {
        const { t, round, room } = event;
        const text = `It's time for round ${round} of *${t.name}*!`;
        startRoomConversation(room, text);
    }

    private async tournamentOver(event: TournamentOver) {
        const { t, winners } = event;
        const who = winners.users.map((user) => mention(user)).join(' and ');
        const text = `:trophy: Congratulations to ${who} for winning the *${t.name}* tournament!`;
        const message = messageWithMetadata(t,
            Message({channel: this.channel})
                .text(text)
                .blocks(Section().text(text))
                .buildToObject());
        this.postMessage(t, message);
        // We no longer need the thread
        this.threads.delete(t.id);
    }

    private async tournamentFailed(t: Tournament ) {
        const text = `:poop: The *${t.name}* tournament ran into a bug and is over. Time to go make a :sandwich:`;
        const message = messageWithMetadata(t,
            Message({channel: this.channel})
                .text(text)
                .blocks(Section().text(text))
                .buildToObject());
        this.postMessage(t, message);
        // We no longer need the thread
        this.threads.delete(t.id);
    }
}
