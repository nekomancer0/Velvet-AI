import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import db from './db';
import dotenv from 'dotenv';
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

async function generateLore(prompt: string): Promise<string> {
	// First, let the AI determine the best parameters for this prompt
	const options = await determineGenerationOptions(prompt);

	try {
		// Récupérer tous les prompts depuis la base de données
		const prompts = db.prepare('SELECT content FROM prompts ORDER BY created_at').all();

		// Compiler les prompts en un seul texte
		const basePrompt = prompts.map((p: any) => p.content).join('\n');

		const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${process.env.OPENROUTER_TOKEN}`
			},
			body: JSON.stringify({
				model: 'meta-llama/llama-3.1-8b-instruct',
				messages: [
					{ role: 'system', content: basePrompt },
					{ role: 'user', content: prompt }
				],
				...options // Use the AI-determined options
			})
		});

		const data = await response.json();
		return data.choices[0].message.content;
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

app.set('port', process.env.PORT || 3000);

async function generateSelfPrompt(): Promise<string> {
	const selfPromptingPrompt = `As an Empyrean Felinid AI, generate an interesting question about Empyrean Felinid lore that would expand the existing knowledge base. The question should be thought-provoking and lead to detailed lore generation. Focus on topics like:
- Celestial rituals
- Divine culture
- Magical practices
- Historical events
- Social structures
- Mystical beliefs

Return only the question itself, without any additional context or explanation.`;

	try {
		const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${process.env.OPENROUTER_TOKEN}`
			},
			body: JSON.stringify({
				model: 'meta-llama/llama-3.1-8b-instruct',
				messages: [{ role: 'user', content: selfPromptingPrompt }],
				max_tokens: 100,
				temperature: 0.9,
				top_p: 0.95
			})
		});

		const data = await response.json();
		return data.choices[0].message.content.trim();
	} catch (error) {
		console.error('Error generating self-prompt:', error);
		throw error;
	}
}

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

	socket.on('prompt:generate-suggestion', async () => {
		try {
			const suggestionQuestion = await generateSelfPrompt();

			const suggestedPrompt = await generateLore(suggestionQuestion);

			// Store the suggestion in the database
			db.query(
				`INSERT INTO prompt_suggestions (prompt, created_at, status) VALUES (?, datetime('now'), 'pending')`
			).run(suggestedPrompt);

			// Emit the suggestion to all connected clients
			io.emit('prompt:suggestion', {
				prompt: suggestedPrompt,
				timestamp: new Date()
			});
		} catch (error) {
			console.log(error);
			socket.emit('prompt:error', {
				error: 'Failed to generate prompt suggestion'
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
