import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import EventEmitter from 'events';
import { writeFileSync } from 'fs';
import path from 'path';
import { PassThrough } from 'stream';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url); // get the resolved path to the file
const __dirname = path.dirname(__filename); // get the name of the directory

type recordOptions = {
	onSilence: (data: any) => void;
	onData: (data: any) => void;
};

class Record extends EventEmitter {
	constructor(options: recordOptions) {
		let detectedSilenceCount = 0;
		let noSilenceCount = 0;

		super();

		const audioStream = new PassThrough(); // Create a stream to handle audio data

		const ffmpegArgs = [
			'-f',
			'dshow', // Specify dshow format for Windows
			'-i',
			'audio=Réseau de microphones (Realtek Audio)', // Replace with your microphone's name
			'-af',
			`silencedetect=n=-30dB:d=2`, // Silence detection filter
			'-ac',
			'1', // Mono audio
			'-ar',
			'16000', // Sampling rate
			'-f',
			'wav', // Output format
			'pipe:1' // Send output to stdout
		];

		const ffmpeg = spawn('ffmpeg', ffmpegArgs);
		this.ffmpeg = ffmpeg;

		// Handle audio data stream
		ffmpeg.stdout.on('data', (chunk) => {
			audioStream.write(chunk); // Pipe the audio data to your PassThrough stream
			options.onData(chunk);
		});

		let data: Buffer = Buffer.from('');

		audioStream.on('data', (chunk) => {
			// console.log(chunk);
			options.onData(chunk);
			data = Buffer.concat([data, chunk]);
		});

		// this.on('silence', () => {
		// 	if (noSilenceCount > 0) {
		// 		noSilenceCount = 0;
		// 	}

		// 	if (detectedSilenceCount > 2) {
		// 		detectedSilenceCount = 0;

		// 		options.onSilence(data);
		// 		process.kill(ffmpeg.pid!);
		// 	}
		// });

		ffmpeg.on('error', (err) => {
			throw err;
		});

		// Handle silence detection from stderr
		ffmpeg.stderr.on('data', async (d) => {
			const message = d.toString();

			if (message.includes('silence_start')) {
				// console.log('Silence started:', message);

				options.onSilence(data);
				process.kill(ffmpeg.pid!);

				// this.emit('silence');
			} else if (message.includes('silence_end')) {
				// console.log('Silence ended:', message.trim());
			}
		});
	}

	ffmpeg: ChildProcessWithoutNullStreams | null = null;
}

export default function record(onFinish: (data: any, filepath: string) => void) {
	let filepath = path.join(__dirname, '..', '..', 'outputs', `${Date.now()}.mp3`);
	new Record({
		onSilence: (data) => {
			onFinish(data, filepath);
		},
		onData: () => {}
	});
}
