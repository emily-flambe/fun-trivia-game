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
	config?: {
		ordered?: boolean;
		prompt?: string;
		showAll?: boolean;
		autoRevealSeconds?: number;
		timed?: boolean;
		timeLimitSeconds?: number;
		categories?: string[];
		feedbackMode?: 'immediate' | 'end';
	};
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

export interface RandomItem {
	id: string;
	exerciseId: string;
	exerciseName: string;
	nodeId: string;
	explanation: string;
	data: Record<string, any>;
	sortOrder: number;
}

export async function getRandomItems(count = 20): Promise<RandomItem[]> {
	const res = await fetch(`${BASE}/items/random?count=${count}`);
	const data = await res.json() as { items: RandomItem[] };
	return data.items;
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

// === Auth ===

export interface AuthState {
	authenticated: boolean;
	email?: string;
	userId?: string;
	loginUrl?: string;
	logoutUrl?: string;
}

export async function getAuthMe(): Promise<AuthState> {
	const res = await fetch(`${BASE}/auth/me`);
	return res.json() as Promise<AuthState>;
}

export interface UserPreferences {
	categoryWeights: Record<string, number>;
}

export async function getUserPreferences(): Promise<UserPreferences> {
	const res = await fetch(`${BASE}/user/preferences`);
	if (!res.ok) throw new Error('Failed to fetch user preferences');
	const data = await res.json() as { preferences?: { categoryWeights?: Record<string, number> } };
	return {
		categoryWeights: data.preferences?.categoryWeights ?? {},
	};
}

export async function updateUserPreferences(preferences: UserPreferences): Promise<UserPreferences> {
	const res = await fetch(`${BASE}/user/preferences`, {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			categoryWeights: preferences.categoryWeights,
		}),
	});
	if (!res.ok) throw new Error('Failed to update user preferences');
	const data = await res.json() as { preferences?: { categoryWeights?: Record<string, number> } };
	return {
		categoryWeights: data.preferences?.categoryWeights ?? {},
	};
}

// === Quiz Results ===

export interface QuizResultPayload {
	exerciseId: string;
	exerciseName: string;
	format: string;
	score: number;
	total: number;
	durationSeconds?: number;
	itemsDetail: { itemId: string; correct: boolean; userAnswer: string; fuzzyMatch: boolean; hintsUsed?: number }[];
	isRetry?: boolean;
	parentResultId?: string;
}

export interface QuizResultResponse {
	id: string;
	exerciseId: string;
	exerciseName: string;
	format: string;
	score: number;
	total: number;
	durationSeconds: number | null;
	completedAt: string;
	isRetry: boolean;
	parentResultId: string | null;
}

export interface UserStats {
	totalQuizzes: number;
	totalCorrect: number;
	totalAttempted: number;
	exercisesCovered: number;
}

export async function submitQuizResult(payload: QuizResultPayload): Promise<QuizResultResponse> {
	const res = await fetch(`${BASE}/quiz-results`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload),
	});
	if (!res.ok) throw new Error('Failed to submit quiz result');
	return res.json() as Promise<QuizResultResponse>;
}

export async function getQuizResults(limit = 20, offset = 0): Promise<{ results: QuizResultResponse[]; total: number }> {
	const res = await fetch(`${BASE}/quiz-results?limit=${limit}&offset=${offset}`);
	if (!res.ok) throw new Error('Failed to fetch quiz results');
	return res.json() as Promise<{ results: QuizResultResponse[]; total: number }>;
}

export async function getUserStats(): Promise<UserStats> {
	const res = await fetch(`${BASE}/quiz-results/stats`);
	if (!res.ok) throw new Error('Failed to fetch stats');
	return res.json() as Promise<UserStats>;
}

export interface CategoryStat {
	category: string;
	correct: number;
	attempted: number;
}

export async function getCategoryStats(): Promise<CategoryStat[]> {
	const res = await fetch(`${BASE}/quiz-results/stats/by-category`);
	if (!res.ok) throw new Error('Failed to fetch category stats');
	const data = await res.json() as { categories: CategoryStat[] };
	return data.categories;
}

export interface QuizResultDetailItem {
	itemId: string;
	prompt: string;
	correctAnswer: string;
	userAnswer: string;
	correct: boolean;
	fuzzyMatch: boolean;
	hintsUsed?: number;
}

export interface SequenceOrderingPlacement {
	itemId: string;
	expectedPosition: number;
	userPosition: number;
	correct: boolean;
}

export interface SequenceOrderingCheckResult {
	valid: true;
	correct: boolean;
	correctCount: number;
	total: number;
	placements: SequenceOrderingPlacement[];
}

export interface ClassificationSortPlacement {
	itemId: string;
	expectedCategories: string[];
	userCategory: string;
	correct: boolean;
}

export interface ClassificationSortCheckResult {
	valid: true;
	correct: boolean;
	correctCount: number;
	total: number;
	placements: ClassificationSortPlacement[];
}

export interface QuizResultDetail {
	id: string;
	exerciseId: string;
	exerciseName: string;
	score: number;
	total: number;
	format: string;
	completedAt: string;
	items: QuizResultDetailItem[];
}

export async function getQuizResultDetail(resultId: string): Promise<QuizResultDetail> {
	const res = await fetch(`${BASE}/quiz-results/${resultId}`);
	if (!res.ok) throw new Error('Failed to fetch quiz result detail');
	return res.json() as Promise<QuizResultDetail>;
}

export interface QuizExerciseSummary {
	exerciseId: string;
	exerciseName: string;
	category: string;
	timesTaken: number;
	lastTaken: string;
	mostRecentScore: number;
	mostRecentTotal: number;
	bestScore: number;
	bestTotal: number;
}

export async function getQuizResultsByExercise(): Promise<{ exercises: QuizExerciseSummary[] }> {
	const res = await fetch(`${BASE}/quiz-results/by-exercise`);
	if (!res.ok) throw new Error('Failed to fetch exercise summaries');
	return res.json() as Promise<{ exercises: QuizExerciseSummary[] }>;
}

export async function checkAnswer(
	exercisePath: string,
	body: { itemId?: string; answer?: string; order?: string[]; assignments?: Record<string, string> }
): Promise<CheckAnswerResult | FillBlanksCheckResult | SequenceOrderingCheckResult | ClassificationSortCheckResult> {
	const res = await fetch(`${BASE}/exercises/${exercisePath}/check`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	});
	return res.json() as Promise<CheckAnswerResult | FillBlanksCheckResult | SequenceOrderingCheckResult | ClassificationSortCheckResult>;
}
