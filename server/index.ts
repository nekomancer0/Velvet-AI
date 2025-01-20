import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import db from './db';
import dotenv from 'dotenv';
import { generateLore } from './utils';
import { initTwitchBot } from './twitch';
import { deleteBrackets } from './utils/brackets';
import playAudio from './playaudio';
import { isOBSRunning } from './obs';
import { confirm, input } from '@inquirer/prompts';
import record from './utils/record';
import liveTranscript from './utils/transcript';
import e from 'express';
import path from 'path';
import { writeFileSync } from 'fs';

dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
	cors: {
		origin: '*', // Allow all origins for development
		methods: ['GET', 'POST']
	}
});

// clear history of the bot and interactions

db.exec('DELETE FROM history');
db.exec('DELETE FROM sqlite_sequence WHERE name = "history"');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
	res.setHeader('Access-Control-Allow-Origin', '*');
	res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
	res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
	next();
});

app.post('/generate', (req, res) => {
	(async () => {
		try {
			const { prompt } = req.body;
			if (!prompt || prompt.trim().length === 0) {
				return res.status(400).json({ error: 'Le prompt est vide ou invalide.' });
			}
			const response = await generateLore(prompt);
			res.status(200).json({ response });
		} catch (error) {
			console.error(error);
			res.status(500).json({ error: error.message });
		}
	})();
});

// Ajouter un prompt
app.post('/prompts', (req, res) => {
	const { content, category } = req.body;

	if (!content || content.trim() === '') {
		res.status(400).json({ error: 'Le contenu est vide.' });
		return;
	}

	const stmt = db.prepare('INSERT INTO prompts (content, category) VALUES (?, ?)');
	stmt.run(content.trim(), category || 'general');

	res.status(201).json({ message: 'Prompt ajouté avec succès.' });
});

app.delete('/prompts/:id', (req, res) => {
	const { id } = req.params;

	const stmt = db.prepare('DELETE FROM prompts WHERE id = ?');
	const result = stmt.run(id);

	if (result.changes === 0) {
		res.status(404).json({ error: 'Prompt introuvable.' });
		return;
	}

	res.status(200).json({ message: 'Prompt supprimé avec succès.' });
});

app.get('/prompts', (req, res) => {
	const stmt = db.prepare('SELECT * FROM prompts');
	const prompts = stmt.all();

	res.status(200).json({ prompts });
});

app.put('/prompts/:id', (req, res) => {
	const { id } = req.params;
	const { content, category } = req.body;

	const stmt = db.prepare('UPDATE prompts SET content = ?, category = ? WHERE id = ?');
	const result = stmt.run(content, category, id);

	if (result.changes === 0) {
		res.status(404).json({ error: 'Prompt not found' });
		return;
	}

	res.status(200).json({ message: 'Prompt updated successfully' });
});

app.get('/prompts/export', (req, res) => {
	const prompts = db.prepare('SELECT * FROM prompts').all();
	const history = db.prepare('SELECT * FROM history').all();
	const favorites = db.prepare('SELECT * FROM favorites').all();

	const exportData = {
		prompts,
		history,
		favorites,
		timestamp: new Date().toISOString()
	};

	res.json(exportData);
});

app.post('/prompts/import', (req, res) => {
	const { data } = req.body;

	db.transaction(() => {
		// Import prompts
		data.prompts.forEach((prompt: any) => {
			db.prepare('INSERT OR IGNORE INTO prompts (content, category) VALUES (?, ?)').run(
				prompt.content,
				prompt.category
			);
		});
		// Import other data...
	})();

	res.json({ message: 'Data imported successfully' });
});

app.get('/history', (req, res) => {
	const history = db
		.prepare(
			`
        SELECT 
            h.id,
            p.content as prompt,
            h.response,
            h.timestamp
        FROM history h
        JOIN prompts p ON h.prompt_id = p.id
        ORDER BY h.timestamp DESC
        LIMIT 50
    `
		)
		.all();

	res.status(200).json({ history });
});

app.set('port', process.env.PORT || 3000);

initTwitchBot(io);
// Socket.IO event handlers
io.on('connection', (socket) => {
	console.log('Client connected');

	// Listen for new prompts
	socket.on('prompt:send', async (promptData) => {
		try {
			const response = await generateLore(promptData.prompt);

			// Emit the response back to the client
			socket.emit('prompt:response', {
				response: response,
				timestamp: new Date()
			});

			// send the response to the server itself

			// Broadcast to other clients that a new response was generated
			socket.broadcast.emit('prompt:new', {
				prompt: promptData.prompt,
				response: response,
				timestamp: new Date()
			});

			await playAudio({ obs: isOBSRunning(), message: deleteBrackets(response), lang: 'en-US' });
		} catch (error) {
			socket.emit('prompt:error', {
				error: error.message
			});
		}
	});

	socket.on('chat:message', async (data) => {
		try {
			// Add context based on current activity
			const contextPrompt = `Current stream activity: ${data.activity}. 
        A viewer says: ${data.message}
        Respond as Meichja, keeping in character as a VTuber.`;

			const response = await generateLore(contextPrompt);

			socket.emit('chat:response', {
				message: response
			});

			await playAudio({ obs: isOBSRunning(), message: deleteBrackets(response), lang: 'en-US' });
		} catch (error) {
			socket.emit('chat:error', {
				error: error.message
			});
		}
	});

	socket.on('donation', async (data) => {
		try {
			const donationPrompt = `A viewer named ${data.username} has donated ${data.amount}! 
        Their message is: "${data.message}"
        React excitedly as Meichja and give them a special blessing!`;

			const response = await generateLore(donationPrompt);

			socket.emit('chat:response', {
				message: response,
				type: 'donation'
			});
		} catch (error) {
			socket.emit('chat:error', {
				error: error.message
			});
		}
	});

	socket.on('disconnect', () => {
		console.log('Client disconnected');
	});
});

server.listen(app.get('port'), async () => {
	console.log(
		`Serveur en écoute sur le port: ${app.get('port')} \nhttp://localhost:${app.get('port')}`
	);
	console.log("Accès à l'API OpenRouter configuré");

	let response = await confirm({ message: 'OBS is not connected, do you want to talk here?' });

	if (response) {
		let vocalOrText = await confirm({ message: 'Do you want to use voice?', default: true });

		if (vocalOrText) {
			async function send() {
				record((data) => {
					let filepath = path.join(__dirname, '..', 'outputs', `${Date.now()}.mp3`);

					writeFileSync(filepath, data);

					liveTranscript(filepath, async (msg) => {
						if (msg === '') {
							console.log('No message detected');
							send();
							return;
						}

						console.log(msg, 'aa');

						let res = await generateLore(msg);
						await playAudio(
							{ obs: isOBSRunning(), message: deleteBrackets(res), lang: 'en-US' },
							() => {
								send();
							}
						);
					});
				});
			}

			await send();
		} else {
			async function send() {
				let msg = await input({ message: 'Enter your message.', required: true });

				let res = await generateLore(msg);

				await playAudio(
					{ obs: isOBSRunning(), message: deleteBrackets(res), lang: 'en-US' },
					() => {
						send();
					}
				);
			}

			await send();
		}
	}
});
