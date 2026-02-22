'use strict';

const DEFAULT_BLOCKLIST = [
  'twitter.com','x.com','reddit.com','facebook.com','instagram.com','tiktok.com',
  'youtube.com','twitch.tv','netflix.com','hulu.com','disneyplus.com',
  'primevideo.com','pinterest.com','snapchat.com','tumblr.com',
];
const DEFAULT_WORK_HOURS = { enabled: true, start: '09:00', end: '18:00', days: [1,2,3,4,5] };

// ─── Sidebar Navigation ───────────────────────────────────────────────────────
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.settings-main section').forEach(s => s.hidden = true);
    document.getElementById(`page-${btn.dataset.page}`).hidden = false;
    if (btn.dataset.page === 'fish')     loadFishPage();
    if (btn.dataset.page === 'released') loadReleasedPage();
  });
});

// ─── Load ─────────────────────────────────────────────────────────────────────
async function load() {
  const { blocklist = DEFAULT_BLOCKLIST, workHours = DEFAULT_WORK_HOURS } =
    await chrome.storage.local.get(['blocklist', 'workHours']);

  document.getElementById('wh-enabled').checked = workHours.enabled;
  document.getElementById('wh-start').value     = workHours.start;
  document.getElementById('wh-end').value       = workHours.end;
  document.getElementById('wh-config').classList.toggle('disabled', !workHours.enabled);

  for (let d = 0; d < 7; d++) {
    document.getElementById(`day-${d}`).checked = workHours.days.includes(d);
  }

  renderBlocklist(blocklist);
}

// ─── Work hours ───────────────────────────────────────────────────────────────
async function saveWorkHours() {
  const enabled = document.getElementById('wh-enabled').checked;
  const start   = document.getElementById('wh-start').value;
  const end     = document.getElementById('wh-end').value;
  const days    = [0,1,2,3,4,5,6].filter(d => document.getElementById(`day-${d}`).checked);
  await chrome.storage.local.set({ workHours: { enabled, start, end, days } });
  document.getElementById('wh-config').classList.toggle('disabled', !enabled);
  toast();
}

document.getElementById('wh-enabled').addEventListener('change', saveWorkHours);
document.getElementById('wh-start').addEventListener('change', saveWorkHours);
document.getElementById('wh-end').addEventListener('change', saveWorkHours);
for (let d = 0; d < 7; d++) {
  document.getElementById(`day-${d}`).addEventListener('change', saveWorkHours);
}

// ─── Blocklist ────────────────────────────────────────────────────────────────
function renderBlocklist(sites) {
  const ul = document.getElementById('blocklist');
  ul.innerHTML = '';
  sites.forEach(site => {
    const li = document.createElement('li');
    li.innerHTML = `<span>${site}</span><button class="remove-btn" data-site="${site}" title="Remove">×</button>`;
    ul.appendChild(li);
  });
}

document.getElementById('blocklist').addEventListener('click', async e => {
  if (!e.target.classList.contains('remove-btn')) return;
  const site = e.target.dataset.site;
  const { blocklist = DEFAULT_BLOCKLIST } = await chrome.storage.local.get('blocklist');
  const updated = blocklist.filter(s => s !== site);
  await chrome.storage.local.set({ blocklist: updated });
  renderBlocklist(updated);
  toast();
});

async function addSite() {
  const input = document.getElementById('new-site');
  const site  = input.value.trim().toLowerCase()
    .replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*$/, '');
  if (!site) return;
  const { blocklist = DEFAULT_BLOCKLIST } = await chrome.storage.local.get('blocklist');
  if (blocklist.includes(site)) { input.value = ''; return; }
  const updated = [...blocklist, site];
  await chrome.storage.local.set({ blocklist: updated });
  renderBlocklist(updated);
  input.value = '';
  toast();
}

document.getElementById('add-site-btn').addEventListener('click', addSite);
document.getElementById('new-site').addEventListener('keydown', e => { if (e.key === 'Enter') addSite(); });

