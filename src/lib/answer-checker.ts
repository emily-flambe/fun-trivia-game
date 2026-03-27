import type { Question, QuestionFormat, CheckAnswerResult } from '../data/types';
import { checkAnswer as fuzzyCheck } from './fuzzy-match';

/**
 * Check an answer against a question using the specified format.
 *
 * The format determines how the user's input is interpreted:
 * - text-entry: fuzzy string matching against answer + alternates
 * - multiple-choice: index comparison (planned)
 * - true-false: boolean comparison (planned)
 * - matching: pair comparison (planned)
 *
 * Every question has a canonical `answer` field (text), so text-entry
 * works for any question regardless of what other format data it carries.
 */
export function checkAnswerByFormat(
	question: Question,
	userInput: { answer?: string; answerIndex?: number },
	format: QuestionFormat
): CheckAnswerResult {
	switch (format) {
		case 'text-entry':
			return checkTextEntry(question, userInput.answer ?? '');

		case 'multiple-choice':
			return checkMultipleChoice(question, userInput.answerIndex ?? -1);

		// Future formats — stub with clear error for now
		case 'true-false':
		case 'matching':
		case 'select-many':
		case 'ordered-list':
			return {
				correct: false,
				correctAnswer: question.answer,
				explanation: question.explanation,
				userAnswer: JSON.stringify(userInput),
				fuzzyMatch: false,
			};

		default:
			return {
				correct: false,
				correctAnswer: question.answer,
				explanation: question.explanation,
				userAnswer: '',
				fuzzyMatch: false,
			};
	}
}

function checkTextEntry(question: Question, userAnswer: string): CheckAnswerResult {
	const result = fuzzyCheck(userAnswer, question.answer, question.alternateAnswers);
	return {
		correct: result.match,
		correctAnswer: question.answer,
		explanation: question.explanation,
		userAnswer,
		fuzzyMatch: result.fuzzyMatch,
	};
}

function checkMultipleChoice(question: Question, answerIndex: number): CheckAnswerResult {
	if (!question.options || question.correctIndex === undefined) {
		// Fall back to text-entry if no MC data
		return {
			correct: false,
			correctAnswer: question.answer,
			explanation: question.explanation,
			userAnswer: String(answerIndex),
			fuzzyMatch: false,
		};
	}

	const correct = answerIndex === question.correctIndex;
	return {
		correct,
		correctAnswer: question.options[question.correctIndex] ?? question.answer,
		explanation: question.explanation,
		userAnswer: question.options[answerIndex] ?? String(answerIndex),
		fuzzyMatch: false,
	};
}
