export async function onRequestPost({ request, env }) {
  try{ const { sessionId } = await request.json(); if (sessionId && env.HISTORY) await env.HISTORY.delete(`sess:${sessionId}`); }catch{}
  return new Response("OK");
}
