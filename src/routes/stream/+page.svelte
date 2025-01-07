<script lang="ts">
	import { io, Socket } from 'socket.io-client';
	import { onMount } from 'svelte';

	let messages: any[] = [];
	let userInput = '';
	let currentActivity = 'chatting';
	let socket: Socket | null = null;
	let error = '';

	onMount(() => {
		socket = io('http://localhost:3000');

		socket.on('chat:response', (data) => {
			console.log(data);
			messages = [
				...messages,
				{
					type: 'ai',
					content: data.message
				}
			];
		});

		socket.on('chat:error', (data) => {
			error = data.error;
		});
	});

	function sendMessage() {
		if (userInput.trim()) {
			socket!.emit('chat:message', { message: userInput });
			messages = [
				...messages,
				{
					type: 'user',
					content: userInput
				}
			];
			userInput = '';
		}
	}

	function sendDonation() {
		socket!.emit('donation', {
			amount: '5.00',
			username: 'TestUser',
			message: 'Keep up the great streams!'
		});
	}
</script>

<div class="stream-container">
	<div class="activity-bar">
		<button onclick={() => (currentActivity = 'gaming')}>Gaming Mode</button>
		<button onclick={() => (currentActivity = 'karaoke')}>Karaoke Mode</button>
		<button onclick={() => (currentActivity = 'chatting')}>Chat Mode</button>
	</div>

	<div class="chat-window">
		{#each messages as message}
			<div class="message {message.type}">
				<p>{message.content}</p>
			</div>
		{/each}
	</div>

	<div class="input-area">
		<input
			bind:value={userInput}
			placeholder="Chat with Meichja..."
			onkeydown={(e) => e.key === 'Enter' && sendMessage()}
		/>
		<button onclick={sendMessage}>Send</button>
		<button onclick={sendDonation}>Send Test Donation</button>
	</div>

	{#if error}
		<div class="error">
			<p>{error}</p>
		</div>
	{/if}
</div>

<style lang="scss">
	button {
		margin-right: 10px;
		padding: 5px 10px;
		background: #4a4a4a;
		color: #fff;
		border: none;
		border-radius: 5px;
		cursor: pointer;
	}

	input {
		margin-right: 10px;
		padding: 5px 10px;
		outline: none;
		border: none;
		color: #0f0f0f;
		cursor: pointer;
		border-bottom: 1px solid #0f0f0f;

		&:hover {
			cursor: text;
		}
	}

	.stream-container {
		display: flex;
		flex-direction: column;
		height: 100vh;
		padding: 20px;
	}

	.chat-window {
		flex: 1;
		overflow-y: auto;
		border: 1px solid #ccc;
		padding: 10px;
		margin: 10px 0;
	}

	.message {
		margin: 5px 0;
		padding: 10px;
		border-radius: 5px;
	}

	.message.user {
		background: #e0e0e0;
	}

	.message.ai {
		background: #e0ffe0;
	}
</style>
