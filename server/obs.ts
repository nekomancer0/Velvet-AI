import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import dotenv from 'dotenv';
import { writeFileSync } from 'fs';

let tts = new TextToSpeechClient({ credentials: require('../google_credentials.json') });

dotenv.config();

import OBSWebSocket from 'obs-websocket-js';

const obs = new OBSWebSocket();

obs.on('ConnectionOpened', () => {
	console.log('Connected to OBS WebSocket');
});

obs.connect({ address: 'localhost:4455' });

export default async function obs_mw(message: string, lang: string = 'fr-FR') {
	const response = (
		await tts.synthesizeSpeech({
			input: {
				text: message
			},
			voice: {
				languageCode: lang,
				ssmlGender: 'MALE'
			},
			audioConfig: {
				audioEncoding: 'MP3'
			}
		})
	)[0];

	writeFileSync('prompt.mp3', response.audioContent as any);

	obs.send('GetSceneList').then((response) => {
		response.scenes.forEach((scene) => {
			scene.sources.forEach((source) => {
				if (source.type.endsWith('ffmpeg_source')) {
					obs.send('SetSourceSettings', {
						sourceName: source.name,
						sourceType: source.type,
						sourceSettings: {
							is_local_file: true,
							local_file: process.cwd() + '/prompt.mp3'
						}
					});

					obs.send('PlayPauseMedia', {
						sourceName: source.name,
						playPause: true
					});
				}
			});
		});
	});
}
