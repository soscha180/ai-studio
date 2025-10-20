const IMG_MODEL_FREE = "@cf/stabilityai/stable-diffusion-xl-base-1.0";

export async function onRequestPost({ request, env }) {
  const { prompt, sessionId, proToken } = await request.json();
  if (!prompt) return j({ error:"Missing prompt" }, 400);

  const isPro = await hasPro(proToken, env);
  const ok = await consume(env, `img:`, sessionId, isPro ? Infinity : 10);
  if (!ok) return j({ error:"Free image limit reached. Use Pro to continue." }, 429);

  const model = isPro ? (env.PRO_IMG_MODEL || IMG_MODEL_FREE) : (env.FREE_IMG_MODEL || IMG_MODEL_FREE);
  const res = await env.AI.run(model, { prompt, num_steps: 20, guidance: 7.5 }); // per model docs
  const buf = res instanceof ArrayBuffer ? res : (res.arrayBuffer ? await res.arrayBuffer() : null);
  if (!buf) return j({ error:"Image generation failed" }, 500);

  return j({ png: toB64(buf) });
}
function j(obj, status=200){ return new Response(JSON.stringify(obj), {status, headers:{ "content-type":"application/json" }}); }
function toB64(ab){ let s=""; const b=new Uint8Array(ab); for(let i=0;i<b.length;i++) s+=String.fromCharCode(b[i]); return btoa(s); }
async function hasPro(t,e){ if(!t||!e.ENTITLEMENTS) return false; return !!(await e.ENTITLEMENTS.get(`pro:${t}`)); }
async function consume(e, p, s, l){ if(!e.LIMITS||!s||!Number.isFinite(l)) return true; const k=`${p}${new Date().toISOString().slice(0,10)}:${s}`; const c=parseInt(await e.LIMITS.get(k)||"0",10); if(c>=l) return false; await e.LIMITS.put(k,String(c+1),{expirationTtl:60*60*27}); return true; }
