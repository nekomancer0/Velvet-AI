import { SpeechClient } from '@google-cloud/speech';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
let speechClient = new SpeechClient({
	credentials: { ...require('../../google_credentials.json') }
});
dotenv.config();

export default function liveTranscript(filepath: string, callback: (text: string) => void) {
	const stream = speechClient.streamingRecognize({
		config: { encoding: 'LINEAR16', languageCode: 'en-US', sampleRateHertz: 16000 }
	});

	stream.on('error', (error) => {
		console.error(error);
	});

	stream.on('data', (response) => {
		callback(response.results[0].alternatives[0].transcript);
	});

	stream.on('close', () => {
		stream.end();
	});

	stream.on('end', () => {
		/* API call completed */
	});

	fs.createReadStream(path.join(filepath)).pipe(stream);
}
