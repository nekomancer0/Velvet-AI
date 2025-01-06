<script lang="ts">
	import axios from 'axios';

	// Page pour gérer le lore, en ajouter, en modifier et en supprimer et aussi les lister

	let prompts: any;

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
			editingPrompt = null;
		} else editingPrompt = prompt;
	}

	async function selectCategory(category: string) {
		console.log(prompts);
		console.log(category);
		prompts = prompts.filter((prompt: any) => prompt.category === category);

		if (category === 'all') {
			prompts = await getPrompts();
		}
	}
</script>

<h1>Gérer le lore</h1>

<div class="container">
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
			<option value="all" selected>All</option>
			<option value="general">Général</option>
			<option value="lore">Lore</option>
			<option value="ritual">Ritual</option>
			<option value="adaptation">Adaptation</option>
			<option value="myth">Myth</option>
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
	}
</style>
