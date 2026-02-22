'use strict';

// ─── Mini fish renderers ───────────────────────────────────────────────────────
// Standalone drawing functions — each renders a static adult fish centered on
// the given canvas context. s = half-size basis unit (matches Fish.size in popup).

function miniBasic(ctx, cx, cy, s, hue) {
  const col     = `hsl(${hue},65%,45%)`;
  const dark    = `hsl(${hue},65%,33%)`;
  const shimmer = `hsla(${hue},65%,67%,0.35)`;
  ctx.save(); ctx.translate(cx, cy);
  // Tail
  ctx.beginPath(); ctx.moveTo(-s*.65,0); ctx.lineTo(-s*1.25,-s*.58); ctx.lineTo(-s*1.25,s*.58); ctx.closePath();
  ctx.fillStyle = dark; ctx.fill();
  // Body
  ctx.beginPath(); ctx.ellipse(0,0,s,s*.52,0,0,Math.PI*2); ctx.fillStyle = col; ctx.fill();
  // Shimmer
  ctx.beginPath(); ctx.ellipse(s*.12,s*.12,s*.52,s*.22,-0.3,0,Math.PI*2); ctx.fillStyle = shimmer; ctx.fill();
  // Dorsal
  ctx.beginPath(); ctx.moveTo(-s*.05,-s*.52); ctx.quadraticCurveTo(s*.28,-s*.9,s*.62,-s*.52); ctx.fillStyle = dark; ctx.fill();
  // Eye
  ctx.beginPath(); ctx.arc(s*.56,-s*.07,s*.18,0,Math.PI*2); ctx.fillStyle='white'; ctx.fill();
  ctx.beginPath(); ctx.arc(s*.60,-s*.07,s*.10,0,Math.PI*2); ctx.fillStyle='#111'; ctx.fill();
  // Smile
  ctx.lineWidth=1.5; ctx.strokeStyle=dark;
  ctx.beginPath(); ctx.arc(s*.38,s*.04,s*.13,0.15,Math.PI-0.15,true); ctx.stroke();
  ctx.restore();
}

function miniLong(ctx, cx, cy, s, hue) {
  const col     = `hsl(${hue},65%,45%)`;
  const dark    = `hsl(${hue},65%,33%)`;
  const shimmer = `hsla(${hue},65%,67%,0.35)`;
  ctx.save(); ctx.translate(cx, cy);
  // Forked tail
  for (const sign of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(-s*.8,0); ctx.lineTo(-s*1.6,sign*s*.55); ctx.lineTo(-s*1.2,sign*s*.1); ctx.closePath();
    ctx.fillStyle=dark; ctx.fill();
  }
  // Body
  ctx.beginPath(); ctx.ellipse(0,0,s*1.4,s*.38,0,0,Math.PI*2); ctx.fillStyle=col; ctx.fill();
  // Lateral stripe
  ctx.beginPath(); ctx.ellipse(0,0,s*1.1,s*.12,0,0,Math.PI*2); ctx.fillStyle=dark; ctx.fill();
  // Shimmer
  ctx.beginPath(); ctx.ellipse(s*.1,s*.1,s*.9,s*.16,-0.2,0,Math.PI*2); ctx.fillStyle=shimmer; ctx.fill();
  // Dorsal
  ctx.beginPath(); ctx.moveTo(-s*.3,-s*.38); ctx.quadraticCurveTo(s*.1,-s*.65,s*.5,-s*.38); ctx.fillStyle=dark; ctx.fill();
  // Eye
  ctx.beginPath(); ctx.arc(s*.78,-s*.06,s*.15,0,Math.PI*2); ctx.fillStyle='white'; ctx.fill();
  ctx.beginPath(); ctx.arc(s*.82,-s*.06,s*.08,0,Math.PI*2); ctx.fillStyle='#111'; ctx.fill();
  // Smile
  ctx.lineWidth=1.5; ctx.strokeStyle=dark;
  ctx.beginPath(); ctx.arc(s*.62,s*.04,s*.10,0.15,Math.PI-0.15,true); ctx.stroke();
  ctx.restore();
}

