export const SKILL_NAMES = ['Nghe', 'Đọc', 'Nói', 'Viết'];

export function isValidScore(value, allowEmpty = true) {
  if (value === '' || value === null || value === undefined) return allowEmpty;
  if (typeof value === 'boolean' || (typeof value === 'string' && !value.trim())) return false;
  const score = Number(value);
  return Number.isFinite(score) && score >= 0 && score <= 9 && Number.isInteger(score * 2);
}

export function hasCompleteScores(gradeRow) {
  return (
    gradeRow.scores?.length === 4 && gradeRow.scores.every((value) => isValidScore(value, false))
  );
}

export function calculateAverageScore(scores) {
  if (!hasCompleteScores({ scores })) return null;
  const totalScore = scores.reduce((total, value) => total + Number(value), 0);
  return (totalScore / 4).toFixed(1);
}

export function createGradePayload(gradeRows) {
  return gradeRows.map(({ studentId, scores, note }) => ({
    studentId,
    scores: scores.map((value) =>
      value === '' || value === null || value === undefined ? '' : Number(value)
    ),
    note: note || '',
  }));
}
