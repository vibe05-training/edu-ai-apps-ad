import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createGenerateHandler } from '../api/generate.js';
import { createLocalServer } from '../server.js';

const exampleInput = {
  assignment: '정수 목록에서 중복을 제거하고 오름차순으로 출력하기',
  test: { name: '음수', reason: '출력 불일치' },
};
const exampleOutput = {
  feedback: '음수가 포함된 결과를 확인해 보세요.',
  hint: '중복 제거 후 정렬 순서를 점검해 보세요.',
  activity: '[-1, 2, -1]을 입력하고 과제 조건에 맞는 기대 출력을 확인해 보세요.',
};
const env = {
  AI_ENDPOINT: 'https://example.invalid/openai/v1/',
  AI_API_KEY: 'test-key',
  AI_DEPLOYMENT: 'test-model',
};

async function start(t, fetchImpl, settings = env) {
  const server = createLocalServer(createGenerateHandler({ env: settings, fetchImpl }));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  return `http://127.0.0.1:${server.address().port}`;
}

function post(base, body) {
  return fetch(`${base}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

test('가상 음수 사례를 AI에 전달하고 검증된 세 항목을 반환한다', async (t) => {
  let called = false;
  const base = await start(t, async (url, options) => {
    called = true;
    assert.equal(url, 'https://example.invalid/openai/v1/chat/completions');
    const request = JSON.parse(options.body);
    assert.deepEqual(request.messages.map(({ role }) => role), ['system', 'user']);
    assert.equal(request.messages[0].content, await readFile(new URL('../api/시스템 프롬프트.txt', import.meta.url), 'utf8'));
    assert.deepEqual(JSON.parse(request.messages[1].content), exampleInput);
    assert.equal(request.model, 'test-model');
    return new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify(exampleOutput) } }],
    }), { status: 200 });
  });
  const response = await post(base, exampleInput);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), exampleOutput);
  assert.equal(called, true);
});

test('입력 누락, 추가 항목과 잘못된 JSON을 AI 호출 없이 거부한다', async (t) => {
  let calls = 0;
  const base = await start(t, async () => { calls++; throw new Error('호출되면 안 됨'); });
  for (const body of [
    { ...exampleInput, assignment: '  ' },
    { assignment: exampleInput.assignment },
    { ...exampleInput, test: { name: '음수', reason: '' } },
    { ...exampleInput, student: '금지' },
    { ...exampleInput, test: { ...exampleInput.test, code: '금지' } },
    '{',
  ]) {
    const response = await post(base, body);
    assert.equal(response.status, 400);
    assert.ok((await response.json()).error);
  }
  assert.equal(calls, 0);
});

test('AI 실패와 유효하지 않은 응답을 오류로 반환한다', async (t) => {
  let nextResponse = new Response('', { status: 500 });
  const base = await start(t, async () => nextResponse);
  let response = await post(base, exampleInput);
  assert.equal(response.status, 502);
  assert.ok((await response.json()).error);
  nextResponse = new Response(JSON.stringify({
    choices: [{ message: { content: JSON.stringify({ ...exampleOutput, hint: ' ' }) } }],
  }), { status: 200 });
  response = await post(base, exampleInput);
  assert.equal(response.status, 502);
  assert.ok((await response.json()).error);
});

test('연결 설정 누락과 잘못된 메서드는 AI 호출 없이 오류를 반환한다', async (t) => {
  let calls = 0;
  const base = await start(t, async () => { calls++; }, {});
  const response = await post(base, exampleInput);
  assert.equal(response.status, 503);
  assert.ok((await response.json()).error);
  const wrongMethod = await fetch(`${base}/api/generate`);
  assert.equal(wrongMethod.status, 405);
  assert.equal(calls, 0);
  assert.equal((await fetch(`${base}/.env.local`)).status, 404);
});
