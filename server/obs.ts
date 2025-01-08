import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import dotenv from 'dotenv';
import { writeFile, rm } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

let tts = new TextToSpeechClient({ credentials: { ...require('../google_credentials.json') } });
dotenv.config();

const __filename = fileURLToPath(import.meta.url); // get the resolved path to the file
const __dirname = path.dirname(__filename); // get the name of the directory

import OBSWebSocket from 'obs-websocket-js';
import { statSync, writeFileSync } from 'fs';

const obs = new OBSWebSocket();

obs.on('ConnectionOpened', () => {
	console.log('Connected to OBS WebSocket');
});

(async () => {
	await obs.connect({ address: 'localhost:4455' });
})();

export default function obs_mw(message: string, lang: string = 'fr-FR') {
	return new Promise(async (resolve, reject) => {
		let outputFile = `${process.cwd()}/outputs/${Date.now()}.mp3`;

		writeFileSync(outputFile, '');

		let response = await tts.synthesizeSpeech({
			input: {
				text: message
			},
			voice: {
				languageCode: lang && lang !== '' ? lang : 'fr-FR',
				ssmlGender: 'FEMALE'
			},
			audioConfig: {
				audioEncoding: 'MP3',
				sampleRateHertz: 24000,
				speakingRate: 1
			}
		});

		writeFileSync(outputFile, response[0].audioContent as any, 'binary');

		let res = await obs.send('GetSceneList');

		res.scenes.forEach(async (scene) => {
			scene.sources.forEach(async (source) => {
				if (source.type.endsWith('ffmpeg_source')) {
					await obs.send('SetSourceSettings', {
						sourceName: source.name,
						sourceType: source.type,
						sourceSettings: {
							is_local_file: true,
							local_file: outputFile
						}
					});

					await obs.send('RestartMedia', {
						sourceName: source.name
					});

					// Clean the file without deleting it

					obs.on('MediaEnded', async (data) => {
						if (data.sourceName === source.name) {
							writeFileSync(outputFile, '');
							resolve(void 0);
						}
					});
				}
			});
		});
	});
}
