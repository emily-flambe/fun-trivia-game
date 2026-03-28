import { useState } from 'react';
import type { ExerciseSummary, PublicItem } from '../lib/api';
import { WikiLinks } from './WikiLinks';

interface Props {
	exercise: ExerciseSummary;
	items: PublicItem[];
	exercisePath: string;
}

export function LearnGrid({ exercise, items, exercisePath }: Props) {
	const [flippedCards, setFlippedCards] = useState<Set<string>>(new Set());
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [reversed, setReversed] = useState(false);

	// Check if items have cardFront/cardBack in data for reversible mode
	const hasCardFields = items.some((item) => item.data?.cardFront || item.data?.cardBack);

	function toggleCard(id: string) {
		setFlippedCards((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
		setSelectedId(id);
	}

	function flipAll() {
		const allFlipped = flippedCards.size === items.length;
		if (allFlipped) {
			setFlippedCards(new Set());
		} else {
			setFlippedCards(new Set(items.map((item) => item.id)));
		}
	}

	function toggleDirection() {
		setReversed((r) => !r);
		setFlippedCards(new Set());
		setSelectedId(null);
	}

	function cardFace(item: PublicItem, flipped: boolean): string {
		const showFront = reversed ? !flipped : flipped;
		if (showFront) return item.data?.cardFront || item.data?.prompt || item.id;
		return item.data?.cardBack || item.data?.prompt || item.id;
	}

	const selectedItem = selectedId ? items.find((i) => i.id === selectedId) : null;

	return (
		<div className="animate-in">
			<div className="flex items-center gap-3 mb-2">
				<a href={`#/node/${exercise.nodeId}`} className="text-text-tertiary hover:text-text-primary transition-colors">&larr;</a>
				<h2 className="text-lg font-semibold flex-1 tracking-tight">{exercise.name}</h2>
			</div>
			<div className="flex items-center gap-2 mb-6 justify-end">
				{hasCardFields && (
					<>
						<button
							onClick={flipAll}
							className="text-sm text-text-tertiary hover:text-accent transition-colors px-3 py-2 rounded-lg hover:bg-surface-hover"
							title="Flip all cards"
						>
							&#8644; Flip All
						</button>
						<button
							onClick={toggleDirection}
							className="text-sm text-text-tertiary hover:text-accent transition-colors px-3 py-2 rounded-lg hover:bg-surface-hover"
							title="Swap default card sides"
						>
							&#x21C5; Reverse
						</button>
					</>
				)}
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
					const isSelected = item.id === selectedId;
					return (
						<button
							key={item.id}
							onClick={() => toggleCard(item.id)}
							className={`rounded-xl p-3 text-left text-sm min-h-[70px] transition-all duration-200 cursor-pointer ${
								isSelected
									? 'bg-surface-raised ring-2 ring-accent'
									: isFlipped
										? 'bg-surface-raised'
										: 'bg-surface-bright hover:bg-surface-hover'
							}`}
						>
							<div className={`font-medium ${isFlipped ? 'text-accent' : ''}`}>
								{cardFace(item, isFlipped)}
							</div>
						</button>
					);
				})}
			</div>

			{/* Detail panel */}
			<div className={`mt-4 bg-surface-raised rounded-xl p-5 min-h-[80px] transition-all duration-200 ${selectedItem ? '' : 'opacity-50'}`}>
				{selectedItem ? (
					<div>
						<div className="flex items-baseline gap-2 mb-2">
							<span className="text-xl font-bold text-accent">
								{selectedItem.data?.cardBack || selectedItem.data?.prompt || selectedItem.id}
							</span>
							{selectedItem.data?.cardFront && (
								<span className="text-text-tertiary text-sm">{selectedItem.data.cardFront}</span>
							)}
						</div>
						{selectedItem.explanation && (
							<ul className="text-sm text-text-secondary leading-relaxed space-y-1 list-disc list-outside ml-4">
								{selectedItem.explanation.split('\\n').map((line, i) => (
									<li key={i}>{line}</li>
								))}
							</ul>
						)}
						<WikiLinks links={selectedItem.data?.links} />
					</div>
				) : (
					<div className="text-text-tertiary text-sm">Click a card to see details</div>
				)}
			</div>
		</div>
	);
}
