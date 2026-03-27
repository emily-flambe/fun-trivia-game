import React, { useEffect, useState } from 'react';
import { getModules, type QuizModule } from '../lib/api';

const TIER_ORDER = ['foundation', 'core', 'advanced'] as const;
const TIER_STYLES: Record<string, string> = {
	foundation: 'bg-sky-900 text-sky-300',
	core: 'bg-slate-700 text-slate-300',
	advanced: 'bg-amber-900 text-amber-300',
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
		return <div className="text-center text-slate-400 py-12">Loading modules...</div>;
	}

	const grouped = TIER_ORDER.map((tier) => ({
		tier,
		modules: modules.filter((m) => m.tier === tier),
	})).filter((g) => g.modules.length > 0);

	return (
		<div>
			<div className="flex items-center gap-3 mb-6">
				<a href="#/" className="text-slate-400 hover:text-slate-200 transition-colors">
					&larr; Back
				</a>
				<h2 className="text-2xl font-bold capitalize">{categoryId}</h2>
			</div>

			{grouped.map(({ tier, modules }) => (
				<div key={tier} className="mb-8">
					<h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-3">
						{tier}
					</h3>
					<div className="space-y-2">
						{modules.map((mod) => (
							<div key={mod.id}>
								<button
									onClick={() => setSelectedModule(selectedModule === mod.id ? null : mod.id)}
									className="w-full bg-slate-800 rounded-lg p-4 text-left hover:bg-slate-750 transition-colors flex items-center justify-between"
								>
									<div>
										<span className="font-medium">{mod.name}</span>
										<span className="text-sm text-slate-400 ml-2">
											{mod.questionCount} questions
										</span>
									</div>
									<span className={`text-xs px-2 py-0.5 rounded ${TIER_STYLES[mod.tier] || ''}`}>
										{mod.tier}
									</span>
								</button>

								{selectedModule === mod.id && (
									<div className="bg-slate-800/50 rounded-b-lg px-4 py-3 flex gap-2 border-t border-slate-700">
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
			className="bg-slate-700 hover:bg-slate-600 text-sm px-3 py-1.5 rounded transition-colors"
		>
			{label}
		</a>
	);
}