// ─── Mini fish renderers (inline from shop.js) ────────────────────────────────
function miniBasic(ctx, cx, cy, s, hue) {
  const col     = `hsl(${hue},65%,45%)`;
  const dark    = `hsl(${hue},65%,33%)`;
  const shimmer = `hsla(${hue},65%,67%,0.35)`;
  ctx.save(); ctx.translate(cx, cy);
  ctx.beginPath(); ctx.moveTo(-s*.65,0); ctx.lineTo(-s*1.25,-s*.58); ctx.lineTo(-s*1.25,s*.58); ctx.closePath();
  ctx.fillStyle = dark; ctx.fill();
  ctx.beginPath(); ctx.ellipse(0,0,s,s*.52,0,0,Math.PI*2); ctx.fillStyle = col; ctx.fill();
  ctx.beginPath(); ctx.ellipse(s*.12,s*.12,s*.52,s*.22,-0.3,0,Math.PI*2); ctx.fillStyle = shimmer; ctx.fill();
  ctx.beginPath(); ctx.moveTo(-s*.05,-s*.52); ctx.quadraticCurveTo(s*.28,-s*.9,s*.62,-s*.52); ctx.fillStyle = dark; ctx.fill();
  ctx.beginPath(); ctx.arc(s*.56,-s*.07,s*.18,0,Math.PI*2); ctx.fillStyle='white'; ctx.fill();
  ctx.beginPath(); ctx.arc(s*.60,-s*.07,s*.10,0,Math.PI*2); ctx.fillStyle='#111'; ctx.fill();
  ctx.lineWidth=1.5; ctx.strokeStyle=dark;
  ctx.beginPath(); ctx.arc(s*.38,s*.04,s*.13,0.15,Math.PI-0.15,true); ctx.stroke();
  ctx.restore();
}

function miniLong(ctx, cx, cy, s, hue) {
  const col     = `hsl(${hue},65%,45%)`;
  const dark    = `hsl(${hue},65%,33%)`;
  const shimmer = `hsla(${hue},65%,67%,0.35)`;
  ctx.save(); ctx.translate(cx, cy);
  for (const sign of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(-s*.8,0); ctx.lineTo(-s*1.6,sign*s*.55); ctx.lineTo(-s*1.2,sign*s*.1); ctx.closePath();
    ctx.fillStyle=dark; ctx.fill();
  }
  ctx.beginPath(); ctx.ellipse(0,0,s*1.4,s*.38,0,0,Math.PI*2); ctx.fillStyle=col; ctx.fill();
  ctx.beginPath(); ctx.ellipse(0,0,s*1.1,s*.12,0,0,Math.PI*2); ctx.fillStyle=dark; ctx.fill();
  ctx.beginPath(); ctx.ellipse(s*.1,s*.1,s*.9,s*.16,-0.2,0,Math.PI*2); ctx.fillStyle=shimmer; ctx.fill();
  ctx.beginPath(); ctx.moveTo(-s*.3,-s*.38); ctx.quadraticCurveTo(s*.1,-s*.65,s*.5,-s*.38); ctx.fillStyle=dark; ctx.fill();
  ctx.beginPath(); ctx.arc(s*.78,-s*.06,s*.15,0,Math.PI*2); ctx.fillStyle='white'; ctx.fill();
  ctx.beginPath(); ctx.arc(s*.82,-s*.06,s*.08,0,Math.PI*2); ctx.fillStyle='#111'; ctx.fill();
  ctx.lineWidth=1.5; ctx.strokeStyle=dark;
  ctx.beginPath(); ctx.arc(s*.62,s*.04,s*.10,0.15,Math.PI-0.15,true); ctx.stroke();
  ctx.restore();
}

