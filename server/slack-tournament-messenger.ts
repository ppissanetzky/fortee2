import assert from 'node:assert';

import { App, BlockAction, BlockElementAction } from '@slack/bolt';

import { Actions, Button, Message, Section, setIfTruthy,
    SlackMessageDto, UserSelect } from 'slack-block-builder';
import config from './config';
import Tournament from './tournament';
import Scheduler from './tournament-scheduler';
import { makeDebug } from './utility';
import { AnnounceBye, SummonTable, TournamentOver } from './tournament-driver';
import { startRoomConversation } from './slack';
import GameRoom from './game-room';
import ms from 'ms';

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

type Thread = {
    ts: string;
    thread_ts?: string;
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

    private readonly threads = new Map<number, Thread>();

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
            .on('tournamentOver', (event) => ready.then(() => this.tournamentOver(event)))
            .on('signupClosed', (t) => ready.then(() => this.deleteThread(t.id)));
            // .on('canceled', (t) => ready.then(() => this.deleteThread(t.id)))
            // .on('started', (t) => ready.then(() => this.started(t)))
            // .on('registered', (event) => ready.then(() => this.registered(event)))
            // .on('unregistered', (event) => ready.then(() => this.unregistered(event)))

            // .on('announceBye', (event) => ready.then(() => this.announceBye(event)))
            // .on('summonTable', (event) => ready.then(() => this.summonTable(event)))
            // .on('failed', (t) => ready.then(() => this.tournamentFailed(t)));

        /** When someone clicks the 'register' action on a message */

        // this.app.action({type: 'block_actions', action_id: 'register-action'},
        //     async ({ack, body}) => {
        //         await ack();
        //         this.register(body);
        //     });

        // this.app.action({type: 'block_actions', action_id: 'unregister-action'},
        //     async ({ack, body}) => {
        //         await ack();
        //         this.unregister(body);
        //     });

        // this.app.action('register-partner-action', async ({ack}) => ack());

        debug('attached');
    }

    private async deleteThread(id: number) {
        const thread = this.threads.get(id);
        if (thread?.ts) {
            await this.app.client.chat.delete({
                channel: this.channel, 
                ts: thread.ts
            });    
            this.threads.delete(id);
        }
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
        let toDelete = Promise.resolve();
        for (const message of messages) {
            if (message.metadata?.event_type === 'tournament') {
                const { ts, thread_ts } = message;
                const payload = message.metadata?.event_payload as any;
                if (ts && payload) {
                    const id: number = payload.id;
                    if (!tourneys.has(id)) {
                        /** Delete them out of band with a delay so we don't get rate limited */
                        toDelete = toDelete.then(async () => {
                            await this.app.client.chat.delete({
                                channel: this.channel,
                                ts
                            });
                            await new Promise((resolve) => setTimeout(resolve, ms('5s')));
                        });
                    }
                    else {
                        this.threads.set(id, {ts, thread_ts});
                        debug('found thread', ts, id, message.text);
                    }
                }
            }
        }
        debug('found', this.threads.size, 'threads');
    }

    private async postMessage(t: Tournament, message: any) {
        const thread = this.threads.get(t.id);
        message.ts = thread?.ts;
        message.thread_ts = thread?.thread_ts;
        const response = message.ts
            ? await this.app.client.chat.update(message)
            : await this.app.client.chat.postMessage(message);
        debug('posted %j', response);
        if (response.ok && response.ts && !thread) {
            debug('ts', message.ts, 'new ts', response.ts);
            this.threads.set(t.id, { ts: response.ts });
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
            + '> <https://fortee2.com/au/tournaments|Click here to sign up>';
        const message = messageWithMetadata(t,
            Message({channel: this.channel})
                .text(text)
                // .blocks(
                //     Section()
                //         .text(text),
                //     Actions()
                //         .blockId('register-block')
                //         .elements(
                //         setIfTruthy(t.choosePartner,
                //             UserSelect().actionId('register-partner-action')
                //         ),
                //         Button()
                //             .primary(true)
                //             .actionId('register-action')
                //             .text('Sign up'),
                //         Button()
                //             .danger(true)
                //             .actionId('unregister-action')
                //             .text('Drop out')
                //     )

                // )
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
        // const text =
        //       `:trophy: *${t.name}* has been canceled :face_holding_back_tears:`;
        // const message = messageWithMetadata(t,
        //     Message({channel: this.channel})
        //         .text(text)
        //         .blocks(Section().text(text))
        //         .buildToObject());
        // this.postMessage(t, message);
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

    private async postThreadReply(t: Tournament, text: string) {
        const thread = this.threads.get(t.id);
        if (!thread) {
            return;
        }
        thread.thread_ts = thread.ts;
        this.app.client.chat.postMessage(
            Message()
                .channel(this.channel)
                .text(text)
                .threadTs(thread.ts)
                .buildToObject());
    }

    private async registered({t, user, partner}: {t: Tournament, user: string, partner?: string}) {
        let text = `<@${user}> signed up`;
        if (partner) {
            text += ` with <@${partner}>`;
        }
        text += `\nWe have ${t.signups().size}`;
        this.postThreadReply(t, text);
    }

    private async unregistered({t, user}: {t: Tournament, user: string}) {
        let text = `<@${user}> dropped out`;
        text += `\nWe have ${t.signups().size || 'no one'}`;
        this.postThreadReply(t, text);
    }

    private async announceBye(event: AnnounceBye) {
        const { t , user, round } = event;
        const text = `${mention(user)} you have a bye in round ${round}, hang tight`;
        this.postThreadReply(t, text);
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
                // .blocks(Section().text(text))
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
