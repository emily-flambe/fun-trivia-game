import { useState } from 'react';
import type { ExerciseSummary, PublicItem } from '../lib/api';

interface Props {
	exercise: ExerciseSummary;
	items: PublicItem[];
	exercisePath: string;
}

export function LearnGrid({ exercise, items, exercisePath }: Props) {
	const [flippedCards, setFlippedCards] = useState<Set<string>>(new Set());
	const [reversed, setReversed] = useState(false);

	const nodeId = exercise.nodeId;
	const allFlipped = flippedCards.size === items.length;

	// Check if items have cardFront/cardBack in data for reversible mode
	const hasCardFields = items.some((item) => item.data?.cardFront || item.data?.cardBack);

	function toggleCard(id: string) {
		setFlippedCards((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	}

	function flipAll() {
		if (allFlipped) {
			setFlippedCards(new Set());
		} else {
			setFlippedCards(new Set(items.map((item) => item.id)));
		}
	}

	function toggleDirection() {
		setReversed((r) => !r);
		setFlippedCards(new Set());
	}

	function cardSides(item: PublicItem) {
		// In learn mode, card face shows the answer side (cardBack), tap reveals the prompt side (cardFront)
		// Answers are stripped from the public API, so we rely on data.cardBack / data.cardFront / data.prompt
		const front = item.data?.cardBack || item.data?.prompt || item.id;
		const back = item.data?.cardFront || item.data?.prompt || item.id;
		return reversed ? { front: back, back: front } : { front, back };
	}

	return (
		<div className="animate-in">
			<div className="flex items-center gap-3 mb-6">
				<a href={`#/node/${nodeId}`} className="text-text-tertiary hover:text-text-primary transition-colors">&larr;</a>
				<h2 className="text-lg font-semibold flex-1 tracking-tight">{exercise.name}</h2>
				{hasCardFields && (
					<button
						onClick={toggleDirection}
						className="text-sm text-text-tertiary hover:text-accent transition-colors"
						title="Swap card sides"
					>
						&#8644; Flip
					</button>
				)}
				<button
					onClick={flipAll}
					className="text-sm text-text-tertiary hover:text-accent transition-colors"
				>
					{allFlipped ? 'Hide All' : 'Reveal All'}
				</button>
				<a
					href={`#/exercise/${exercisePath}?mode=quiz`}
					className="bg-action hover:bg-action-hover text-white px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200"
				>
					Quiz Me
				</a>
			</div>

			<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
				{items.map((item) => {
					const isFlipped = flippedCards.has(item.id);
					const sides = cardSides(item);
					return (
						<button
							key={item.id}
							onClick={() => toggleCard(item.id)}
							className={`rounded-xl p-3 text-left text-sm min-h-[70px] transition-all duration-200 cursor-pointer ${
								isFlipped
									? 'bg-surface-raised'
									: 'bg-surface-bright hover:bg-surface-hover'
							}`}
						>
							<div className={`font-medium ${isFlipped ? 'text-accent' : ''}`}>
								{isFlipped ? sides.back : sides.front}
							</div>
						</button>
					);
				})}
			</div>
		</div>
	);
}
