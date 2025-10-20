// Tabs
document.querySelectorAll(".tabs button").forEach(b=>{
  b.addEventListener("click", ()=>{
    document.querySelectorAll(".tabs button").forEach(x=>x.classList.remove("active"));
    document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));
    b.classList.add("active");
    document.getElementById("tab-"+b.dataset.tab).classList.add("active");
  });
});

const chatEl = document.getElementById("chat");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("prompt");
const imgPrompt = document.getElementById("imgPrompt");
const imgResult = document.getElementById("imgResult");
const upgradeLink = document.getElementById("upgradeLink");

function getSessionId(){
  let id = localStorage.getItem("ai_session_id");
  if(!id){ id = (crypto.randomUUID?.() || (Date.now()+"-"+Math.random().toString(36).slice(2))); localStorage.setItem("ai_session_id", id); }
  return id;
}
function bubble(role, text=""){ const d=document.createElement("div"); d.className=msg ${role}; d.textContent=text; chatEl.appendChild(d); chatEl.scrollTop=chatEl.scrollHeight; return d; }
async function typeInto(el, text, delay=12){ el.textContent=""; for(let i=0;i<text.length;i++){ el.textContent+=text[i]; if(i%3===0) await new Promise(r=>setTimeout(r,delay)); chatEl.scrollTop=chatEl.scrollHeight; }}

// Chat submit
chatForm.addEventListener("submit", async (e)=>{
  e.preventDefault();
  const q = chatInput.value.trim(); if(!q) return;
  chatInput.value=""; bubble("user", q);
  const aiEl = bubble("ai", "…");
  const btn = chatForm.querySelector("button"); btn.disabled=true;
  try{
    const r = await fetch("/api/chat", { method:"POST", headers:{ "content-type":"application/json" },
      body: JSON.stringify({ sessionId:getSessionId(), proToken: localStorage.getItem("ai_pro_token")||null, messages:[{role:"user", content:q}] })
    });
    const j = await r.json(); if(!r.ok) throw new Error(j.error||HTTP ${r.status});
    await typeInto(aiEl, j.reply);
  }catch(err){ aiEl.textContent="Error: "+err.message; } finally{ btn.disabled=false; }
});

// Image generation
document.getElementById("makeImage").addEventListener("click", async ()=>{
  const p = imgPrompt.value.trim(); if(!p) return;
  imgResult.textContent = "Generating…";
  try{
    const r = await fetch("/api/image", { method:"POST", headers:{ "content-type":"application/json" },
      body: JSON.stringify({ sessionId:getSessionId(), proToken: localStorage.getItem("ai_pro_token")||null, prompt:p })
    });
    const j = await r.json(); if(!r.ok) throw new Error(j.error||HTTP ${r.status});
    const img = new Image(); img.src = data:image/png;base64,${j.png}; img.alt = p;
    imgResult.innerHTML=""; imgResult.appendChild(img);
  }catch(err){ imgResult.textContent="Error: "+err.message; }
});

// “Use Pro”: access code first; if empty, start bKash
document.getElementById("usePro").addEventListener("click", async ()=>{
  const code = document.getElementById("proCode").value.trim();
  if (code) {
    const r = await fetch("/api/checkout", { method:"POST", headers:{ "content-type":"application/json" }, body: JSON.stringify({ mode:"validate", code }) });
    const j = await r.json(); if (j.valid){ localStorage.setItem("ai_pro_token", j.token); return alert("Pro enabled!"); }
    return alert("Invalid code.");
  }
  const r = await fetch("/api/checkout", { method:"POST", headers:{ "content-type":"application/json" }, body: JSON.stringify({ mode:"bkash_create" }) });
  const j = await r.json(); if(!r.ok) return alert(j.error||"bKash init failed."); window.open(j.bkashURL, "_blank");
});

// After bKash redirect
(function(){
  const p = new URLSearchParams(location.search);
  const pro = p.get("pro"); const err = p.get("pro_error");
  if (pro){ localStorage.setItem("ai_pro_token", pro); history.replaceState({}, "", location.pathname); alert("Payment successful — Pro enabled!"); }
  else if (err){ history.replaceState({}, "", location.pathname); alert("Payment failed: "+err); }
})();

// New chat
document.getElementById("newChat").addEventListener("click", async ()=>{
  const id = localStorage.getItem("ai_session_id");
  try{ await fetch("/api/reset", { method:"POST", headers:{ "content-type":"application/json" }, body: JSON.stringify({ sessionId:id }) }); }catch{}
  localStorage.removeItem("ai_session_id"); chatEl.innerHTML="";
});
upgradeLink.href = "/pricing";