function miniRound(ctx, cx, cy, s, hue) {
  const col     = `hsl(${hue},65%,45%)`;
  const dark    = `hsl(${hue},65%,33%)`;
  const shimmer = `hsla(${hue},65%,67%,0.35)`;
  ctx.save(); ctx.translate(cx, cy);
  ctx.beginPath(); ctx.moveTo(-s*.65,0); ctx.lineTo(-s*1.05,-s*.42); ctx.lineTo(-s*1.05,s*.42); ctx.closePath();
  ctx.fillStyle=dark; ctx.fill();
  ctx.beginPath(); ctx.ellipse(0,0,s*.95,s*.85,0,0,Math.PI*2); ctx.fillStyle=col; ctx.fill();
  ctx.beginPath(); ctx.ellipse(s*.1,s*.18,s*.55,s*.38,-0.3,0,Math.PI*2); ctx.fillStyle=shimmer; ctx.fill();
  for (const sx of [-s*.25, s*.05, s*.38]) {
    ctx.beginPath(); ctx.moveTo(sx-s*.12,-s*.85); ctx.lineTo(sx,-s*1.15); ctx.lineTo(sx+s*.12,-s*.85); ctx.closePath();
    ctx.fillStyle=dark; ctx.fill();
  }
  ctx.beginPath(); ctx.arc(s*.48,-s*.18,s*.24,0,Math.PI*2); ctx.fillStyle='white'; ctx.fill();
  ctx.beginPath(); ctx.arc(s*.52,-s*.18,s*.14,0,Math.PI*2); ctx.fillStyle='#111'; ctx.fill();
  ctx.beginPath(); ctx.arc(s*.44,-s*.24,s*.07,0,Math.PI*2); ctx.fillStyle='rgba(255,255,255,0.65)'; ctx.fill();
  ctx.lineWidth=1.5; ctx.strokeStyle=dark;
  ctx.beginPath(); ctx.arc(s*.25,s*.18,s*.13,0.15,Math.PI-0.15,true); ctx.stroke();
  ctx.restore();
}

