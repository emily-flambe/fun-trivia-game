import { useEffect, useState } from 'react';
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
		return <div className="text-center text-text-tertiary py-16">Loading categories...</div>;
	}

	return (
		<div className="animate-in">
			<div className="mb-8">
				<h2 className="text-3xl font-bold tracking-tight mb-2">Categories</h2>
				<p className="text-text-secondary">Choose a topic to start practicing</p>
			</div>
			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 stagger">
				{categories.map((cat) => (
					<a
						key={cat.id}
						href={`#/category/${cat.id}`}
						className="group bg-surface-raised rounded-2xl p-6 hover:bg-surface-hover transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/8 relative overflow-hidden"
					>
						<div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl" style={{ backgroundColor: cat.color }} />
						<h3 className="text-lg font-semibold mb-1 group-hover:text-text-primary transition-colors">{cat.name}</h3>
						<p className="text-sm text-text-tertiary mb-4">{cat.moduleCount} modules</p>
						<div className="flex flex-wrap gap-2 text-xs">
							{cat.tiers.foundation > 0 && (
								<span className="bg-action-bg text-action px-2.5 py-1 rounded-full font-medium">
									{cat.tiers.foundation} Foundation
								</span>
							)}
							{cat.tiers.core > 0 && (
								<span className="bg-surface-bright text-text-secondary px-2.5 py-1 rounded-full font-medium">
									{cat.tiers.core} Core
								</span>
							)}
							{cat.tiers.advanced > 0 && (
								<span className="bg-accent-muted text-accent px-2.5 py-1 rounded-full font-medium">
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
