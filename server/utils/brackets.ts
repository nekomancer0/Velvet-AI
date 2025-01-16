// Function to match words in asterisks and provide them

let regex = /\*([^*]+)\*/gm;

export function findBrackets(text: string) {
	let matches = text.matchAll(regex);
	let array = matches.toArray();
	let words: string[] = [];

	for (let match of array) {
		words.push(match[1]);
	}

	return words;
}

export function deleteBrackets(text: string) {
	let words = findBrackets(text);

	for (let word of words) {
		// detect if there is a space before or after the brackets

		if (text.includes(' *' + word + '* ')) {
			text = text.replace(' *' + word + '* ', '');
		}

		if (text.includes(' *' + word + '*')) {
			text = text.replace(' *' + word + '*', '');
		}

		if (text.includes(word + '* ')) {
			text = text.replace(word + '* ', '');
		}

		if (text.includes(word + '*')) {
			text = text.replace(word + '*', '');
		}

		if (text.includes(' *' + word)) {
			text = text.replace(' *' + word, '');
		}

		if (text.includes('* ' + word)) {
			text = text.replace('* ' + word, '');
		}

		if (text.includes('*' + word)) {
			text = text.replace('*' + word, '');
		}
	}

	return text;
}
