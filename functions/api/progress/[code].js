// 進度同步 API:以「學號」為 key 存在 Cloudflare KV
const headers = {
  "content-type": "application/json",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,PUT,OPTIONS",
  "access-control-allow-headers": "content-type",
};

function validCode(code) {
  return /^[A-Z2-9]{6}$/.test(code || "");
}

export async function onRequestOptions() {
  return new Response(null, { headers });
}

export async function onRequestGet({ params, env }) {
  const code = (params.code || "").toUpperCase();
  if (!validCode(code)) return new Response('{"error":"bad code"}', { status: 400, headers });
  const v = await env.PROGRESS.get("p:" + code);
  return new Response(v || "null", { headers });
}

export async function onRequestPut({ params, env, request }) {
  const code = (params.code || "").toUpperCase();
  if (!validCode(code)) return new Response('{"error":"bad code"}', { status: 400, headers });
  const body = await request.text();
  if (body.length > 200000) return new Response('{"error":"too big"}', { status: 413, headers });
  try { JSON.parse(body); } catch (e) { return new Response('{"error":"bad json"}', { status: 400, headers }); }
  await env.PROGRESS.put("p:" + code, body);
  return new Response('{"ok":true}', { headers });
}
