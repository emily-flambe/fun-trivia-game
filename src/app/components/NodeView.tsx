import { useEffect, useState } from 'react';
import { getNode, type NodeDetail } from '../lib/api';

export function NodeView({ path }: { path: string }) {
	const [data, setData] = useState<NodeDetail | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(false);

	useEffect(() => {
		setLoading(true);
		setError(false);
		getNode(path)
			.then(setData)
			.catch(() => setError(true))
			.finally(() => setLoading(false));
	}, [path]);

	if (loading) return <div className="text-center text-text-tertiary py-16">Loading...</div>;
	if (error || !data) return <div className="text-center text-incorrect py-16">Node not found</div>;

	const { node, children, exercises, breadcrumbs } = data;

	return (
		<div className="animate-in">
			{/* Breadcrumbs */}
			<div className="flex items-center gap-2 mb-6 text-sm">
				<a href="#/" className="text-text-tertiary hover:text-accent transition-colors">Home</a>
				{breadcrumbs.map((bc) => (
					<span key={bc.id} className="flex items-center gap-2">
						<span className="text-text-tertiary">/</span>
						<a href={`#/node/${bc.id}`} className={bc.id === node.id ? 'text-text-primary font-medium' : 'text-text-tertiary hover:text-accent transition-colors'}>
							{bc.name}
						</a>
					</span>
				))}
			</div>

			<h2 className="text-2xl font-bold tracking-tight mb-2">{node.name}</h2>
			{node.description && <p className="text-text-secondary mb-6">{node.description}</p>}

			{/* Child nodes */}
			{children.length > 0 && (
				<div className="mb-8">
					<h3 className="text-xs font-semibold uppercase tracking-widest text-text-tertiary mb-3">Subcategories</h3>
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
						{children.map((child) => (
							<a
								key={child.id}
								href={`#/node/${child.id}`}
								className="bg-surface-raised rounded-xl p-5 hover:bg-surface-hover transition-all duration-200 hover:-translate-y-0.5"
							>
								<h4 className="font-semibold mb-1">{child.name}</h4>
								{child.description && <p className="text-sm text-text-tertiary mb-2">{child.description}</p>}
								<div className="flex gap-3 text-xs text-text-tertiary">
									{(child.childCount ?? 0) > 0 && <span>{child.childCount} subcategories</span>}
									{(child.exerciseCount ?? 0) > 0 && <span>{child.exerciseCount} exercises</span>}
								</div>
							</a>
						))}
					</div>
				</div>
			)}

			{/* Exercises */}
			{exercises.length > 0 && (
				<div>
					<h3 className="text-xs font-semibold uppercase tracking-widest text-text-tertiary mb-3">Exercises</h3>
					<div className="space-y-3">
						{exercises.map((ex) => (
							<div key={ex.id} className="bg-surface-raised rounded-xl p-5">
								<div className="flex items-start justify-between gap-4 mb-2">
									<div>
										<h4 className="font-semibold">{ex.name}</h4>
										{ex.description && <p className="text-sm text-text-tertiary mt-0.5">{ex.description}</p>}
									</div>
									<div className="flex items-center gap-2 shrink-0">
										<span className="text-xs text-text-tertiary">{ex.itemCount ?? 0} items</span>
										<span className="text-xs px-2.5 py-1 rounded-full font-medium bg-surface-bright text-text-secondary">
											{ex.format}
										</span>
									</div>
								</div>
								<div className="flex gap-2 mt-3">
									<a
										href={`#/exercise/${ex.id}?mode=learn`}
										className="text-sm px-3.5 py-1.5 rounded-lg font-medium transition-all duration-200 bg-surface-bright hover:bg-surface-hover text-text-secondary border border-border-subtle"
									>
										Study
									</a>
									<a
										href={`#/exercise/${ex.id}?mode=quiz`}
										className="text-sm px-3.5 py-1.5 rounded-lg font-medium transition-all duration-200 bg-action hover:bg-action-hover text-white"
									>
										Quiz
									</a>
									{ex.format === 'text-entry' && (
										<a
											href={`#/exercise/${ex.id}?mode=grid`}
											className="text-sm px-3.5 py-1.5 rounded-lg font-medium transition-all duration-200 bg-surface-bright hover:bg-surface-hover text-text-secondary border border-border-subtle"
										>
											Grid
										</a>
									)}
								</div>
							</div>
						))}
					</div>
				</div>
			)}

			{children.length === 0 && exercises.length === 0 && (
				<div className="text-center text-text-tertiary py-8">No content yet in this category.</div>
			)}
		</div>
	);
}
