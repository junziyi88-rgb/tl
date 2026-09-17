const { main: handleInterpretation } = require('./index.cjs');

function jsonResponse(statusCode, value) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
    body: JSON.stringify(value),
  };
}

function createHttpHandler(handler = handleInterpretation) {
  return async (event = {}) => {
    if (event.httpMethod !== 'POST') {
      return jsonResponse(405, { error: '只支持 POST 请求。' });
    }

    try {
      const rawBody = event.isBase64Encoded
        ? Buffer.from(event.body || '', 'base64').toString('utf8')
        : event.body || '{}';
      if (Buffer.byteLength(rawBody, 'utf8') > 50_000) {
        return jsonResponse(413, { error: '请求内容过大。' });
      }
      return jsonResponse(200, await handler(JSON.parse(rawBody)));
    } catch {
      return jsonResponse(400, { error: '请求格式无效。' });
    }
  };
}

exports.createHttpHandler = createHttpHandler;
exports.main = createHttpHandler();
