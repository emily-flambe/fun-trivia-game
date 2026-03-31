import { useState, useEffect, useRef, useCallback } from 'react';
import { getRootNodes, getNode, type NodeSummary, type ExerciseSummary } from '../lib/api';
import { LL_CATEGORIES } from '../../data/types';

interface SidebarProps {
	activePath: string | null;
	activeType: 'node' | 'exercise' | null;
	activeMode: string | null;
	isOpen: boolean;
	onClose: () => void;
}

interface CachedNode {
	children: NodeSummary[];
	exercises: ExerciseSummary[];
}

export function Sidebar({ activePath, activeType, activeMode, isOpen, onClose }: SidebarProps) {
	const [rootNodes, setRootNodes] = useState<NodeSummary[]>([]);
	const [expanded, setExpanded] = useState<Set<string>>(new Set());
	const [loadingSet, setLoadingSet] = useState<Set<string>>(new Set());
	const cache = useRef<Map<string, CachedNode>>(new Map());
	const inFlight = useRef<Set<string>>(new Set());
	const [, bump] = useState(0);

	// Fetch root categories on mount
	useEffect(() => {
		getRootNodes().then(setRootNodes).catch(() => {});
	}, []);

	const fetchNode = useCallback(async (nodeId: string) => {
		if (cache.current.has(nodeId) || inFlight.current.has(nodeId)) return;
		inFlight.current.add(nodeId);
		setLoadingSet(prev => new Set([...prev, nodeId]));
		try {
			const data = await getNode(nodeId);
			cache.current.set(nodeId, { children: data.children, exercises: data.exercises });
			bump(v => v + 1);
		} catch { /* node may not exist or be a leaf */ }
		finally {
			inFlight.current.delete(nodeId);
			setLoadingSet(prev => {
				const next = new Set(prev);
				next.delete(nodeId);
				return next;
			});
		}
	}, []);

	// Auto-expand tree to reveal current route
	useEffect(() => {
		if (!activePath) return;
		const parts = activePath.split('/');
		// For exercise paths, the last segment is the exercise slug — don't try to expand it as a node
		const depth = activeType === 'exercise' ? parts.length - 1 : parts.length;
		const ancestors: string[] = [];
		for (let i = 1; i <= depth; i++) {
			ancestors.push(parts.slice(0, i).join('/'));
		}
		setExpanded(prev => {
			const next = new Set(prev);
			ancestors.forEach(p => next.add(p));
			return next;
		});
		ancestors.forEach(p => fetchNode(p));
	}, [activePath, activeType, fetchNode]);

	const toggleExpand = useCallback((nodeId: string, e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setExpanded(prev => {
			const next = new Set(prev);
			if (next.has(nodeId)) {
				next.delete(nodeId);
			} else {
				next.add(nodeId);
				fetchNode(nodeId);
			}
			return next;
		});
	}, [fetchNode]);

	const getCategoryColor = (id: string): string => {
		const rootId = id.split('/')[0];
		return LL_CATEGORIES.find(c => c.id === rootId)?.color || '#8a847c';
	};

	const isInBranch = (id: string): boolean =>
		!!activePath && (activePath === id || activePath.startsWith(id + '/'));

	const isExactActive = (id: string, type: 'node' | 'exercise'): boolean =>
		!!activePath && activePath === id && activeType === type;

	function renderNode(node: NodeSummary, depth: number) {
		const isExp = expanded.has(node.id);
		const isLoading = loadingSet.has(node.id);
		const cached = cache.current.get(node.id);
		const hasContent = (node.childCount ?? 0) > 0 || (node.exerciseCount ?? 0) > 0;
		const active = isExactActive(node.id, 'node');
		const inBranch = isInBranch(node.id);

		return (
			<li key={node.id} role="treeitem" aria-expanded={hasContent ? isExp : undefined}>
				<div
					className={`group flex items-center gap-1 rounded-lg transition-colors duration-150 ${
						active
							? 'bg-accent-muted text-accent'
							: inBranch
								? 'text-text-primary'
								: 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
					}`}
					style={{ paddingLeft: `${depth * 12 + 4}px` }}
				>
					{/* Expand/collapse chevron */}
					{hasContent ? (
						<button
							onClick={(e) => toggleExpand(node.id, e)}
							className="w-6 h-6 flex items-center justify-center shrink-0 rounded text-text-tertiary hover:text-text-primary transition-colors"
							aria-label={isExp ? 'Collapse' : 'Expand'}
						>
							<svg
								className={`w-2.5 h-2.5 transition-transform duration-200 ${isExp ? 'rotate-90' : ''}`}
								viewBox="0 0 6 10"
								fill="none"
							>
								<path d="M1 1l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
							</svg>
						</button>
					) : (
						<span className="w-6 shrink-0" />
					)}

					{/* Category color dot (root level only) */}
					{depth === 0 && (
						<span
							className="w-2 h-2 rounded-full shrink-0"
							style={{ backgroundColor: getCategoryColor(node.id) }}
						/>
					)}

					{/* Node name */}
					<a
						href={`#/node/${node.id}`}
						onClick={onClose}
						className={`flex-1 py-1.5 text-[13px] truncate ${
							depth === 0 ? 'font-semibold' : 'font-medium'
						} ${active ? 'text-accent' : ''}`}
					>
						{node.name}
					</a>

					{/* Exercise count badge (collapsed only) */}
					{!isExp && (node.exerciseCount ?? 0) > 0 && (
						<span className="text-[11px] text-text-tertiary tabular-nums pr-2">
							{node.exerciseCount}
						</span>
					)}
				</div>

				{/* Expanded children */}
				{isExp && (
					<ul role="group">
						{isLoading && !cached && (
							<li
								className="text-xs text-text-tertiary py-1.5 animate-pulse"
								style={{ paddingLeft: `${(depth + 1) * 12 + 30}px` }}
							>
								Loading&hellip;
							</li>
						)}
						{cached?.children.map(child => renderNode(child, depth + 1))}
						{renderExercises(cached?.exercises ?? [], node.name, depth + 1)}
						{cached && cached.children.length === 0 && cached.exercises.length === 0 && (
							<li
								className="text-xs text-text-tertiary italic py-1"
								style={{ paddingLeft: `${(depth + 1) * 12 + 30}px` }}
							>
								No content yet
							</li>
						)}
					</ul>
				)}
			</li>
		);
	}

	function renderExercises(exercises: ExerciseSummary[], parentName: string, depth: number) {
		return exercises.flatMap(ex => {
			const showName = exercises.length > 1 || ex.name !== parentName;
			const modeDepth = showName ? depth + 1 : depth;
			const items: React.ReactNode[] = [];

			if (showName) {
				items.push(
					<li key={`${ex.id}-label`} className="pt-1">
						<span
							className="flex items-center gap-2 py-1 text-[12px] font-medium text-text-tertiary"
							style={{ paddingLeft: `${depth * 12 + 30}px` }}
						>
							{ex.name}
						</span>
					</li>
				);
			}

			items.push(renderModeLink(ex, 'learn', 'Study', modeDepth));
			items.push(renderModeLink(ex, 'quiz', 'Quiz', modeDepth));
			if (ex.format === 'text-entry') {
				items.push(renderModeLink(ex, 'grid', 'List', modeDepth));
			}
			return items;
		});
	}

	function renderModeLink(ex: ExerciseSummary, mode: string, label: string, depth: number) {
		const isActive = activePath === ex.id && activeType === 'exercise' && activeMode === mode;

		const icon = mode === 'learn' ? (
			<svg className="w-3 h-3 shrink-0 opacity-50" viewBox="0 0 16 16" fill="none">
				<path d="M2 3h5l1 1 1-1h5v10h-5l-1 1-1-1H2V3z" stroke="currentColor" strokeWidth="1.2" />
				<path d="M8 4v10" stroke="currentColor" strokeWidth="1" />
			</svg>
		) : mode === 'grid' ? (
			<svg className="w-3 h-3 shrink-0 opacity-50" viewBox="0 0 16 16" fill="none">
				<path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
			</svg>
		) : (
			<svg className="w-3 h-3 shrink-0 opacity-50" viewBox="0 0 16 16" fill="none">
				<path d="M11.5 2.5l2 2-8 8H3.5v-2l8-8z" stroke="currentColor" strokeWidth="1.2" />
			</svg>
		);

		return (
			<li key={`${ex.id}-${mode}`} role="treeitem">
				<a
					href={`#/exercise/${ex.id}?mode=${mode}`}
					onClick={onClose}
					className={`flex items-center gap-2 py-1 rounded-lg transition-colors duration-150 text-[13px] pr-2 ${
						isActive
							? 'bg-action-bg text-action font-medium'
							: 'text-text-tertiary hover:bg-surface-hover hover:text-text-secondary'
					}`}
					style={{ paddingLeft: `${depth * 12 + 30}px` }}
				>
					{icon}
					<span>{label}</span>
				</a>
			</li>
		);
	}

	return (
		<>
			{/* Mobile backdrop */}
			<div
				className={`fixed inset-0 bg-black/25 z-40 transition-opacity duration-300 md:hidden ${
					isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
				}`}
				onClick={onClose}
				aria-hidden="true"
			/>

			{/* Sidebar panel */}
			<aside
				className={`
					fixed md:static inset-y-0 left-0 z-50 md:z-auto
					w-72 md:w-64 shrink-0 overflow-hidden
					bg-surface-raised border-r border-border-subtle
					transition-transform duration-300 ease-out md:transition-none
					flex flex-col
					${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
				`}
			>
				{/* Mobile drawer header */}
				<div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle md:hidden">
					<span className="text-sm font-semibold text-text-primary">Browse Topics</span>
					<button
						onClick={onClose}
						className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-hover text-text-tertiary"
						aria-label="Close navigation"
					>
						<svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
							<path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
						</svg>
					</button>
				</div>

				{/* Scrollable tree */}
				<div className="flex-1 overflow-y-auto sidebar-scroll">
					<div className="hidden md:block px-4 pt-3 pb-1">
						<span className="text-[11px] font-semibold uppercase tracking-widest text-text-tertiary">
							Topics
						</span>
					</div>
					<nav className="px-2 pb-4" aria-label="Category navigation">
						<ul role="tree" className="space-y-px">
							{rootNodes.map(node => renderNode(node, 0))}
						</ul>
					</nav>
				</div>
			</aside>
		</>
	);
}