function drawFishPreview(canvas, type, hue, stage) {
  const ctx = canvas.getContext('2d');
  const cW = canvas.width, cH = canvas.height;
  const g = ctx.createLinearGradient(0, 0, 0, cH);
  g.addColorStop(0, 'hsl(210,68%,10%)');
  g.addColorStop(1, 'hsl(220,75%,6%)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, cW, cH);

  const cx = cW / 2, cy = cH / 2;

  // Fry: draw the unified greenish-blue teardrop
  if (stage === 'fry') {
    const s = 10;
    const col  = 'hsl(175,55%,48%)';
    const dark = 'hsl(175,55%,35%)';
    ctx.save(); ctx.translate(cx, cy);
    ctx.beginPath(); ctx.moveTo(-s*.6,0); ctx.lineTo(-s*.95,-s*.38); ctx.lineTo(-s*.95,s*.38); ctx.closePath();
    ctx.fillStyle = dark; ctx.fill();
    ctx.beginPath(); ctx.ellipse(0,0,s,s*.65,0,0,Math.PI*2); ctx.fillStyle = col; ctx.fill();
    ctx.beginPath(); ctx.arc(s*.5,-s*.1,s*.12,0,Math.PI*2); ctx.fillStyle='#111'; ctx.fill();
    ctx.restore();
    return;
  }

  // Juvenile: blend hue halfway toward fry color
  const drawHue = stage === 'juvenile' ? Math.round(175 + ((hue - 175) * 0.5)) : hue;
  const s = type === 'long' ? 16 : 18;

  if (type === 'long')       miniLong(ctx, cx, cy, s, drawHue);
  else if (type === 'round') miniRound(ctx, cx, cy, s, drawHue);
  else                       miniBasic(ctx, cx, cy, s, drawHue);
}

// ─── Fish Status Page ─────────────────────────────────────────────────────────
async function loadFishPage() {
  const { tankFish = [] } = await chrome.storage.local.get('tankFish');
  renderFishList(tankFish);
}

function renderFishList(fishArr) {
  const container = document.getElementById('fish-list');
  container.innerHTML = '';
  if (!fishArr.length) {
    container.innerHTML = '<p class="muted-text">No fish in your tank.</p>';
    return;
  }
  for (const f of fishArr) {
    container.appendChild(buildFishCard(f));
  }
}

function buildFishCard(f) {
  const card = document.createElement('div');
  card.className = 'fish-status-card';

  // Mini canvas preview
  const canvas = document.createElement('canvas');
  canvas.className = 'fish-mini-preview';
  canvas.width = 70; canvas.height = 50;
  card.appendChild(canvas);
  drawFishPreview(canvas, f.type, f.hue, f.stage);

  // Meta info
  const meta = document.createElement('div');
  meta.className = 'fish-meta';
  const typeLabel = { basic: 'Oval', long: 'Tetra', round: 'Puffer' }[f.type] ?? f.type;
  const hpPct   = f.stage === 'dead' ? 0 : Math.round(f.health);
  const hpColor = f.stage === 'dead' ? '#555' : `hsl(${hpPct * 1.2},80%,45%)`;
  meta.innerHTML = `
    <div class="fish-name">${typeLabel}</div>
    <div class="fish-stage">${f.stage}${f.stage === 'dead' ? ' ☠' : ''}</div>
    <div class="fish-hp-bar">
      <div class="fish-hp-fill" style="width:${hpPct}%; background:${hpColor};"></div>
    </div>
  `;
  card.appendChild(meta);

  // Release button
  const btn = document.createElement('button');
  btn.className = 'release-btn';
  btn.textContent = 'Release';
  btn.addEventListener('click', () => releaseFish(f.id));
  card.appendChild(btn);

  return card;
}

async function releaseFish(id) {
  const { tankFish = [], releasedFish = [] } = await chrome.storage.local.get(['tankFish', 'releasedFish']);
  const idx = tankFish.findIndex(f => f.id === id);
  if (idx === -1) return;
  const [released] = tankFish.splice(idx, 1);
  released.releasedAt = Date.now();
  releasedFish.unshift(released);
  await chrome.storage.local.set({ tankFish, releasedFish });
  loadFishPage();
  toast('Fish released into the wild!');
}

// ─── Released Fish History Page ───────────────────────────────────────────────
async function loadReleasedPage() {
  const { releasedFish = [] } = await chrome.storage.local.get('releasedFish');
  renderReleasedList(releasedFish);
}

function renderReleasedList(arr) {
  const container = document.getElementById('released-list');
  container.innerHTML = '';
  if (!arr.length) {
    container.innerHTML = '<p class="muted-text">No fish released yet.</p>';
    return;
  }
  for (const f of arr) {
    const card = document.createElement('div');
    card.className = 'released-card';

    const canvas = document.createElement('canvas');
    canvas.className = 'fish-mini-preview';
    canvas.width = 70; canvas.height = 50;
    card.appendChild(canvas);
    drawFishPreview(canvas, f.type, f.hue, f.stage);

    const meta = document.createElement('div');
    meta.className = 'fish-meta';
    const typeLabel = { basic: 'Oval', long: 'Tetra', round: 'Puffer' }[f.type] ?? f.type;
    const dateStr = f.releasedAt ? new Date(f.releasedAt).toLocaleDateString() : 'Unknown date';
    meta.innerHTML = `
      <div class="fish-name">${typeLabel}</div>
      <div class="fish-stage">${f.stage}</div>
      <div class="released-date">Released ${dateStr}</div>
    `;
    card.appendChild(meta);

    container.appendChild(card);
  }
}

// ─── Saved toast ──────────────────────────────────────────────────────────────
let toastTimer;
function toast(msg = 'Saved ✓') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
}

// ─── Init ─────────────────────────────────────────────────────────────────────
document.body.insertAdjacentHTML('beforeend', '<div id="toast"></div>');
load();
