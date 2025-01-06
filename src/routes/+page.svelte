<script lang="ts">
	import { goto } from '$app/navigation';
	import axios from 'axios';

	let prompt = '';
	let response = '';
	let error = '';

	async function sendPrompt() {
		response = '';
		error = '';

		try {
			const res = await axios.post('http://localhost:3000/generate', { prompt });

			if (res.data.error) {
				error = res.data.error;
				throw new Error(error);
			}

			response = res.data.response;
		} catch (e: any) {
			console.error(e.message);
			error = 'Erreur de connexion au serveur.';
		}
	}
</script>

<div class="container">
	<div class="question">
		<textarea bind:value={prompt} placeholder="Entrez un prompt..."></textarea>

		<div class="buttons">
			<button onclick={sendPrompt}>Générer</button>
			<button class="manage" onclick={async () => await goto('/manage')}
				>Gestion du lore et des prompts</button
			>
		</div>

		{#if response}
			<div class="response">{response}</div>
		{/if}
		{#if error}
			<div class="error">{error}</div>
		{/if}
	</div>
</div>

<style lang="scss">
	div.question {
		display: flex;
		flex-direction: column;
		gap: 10px;

		border: 1px solid #ccc;
		border-radius: 5px;
		padding: 10px;
		width: 80%;
		margin-inline: auto;

		div {
			width: 100%;
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

			button.manage {
				width: 200px;
			}
		}

		textarea {
			height: 100px;
			outline: 0;
			border: 0;
			box-shadow: inset 0 0 10px rgba(0, 0, 0, 0.1);
			padding: 10px;
		}

		.response {
			margin-top: 10px;
			background: #e0ffe0;
			padding: 10px;
			border: 1px solid #00b000;
			box-shadow: inset 0 0 10px rgba(0, 0, 0, 0.1);
		}

		.error {
			margin-top: 10px;
			background: #ffe0e0;
			padding: 10px;
			border: 1px solid #b00000;
			box-shadow: inset 0 0 10px rgba(0, 0, 0, 0.1);
		}
	}

	div.container {
		display: flex;
		gap: 10px;

		align-items: center;
		justify-content: center;
	}
</style>
