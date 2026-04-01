const REVEALABLE_CHAR = /[\p{L}\p{N}]/u;

export function countRevealableChars(answer: string): number {
	let count = 0;
	for (const ch of answer) {
		if (REVEALABLE_CHAR.test(ch)) count++;
	}
	return count;
}

export function maskAnswer(answer: string, revealedCount: number): string {
	const revealTarget = Math.max(0, revealedCount);
	let seen = 0;
	let output = '';

	for (const ch of answer) {
		if (!REVEALABLE_CHAR.test(ch)) {
			output += ch;
			continue;
		}
		if (seen < revealTarget) {
			output += ch;
			seen++;
		} else {
			output += '•';
		}
	}

	return output;
}

export function nextRevealCount(answer: string, currentRevealCount: number): number {
	const total = countRevealableChars(answer);
	return Math.min(total, Math.max(0, currentRevealCount) + 1);
}