function miniRound(ctx, cx, cy, s, hue) {
  const col     = `hsl(${hue},65%,45%)`;
  const dark    = `hsl(${hue},65%,33%)`;
  const shimmer = `hsla(${hue},65%,67%,0.35)`;
  ctx.save(); ctx.translate(cx, cy);
  // Stubby tail
  ctx.beginPath(); ctx.moveTo(-s*.65,0); ctx.lineTo(-s*1.05,-s*.42); ctx.lineTo(-s*1.05,s*.42); ctx.closePath();
  ctx.fillStyle=dark; ctx.fill();
  // Body
  ctx.beginPath(); ctx.ellipse(0,0,s*.95,s*.85,0,0,Math.PI*2); ctx.fillStyle=col; ctx.fill();
  // Shimmer
  ctx.beginPath(); ctx.ellipse(s*.1,s*.18,s*.55,s*.38,-0.3,0,Math.PI*2); ctx.fillStyle=shimmer; ctx.fill();
  // Spiky dorsal
  for (const sx of [-s*.25, s*.05, s*.38]) {
    ctx.beginPath(); ctx.moveTo(sx-s*.12,-s*.85); ctx.lineTo(sx,-s*1.15); ctx.lineTo(sx+s*.12,-s*.85); ctx.closePath();
    ctx.fillStyle=dark; ctx.fill();
  }
  // Big eye
  ctx.beginPath(); ctx.arc(s*.48,-s*.18,s*.24,0,Math.PI*2); ctx.fillStyle='white'; ctx.fill();
  ctx.beginPath(); ctx.arc(s*.52,-s*.18,s*.14,0,Math.PI*2); ctx.fillStyle='#111'; ctx.fill();
  ctx.beginPath(); ctx.arc(s*.44,-s*.24,s*.07,0,Math.PI*2); ctx.fillStyle='rgba(255,255,255,0.65)'; ctx.fill();
  // Smile
  ctx.lineWidth=1.5; ctx.strokeStyle=dark;
  ctx.beginPath(); ctx.arc(s*.25,s*.18,s*.13,0.15,Math.PI-0.15,true); ctx.stroke();
  ctx.restore();
}

// ─── Preview config ────────────────────────────────────────────────────────────
// canonical hue and scale for each type's shop card preview
const PREVIEW = {
  basic: { hue: 155, fn: miniBasic, s: 24, cx: 75, cy: 46 },
  long:  { hue:  20, fn: miniLong,  s: 19, cx: 78, cy: 46 }, // narrower s keeps elongated body in frame
  round: { hue: 280, fn: miniRound, s: 22, cx: 72, cy: 48 },
};

function renderPreviews() {
  document.querySelectorAll('.fish-preview').forEach(canvas => {
    const type = canvas.closest('.fish-card').dataset.type;
    const p    = PREVIEW[type];
    if (!p) return;
    const ctx = canvas.getContext('2d');
    // Dark water gradient background
    const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
    g.addColorStop(0, 'hsl(210,68%,10%)');
    g.addColorStop(1, 'hsl(220,75%,6%)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    p.fn(ctx, p.cx, p.cy, p.s, p.hue);
  });
}

// ─── Balance ───────────────────────────────────────────────────────────────────
let currentCoins = 0;

function updateUI(coins) {
  currentCoins = coins;
  document.getElementById('balance').textContent = Math.floor(coins);
  document.querySelectorAll('.buy-btn').forEach(btn => {
    const cost = Number(btn.dataset.cost);
    const affordable = coins >= cost;
    btn.disabled = !affordable;
    btn.closest('.fish-card').classList.toggle('unaffordable', !affordable);
  });
}

async function loadBalance() {
  const { coins = 0 } = await chrome.storage.local.get('coins');
  updateUI(coins);
}

// Live-refresh balance when popup changes storage
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.coins) {
    updateUI(changes.coins.newValue ?? 0);
  }
});

// ─── Purchase ──────────────────────────────────────────────────────────────────
async function buyFish(type, cost) {
  const { coins = 0, pendingFish = [] } = await chrome.storage.local.get(['coins', 'pendingFish']);
  if (coins < cost) { showToast('Not enough coins!', true); return; }

  const hue      = Math.floor(Math.random() * 360);
  const newCoins = Math.round((coins - cost) * 1000) / 1000;
  await chrome.storage.local.set({ coins: newCoins, pendingFish: [...pendingFish, { type, hue }] });
  updateUI(newCoins);

  const name = document.querySelector(`.fish-card[data-type="${type}"] .fish-name`).textContent;
  showToast(`${name} incoming! It'll arrive as a baby fry. 🐟`);
}

document.getElementById('shop-grid').addEventListener('click', e => {
  const btn = e.target.closest('.buy-btn');
  if (!btn || btn.disabled) return;
  buyFish(btn.dataset.type, Number(btn.dataset.cost));
});

// ─── Toast ────────────────────────────────────────────────────────────────────
let toastTimer;
function showToast(msg, isError = false) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.toggle('error', isError);
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

// ─── Init ─────────────────────────────────────────────────────────────────────
renderPreviews();
loadBalance();
