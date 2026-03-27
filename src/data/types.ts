export type Category = 'geography' | 'history' | 'science' | 'literature' | 'entertainment' | 'sports';
export type Tier = 'foundation' | 'core' | 'advanced';
export type QuestionType = 'type-in' | 'multiple-choice' | 'matching';
export type QuizMode = 'learn' | 'quiz' | 'review-mistakes' | 'random-10';

export interface BaseQuestion {
  id: string;
  moduleId: string;
  type: QuestionType;
  question: string;
  explanation: string;
}

export interface TypeInQuestion extends BaseQuestion {
  type: 'type-in';
  answer: string;
  alternateAnswers: string[];
}

export interface MultipleChoiceQuestion extends BaseQuestion {
  type: 'multiple-choice';
  options: string[];
  correctIndex: number;
}

export interface MatchingQuestion extends BaseQuestion {
  type: 'matching';
  pairs: { left: string; right: string }[];
}

export type Question = TypeInQuestion | MultipleChoiceQuestion | MatchingQuestion;

export interface QuizModule {
  id: string;
  category: Category;
  name: string;
  tier: Tier;
  description: string;
  questionType: QuestionType;
  questionCount: number;
}

export interface QuizModuleWithQuestions extends QuizModule {
  questions: Question[];
}

export interface CategoryInfo {
  id: Category;
  name: string;
  color: string;
  moduleCount: number;
  tiers: {
    foundation: number;
    core: number;
    advanced: number;
  };
}

export interface QuestionProgress {
  seen: number;
  correct: number;
  incorrect: number;
  lastSeen: string;
}

export interface ModuleProgress {
  questions: Record<string, QuestionProgress>;
}

export interface StreakData {
  currentStreak: number;
  lastActiveDate: string;
}

export interface QuizSession {
  moduleId: string;
  mode: QuizMode;
  questions: Question[];
  currentIndex: number;
  answers: SessionAnswer[];
  startedAt: string;
  status: 'in-progress' | 'complete';
}

export interface SessionAnswer {
  questionId: string;
  correct: boolean;
  userAnswer: string;
  timeSpentMs: number;
}

export interface CheckAnswerResult {
  correct: boolean;
  correctAnswer: string;
  explanation: string;
  userAnswer: string;
  fuzzyMatch: boolean;
}

// Category display metadata (static, not in DB)
export const CATEGORY_META: Record<Category, { name: string; color: string }> = {
  geography: { name: 'Geography', color: '#34d399' },
  history: { name: 'History', color: '#fbbf24' },
  science: { name: 'Science', color: '#38bdf8' },
  literature: { name: 'Literature', color: '#a78bfa' },
  entertainment: { name: 'Entertainment', color: '#f472b6' },
  sports: { name: 'Sports & Games', color: '#fb923c' },
};
