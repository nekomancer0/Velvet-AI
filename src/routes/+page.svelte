<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { io } from 'socket.io-client';
	import { goto } from '$app/navigation';
	import type { Socket } from 'socket.io-client';

	let prompt = '';
	let response = '';
	let error = '';
	let socket: Socket | null = null;
	let isConnected = false;
	let suggestedPrompts: Array<{ prompt: string; timestamp: Date }> = [];

	onMount(() => {
		socket = io('http://localhost:3000');

		socket.on('connect', () => {
			isConnected = true;
			console.log('Connected to server');
		});

		socket.on('prompt:response', (data) => {
			response = data.response;
		});

		socket.on('prompt:error', (data) => {
			error = data.error;
		});

		socket.on('prompt:new', (data) => {
			// Handle notifications of new prompts from other users if needed
			console.log('New prompt from another user:', data);
		});
	});

	onDestroy(() => {
		if (socket) {
			socket.disconnect();
		}
	});

	async function sendPrompt() {
		response = '';
		error = '';

		if (!isConnected) {
			error = 'Not connected to server';
			return;
		}

		try {
			// Emit the prompt through socket instead of HTTP request
			socket!.emit('prompt:send', { prompt });
		} catch (e: any) {
			console.error(e.message);
			error = 'Error sending prompt';
		}
	}
</script>

<div class="container">
	<div class="question">
		<textarea bind:value={prompt} placeholder="Enter a prompt..." class:disconnected={!isConnected}
		></textarea>

		<div class="buttons">
			<button onclick={sendPrompt} disabled={!isConnected}> Generate </button>
			<button class="manage" onclick={async () => await goto('/manage')}>
				Manage Lore and Prompts
			</button>
		</div>

		{#if response}
			<div class="response">{response}</div>
		{/if}
		{#if error}
			<div class="error">{error}</div>
		{/if}

		<!-- Connection status indicator -->
		<div class="status" class:connected={isConnected}>
			{isConnected ? 'Connected' : 'Disconnected'}
		</div>
	</div>
</div>

<style lang="scss">
	* {
		font-family: sans-serif;
	}

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

	.status {
		position: fixed;
		bottom: 10px;
		right: 10px;
		padding: 5px 10px;
		border-radius: 5px;
		background: #ff4444;
		color: white;
		text-align: center;

		&.connected {
			background: #44ff44;
		}
	}

	.disconnected {
		opacity: 0.7;
		cursor: not-allowed;
		background: #ff4444;
	}

	.suggestions {
		margin-top: 20px;
		padding: 15px;
		background: rgba(255, 255, 255, 0.1);
		border-radius: 8px;

		h3 {
			margin: 0 0 15px 0;
			color: #e0e0e0;
		}
	}

	.suggestion {
		padding: 10px;
		margin-bottom: 10px;
		background: rgba(0, 0, 0, 0.2);
		border-radius: 5px;
		display: flex;
		justify-content: space-between;
		align-items: center;

		p {
			margin: 0;
			flex: 1;
		}

		button {
			margin-left: 10px;
			padding: 5px 10px;
			background: #4a4a4a;
			border: none;
			border-radius: 3px;
			color: white;
			cursor: pointer;

			&:hover {
				background: #5a5a5a;
			}
		}
	}
</style>
