const http = require('http');
const { main: handleInterpretation } = require('./index.cjs');

const port = Number(process.env.PORT || 9000);
const maxBodyBytes = 50_000;

function allowedOrigin(origin) {
  return (
    origin ===
      'https://gongjian-tarot-d2geleaahb9b8605e-1484522062.tcloudbaseapp.com' ||
    /^http:\/\/(?:127\.0\.0\.1|localhost):\d+$/.test(origin || '')
  );
}

function responseHeaders(req) {
  const origin = req.headers.origin;
  return {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...(allowedOrigin(origin)
      ? {
          'access-control-allow-origin': origin,
          'access-control-allow-methods': 'POST, OPTIONS',
          'access-control-allow-headers': 'content-type',
          vary: 'Origin',
        }
      : {}),
  };
}

function send(req, res, statusCode, value) {
  res.writeHead(statusCode, responseHeaders(req));
  res.end(JSON.stringify(value));
}

http
  .createServer((req, res) => {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, responseHeaders(req));
      res.end();
      return;
    }
    if (req.method !== 'POST') {
      send(req, res, 405, { error: '只支持 POST 请求。' });
      return;
    }

    let body = '';
    let tooLarge = false;
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body, 'utf8') > maxBodyBytes) {
        tooLarge = true;
        req.destroy();
      }
    });
    req.on('end', async () => {
      if (tooLarge) {
        send(req, res, 413, { error: '请求内容过大。' });
        return;
      }
      try {
        send(
          req,
          res,
          200,
          await handleInterpretation(JSON.parse(body || '{}')),
        );
      } catch {
        send(req, res, 400, { error: '请求格式无效。' });
      }
    });
  })
  .listen(port, '0.0.0.0');
