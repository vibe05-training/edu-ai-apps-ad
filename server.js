import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { loadEnvFile } from 'node:process';
import { pathToFileURL } from 'node:url';
import generate from './api/generate.js';

const staticFiles = new Map([
  ['/', [new URL('./public/index.html', import.meta.url), 'text/html; charset=utf-8']],
  ['/index.html', [new URL('./public/index.html', import.meta.url), 'text/html; charset=utf-8']],
  ['/app.js', [new URL('./public/app.js', import.meta.url), 'text/javascript; charset=utf-8']],
  ['/validation.js', [new URL('./public/validation.js', import.meta.url), 'text/javascript; charset=utf-8']],
]);

function createRequestHandler(handler = generate) {
  return async (req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (pathname === '/api/generate') return handler(req, res);
    const file = staticFiles.get(pathname);
    if (!file) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('찾을 수 없습니다.');
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD' });
      return res.end();
    }
    try {
      const content = await readFile(file[0]);
      res.writeHead(200, { 'Content-Type': file[1], 'X-Content-Type-Options': 'nosniff' });
      return res.end(req.method === 'HEAD' ? undefined : content);
    } catch {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('화면 파일을 읽지 못했습니다.');
    }
  };
}

export default createRequestHandler();

export function createLocalServer(handler = generate) {
  return createServer(createRequestHandler(handler));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    loadEnvFile(new URL('./.env.local', import.meta.url));
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('로컬 환경변수 파일을 읽지 못했습니다.');
      process.exit(1);
    }
  }
  const port = process.env.PORT || 3000;
  const server = createLocalServer().listen(port, '127.0.0.1', () => {
    console.log(`로컬 서버가 127.0.0.1:${server.address().port}에서 실행 중입니다.`);
  });
}
