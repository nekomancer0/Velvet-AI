import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import db from './db';
import dotenv from 'dotenv';
import obs_mw from './obs';
import { EventEmitter } from 'stream';
dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
	cors: {
		origin: '*', // Allow all origins for development
		methods: ['GET', 'POST']
	}
});

interface GenerationOptions {
	max_tokens: number;
	temperature: number;
	top_p: number;
}

async function determineGenerationOptions(prompt: string): Promise<GenerationOptions> {
	try {
		const optionsPrompt = `As an AI assistant, analyze the following prompt and determine the best generation parameters for a response. The prompt is: "${prompt}". Consider these aspects:
1. Is this a simple greeting, a lore question, or a complex query?
2. How detailed should the response be?
3. How creative vs factual should the response be?

Return only a JSON object with these parameters:
- max_tokens (number between 100-2000)
- temperature (number between 0.1-1.0)
- top_p (number between 0.1-1.0)

Format: {"max_tokens": X, "temperature": Y, "top_p": Z};
Return only in JSON format.`;

		const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${process.env.OPENROUTER_TOKEN}`
			},
			body: JSON.stringify({
				model: 'meta-llama/llama-3.1-8b-instruct',
				messages: [{ role: 'user', content: optionsPrompt }],
				max_tokens: 100, // Small response for efficiency
				temperature: 0.3, // More deterministic for parameter selection
				top_p: 0.9
			})
		});

		const data = await response.json();
		const optionsString = data.choices[0].message.content
			.replace('```\n', '')
			.replace('\n```', '')
			.replace('```json\n', '')
			.replace('\n```', '');

		// Parse the JSON response
		const options: GenerationOptions = JSON.parse(optionsString);

		// Validate and clamp values to safe ranges
		return {
			max_tokens: Math.min(Math.max(100, options.max_tokens), 2000),
			temperature: Math.min(Math.max(0.1, options.temperature), 1.0),
			top_p: Math.min(Math.max(0.1, options.top_p), 1.0)
		};
	} catch (error) {
		console.error('Error determining options:', error);
		// Return default options if something goes wrong
		return {
			max_tokens: 500,
			temperature: 0.8,
			top_p: 0.9
		};
	}
}

async function determineLanguage(prompt: string): Promise<string> {
	try {
		const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${process.env.OPENROUTER_TOKEN}`
			},
			body: JSON.stringify({
				model: 'meta-llama/llama-3.1-8b-instruct',
				messages: [
					{
						role: 'user',
						content: `What is the language of the following prompt: "${prompt}". Return only fr-FR or en-US.`
					}
				],
				max_tokens: 100, // Small response for efficiency
				temperature: 0.3, // More deterministic for parameter selection
				top_p: 0.9
			})
		});

		const data = await response.json();
		const optionsString = data.choices[0].message.content;

		// Parse the JSON response

		// Validate and clamp values to safe ranges
		return optionsString;
	} catch (error) {
		console.error('Error determining options:', error);
		// Return default options if something goes wrong
		return '';
	}
}

async function generateLore(prompt: string): Promise<string> {
	const options = await determineGenerationOptions(prompt);

	try {
		// Get base prompts
		const basePrompts = db.prepare('SELECT content FROM prompts ORDER BY created_at').all();

		// Get recent history (last 5 interactions)
		const history = db.prepare(`SELECT prompt, response FROM history`).all();

		// Compile conversation history
		let conversationHistory = basePrompts.map((p: any) => ({
			role: 'system',
			content: p.content
		}));

		// Add recent history to conversation
		history.forEach((h: any) => {
			conversationHistory.push(
				{ role: 'user', content: h.prompt },
				{ role: 'assistant', content: h.response }
			);
		});

		// Add current prompt
		conversationHistory.push({ role: 'user', content: prompt });

		const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${process.env.OPENROUTER_TOKEN}`
			},
			body: JSON.stringify({
				model: 'meta-llama/llama-3.1-8b-instruct',
				messages: conversationHistory,
				...options
			})
		});

		const data = await response.json();
		const generatedResponse = data.choices[0].message.content;

		db.prepare(
			`INSERT INTO history (prompt, response) 
            VALUES (?, ?)
        `
		).run(prompt, generatedResponse);

		return generatedResponse;
	} catch (error) {
		console.error('Error:', error);
		throw error;
	}
}

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
	const { content, category, tags } = req.body;

	const stmt = db.prepare('UPDATE prompts SET content = ?, category = ?, tags = ? WHERE id = ?');
	const result = stmt.run(content, category, tags, id);

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

			await obs_mw(response, await determineLanguage(response));

			// Broadcast to other clients that a new response was generated
			socket.broadcast.emit('prompt:new', {
				prompt: promptData.prompt,
				response: response,
				timestamp: new Date()
			});
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

server.listen(app.get('port'), () => {
	console.log(
		`Serveur en écoute sur le port: ${app.get('port')} \nhttp://localhost:${app.get('port')}`
	);
	console.log("Accès à l'API OpenRouter configuré");
});
