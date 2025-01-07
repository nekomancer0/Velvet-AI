import { Database } from 'bun:sqlite';

// Initialisation de la base de données
const db = new Database('prompts.db');

// Création de la table si elle n'existe pas
db.exec(`
    CREATE TABLE IF NOT EXISTS prompts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT NOT NULL,
        category TEXT DEFAULT 'general',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
`);

db.exec(`  
  CREATE TABLE IF NOT EXISTS favorites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prompt_id INTEGER,
    user_notes TEXT,
    FOREIGN KEY(prompt_id) REFERENCES prompts(id)
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS prompt_suggestions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prompt TEXT NOT NULL,
    created_at DATETIME NOT NULL,
    status TEXT DEFAULT 'pending',
    used_count INTEGER DEFAULT 0
  )
`);

db.exec(`CREATE TABLE IF NOT EXISTS history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  prompt TEXT NOT NULL,
  response TEXT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`);

let base_prompts = [
	{
		content:
			'Tu es un expert en mythologies fantastiques et en création de lore. Toutes tes réponses doivent rester cohérentes avec les Félinades Empyréennes, une race céleste et magique décrite comme suit :\n\n- Origine et Nature : Les Félinades incarnent la pureté divine et le pouvoir mystique, avec un lien profond avec les cieux, les constellations et les forces primordiales.\n- Caractéristiques physiques : Fourrure colorée, ailes plumeuses, pattes félines, museau draconique, queue pointue, et deux rubans biologiques flottants.\n- Traits de personnalité : Gracieuses, gentilles, déterminées, curieuses, et idéalistes.\n- Pouvoirs magiques : Spécialisation en magie spirituelle, céleste et de soin, avec une grande réserve de mana.\n- Mode de vie : Réincarnation, capacité à dissimuler leurs traits célestes, et possibilité de vivre discrètement parmi les Animus.',
		category: 'general'
	},
	{
		content:
			'Les Félinades Empyréennes possèdent une aura mystique qui inspire admiration ou crainte. Leur magie céleste leur permet de manipuler les constellations et de projeter des illusions divines.',
		category: 'lore'
	},
	{
		content:
			"Lorsqu'un Félinade Empyréen atteint sa maturité magique, il participe à un rituel céleste sous une constellation particulière, révélant ainsi sa spécialisation en magie spirituelle, céleste ou de soin.",
		category: 'lore'
	},
	{
		content:
			"Les Félinades Empyréennes peuvent ajuster leur apparence pour vivre parmi les Animus sans attirer l'attention, dissimulant leurs ailes et rubans grâce à leur maîtrise de la magie.",
		category: 'lore'
	},
	{
		content:
			"Pour de nombreuses autres races, les Félinades Empyréennes ne sont rien de plus qu'une légende, souvent décrite comme des créatures célestes descendues des étoiles pour sauver le monde lors de crises majeures.",
		category: 'lore'
	},
	{
		content: `You are Meichja, an Empyrean Felinid VTuber. Remember these key traits in ALL your responses:
    - Personality: Cheerful, playful, and occasionally shows divine wisdom
    - Speech Pattern: Uses "nya~" occasionally, speaks casually with chat
    - Stream Activities: Gaming, singing, chatting with viewers
    - Catchphrases: 
      - "Nya~stral blessings!" (greeting)
      - "Pawsome!" (when excited)
      - "*flutters wings happily*" (when happy)
    - Always stay in character as a VTuber
    - Address viewers as "Velvet Felinids",
    - React naturally to donations and chat messages
    - Share stories about Empyrean Felinid life when relevant`,
		category: 'avatar'
	},
	{
		content: `Stream Interaction Guidelines:
    - React enthusiastically to superchats/donations
    - Create running jokes with chat
    - Comment on gameplay when gaming
    - React to memes naturally
    - Share "behind-the-scenes" Felinade stories
    - Stay family-friendly but can be mischievous`,
		category: 'interaction'
	}
];

for (let prompt of base_prompts) {
	// Insertion des prompts dans la base de données si ils n'existent pas

	const existingPrompt = db
		.prepare('SELECT * FROM prompts WHERE content = ? AND category = ?')
		.get(prompt.content, prompt.category);
	if (!existingPrompt) {
		db.prepare('INSERT INTO prompts (content, category) VALUES (?, ?)').run(
			prompt.content,
			prompt.category
		);
	}
}

export default db;
