import React, { useEffect, useState } from 'react';
import { getModules, type QuizModule } from '../lib/api';

const TIER_ORDER = ['foundation', 'core', 'advanced'] as const;
const TIER_STYLES: Record<string, string> = {
	foundation: 'bg-action-bg text-action',
	core: 'bg-surface-bright text-text-secondary',
	advanced: 'bg-accent-muted text-accent',
};

export function CategoryView({ categoryId }: { categoryId: string }) {
	const [modules, setModules] = useState<QuizModule[]>([]);
	const [loading, setLoading] = useState(true);
	const [selectedModule, setSelectedModule] = useState<string | null>(null);

	useEffect(() => {
		getModules(categoryId)
			.then(setModules)
			.finally(() => setLoading(false));
	}, [categoryId]);

	if (loading) {
		return <div className="text-center text-text-tertiary py-16">Loading modules...</div>;
	}

	const grouped = TIER_ORDER.map((tier) => ({
		tier,
		modules: modules.filter((m) => m.tier === tier),
	})).filter((g) => g.modules.length > 0);

	return (
		<div className="animate-in">
			<div className="flex items-center gap-3 mb-8">
				<a href="#/" className="text-text-tertiary hover:text-text-primary transition-colors text-sm">
					&larr; Back
				</a>
				<h2 className="text-2xl font-bold capitalize tracking-tight">{categoryId}</h2>
			</div>

			{grouped.map(({ tier, modules }) => (
				<div key={tier} className="mb-8">
					<h3 className="text-xs font-semibold uppercase tracking-widest text-text-tertiary mb-3">
						{tier}
					</h3>
					<div className="space-y-2">
						{modules.map((mod) => (
							<div key={mod.id}>
								<button
									onClick={() => setSelectedModule(selectedModule === mod.id ? null : mod.id)}
									className="w-full bg-surface-raised rounded-xl p-4 text-left hover:bg-surface-hover transition-all duration-200 flex items-center justify-between group"
								>
									<div>
										<span className="font-medium group-hover:text-white transition-colors">{mod.name}</span>
										<span className="text-sm text-text-tertiary ml-2">
											{mod.questionCount} questions
										</span>
									</div>
									<span className={`text-xs px-2.5 py-1 rounded-full font-medium ${TIER_STYLES[mod.tier] || ''}`}>
										{mod.tier}
									</span>
								</button>

								{selectedModule === mod.id && (
									<div className="bg-surface-raised/60 rounded-b-xl px-4 py-3 flex gap-2 -mt-1 border-t border-border-subtle">
										<ModeButton moduleId={mod.id} mode="learn" label="Learn" />
										<ModeButton moduleId={mod.id} mode="quiz" label="Quiz" />
										<ModeButton moduleId={mod.id} mode="random-10" label="Random 10" />
									</div>
								)}
							</div>
						))}
					</div>
				</div>
			))}
		</div>
	);
}

function ModeButton({ moduleId, mode, label }: { moduleId: string; mode: string; label: string }) {
	return (
		<a
			href={`#/quiz/${moduleId}?mode=${mode}`}
			className="bg-surface-bright hover:bg-action hover:text-white text-sm px-4 py-2 rounded-lg transition-all duration-200 font-medium text-text-secondary"
		>
			{label}
		</a>
	);
}
