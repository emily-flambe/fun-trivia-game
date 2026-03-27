const BASE = '/api';

export interface CategoryInfo {
	id: string;
	name: string;
	color: string;
	moduleCount: number;
	tiers: { foundation: number; core: number; advanced: number };
}

export interface QuizModule {
	id: string;
	category: string;
	name: string;
	tier: string;
	description: string;
	defaultFormat: string;
	questionCount: number;
}

export interface Question {
	id: string;
	moduleId: string;
	question: string;
	answer: string;
	alternateAnswers: string[];
	explanation: string;
	cardFront?: string;
	cardBack?: string;
	sortOrder: number;
	options?: string[];
	correctIndex?: number;
}

export interface ModuleWithQuestions extends QuizModule {
	questions: Question[];
}

export interface CheckResult {
	correct: boolean;
	correctAnswer: string;
	explanation: string;
	userAnswer: string;
	fuzzyMatch: boolean;
}

export async function getCategories(): Promise<CategoryInfo[]> {
	const res = await fetch(`${BASE}/categories`);
	const data = await res.json();
	return (data as { categories: CategoryInfo[] }).categories;
}

export async function getModules(category?: string, tier?: string): Promise<QuizModule[]> {
	const params = new URLSearchParams();
	if (category) params.set('category', category);
	if (tier) params.set('tier', tier);
	const res = await fetch(`${BASE}/modules?${params}`);
	const data = await res.json();
	return (data as { modules: QuizModule[] }).modules;
}

export async function getModule(moduleId: string): Promise<ModuleWithQuestions> {
	const res = await fetch(`${BASE}/modules/${moduleId}`);
	if (!res.ok) throw new Error('Module not found');
	return res.json() as Promise<ModuleWithQuestions>;
}

export async function checkAnswer(moduleId: string, questionId: string, answer: string): Promise<CheckResult> {
	const res = await fetch(`${BASE}/modules/${moduleId}/check`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ questionId, answer }),
	});
	return res.json() as Promise<CheckResult>;
}
