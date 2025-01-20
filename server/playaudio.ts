// Play audio from file wiith portaudio or OBS depending if OBS is running

import obs_mw from './obs';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import dotenv from 'dotenv';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { deleteBrackets } from './utils/brackets';
import { readdirSync, rmSync, writeFileSync } from 'fs';
import liveTranscript from './utils/transcript';

let tts = new TextToSpeechClient({ credentials: { ...require('../google_credentials.json') } });
dotenv.config();

const __filename = fileURLToPath(import.meta.url); // get the resolved path to the file
const __dirname = path.dirname(__filename); // get the name of the directory

type AudioConfig = {
	obs: boolean;
	message: string;
	lang: 'en-US' | 'fr-FR';
};

export default async function playAudio(
	config: AudioConfig = { obs: false, lang: 'en-US', message: '' },
	onFinish?: () => void
) {
	let { obs, message, lang } = config;
	if (obs) {
		return await obs_mw(message, lang);
	} else {
		let outputFile = `${process.cwd()}/outputs/${Date.now()}.mp3`;

		let response = await tts.synthesizeSpeech({
			input: {
				text: deleteBrackets(message)
			},
			voice: {
				languageCode: lang,
				ssmlGender: 'SSML_VOICE_GENDER_UNSPECIFIED'
			},
			audioConfig: {
				audioEncoding: 'LINEAR16',
				sampleRateHertz: 24000,
				speakingRate: 1
			}
		});

		writeFileSync(outputFile, response[0].audioContent as any);

		let p = spawn('ffplay', ['-v', 'quiet', '-nodisp', '-autoexit', outputFile], {
			stdio: 'inherit'
		});

		p.on('close', () => {
			console.log('Audio played');

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

			p.kill();

			if (onFinish) onFinish();
		});

		p.on('spawn', () => {
			let t = '';
			liveTranscript(outputFile, (text: string) => {
				console.clear();
				t += text;

				console.log(t);
			});
		});
	}
}
