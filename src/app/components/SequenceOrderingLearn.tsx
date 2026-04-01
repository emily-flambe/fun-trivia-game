import { useState } from 'react';
import type { ExerciseSummary, PublicItem } from '../lib/api';
import { WikiLinks } from './WikiLinks';

interface Props {
	exercise: ExerciseSummary;
	items: PublicItem[];
	exercisePath: string;
}

function getLabel(item: PublicItem): string {
	return item.data?.label || item.data?.cardBack || item.data?.prompt || item.id;
}

export function SequenceOrderingLearn({ exercise, items, exercisePath }: Props) {
	const [expandedId, setExpandedId] = useState<string | null>(null);

	const sorted = [...items].sort((a, b) => a.sortOrder - b.sortOrder);

	function toggleExpand(id: string) {
		setExpandedId((prev) => (prev === id ? null : id));
	}

	return (
		<div className="animate-in">
			<div className="flex items-center gap-3 mb-2">
				<a href={`#/node/${exercise.nodeId}`} className="text-text-tertiary hover:text-text-primary transition-colors">&larr;</a>
				<h2 className="text-lg font-semibold flex-1 tracking-tight">{exercise.name}</h2>
			</div>
			<div className="flex items-center gap-2 mb-6 justify-end">
				<a
					href={`#/exercise/${exercisePath}?mode=quiz`}
					className="bg-action hover:bg-action-hover text-white px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200"
				>
					Quiz Me
				</a>
			</div>

			<div className="space-y-2">
				{sorted.map((item, idx) => {
					const isExpanded = item.id === expandedId;
					const label = getLabel(item);
					return (
						<button
							key={item.id}
							onClick={() => toggleExpand(item.id)}
							className={`w-full text-left rounded-xl transition-all duration-200 ${
								isExpanded
									? 'bg-surface-raised ring-2 ring-accent'
									: 'bg-surface-bright hover:bg-surface-hover'
							}`}
						>
							<div className="flex items-center gap-3 px-4 py-3">
								<span className="text-sm font-semibold text-accent w-7 text-right shrink-0">
									{idx + 1}
								</span>
								<span className="font-medium flex-1 min-w-0 truncate">{label}</span>
							</div>
							{isExpanded && (
								<div className="px-4 pb-3 pl-14">
									{item.explanation && (
										<ul className="text-sm text-text-secondary leading-relaxed space-y-1 list-disc list-outside ml-4">
											{item.explanation.split('\\n').map((line, i) => (
												<li key={i}>{line}</li>
											))}
										</ul>
									)}
									<WikiLinks links={item.data?.links} />
								</div>
							)}
						</button>
					);
				})}
			</div>
		</div>
	);
}
