export class InputValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InputValidationError';
  }
}

export function parseGrade(json) {
  if (typeof json !== 'string') {
    throw new InputValidationError('채점 파일은 JSON 문자열이어야 합니다.');
  }

  let grade;
  try {
    grade = JSON.parse(json);
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    throw new InputValidationError('JSON 형식이 올바르지 않습니다.');
  }

  const validScores = (item) =>
    item !== null && typeof item === 'object' && !Array.isArray(item) &&
    Number.isFinite(item.score) && Number.isFinite(item.max_score) &&
    item.max_score >= 0 && item.score >= 0 && item.score <= item.max_score;

  if (!validScores(grade) || !Array.isArray(grade.tests) ||
      !grade.tests.every((item) =>
        validScores(item) && typeof item.name === 'string' && typeof item.reason === 'string')) {
    throw new InputValidationError('유효하지 않은 채점 파일입니다.');
  }

  return grade;
}

export function summarizeGrade(grade) {
  return {
    score: grade.score,
    maxScore: grade.max_score,
    passed: grade.tests.filter((item) => item.score === item.max_score).length,
    total: grade.tests.length,
  };
}

export function getFailedTests(grade) {
  return grade.tests.filter((item) => item.score < item.max_score);
}

export function gradeToCsv(grade) {
  const rows = [
    ['테스트 이름', '획득 점수', '배점', '결과'],
    ...grade.tests.map((item) => [
      item.name, item.score, item.max_score, item.score === item.max_score ? '통과' : '실패',
    ]),
  ];
  const escapeCell = (value) => {
    const text = String(value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return `\uFEFF${rows.map((row) => row.map(escapeCell).join(',')).join('\r\n')}\r\n`;
}

export function validateRecommendation(response) {
  if (response === null || typeof response !== 'object' || Array.isArray(response) ||
      !['feedback', 'hint', 'activity'].every((field) =>
        typeof response[field] === 'string' && response[field].trim().length > 0)) {
    throw new InputValidationError('유효하지 않은 보충 학습 추천 응답입니다.');
  }

  return response;
}
