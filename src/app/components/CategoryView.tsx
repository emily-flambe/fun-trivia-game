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
				<a href="#/" className="text-text-tertiary hover:text-accent transition-colors text-sm font-medium">
					&larr; Categories
				</a>
				<h2 className="text-2xl font-bold capitalize tracking-tight">{categoryId}</h2>
			</div>

			{grouped.map(({ tier, modules }) => (
				<div key={tier} className="mb-8">
					<h3 className="text-xs font-semibold uppercase tracking-widest text-text-tertiary mb-3">
						{tier}
					</h3>
					<div className="space-y-3">
						{modules.map((mod) => (
							<div key={mod.id} className="bg-surface-raised rounded-xl p-5">
								<div className="flex items-start justify-between gap-4 mb-2">
									<div>
										<h4 className="font-semibold">{mod.name}</h4>
										<p className="text-sm text-text-tertiary mt-0.5">{mod.description}</p>
									</div>
									<div className="flex items-center gap-2 shrink-0">
										<span className="text-xs text-text-tertiary">{mod.questionCount}q</span>
										<span className={`text-xs px-2.5 py-1 rounded-full font-medium ${TIER_STYLES[mod.tier] || ''}`}>
											{mod.tier}
										</span>
									</div>
								</div>
								<div className="flex gap-2 mt-3">
									<a
										href={`#/quiz/${mod.id}?mode=learn`}
										className="text-sm px-3.5 py-1.5 rounded-lg font-medium transition-all duration-200 bg-surface-bright hover:bg-surface-hover text-text-secondary border border-border-subtle"
									>
										Study
									</a>
									<a
										href={`#/quiz/${mod.id}?mode=quiz`}
										className="text-sm px-3.5 py-1.5 rounded-lg font-medium transition-all duration-200 bg-action hover:bg-action-hover text-white"
									>
										Quiz
									</a>
									<a
										href={`#/quiz/${mod.id}?mode=random-10`}
										className="text-sm px-3.5 py-1.5 rounded-lg font-medium transition-all duration-200 bg-surface-bright hover:bg-surface-hover text-text-secondary border border-border-subtle"
									>
										Quick 10
									</a>
								</div>
							</div>
						))}
					</div>
				</div>
			))}
		</div>
	);
}
