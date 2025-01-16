import db from './db';
import dotenv from 'dotenv';
dotenv.config();
import dayjs from 'dayjs';
import { deleteBrackets } from './utils/brackets';

interface GenerationOptions {
	max_tokens: number;
	temperature: number;
	top_p: number;
}

export async function determineGenerationOptions(prompt: string): Promise<GenerationOptions> {
	// 	try {
	// 		const optionsPrompt = `As an AI assistant, analyze the following prompt and determine the best generation parameters for a response. The prompt is: "${prompt}". Consider these aspects:
	// 1. Is this a simple greeting, a lore question, or a complex query?
	// 2. How detailed should the response be?
	// 3. How creative vs factual should the response be?

	// Return only a JSON object with these parameters:
	// - max_tokens (number between 100-2000)
	// - temperature (number between 0.1-1.0)
	// - top_p (number between 0.1-1.0)

	// Format: {"max_tokens": X, "temperature": Y, "top_p": Z};
	// Return only in JSON format.`;

	// 		const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
	// 			method: 'POST',
	// 			headers: {
	// 				'Content-Type': 'application/json',
	// 				Authorization: `Bearer ${process.env.OPENROUTER_TOKEN}`
	// 			},
	// 			body: JSON.stringify({
	// 				model: process.env.AI_MODEL,
	// 				messages: [{ role: 'user', content: optionsPrompt }],
	// 				max_tokens: 100, // Small response for efficiency
	// 				temperature: 0.3, // More deterministic for parameter selection
	// 				top_p: 0.9
	// 			})
	// 		});

	// 		const data = await response.json();
	// 		const optionsString = data.choices[0].message.content
	// 			.replace('```\n', '')
	// 			.replace('\n```', '')
	// 			.replace('```json\n', '')
	// 			.replace('\n```', '')
	// 			.trim();

	// 		// Parse the JSON response
	// 		const options: GenerationOptions = JSON.parse(optionsString);

	// 		// Validate and clamp values to safe ranges
	// 		return {
	// 			max_tokens: Math.min(Math.max(100, options.max_tokens), 2000),
	// 			temperature: Math.min(Math.max(0.1, options.temperature), 1.0),
	// 			top_p: Math.min(Math.max(0.1, options.top_p), 1.0)
	// 		};
	// 	} catch (error) {
	// 		console.error('Error determining options:', error);
	// 		// Return default options if something goes wrong
	// 		return {
	// 			max_tokens: 500,
	// 			temperature: 0.8,
	// 			top_p: 0.9
	// 		};
	// }

	return {
		max_tokens: 2000,
		temperature: 0.4,
		top_p: 0.9
	};
}

export async function determineLanguage(prompt: string): Promise<string> {
	// try {
	// 	const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
	// 		method: 'POST',
	// 		headers: {
	// 			'Content-Type': 'application/json',
	// 			Authorization: `Bearer ${process.env.OPENROUTER_TOKEN}`
	// 		},
	// 		body: JSON.stringify({
	// 			model: process.env.AI_MODEL,
	// 			messages: [
	// 				{
	// 					role: 'user',
	// 					content: `What is the language of the following prompt: "${prompt}". Return only fr-FR or en-US.`
	// 				}
	// 			],
	// 			max_tokens: 100, // Small response for efficiency
	// 			temperature: 0.3, // More deterministic for parameter selection
	// 			top_p: 0.9
	// 		})
	// 	});

	// 	const data = await response.json();
	// 	const optionsString = data.choices[0].message.content;

	// 	// Parse the JSON response

	// 	// Validate and clamp values to safe ranges
	// 	return optionsString;
	// } catch (error) {
	// 	console.error('Error determining options:', error);
	// 	// Return default options if something goes wrong
	// 	return '';
	// }

	return 'en-US';
}

export async function generateLore(prompt: string): Promise<string> {
	const options = await determineGenerationOptions(prompt);

	try {
		// Get base prompts
		const basePrompts = db.prepare('SELECT content FROM prompts').all();

		// Get recent history (last 5 interactions)
		const history = db.prepare(`SELECT prompt, response FROM history`).all();

		// Compile conversation history
		let conversationHistory: { role: string; content: any }[] = [
			{
				role: 'system',
				content: basePrompts.map((s: any) => deleteBrackets(s.content)).join('\n\n')
			}
		];

		// Add recent history to conversation
		history.forEach((h: any) => {
			console.log(h);
			conversationHistory.push(
				{ role: 'user', content: h.prompt },
				{ role: 'assistant', content: deleteBrackets(h.response) }
			);
		});

		prompt = `[${dayjs(new Date()).format('DD MM YYYY')} at ${dayjs(new Date()).format('HH[h]')}]: ${prompt}`;

		// Add current prompt
		conversationHistory.push({
			role: 'user',
			content: prompt
		});

		const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${process.env.OPENROUTER_TOKEN}`
			},
			body: JSON.stringify({
				model: process.env.AI_MODEL,
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
		).run(deleteBrackets(prompt), deleteBrackets(generatedResponse));

		return generatedResponse;
	} catch (error) {
		console.error('Error:', error);
		throw error;
	}
}
