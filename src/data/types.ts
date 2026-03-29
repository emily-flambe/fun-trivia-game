// === Exercise formats and display types ===

export type ExerciseFormat = 'text-entry' | 'fill-blanks';
export type DisplayType = 'cards' | 'periodic-table' | 'map' | 'timeline';

// === Core domain types ===

export interface Node {
  id: string;
  parentId: string | null;
  name: string;
  description: string;
  sortOrder: number;
  childCount?: number;
  exerciseCount?: number;
}

export interface Exercise {
  id: string;
  nodeId: string;
  name: string;
  description: string;
  format: ExerciseFormat;
  displayType?: DisplayType;
  config?: FillBlanksConfig;
  sortOrder: number;
  itemCount?: number;
}

export interface FillBlanksConfig {
  ordered: boolean;
  prompt: string;
}

export interface Item {
  id: string;
  exerciseId: string;
  answer: string;
  alternates: string[];
  explanation: string;
  data: TextEntryData | FillBlanksData;
  sortOrder: number;
}

export interface TextEntryData {
  prompt: string;
  cardFront?: string;
  cardBack?: string;
  imageUrl?: string;
  links?: { text: string; url: string }[];
}

export interface FillBlanksData {
  label?: string;
  links?: { text: string; url: string }[];
}

// === Answer checking ===

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

// === User types ===

export interface User {
  id: string;
  email: string;
  displayName: string;
  preferences: Record<string, unknown>;
  createdAt: string;
  lastSeenAt: string;
}

export interface QuizResult {
  id: string;
  userId: string;
  exerciseId: string;
  exerciseName: string;
  format: ExerciseFormat;
  score: number;
  total: number;
  durationSeconds: number | null;
  itemsDetail: QuizItemResult[];
  completedAt: string;
  isRetry: boolean;
  parentResultId: string | null;
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

export interface QuizItemResult {
  itemId: string;
  correct: boolean;
  userAnswer: string;
  fuzzyMatch: boolean;
}

// === Quiz result detail ===

export interface QuizResultDetailItem {
  itemId: string;
  prompt: string;
  correctAnswer: string;
  userAnswer: string;
  correct: boolean;
  fuzzyMatch: boolean;
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

// === Admin input types ===

export interface CreateExerciseInput {
  id: string;
  nodeId: string;
  name: string;
  description?: string;
  format: ExerciseFormat;
  displayType?: DisplayType;
  config?: FillBlanksConfig;
  sortOrder?: number;
  items?: CreateItemInput[];
}

export interface UpdateExerciseInput {
  name?: string;
  description?: string;
  format?: ExerciseFormat;
  displayType?: DisplayType;
  config?: FillBlanksConfig | null;
  sortOrder?: number;
}

export interface CreateItemInput {
  id: string;
  answer: string;
  alternates?: string[];
  explanation?: string;
  data?: Record<string, unknown>;
  sortOrder?: number;
}

export interface UpdateItemInput {
  answer?: string;
  alternates?: string[];
  explanation?: string;
  data?: Record<string, unknown>;
  sortOrder?: number;
}

export interface CreateNodeInput {
  id: string;
  parentId?: string | null;
  name: string;
  description?: string;
  sortOrder?: number;
}

// === Admin export types ===

export interface SeedExport {
  nodes: Array<{
    id: string;
    parentId: string | null;
    name: string;
    description: string;
  }>;
  exercises: Array<Record<string, unknown>>;
}

export interface ContentHealthReport {
  totalNodes: number;
  totalExercises: number;
  totalItems: number;
  issues: ContentHealthIssue[];
}

export interface ContentHealthIssue {
  type: 'empty-exercise' | 'orphan-exercise' | 'missing-links' | 'empty-explanation' | 'missing-prompt';
  exerciseId: string;
  itemId?: string;
  message: string;
}

// === Learned League categories ===

export interface LLCategory {
  id: string;
  name: string;
  color: string;
}

export const LL_CATEGORIES: LLCategory[] = [
  { id: 'american-history', name: 'American History', color: '#dc2626' },
  { id: 'art', name: 'Art', color: '#f59e0b' },
  { id: 'business-economics', name: 'Business/Economics', color: '#475569' },
  { id: 'classical-music', name: 'Classical Music', color: '#9333ea' },
  { id: 'current-events', name: 'Current Events', color: '#64748b' },
  { id: 'film', name: 'Film', color: '#d946ef' },
  { id: 'food-drink', name: 'Food/Drink', color: '#65a30d' },
  { id: 'games-sport', name: 'Games/Sport', color: '#ca8a04' },
  { id: 'geography', name: 'Geography', color: '#059669' },
  { id: 'language', name: 'Language', color: '#0891b2' },
  { id: 'lifestyle', name: 'Lifestyle', color: '#0d9488' },
  { id: 'literature', name: 'Literature', color: '#7c3aed' },
  { id: 'math', name: 'Math', color: '#0284c7' },
  { id: 'pop-music', name: 'Pop Music', color: '#e11d48' },
  { id: 'science', name: 'Science', color: '#2563eb' },
  { id: 'television', name: 'Television', color: '#f43f5e' },
  { id: 'theatre', name: 'Theatre', color: '#c026d3' },
  { id: 'world-history', name: 'World History', color: '#ea580c' },
];
