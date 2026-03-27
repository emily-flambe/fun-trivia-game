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
		if (state.status === 'in-progress' && inputRef.current) {
			inputRef.current.focus();
		}
	}, [state.current, state.status]);

	if (state.status === 'loading' || !mod) {
		return <div className="text-center text-slate-400 py-12">Loading quiz...</div>;
	}

	const question = state.questions[state.current];
	const isLearn = mode === 'learn';
	const progress = `${state.current + 1} / ${state.questions.length}`;
	const progressPct = ((state.current) / state.questions.length) * 100;

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

	// Quiz complete — show summary
	if (state.status === 'complete') {
		const correct = state.answers.filter((a) => a.correct).length;
		const total = state.answers.length;
		const wrong = state.answers.filter((a) => !a.correct);

		return (
			<div>
				<div className="flex items-center gap-3 mb-6">
					<a href={`#/category/${mod.category}`} className="text-slate-400 hover:text-slate-200">&larr; Back</a>
					<h2 className="text-2xl font-bold">{mod.name}</h2>
				</div>

				<div className="bg-slate-800 rounded-xl p-6 mb-6 text-center">
					<div className="text-4xl font-bold mb-2">
						{total > 0 ? `${correct} / ${total}` : 'No questions'}
					</div>
					{total > 0 && (
						<div className="text-slate-400">
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
									<div key={a.questionId} className="bg-slate-800 rounded-lg p-4 border-l-4 border-red-500">
										<div className="font-medium mb-1">{q?.question}</div>
										<div className="text-sm">
											<span className="text-red-400">Your answer: {a.userAnswer}</span>
											<span className="text-slate-500 mx-2">|</span>
											<span className="text-emerald-400">Correct: {a.result.correctAnswer}</span>
										</div>
										<div className="text-sm text-slate-400 mt-1">{a.result.explanation}</div>
									</div>
								);
							})}
						</div>
					</div>
				)}

				<div className="mt-6 flex gap-3">
					<a href={`#/quiz/${moduleId}?mode=${mode}`} className="bg-sky-600 hover:bg-sky-500 px-4 py-2 rounded transition-colors">
						Try Again
					</a>
					<a href={`#/category/${mod.category}`} className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded transition-colors">
						Back to Category
					</a>
				</div>
			</div>
		);
	}

	// Active question
	return (
		<div>
			<div className="flex items-center gap-3 mb-4">
				<a href={`#/category/${mod.category}`} className="text-slate-400 hover:text-slate-200">&larr;</a>
				<h2 className="text-lg font-semibold flex-1">{mod.name}</h2>
				<span className="text-sm text-slate-400">{progress}</span>
			</div>

			{/* Progress bar */}
			<div className="h-1 bg-slate-700 rounded-full mb-6">
				<div className="h-1 bg-sky-500 rounded-full transition-all duration-300" style={{ width: `${progressPct}%` }} />
			</div>

			<div className="bg-slate-800 rounded-xl p-6">
				<div className="text-lg mb-6">{question.question}</div>

				{isLearn ? (
					// Learn mode — show answer immediately
					<div>
						<div className="bg-emerald-900/30 border border-emerald-700 rounded-lg p-4 mb-4">
							<div className="font-semibold text-emerald-400 mb-1">{question.answer}</div>
							<div className="text-sm text-slate-300">{question.explanation}</div>
						</div>
						<button onClick={handleNext} className="bg-sky-600 hover:bg-sky-500 px-4 py-2 rounded transition-colors">
							Next
						</button>
					</div>
				) : state.status === 'showing-result' && currentResult ? (
					// Showing result after answer
					<div>
						<div
							className={`rounded-lg p-4 mb-4 border ${
								currentResult.correct
									? 'bg-emerald-900/30 border-emerald-700'
									: 'bg-red-900/30 border-red-700'
							}`}
						>
							<div className="font-semibold mb-1">
								{currentResult.correct ? (
									<span className="text-emerald-400">
										Correct!{currentResult.fuzzyMatch ? ' (close enough)' : ''}
									</span>
								) : (
									<span className="text-red-400">
										Incorrect — the answer is <span className="text-slate-100">{currentResult.correctAnswer}</span>
									</span>
								)}
							</div>
							<div className="text-sm text-slate-300">{currentResult.explanation}</div>
						</div>
						<button onClick={handleNext} className="bg-sky-600 hover:bg-sky-500 px-4 py-2 rounded transition-colors">
							{state.current + 1 >= state.questions.length ? 'See Results' : 'Next'}
						</button>
					</div>
				) : (
					// Input form
					<form onSubmit={handleSubmit} className="flex gap-2">
						<input
							ref={inputRef}
							type="text"
							value={input}
							onChange={(e) => setInput(e.target.value)}
							placeholder="Type your answer..."
							className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
							autoComplete="off"
							disabled={checking}
						/>
						<button
							type="submit"
							disabled={!input.trim() || checking}
							className="bg-sky-600 hover:bg-sky-500 disabled:bg-slate-700 disabled:text-slate-500 px-4 py-2 rounded-lg transition-colors"
						>
							{checking ? '...' : 'Submit'}
						</button>
					</form>
				)}
			</div>
		</div>
	);
}
