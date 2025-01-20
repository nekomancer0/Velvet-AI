import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
let tts = new TextToSpeechClient({ credentials: { ...require('../google_credentials.json') } });
dotenv.config();

const __filename = fileURLToPath(import.meta.url); // get the resolved path to the file
const __dirname = path.dirname(__filename); // get the name of the directory

import OBSWebSocket from 'obs-websocket-js';
import { readdirSync, rmSync, writeFileSync } from 'fs';
import { deleteBrackets } from './utils/brackets';

const obs = new OBSWebSocket();

let running = false;

obs.on('ConnectionOpened', () => {
	console.log('Connected to OBS WebSocket');
});

(async () => {
	try {
		await obs.connect({ address: 'localhost:4455' });
		running = true;
	} catch (error) {
		console.error('Error connecting to OBS:', error);
		console.log('Will be using portaudio instead.');
		running = false;
	}
})();

export default function obs_mw(message: string, lang: string = 'en-US') {
	return new Promise(async (resolve, reject) => {
		let outputFile = `${process.cwd()}/outputs/${Date.now()}.mp3`;

		let response = await tts.synthesizeSpeech({
			input: {
				text: deleteBrackets(message)
			},
			voice: {
				languageCode: lang && lang !== '' ? lang : 'en-US',
				ssmlGender: 'SSML_VOICE_GENDER_UNSPECIFIED'
			},
			audioConfig: {
				audioEncoding: 'LINEAR16',
				sampleRateHertz: 24000,
				speakingRate: 1
			}
		});

		writeFileSync(outputFile, response[0].audioContent as any);

		let res = await obs.send('GetSceneList');

		let audioSource: any = null;
		res.scenes.forEach(async (scene) => {
			scene.sources.forEach(async (source) => {
				if (source.type.endsWith('ffmpeg_source')) {
					audioSource = source;

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
							resolve(void 0);
							obs.removeAllListeners('MediaEnded');

							// Clean old audio files

							let files = readdirSync(path.join(__dirname, '..', 'outputs'));

							for (const file of files) {
								if (file.endsWith('.mp3')) {
									try {
										rmSync(path.join(__dirname, '..', 'outputs', file));
									} catch {
										// Keep blank because the file is in use
									}
								}
							}
						}
					});
				}
			});
		});
	});
}

export function isOBSRunning() {
	return running;
}
