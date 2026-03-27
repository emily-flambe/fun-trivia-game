import React, { useEffect, useState, useRef } from 'react';
import { getModule, checkAnswer, type Question, type ModuleWithQuestions, type CheckResult } from '../lib/api';

interface QuizState {
	questions: Question[];
	current: number;
	answers: { questionId: string; correct: boolean; userAnswer: string; result: CheckResult }[];
	status: 'loading' | 'in-progress' | 'showing-result' | 'complete';
}

function shuffleArray<T>(arr: T[]): T[] {
	const copy = [...arr];
	for (let i = copy.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[copy[i], copy[j]] = [copy[j], copy[i]];
	}
	return copy;
}

export function QuizView({ moduleId, mode }: { moduleId: string; mode: string }) {
	const [mod, setMod] = useState<ModuleWithQuestions | null>(null);
	const [state, setState] = useState<QuizState>({
		questions: [],
		current: 0,
		answers: [],
		status: 'loading',
	});
	const [input, setInput] = useState('');
	const [currentResult, setCurrentResult] = useState<CheckResult | null>(null);
	const [checking, setChecking] = useState(false);
	const [expandedLearnItem, setExpandedLearnItem] = useState<string | null>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		getModule(moduleId).then((m) => {
			setMod(m);
			let questions = m.questions;
			if (mode === 'quiz') questions = shuffleArray(questions);
			else if (mode === 'random-10') questions = shuffleArray(questions).slice(0, 10);
			setState({ questions, current: 0, answers: [], status: questions.length > 0 ? 'in-progress' : 'complete' });
		});
	}, [moduleId, mode]);

	useEffect(() => {
		if (state.status === 'in-progress' && inputRef.current && mode !== 'learn') {
			inputRef.current.focus();
		}
	}, [state.current, state.status, mode]);

	if (state.status === 'loading' || !mod) {
		return <div className="text-center text-text-tertiary py-16">Loading...</div>;
	}

	// ─── LEARN MODE: Full reference list ───
	if (mode === 'learn') {
		return (
			<div className="animate-in">
				<div className="flex items-center gap-3 mb-6">
					<a href={`#/category/${mod.category}`} className="text-text-tertiary hover:text-text-primary transition-colors">&larr;</a>
					<div className="flex-1">
						<h2 className="text-xl font-bold tracking-tight">{mod.name}</h2>
						<p className="text-sm text-text-tertiary">{state.questions.length} items</p>
					</div>
					<a
						href={`#/quiz/${moduleId}?mode=quiz`}
						className="bg-action hover:bg-action-hover text-white px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200"
					>
						Quiz Me
					</a>
				</div>

				<div className="space-y-1">
					{state.questions.map((q, i) => (
						<div key={q.id}>
							<button
								onClick={() => setExpandedLearnItem(expandedLearnItem === q.id ? null : q.id)}
								className="w-full text-left px-4 py-3 rounded-xl hover:bg-surface-raised transition-colors flex items-baseline gap-3 group"
							>
								<span className="text-text-tertiary text-sm font-mono w-8 text-right shrink-0">
									{i + 1}
								</span>
								<span className="font-medium group-hover:text-white transition-colors">
									{q.answer}
								</span>
							</button>
							{expandedLearnItem === q.id && (
								<div className="ml-15 pl-11 pr-4 pb-3 text-sm text-text-secondary">
									{q.explanation}
								</div>
							)}
						</div>
					))}
				</div>
			</div>
		);
	}

	const question = state.questions[state.current];
	const progress = `${state.current + 1} / ${state.questions.length}`;
	const progressPct = (state.current / state.questions.length) * 100;

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!question || checking) return;
		setChecking(true);

		const result = await checkAnswer(moduleId, question.id, input);
		setCurrentResult(result);
		setState((s) => ({
			...s,
			status: 'showing-result',
			answers: [...s.answers, { questionId: question.id, correct: result.correct, userAnswer: input, result }],
		}));
		setChecking(false);
	}

	async function handleGiveUp() {
		if (!question || checking) return;
		setChecking(true);
		const result = await checkAnswer(moduleId, question.id, '');
		setCurrentResult({ ...result, correct: false });
		setState((s) => ({
			...s,
			status: 'showing-result',
			answers: [...s.answers, { questionId: question.id, correct: false, userAnswer: '(gave up)', result: { ...result, correct: false } }],
		}));
		setChecking(false);
	}

	function handleNext() {
		const nextIdx = state.current + 1;
		if (nextIdx >= state.questions.length) {
			setState((s) => ({ ...s, status: 'complete' }));
		} else {
			setState((s) => ({ ...s, current: nextIdx, status: 'in-progress' }));
			setCurrentResult(null);
			setInput('');
		}
	}

	// ─── QUIZ COMPLETE: Summary ───
	if (state.status === 'complete') {
		const correct = state.answers.filter((a) => a.correct).length;
		const total = state.answers.length;
		const wrong = state.answers.filter((a) => !a.correct);

		return (
			<div className="animate-in">
				<div className="flex items-center gap-3 mb-6">
					<a href={`#/category/${mod.category}`} className="text-text-tertiary hover:text-text-primary transition-colors">&larr; Back</a>
					<h2 className="text-2xl font-bold tracking-tight">{mod.name}</h2>
				</div>

				<div className="bg-surface-raised rounded-2xl p-8 mb-8 text-center">
					<div className="text-5xl font-extrabold mb-2 text-accent">
						{total > 0 ? `${correct} / ${total}` : 'No questions'}
					</div>
					{total > 0 && (
						<div className="text-text-secondary text-lg">
							{Math.round((correct / total) * 100)}% correct
						</div>
					)}
				</div>

				{wrong.length > 0 && (
					<div>
						<h3 className="text-lg font-semibold mb-3">Incorrect Answers</h3>
						<div className="space-y-3">
							{wrong.map((a) => {
								const q = state.questions.find((q) => q.id === a.questionId);
								return (
									<div key={a.questionId} className="bg-surface-raised rounded-xl p-5 border-l-4 border-incorrect">
										<div className="font-medium mb-1">{q?.question}</div>
										<div className="text-sm">
											<span className="text-incorrect">Your answer: {a.userAnswer}</span>
											<span className="text-border-default mx-2">|</span>
											<span className="text-correct">Correct: {a.result.correctAnswer}</span>
										</div>
										<div className="text-sm text-text-tertiary mt-1">{a.result.explanation}</div>
									</div>
								);
							})}
						</div>
					</div>
				)}

				<div className="mt-6 flex gap-3">
					<a href={`#/quiz/${moduleId}?mode=quiz`} className="bg-action hover:bg-action-hover text-white px-5 py-2.5 rounded-xl font-medium transition-all duration-200">
						Try Again
					</a>
					<a href={`#/quiz/${moduleId}?mode=learn`} className="bg-surface-bright hover:bg-surface-hover text-text-secondary px-5 py-2.5 rounded-xl font-medium transition-all duration-200">
						Study List
					</a>
					<a href={`#/category/${mod.category}`} className="bg-surface-bright hover:bg-surface-hover text-text-secondary px-5 py-2.5 rounded-xl font-medium transition-all duration-200">
						Back
					</a>
				</div>
			</div>
		);
	}

	// ─── QUIZ MODE: One question at a time ───
	return (
		<div className="animate-in">
			<div className="flex items-center gap-3 mb-4">
				<a href={`#/category/${mod.category}`} className="text-text-tertiary hover:text-text-primary transition-colors">&larr;</a>
				<h2 className="text-lg font-semibold flex-1 tracking-tight">{mod.name}</h2>
				<span className="text-sm text-text-tertiary font-medium">{progress}</span>
			</div>

			<div className="h-1 bg-border-subtle rounded-full mb-6">
				<div className="h-1 bg-gradient-to-r from-action to-accent rounded-full transition-all duration-300" style={{ width: `${progressPct}%` }} />
			</div>

			<div className="bg-surface-raised rounded-2xl p-8">
				<div className="text-lg mb-6">{question.question}</div>

				{state.status === 'showing-result' && currentResult ? (
					<div>
						<div
							className={`rounded-xl p-5 mb-4 border ${
								currentResult.correct
									? 'bg-correct-bg border-correct-border'
									: 'bg-incorrect-bg border-incorrect-border'
							}`}
						>
							<div className="font-semibold mb-1">
								{currentResult.correct ? (
									<span className="text-correct">
										Correct!{currentResult.fuzzyMatch ? ' (close enough)' : ''}
									</span>
								) : (
									<span className="text-incorrect">
										Incorrect — the answer is <span className="text-text-primary">{currentResult.correctAnswer}</span>
									</span>
								)}
							</div>
							<div className="text-sm text-text-secondary">{currentResult.explanation}</div>
						</div>
						<button onClick={handleNext} className="bg-action hover:bg-action-hover text-white px-5 py-2.5 rounded-xl font-medium transition-all duration-200">
							{state.current + 1 >= state.questions.length ? 'See Results' : 'Next'}
						</button>
					</div>
				) : (
					<div>
						<form onSubmit={handleSubmit} className="flex gap-3">
							<input
								ref={inputRef}
								type="text"
								value={input}
								onChange={(e) => setInput(e.target.value)}
								placeholder="Type your answer..."
								className="flex-1 bg-surface-bright border border-border-default rounded-xl px-4 py-3 text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all"
								autoComplete="off"
								disabled={checking}
							/>
							<button
								type="submit"
								disabled={!input.trim() || checking}
								className="bg-action hover:bg-action-hover text-white disabled:bg-surface-bright disabled:text-text-tertiary px-5 py-3 rounded-xl font-medium transition-all duration-200"
							>
								{checking ? '...' : 'Submit'}
							</button>
						</form>
						<button
							onClick={handleGiveUp}
							disabled={checking}
							className="mt-3 text-sm text-text-tertiary hover:text-accent transition-colors disabled:opacity-50"
						>
							Give up
						</button>
					</div>
				)}
			</div>
		</div>
	);
}
