import { LL_CATEGORIES } from '../../data/types';

export function Dashboard() {
	return (
		<div className="animate-in">
			<div className="mb-8">
				<h2 className="text-3xl font-bold tracking-tight mb-2">Categories</h2>
				<p className="text-text-secondary">Choose a topic to start practicing</p>
			</div>
			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 stagger">
				{LL_CATEGORIES.map((cat) => (
					<a
						key={cat.id}
						href={`#/node/${cat.id}`}
						className="group bg-surface-raised rounded-2xl p-6 hover:bg-surface-hover transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/8 relative overflow-hidden"
					>
						<div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl" style={{ backgroundColor: cat.color }} />
						<h3 className="text-lg font-semibold mb-1 group-hover:text-text-primary transition-colors">{cat.name}</h3>
					</a>
				))}
			</div>
		</div>
	);
}
