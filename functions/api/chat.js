const MODEL_FREE = "@cf/meta/llama-3.1-8b-instruct";
const MODEL_PRO = "@cf/meta/llama-3.1-8b-instruct";
const MEMORY_TURNS = 8;
const DAILY_FREE_LIMIT = 30;

export async function onRequestPost({ request, env }) {
  const { messages = [], sessionId, proToken } = await request.json();
  if (!Array.isArray(messages) || !messages.length) return j({ error:"No messages" }, 400);

  const isPro = await hasPro(proToken, env);
  const ok = await consume(env, `chat:`, sessionId, isPro ? Infinity : DAILY_FREE_LIMIT);
  if (!ok) return j({ error:"Free limit reached. Use Pro to continue." }, 429);

  let history = [];
  if (env.HISTORY && sessionId) { try{ const raw = await env.HISTORY.get(`sess:${sessionId}`); if(raw) history = JSON.parse(raw);}catch{} }
  const trimmed = history.slice(-MEMORY_TURNS);

  const system = { role:"system", content: (env.SYSTEM_PROMPT || "You are a concise, friendly assistant.") };
  const model = isPro ? (env.PRO_MODEL || MODEL_PRO) : (env.FREE_MODEL || MODEL_FREE);

  const ai = await env.AI.run(model, { messages:[system, ...trimmed, ...messages], temperature:0.6, max_tokens:1024 });
  const reply = ai?.response || ai?.result || "(no reply)";

  if (env.HISTORY && sessionId){ try{ const updated=[...trimmed, ...messages, {role:"assistant", content:reply}];
    await env.HISTORY.put(`sess:${sessionId}`, JSON.stringify(updated), { expirationTtl: 60*60*24*2 }); }catch{} }

  return j({ reply });
}
function j(obj, status=200){ return new Response(JSON.stringify(obj), {status, headers:{ "content-type":"application/json" }}); }
async function hasPro(token, env){ if(!token||!env.ENTITLEMENTS) return false; return !!(await env.ENTITLEMENTS.get(`pro:${token}`)); }
async function consume(env, prefix, sessionId, limit){
  if (!env.LIMITS || !sessionId || !Number.isFinite(limit)) return true;
  const key = `${prefix}${new Date().toISOString().slice(0,10)}:${sessionId}`;
  const curr = parseInt(await env.LIMITS.get(key)||"0",10); if (curr>=limit) return false;
  await env.LIMITS.put(key, String(curr+1), { expirationTtl: 60*60*27 }); return true;
}
