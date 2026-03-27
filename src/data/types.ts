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
}

export interface FillBlanksData {
  label?: string;
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
