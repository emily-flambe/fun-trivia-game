import React, { useEffect, useState } from 'react';
import { getCategories, type CategoryInfo } from '../lib/api';

export function Dashboard() {
	const [categories, setCategories] = useState<CategoryInfo[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		getCategories()
			.then(setCategories)
			.finally(() => setLoading(false));
	}, []);

	if (loading) {
		return <div className="text-center text-slate-400 py-12">Loading categories...</div>;
	}

	return (
		<div>
			<h2 className="text-2xl font-bold mb-6">Categories</h2>
			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
				{categories.map((cat) => (
					<a
						key={cat.id}
						href={`#/category/${cat.id}`}
						className="bg-slate-800 rounded-xl p-5 border-l-4 hover:bg-slate-750 transition-colors"
						style={{ borderLeftColor: cat.color }}
					>
						<h3 className="text-lg font-semibold mb-1">{cat.name}</h3>
						<p className="text-sm text-slate-400 mb-3">{cat.moduleCount} modules</p>
						<div className="flex gap-2 text-xs">
							{cat.tiers.foundation > 0 && (
								<span className="bg-sky-900 text-sky-300 px-2 py-0.5 rounded">
									{cat.tiers.foundation} Foundation
								</span>
							)}
							{cat.tiers.core > 0 && (
								<span className="bg-slate-700 text-slate-300 px-2 py-0.5 rounded">{cat.tiers.core} Core</span>
							)}
							{cat.tiers.advanced > 0 && (
								<span className="bg-amber-900 text-amber-300 px-2 py-0.5 rounded">
									{cat.tiers.advanced} Advanced
								</span>
							)}
						</div>
					</a>
				))}
			</div>
		</div>
	);
}
