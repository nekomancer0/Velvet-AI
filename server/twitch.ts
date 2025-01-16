import tmi from 'tmi.js';
import { Server } from 'socket.io';
import obs_mw from './obs';
import { determineLanguage, generateLore } from './utils';
export async function initTwitchBot(io: Server) {
	const client = new tmi.Client({
		options: { debug: true, clientId: process.env.TWITCH_CLIENT_ID! },
		connection: {
			reconnect: true,
			secure: true
		},
		identity: {
			username: `Nekoniyah`,
			password: `oauth:${process.env.TWITCH_TOKEN}` // access_token
		},
		channels: [process.env.TWITCH_CHANNEL!]
	});

	await client.connect().catch(console.error);

	// Handle incoming messages
	client.on('message', async (channel, tags, message, self) => {
		console.log(self);
		if (self) return; // Ignore messages from the bot

		// Generate AI response using existing infrastructure

		let aiResponse = await generateLore(`You got a message from ${tags.username}: ${message}`);

		// Send message to Twitch chat
		// client.say(channel, `@${tags.username} ${aiResponse}`);

		// Emit to web clients
		io.emit('chat:response', {
			type: 'twitch',
			username: tags.username,
			message: message,
			response: aiResponse
		});

		// Optional: Text-to-speech using existing obs_mw
		await obs_mw(aiResponse, await determineLanguage(aiResponse));
	});

	return client;
}
