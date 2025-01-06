import express from 'express';
import db from './db';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

if (!fs.existsSync('./logs')) {
	fs.mkdirSync('./logs');
}

async function generateLore(customPrompt: string) {
	try {
		// Récupérer tous les prompts depuis la base de données
		const prompts = db.prepare('SELECT content FROM prompts ORDER BY created_at').all();

		// Compiler les prompts en un seul texte
		const basePrompt = prompts.map((p: any) => p.content).join('\n');

		// Ajouter le prompt personnalisé
		const finalPrompt = `${basePrompt}\n\n${customPrompt}`;

		// Afficher le prompt final et le logger dans un fichier

		console.log(finalPrompt);

		fs.writeFileSync(`./logs/log-${Date.now()}.txt`, finalPrompt);

		// Envoyer la requête à OpenRouter
		const response = await fetch('https://openrouter.ai/api/v1/completions', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${process.env.OPENROUTER_TOKEN}`, // Remplace avec ta clé
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				model: 'meta-llama/llama-3.1-8b-instruct',
				prompt: finalPrompt,
				max_tokens: 1024,
				temperature: 0.7
			})
		});

		const data = await response.json();

		if (response.ok) {
			return data.choices[0].text.trim();
		} else {
			throw new Error(`Erreur API : ${data.error.message}`);
		}
	} catch (error) {
		console.error(error);
		throw error;
	}
}

const app = express();

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

app.listen(3000, () => {
	console.log('Serveur en écoute sur le port 3000\nhttp://localhost:3000');
	console.log("Accès à l'API OpenRouter configuré");
});
