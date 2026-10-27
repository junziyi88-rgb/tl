const TENCENT_ORIGIN =
  'https://gongjian-tarot-d2geleaahb9b8605e-1484522062.tcloudbaseapp.com';

function originAllowed(origin) {
  return (
    !origin ||
    origin === TENCENT_ORIGIN ||
    /^http:\/\/(?:127\.0\.0\.1|localhost):\d+$/.test(origin)
  );
}

function responseHeaders(origin) {
  return {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...(origin
      ? {
          'access-control-allow-origin': origin,
          'access-control-allow-methods': 'POST, OPTIONS',
          'access-control-allow-headers': 'content-type',
          vary: 'Origin',
        }
      : {}),
  };
}

function json(origin, value, status = 200) {
  return Response.json(value, {
    status,
    headers: responseHeaders(origin),
  });
}

export function createFetchHandler({ handleDataRequest, handleAiRequest }) {
  return async function fetchHandler(request) {
    const origin = request.headers.get('origin') || '';
    if (!originAllowed(origin)) {
      return json('', { error: '来源无效。' }, 403);
    }
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: responseHeaders(origin),
      });
    }
    if (request.method !== 'POST') {
      return json(origin, { error: '只支持 POST 请求。' }, 405);
    }

    try {
      const body = await request.text();
      if (new TextEncoder().encode(body).byteLength > 50_000) {
        return json(origin, { error: '请求内容过大。' }, 413);
      }
      const input = JSON.parse(body || '{}');
      if (typeof input.action === 'string') {
        return json(origin, {
          data: await handleDataRequest(input.action, input.params || {}),
        });
      }
      return json(origin, await handleAiRequest(input));
    } catch {
      return json(origin, { error: '请求未能完成，请稍后重试。' }, 400);
    }
  };
}
