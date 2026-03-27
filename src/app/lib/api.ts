const BASE = '/api';

// === Client-side types (API response shapes) ===

export interface NodeSummary {
	id: string;
	parentId: string | null;
	name: string;
	description: string;
	sortOrder: number;
	childCount?: number;
	exerciseCount?: number;
}

export interface ExerciseSummary {
	id: string;
	nodeId: string;
	name: string;
	description: string;
	format: string;
	displayType?: string;
	config?: { ordered?: boolean; prompt?: string };
	sortOrder: number;
	itemCount?: number;
}

// Item as returned by GET /api/exercises/:path — answers stripped, explanations kept
export interface PublicItem {
	id: string;
	exerciseId: string;
	explanation: string;
	data: Record<string, any>;
	sortOrder: number;
}

export interface NodeDetail {
	node: NodeSummary;
	children: NodeSummary[];
	exercises: ExerciseSummary[];
	breadcrumbs: NodeSummary[];
}

export interface ExerciseDetail {
	exercise: ExerciseSummary;
	items: PublicItem[];
}

export interface CheckAnswerResult {
	correct: boolean;
	correctAnswer: string;
	explanation: string;
	userAnswer: string;
	fuzzyMatch: boolean;
}

export interface FillBlanksCheckResult {
	matched: boolean;
	matchedItemId?: string;
	position?: number;
	userAnswer: string;
	fuzzyMatch: boolean;
}

export async function getRootNodes(): Promise<NodeSummary[]> {
	const res = await fetch(`${BASE}/nodes`);
	const data = await res.json();
	return (data as { nodes: NodeSummary[] }).nodes;
}

export async function getNode(path: string): Promise<NodeDetail> {
	const res = await fetch(`${BASE}/nodes/${path}`);
	if (!res.ok) throw new Error('Node not found');
	return res.json() as Promise<NodeDetail>;
}

export async function getExercise(path: string): Promise<ExerciseDetail> {
	const res = await fetch(`${BASE}/exercises/${path}`);
	if (!res.ok) throw new Error('Exercise not found');
	return res.json() as Promise<ExerciseDetail>;
}

export async function getRandomExerciseId(): Promise<string> {
	const res = await fetch(`${BASE}/exercises/random`);
	const data = await res.json() as { id: string };
	return data.id;
}

export interface RevealedItem {
	id: string;
	answer: string;
	explanation: string;
	sortOrder: number;
}

export async function revealAnswers(exercisePath: string): Promise<RevealedItem[]> {
	const res = await fetch(`${BASE}/exercises/${exercisePath}/answers`);
	const data = await res.json() as { items: RevealedItem[] };
	return data.items;
}

export async function checkAnswer(
	exercisePath: string,
	body: { itemId?: string; answer: string }
): Promise<CheckAnswerResult | FillBlanksCheckResult> {
	const res = await fetch(`${BASE}/exercises/${exercisePath}/check`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	});
	return res.json() as Promise<CheckAnswerResult | FillBlanksCheckResult>;
}
