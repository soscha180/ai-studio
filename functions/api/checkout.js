// Flow: POST mode=bkash_create -> return bkashURL -> user completes on bKash
// Callback GET ?mode=bkash_callback&paymentID=...&status=success -> execute -> if statusCode==='0000' => mint Pro token -> redirect "/?pro=<token>"

const API_VER = "v1.2.0-beta";

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  if (request.method === "POST") {
    const body = await safeJson(request);
    if (body.mode === "validate") {
      // optional: keep “access code” path
      const exists = body.code && env.ENTITLEMENTS && await env.ENTITLEMENTS.get(`code:${body.code}`);
      if (exists) {
        await env.ENTITLEMENTS.put(`pro:${body.code}`, "1", { expirationTtl: 60*60*24*30 });
        return json({ valid:true, token: body.code });
      }
      return json({ valid:false }, 400);
    }

    if (body.mode === "bkash_create") {
      const id_token = await grantToken(env);
      const amount = (env.PRO_PRICE_BDT || "199").toString();
      const invoice = `${env.MERCHANT_PREFIX || "INV"}-${Date.now()}`;
      const callbackURL = `${env.SITE_ORIGIN}/api/checkout?mode=bkash_callback`;

      const { bkashURL, paymentID } = await createPayment(env, id_token, {
        amount, currency:"BDT", intent:"sale", merchantInvoiceNumber: invoice, callbackURL
      });
      if (!bkashURL || !paymentID) return json({ error:"bKash create failed" }, 500);
      return json({ bkashURL, paymentID });
    }

    return json({ error:"Unsupported mode" }, 400);
  }

  if (request.method === "GET" && url.searchParams.get("mode") === "bkash_callback") {
    const status = url.searchParams.get("status");
    const paymentID = url.searchParams.get("paymentID");
    if (status !== "success" || !paymentID) return redirect(`${env.SITE_ORIGIN}/?pro_error=${encodeURIComponent(status||"failed")}`);

    try {
      const id_token = await grantToken(env);
      const execRes = await executePayment(env, id_token, paymentID);
      if (execRes?.statusCode === "0000") {
        const token = `bk-${paymentID}`;
        await env.ENTITLEMENTS.put(`pro:${token}`, "1", { expirationTtl: 60*60*24*30 });
        return redirect(`${env.SITE_ORIGIN}/?pro=${encodeURIComponent(token)}`);
      }
      return redirect(`${env.SITE_ORIGIN}/?pro_error=${encodeURIComponent(execRes?.statusMessage || "execute_failed")}`);
    } catch {
      return redirect(`${env.SITE_ORIGIN}/?pro_error=exception`);
    }
  }
  return json({ ok:true });
}

// bKash helpers
async function grantToken(env){
  const r = await fetch(`${env.BKASH_BASE_URL}/${API_VER}/tokenized/checkout/token/grant`, {
    method:"POST",
    headers:{ accept:"application/json", "content-type":"application/json", username: env.BKASH_USERNAME, password: env.BKASH_PASSWORD },
    body: JSON.stringify({ app_key: env.BKASH_APP_KEY, app_secret: env.BKASH_APP_SECRET })
  });
  const j = await r.json(); if(!r.ok || !j?.id_token) throw new Error("grant token failed"); return j.id_token;
}
async function createPayment(env, id_token, payload){
  const r = await fetch(`${env.BKASH_BASE_URL}/${API_VER}/tokenized/checkout/create`, {
    method:"POST",
    headers:{ accept:"application/json", "content-type":"application/json", authorization: id_token, "x-app-key": env.BKASH_APP_KEY },
    body: JSON.stringify(payload)
  });
  return await r.json(); // expects { bkashURL, paymentID, ... }
}
async function executePayment(env, id_token, paymentID){
  const r = await fetch(`${env.BKASH_BASE_URL}/${API_VER}/tokenized/checkout/execute`, {
    method:"POST",
    headers:{ accept:"application/json", "content-type":"application/json", authorization: id_token, "x-app-key": env.BKASH_APP_KEY },
    body: JSON.stringify({ paymentID })
  });
  return await r.json(); // check statusCode === '0000'
}

// utils
function json(obj, status=200){ return new Response(JSON.stringify(obj), { status, headers:{ "content-type":"application/json" } }); }
async function safeJson(req){ try{ return await req.json(); }catch{ return {}; } }
function redirect(to){ return new Response(null, { status:302, headers:{ location: to } }); }
