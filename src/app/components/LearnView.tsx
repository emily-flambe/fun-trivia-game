import React, { useEffect, useState, useRef } from 'react';
import { getModule, type ModuleWithQuestions } from '../lib/api';

export function LearnView({ moduleId }: { moduleId: string }) {
	const [mod, setMod] = useState<ModuleWithQuestions | null>(null);
	const [current, setCurrent] = useState(0);
	const [sidebarOpen, setSidebarOpen] = useState(false);
	const activeRef = useRef<HTMLButtonElement>(null);

	useEffect(() => {
		getModule(moduleId).then(setMod);
	}, [moduleId]);

	useEffect(() => {
		if (activeRef.current) {
			activeRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
		}
	}, [current]);

	if (!mod) {
		return <div className="text-center text-text-tertiary py-16">Loading...</div>;
	}

	const questions = mod.questions;
	const question = questions[current];

	function jumpTo(idx: number) {
		setCurrent(idx);
		setSidebarOpen(false);
	}

	const sidebar = (
		<div className="flex flex-col h-full">
			<div className="px-4 py-3 border-b border-border-subtle">
				<div className="font-semibold text-sm tracking-tight truncate">{mod.name}</div>
				<div className="text-xs text-text-tertiary">{questions.length} questions</div>
			</div>
			<div className="flex-1 overflow-y-auto">
				{questions.map((q, i) => (
					<button
						key={q.id}
						ref={i === current ? activeRef : undefined}
						onClick={() => jumpTo(i)}
						className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-start gap-2.5 border-l-2 ${
							i === current
								? 'bg-surface-hover border-accent text-text-primary'
								: 'border-transparent text-text-secondary hover:bg-surface-hover hover:text-text-primary'
						}`}
					>
						<span className={`text-xs font-medium mt-0.5 shrink-0 w-5 text-right ${i === current ? 'text-accent' : 'text-text-tertiary'}`}>
							{i + 1}
						</span>
						<span className="truncate">{q.question}</span>
					</button>
				))}
			</div>
		</div>
	);

	return (
		<div className="animate-in">
			{/* Mobile header */}
			<div className="lg:hidden flex items-center gap-3 mb-4">
				<a href={`#/category/${mod.category}`} className="text-text-tertiary hover:text-text-primary transition-colors">&larr;</a>
				<h2 className="text-lg font-semibold flex-1 tracking-tight truncate">{mod.name}</h2>
				<button
					onClick={() => setSidebarOpen(!sidebarOpen)}
					className="text-sm text-text-secondary bg-surface-raised px-3 py-1.5 rounded-lg border border-border-subtle hover:bg-surface-hover transition-colors font-medium"
				>
					{current + 1} / {questions.length} &#9662;
				</button>
			</div>

			{/* Mobile sidebar dropdown */}
			{sidebarOpen && (
				<div className="lg:hidden mb-4 bg-surface-raised rounded-xl border border-border-subtle max-h-64 overflow-y-auto">
					{sidebar}
				</div>
			)}

			{/* Desktop layout */}
			<div className="flex gap-6">
				{/* Desktop sidebar */}
				<div className="hidden lg:block w-72 shrink-0">
					<div className="bg-surface-raised rounded-xl border border-border-subtle sticky top-4 max-h-[calc(100vh-6rem)] flex flex-col overflow-hidden">
						{sidebar}
					</div>
				</div>

				{/* Main content */}
				<div className="flex-1 min-w-0">
					{/* Desktop back link */}
					<div className="hidden lg:flex items-center gap-3 mb-4">
						<a href={`#/category/${mod.category}`} className="text-text-tertiary hover:text-text-primary transition-colors text-sm">&larr; Back</a>
					</div>

					<div className="bg-surface-raised rounded-2xl p-8">
						<div className="text-xs text-text-tertiary font-medium uppercase tracking-widest mb-3">
							Question {current + 1} of {questions.length}
						</div>
						<div className="text-xl font-medium mb-6">{question.question}</div>

						<div className="bg-correct-bg border border-correct-border rounded-xl p-5 mb-6">
							<div className="font-semibold text-correct mb-1">{question.answer}</div>
							<div className="text-sm text-text-secondary">{question.explanation}</div>
						</div>

						{/* Prev/Next navigation */}
						<div className="flex items-center justify-between">
							<button
								onClick={() => setCurrent(Math.max(0, current - 1))}
								disabled={current === 0}
								className="text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:text-text-tertiary disabled:cursor-default text-text-secondary hover:text-text-primary hover:bg-surface-hover"
							>
								&larr; Previous
							</button>
							<button
								onClick={() => setCurrent(Math.min(questions.length - 1, current + 1))}
								disabled={current === questions.length - 1}
								className="bg-action hover:bg-action-hover text-white disabled:bg-surface-bright disabled:text-text-tertiary text-sm font-medium px-4 py-2 rounded-lg transition-all duration-200"
							>
								Next &rarr;
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
