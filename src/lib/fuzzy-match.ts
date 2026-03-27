/**
 * Normalize a string for comparison: lowercase, trim, strip diacritics, collapse whitespace.
 */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // strip diacritics
    .replace(/\s+/g, ' ');
}

/**
 * Deeper normalization for answer comparison: strips punctuation, hyphens,
 * and leading articles on top of basic normalize().
 */
export function normalizeForMatching(s: string): string {
  return normalize(s)
    .replace(/[.,']/g, '')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(the|a|an)\s+/i, '');
}

/**
 * Compute Levenshtein distance between two strings.
 */
export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }

  return dp[m][n];
}

export interface FuzzyMatchResult {
  match: boolean;
  exactMatch: boolean;
  fuzzyMatch: boolean;
  closestAnswer: string;
  distance: number;
}

/**
 * Check if a user's answer matches the correct answer, with fuzzy tolerance.
 *
 * Rules:
 * 1. Normalize both strings (lowercase, trim, strip diacritics, collapse whitespace)
 * 2. Check exact match against answer and all alternateAnswers
 * 3. If no exact match and answer length >= 5, check Levenshtein distance <= 2
 * 4. Return result with match info
 */
export function checkAnswer(
  userAnswer: string,
  correctAnswer: string,
  alternateAnswers: string[] = []
): FuzzyMatchResult {
  const normalizedUser = normalizeForMatching(userAnswer);
  const allAnswers = [correctAnswer, ...alternateAnswers];

  // Check exact matches first
  for (const ans of allAnswers) {
    if (normalizeForMatching(ans) === normalizedUser) {
      return {
        match: true,
        exactMatch: true,
        fuzzyMatch: false,
        closestAnswer: correctAnswer,
        distance: 0,
      };
    }
  }

  // Fuzzy match only for answers with length >= 5
  if (normalizedUser.length >= 5) {
    let bestDistance = Infinity;
    let bestAnswer = correctAnswer;

    for (const ans of allAnswers) {
      const d = levenshtein(normalizedUser, normalizeForMatching(ans));
      if (d < bestDistance) {
        bestDistance = d;
        bestAnswer = ans;
      }
    }

    if (bestDistance <= 2) {
      return {
        match: true,
        exactMatch: false,
        fuzzyMatch: true,
        closestAnswer: correctAnswer,
        distance: bestDistance,
      };
    }

    return {
      match: false,
      exactMatch: false,
      fuzzyMatch: false,
      closestAnswer: correctAnswer,
      distance: bestDistance,
    };
  }

  // Short answer, no exact match — fail
  return {
    match: false,
    exactMatch: false,
    fuzzyMatch: false,
    closestAnswer: correctAnswer,
    distance: levenshtein(normalizedUser, normalizeForMatching(correctAnswer)),
  };
}
