import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  InputValidationError,
  getFailedTests,
  gradeToCsv,
  parseGrade,
  summarizeGrade,
  validateRecommendation,
} from '../public/validation.js';

const gradeJson = readFileSync(new URL('../grade.json', import.meta.url), 'utf8');
const trainingGrade = JSON.parse(gradeJson);
const exampleRecommendation = {
  feedback: '음수가 포함된 결과를 확인해 보세요.',
  hint: '중복 제거 후 정렬 순서를 점검해 보세요.',
  activity: '[-1, 2, -1]을 입력하고 과제 조건에 맞는 기대 출력을 확인해 보세요.',
};

test('연수용 채점 결과의 점수와 통과 수를 확인한다', () => {
  const grade = parseGrade(gradeJson);
  assert.deepEqual(summarizeGrade(grade), {
    score: 80,
    maxScore: 100,
    passed: 8,
    total: 10,
  });
});

test('실패 테스트의 이름과 사유를 추린다', () => {
  assert.deepEqual(
    getFailedTests(trainingGrade).map(({ name, reason }) => ({ name, reason })),
    [
      { name: '음수', reason: '출력 불일치' },
      { name: '빈목록', reason: '실행 오류' },
    ],
  );
});

test('CSV에 연수용 테스트 전체를 원래 순서와 결과로 기록한다', () => {
  const csv = gradeToCsv(parseGrade(gradeJson));
  assert.ok(csv.startsWith('\uFEFF'));
  const rows = csv.slice(1).trimEnd().split('\r\n');
  assert.equal(rows[0], '테스트 이름,획득 점수,배점,결과');
  assert.deepEqual(rows.slice(1), trainingGrade.tests.map((item) =>
    `${item.name},${item.score},${item.max_score},${item.score === item.max_score ? '통과' : '실패'}`));
});

test('CSV에서 쉼표, 따옴표, 줄바꿈을 포함한 이름을 이스케이프한다', () => {
  const grade = { tests: [
    { name: '쉼표,따옴표"와\r\n줄바꿈', score: 0, max_score: 10 },
  ] };
  assert.equal(gradeToCsv(grade), '\uFEFF테스트 이름,획득 점수,배점,결과\r\n"쉼표,따옴표""와\r\n줄바꿈",0,10,실패\r\n');
});

test('잘못된 JSON을 입력 오류로 거부한다', () => {
  assert.throws(() => parseGrade('{'), InputValidationError);
});

for (const field of ['score', 'max_score', 'tests']) {
  test(`최상위 필수 항목 ${field} 누락을 거부한다`, () => {
    const grade = { ...trainingGrade };
    delete grade[field];
    assert.throws(() => parseGrade(JSON.stringify(grade)), InputValidationError);
  });
}

for (const field of ['name', 'score', 'max_score', 'reason']) {
  test(`테스트 필수 항목 ${field} 누락을 거부한다`, () => {
    const grade = structuredClone(trainingGrade);
    delete grade.tests[0][field];
    assert.throws(() => parseGrade(JSON.stringify(grade)), InputValidationError);
  });
}

test('피드백, 힌트, 재도전 활동이 있는 예시 응답을 허용한다', () => {
  assert.deepEqual(validateRecommendation(exampleRecommendation), exampleRecommendation);
});

for (const field of ['feedback', 'hint', 'activity']) {
  test(`추천 응답의 ${field} 누락을 거부한다`, () => {
    const response = { ...exampleRecommendation };
    delete response[field];
    assert.throws(() => validateRecommendation(response), InputValidationError);
  });

  test(`추천 응답의 빈 ${field}을 거부한다`, () => {
    const response = { ...exampleRecommendation, [field]: '  \n' };
    assert.throws(() => validateRecommendation(response), InputValidationError);
  });

  test(`추천 응답의 여러 ${field} 항목을 거부한다`, () => {
    const response = { ...exampleRecommendation, [field]: ['첫 번째', '두 번째'] };
    assert.throws(() => validateRecommendation(response), InputValidationError);
  });
}
