<script lang="ts">
	import axios from 'axios';

	let prompts: any[] = [];
	let newPrompt = {
		content: '',
		category: 'general'
	};
	let error = '';
	let success = '';

	const categories = ['general', 'lore', 'avatar', 'interaction'];

	let editingPrompt: any;

	async function getPrompts() {
		try {
			const res = await axios.get('http://localhost:3000/prompts');
			return res.data.prompts;
		} catch (e: any) {
			console.error(e.message);
			return [];
		}
	}

	async function deletePrompt(id: string) {
		try {
			let yesOrNo = confirm('Voulez-vous vraiment supprimer ce prompt ?');
			if (!yesOrNo) return;
			await axios.delete(`http://localhost:3000/prompts/${id}`);
			prompts = await getPrompts();
		} catch (e: any) {
			console.error(e.message);
		}
	}

	(async () => {
		prompts = await getPrompts();
	})();

	function capitalize(str: string) {
		return str.charAt(0).toUpperCase() + str.slice(1);
	}

	async function switchEditingPrompt(prompt: any) {
		if (editingPrompt && editingPrompt.id === prompt.id) {
			// Update prompt

			try {
				await axios.put(`http://localhost:3000/prompts/${prompt.id}`, {
					content: editingPrompt.content,
					category: editingPrompt.category,
					tags: editingPrompt.tags
				});
				success = 'Prompt updated successfully';
				error = '';
				prompts = await getPrompts();
			} catch (err) {
				error = 'Failed to update prompt';
				success = '';
				console.error(err);
			}

			editingPrompt = null;
		} else editingPrompt = prompt;
	}

	async function selectCategory(category: string) {
		prompts = prompts.filter((prompt: any) => prompt.category === category);

		if (prompts.length === 0) {
			prompts = await getPrompts();
		}

		// If category is 'all', show all prompts
		if (category === 'all') {
			prompts = await getPrompts();
		}
	}

	// Add new base prompt
	async function addBasePrompt() {
		try {
			if (!newPrompt.content.trim()) {
				error = 'Prompt content cannot be empty';
				return;
			}

			await axios.post('http://localhost:3000/prompts', newPrompt);
			success = 'Base prompt added successfully';
			error = '';

			// Reset form
			newPrompt = {
				content: '',
				category: 'general'
			};

			// Reload prompts
			prompts = await getPrompts();
		} catch (err) {
			error = 'Failed to add base prompt';
			success = '';
			console.error(err);
		}
	}
</script>

<h1>Gérer le lore</h1>

<div class="container">
	<div class="add-prompt-form">
		<h3>Add New Base Prompt</h3>
		<div class="form-group">
			<label for="content">Prompt Content:</label>
			<textarea
				id="content"
				bind:value={newPrompt.content}
				placeholder="Enter the base prompt content..."
				rows="4"
			></textarea>
		</div>

		<div class="form-group">
			<label for="category">Category:</label>
			<select id="category" bind:value={newPrompt.category}>
				{#each categories as category}
					<option value={category}>{category}</option>
				{/each}
			</select>
		</div>

		<button onclick={addBasePrompt}>Add Base Prompt</button>

		{#if error}
			<div class="error">{error}</div>
		{/if}
		{#if success}
			<div class="success">{success}</div>
		{/if}
	</div>
	<div class="prompts">
		{#key prompts}
			{#if !prompts || prompts.length === 0}
				<p>Aucun prompt trouvé.</p>
			{:else}
				{#each prompts as prompt}
					<div class={`prompt ${editingPrompt ? 'editing' : ''}`}>
						<h3>{capitalize(prompt.category)}</h3>
						{#if editingPrompt && editingPrompt.id === prompt.id}
							<textarea bind:value={editingPrompt.content}></textarea>

							<div class="buttons">
								<button class="edit" onclick={() => switchEditingPrompt(prompt)}>Fini</button>
							</div>
						{:else}
							<p>{prompt.content}</p>
							<div class="buttons">
								<button class="del" onclick={async () => await deletePrompt(prompt.id)}
									>Supprimer</button
								>
								<button class="edit" onclick={() => switchEditingPrompt(prompt)}>Modifier</button>
							</div>
						{/if}
					</div>
				{/each}
			{/if}
		{/key}
	</div>

	<div class="classify">
		<h3>Classement</h3>

		<select
			onchange={async (ev) =>
				// @ts-ignore
				await selectCategory(ev.target!.value)}
		>
			{#each categories as category}
				<option value={category}>{capitalize(category)}</option>
			{/each}
		</select>
	</div>
</div>

<style lang="scss">
	* {
		font-family: sans-serif;
	}

	.container {
		display: flex;
		gap: 10px;
		justify-content: space-between;

		h1 {
			margin: 0;
		}

		.prompts {
			display: flex;
			flex-direction: column;
			gap: 10px;
			width: 50%;

			.prompt {
				border: 1px solid #ccc;
				border-radius: 5px;
				padding: 10px;

				p {
					text-align: justify;
				}

				.buttons {
					display: flex;
					gap: 10px;
					justify-content: space-between;

					button {
						width: 100px;
						height: 30px;
						background: #00b000;
						color: #fff;
						border: none;
						border-radius: 5px;
						cursor: pointer;
					}
				}
			}

			.editing {
				background: #f0f0f0;

				textarea {
					width: 100%;
					height: 100px;

					border: 1px solid #ccc;
					border-radius: 5px;
				}

				.buttons {
					button {
						width: 100px;
						height: 30px;
						background: #00b000;
						color: #fff;
						border: none;
						border-radius: 5px;
						cursor: pointer;
					}
				}
			}
		}

		.classify {
			width: 50%;

			select {
				border: 1px solid #ccc;
				border-radius: 5px;
				padding: 10px;

				width: 100%;
				height: 100px;

				option {
					padding: 10px;

					border: 1px solid #ccc;
					border-radius: 5px;

					cursor: pointer;

					&:hover {
						background: #f0f0f0;
					}

					&:disabled {
						background: #f0f0f0;
						color: #ccc;
						cursor: not-allowed;
					}
				}
			}
		}

		.add-prompt-form {
			display: flex;
			flex-direction: column;
			gap: 10px;

			input {
				border: 1px solid #ccc;
				border-radius: 5px;
				padding: 10px;

				width: 100%;
				height: 100px;
			}

			select {
				border: 1px solid #ccc;
				border-radius: 5px;
				padding: 10px;

				width: 100%;
			}

			button {
				width: 200px;
				height: 30px;
				background: #00b000;
				color: #fff;
				border: none;
				border-radius: 5px;
				cursor: pointer;
			}

			textarea {
				width: 100%;
				height: 100px;

				border: 1px solid #ccc;
				border-radius: 5px;
			}

			.error {
				color: red;
			}

			.success {
				color: green;
			}
		}
	}
</style>
