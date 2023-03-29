import type { KnownBlock } from '@slack/bolt';
import _ from 'lodash';
import { Invitation } from './invitations';

export const START_GAME = {
    type: 'modal',
    callback_id: 'start-game',
    submit: {
        type: 'plain_text',
        text: 'Invite'
    },
    title: {
        type: 'plain_text',
        text: `Let's get a game going`
    },
    blocks: [
		{
			"type": "input",
            "block_id": "partner-block",
            "optional": true,
			"element": {
				"type": "multi_users_select",
				"placeholder": {
					"type": "plain_text",
					"text": "Choose your partner",
					"emoji": true
				},
				"action_id": "partner",
				"max_selected_items": 1,
			},
			"label": {
				"type": "plain_text",
				"text": "Who will be your partner?",
				"emoji": true
			}
		},
		{
			"type": "input",
            "block_id": "team-block",
            "optional": true,
			"element": {
				"type": "multi_users_select",
				"placeholder": {
					"type": "plain_text",
					"text": "Choose the other team",
					"emoji": true
				},
				"action_id": "team",
				"max_selected_items": 2,
			},
			"label": {
				"type": "plain_text",
				"text": "Who will be on the other team?",
				"emoji": true
			}
		},
		{
			"type": "section",
			"text": {
				"type": "mrkdwn",
				"text": "_If you want to play with bots, you can leave all the users blank._"
			}
		}
	]
};

export function PLAY_DM(userId: string, invitation: Invitation): KnownBlock[] {
    /**
     * Get a list of users exluding this one and the host (which could be )
     * the same one
     */
    const { host } = invitation;
    const remove = new Set([userId, host]);
    const others = invitation.users.filter((user) => !remove.has(user));
    let text = '';
    // We're sending this message to the host
    // The host wants to play with just bots
    if (userId === host && others.length === 0) {
        text = `Your game is ready to start!`;
    }
    // We're sending this message to someone that was invited
    else {
        text = `Click 'Play' when you're ready to start the game`;
    }

    return [
		{
			"type": "section",
			"text": {
				"type": "mrkdwn",
				"text": text
			}
		},
		{
			"type": "actions",
			"elements": [
				{
					"type": "button",
					"style": "primary",
					"text": {
						"type": "plain_text",
						"text": "Play",
						"emoji": true
					},
                    "url": `${invitation.urls.get(userId)}`,
                    "value": `${invitation.id}`,
					"action_id": "play-action"
				},
			]
		}
	]
}
