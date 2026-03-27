import { useState } from 'react';
import type { ExerciseSummary, PublicItem } from '../lib/api';

interface Props {
	exercise: ExerciseSummary;
	items: PublicItem[];
	exercisePath: string;
}

export function LearnGrid({ exercise, items, exercisePath }: Props) {
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [reversed, setReversed] = useState(false);

	const nodeId = exercise.nodeId;

	// Check if items have cardFront/cardBack in data for reversible mode
	const hasCardFields = items.some((item) => item.data?.cardFront || item.data?.cardBack);

	function selectCard(id: string) {
		setSelectedId((prev) => (prev === id ? null : id));
	}

	function toggleDirection() {
		setReversed((r) => !r);
		setSelectedId(null);
	}

	function cardFace(item: PublicItem) {
		const front = item.data?.cardBack || item.data?.prompt || item.id;
		const back = item.data?.cardFront || item.data?.prompt || item.id;
		return reversed ? back : front;
	}

	const selectedItem = selectedId ? items.find((i) => i.id === selectedId) : null;

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
				<a
					href={`#/exercise/${exercisePath}?mode=quiz`}
					className="bg-action hover:bg-action-hover text-white px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200"
				>
					Quiz Me
				</a>
			</div>

			<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
				{items.map((item) => {
					const isSelected = item.id === selectedId;
					return (
						<button
							key={item.id}
							onClick={() => selectCard(item.id)}
							className={`rounded-xl p-3 text-left text-sm min-h-[70px] transition-all duration-200 cursor-pointer ${
								isSelected
									? 'bg-surface-raised ring-2 ring-accent'
									: 'bg-surface-bright hover:bg-surface-hover'
							}`}
						>
							<div className={`font-medium ${isSelected ? 'text-accent' : ''}`}>
								{cardFace(item)}
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
							<div className="text-sm text-text-secondary leading-relaxed">{selectedItem.explanation}</div>
						)}
					</div>
				) : (
					<div className="text-text-tertiary text-sm">Click a card to see details</div>
				)}
			</div>
		</div>
	);
}
