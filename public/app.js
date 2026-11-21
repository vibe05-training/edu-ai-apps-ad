import {
  InputValidationError,
  getFailedTests,
  gradeToCsv,
  parseGrade,
  summarizeGrade,
  validateRecommendation,
} from './validation.js';

const fileInput = document.getElementById('grade-file');
const fileError = document.getElementById('file-error');
const downloadCsv = document.getElementById('download-csv');
const gradeResults = document.getElementById('grade-results');
const gradeSummary = document.getElementById('grade-summary');
const failedOnly = document.getElementById('failed-only');
const testResults = document.getElementById('test-results');
const form = document.getElementById('condition-form');
const condition = document.getElementById('condition');
const conditionError = document.getElementById('condition-error');
const selectionError = document.getElementById('selection-error');
const recommendationError = document.getElementById('recommendation-error');
const recommendationStatus = document.getElementById('recommendation-status');
const recommendationSubmit = document.getElementById('recommendation-submit');
const confirmation = document.getElementById('confirmation');
const submittedCondition = document.getElementById('submitted-condition');
const selectedTest = document.getElementById('selected-test');
const submittedTest = document.getElementById('submitted-test');
const feedback = document.getElementById('feedback');
const hint = document.getElementById('hint');
const activity = document.getElementById('activity');

let grade = null;
let selectedFailure = null;
let fileRequest = 0;
let recommendationRequest = null;

function cancelRecommendation() {
  if (recommendationRequest) recommendationRequest.abort();
  recommendationRequest = null;
  recommendationSubmit.disabled = false;
  recommendationStatus.textContent = '';
  recommendationError.textContent = '';
  confirmation.hidden = true;
}

function failureText(item) {
  return `${item.name} — ${item.reason}`;
}

function renderTests() {
  const failures = new Set(getFailedTests(grade));
  const visibleTests = failedOnly.checked ? grade.tests.filter((item) => failures.has(item)) : grade.tests;
  testResults.replaceChildren();

  for (const item of visibleTests) {
    const row = document.createElement('tr');
    const selection = document.createElement('td');
    const failed = failures.has(item);
    if (failed) {
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'failed-test';
      radio.checked = item === selectedFailure;
      radio.setAttribute('aria-label', `${failureText(item)} 선택`);
      radio.addEventListener('change', () => {
        cancelRecommendation();
        selectedFailure = item;
        selectedTest.textContent = failureText(item);
        selectionError.textContent = '';
      });
      selection.append(radio);
    }
    row.append(selection);

    for (const [index, value] of [item.name, item.score, item.max_score, failed ? '실패' : '통과', item.reason].entries()) {
      const cell = document.createElement(index === 0 ? 'th' : 'td');
      if (index === 0) cell.scope = 'row';
      if (index === 3 && failed) cell.className = 'failure';
      cell.textContent = value;
      row.append(cell);
    }
    testResults.append(row);
  }
}

fileInput.addEventListener('change', async () => {
  const request = ++fileRequest;
  cancelRecommendation();
  grade = null;
  downloadCsv.disabled = true;
  selectedFailure = null;
  gradeResults.hidden = true;
  gradeSummary.textContent = '';
  testResults.replaceChildren();
  failedOnly.checked = false;
  selectedTest.textContent = '실패 항목을 선택해 주세요.';
  selectionError.textContent = '';
  for (const element of [submittedTest, submittedCondition, feedback, hint, activity]) {
    element.textContent = '';
  }
  fileError.textContent = '';

  const file = fileInput.files[0];
  if (!file) return;

  let json;
  try {
    json = await file.text();
  } catch (error) {
    if (request === fileRequest) {
      fileError.textContent = '파일을 읽지 못했습니다. 다시 선택해 주세요.';
      console.error('채점 파일 읽기 실패:', error);
    }
    return;
  }
  if (request !== fileRequest) return;

  try {
    grade = parseGrade(json);
  } catch (error) {
    if (!(error instanceof InputValidationError)) throw error;
    fileError.textContent = error.message;
    return;
  }

  const summary = summarizeGrade(grade);
  gradeSummary.textContent = `총점: ${summary.score}/${summary.maxScore}점 · 통과: ${summary.passed}/${summary.total}개`;
  renderTests();
  gradeResults.hidden = false;
  downloadCsv.disabled = false;
});

downloadCsv.addEventListener('click', () => {
  if (!grade) {
    fileError.textContent = '유효한 채점 파일을 먼저 선택해 주세요.';
    return;
  }
  const url = URL.createObjectURL(new Blob([gradeToCsv(grade)], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'grade-results.csv';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
});

failedOnly.addEventListener('change', () => {
  if (grade) renderTests();
});

condition.addEventListener('input', cancelRecommendation);

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  cancelRecommendation();
  conditionError.textContent = '';
  selectionError.textContent = '';
  condition.removeAttribute('aria-invalid');

  if (!condition.value.trim()) {
    conditionError.textContent = '과제 조건을 입력해 주세요.';
    condition.setAttribute('aria-invalid', 'true');
    condition.focus();
    return;
  }
  if (!selectedFailure) {
    selectionError.textContent = '실패 항목을 선택해 주세요.';
    return;
  }

  const controller = new AbortController();
  recommendationRequest = controller;
  recommendationSubmit.disabled = true;
  recommendationStatus.textContent = '추천을 생성하고 있습니다.';
  const assignment = condition.value;
  const failure = selectedFailure;

  try {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assignment,
        test: { name: failure.name, reason: failure.reason },
      }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error('추천 요청 실패');
    const recommendation = validateRecommendation(await response.json());
    if (recommendationRequest !== controller) return;
    submittedTest.textContent = failureText(failure);
    submittedCondition.textContent = assignment;
    feedback.textContent = recommendation.feedback;
    hint.textContent = recommendation.hint;
    activity.textContent = recommendation.activity;
    confirmation.hidden = false;
  } catch (error) {
    if (recommendationRequest !== controller) return;
    recommendationError.textContent = '추천을 생성하지 못했습니다. 다시 시도해 주세요.';
    console.error('추천 요청 또는 응답 검증에 실패했습니다.');
  } finally {
    if (recommendationRequest === controller) {
      recommendationRequest = null;
      recommendationSubmit.disabled = false;
      recommendationStatus.textContent = '';
    }
  }
});
