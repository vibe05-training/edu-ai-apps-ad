import { readFile } from 'node:fs/promises';
import { validateRecommendation } from '../public/validation.js';

const MAX_BODY_BYTES = 16 * 1024;

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function validInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).some((key) => !['assignment', 'test'].includes(key))) return false;
  const { assignment, test } = body;
  if (!test || typeof test !== 'object' || Array.isArray(test) ||
      Object.keys(test).some((key) => !['name', 'reason'].includes(key))) return false;
  return [assignment, test.name, test.reason].every((value) =>
    typeof value === 'string' && value.trim().length > 0);
}

async function readBody(req) {
  if (req.body !== undefined) {
    const text = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    if (Buffer.byteLength(text) > MAX_BODY_BYTES) throw new RangeError('요청이 너무 큽니다.');
    return typeof req.body === 'string' ? JSON.parse(text) : req.body;
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new RangeError('요청이 너무 큽니다.');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function aiUrl(endpoint) {
  const url = new URL(endpoint);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error('유효하지 않은 AI 엔드포인트');
  }
  url.pathname = `${url.pathname.replace(/\/+$/, '')}/chat/completions`;
  return url.toString();
}

export function createGenerateHandler({ env = process.env, fetchImpl = globalThis.fetch } = {}) {
  return async function generate(req, res) {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return send(res, 405, { error: 'POST 요청만 허용됩니다.' });
    }

    let body;
    try {
      body = await readBody(req);
    } catch (error) {
      if (error instanceof SyntaxError || error instanceof RangeError) {
        return send(res, error instanceof RangeError ? 413 : 400, { error: '요청 JSON이 올바르지 않습니다.' });
      }
      return send(res, 400, { error: '요청을 읽지 못했습니다.' });
    }
    if (!validInput(body)) {
      return send(res, 400, { error: '과제 조건과 실패 항목의 이름·사유를 입력해 주세요.' });
    }

    const { AI_ENDPOINT, AI_API_KEY, AI_DEPLOYMENT } = env;
    if (![AI_ENDPOINT, AI_API_KEY, AI_DEPLOYMENT].every((value) => typeof value === 'string' && value.trim())) {
      return send(res, 503, { error: 'AI 연결이 설정되지 않았습니다.' });
    }

    let url;
    try {
      url = aiUrl(AI_ENDPOINT);
    } catch {
      return send(res, 503, { error: 'AI 연결 설정이 올바르지 않습니다.' });
    }

    let instruction;
    try {
      instruction = await readFile(new URL('./시스템 프롬프트.txt', import.meta.url), 'utf8');
      if (!instruction.trim()) throw new Error('시스템 프롬프트가 비어 있습니다.');
    } catch {
      console.error('시스템 프롬프트를 읽지 못했습니다.');
      return send(res, 500, { error: '추천 설정을 읽지 못했습니다.' });
    }

    try {
      const response = await fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'api-key': AI_API_KEY },
        body: JSON.stringify({
          model: AI_DEPLOYMENT,
          messages: [
            { role: 'system', content: instruction },
            { role: 'user', content: JSON.stringify({
              assignment: body.assignment,
              test: { name: body.test.name, reason: body.test.reason },
            }) },
          ],
          response_format: { type: 'json_object' },
        }),
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok) return send(res, 502, { error: 'AI 추천 요청에 실패했습니다. 다시 시도해 주세요.' });
      const payload = await response.json();
      const content = payload?.choices?.[0]?.message?.content;
      if (typeof content !== 'string') {
        return send(res, 502, { error: 'AI 추천 응답이 올바르지 않습니다. 다시 시도해 주세요.' });
      }
      const recommendation = validateRecommendation(JSON.parse(content));
      return send(res, 200, {
        feedback: recommendation.feedback,
        hint: recommendation.hint,
        activity: recommendation.activity,
      });
    } catch {
      return send(res, 502, { error: 'AI 추천을 처리하지 못했습니다. 다시 시도해 주세요.' });
    }
  };
}

export default createGenerateHandler();
