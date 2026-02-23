// ─── Settings page ─────────────────────────────────────────────────────────────

import { DEFAULT_BLOCKLIST, DEFAULT_WORK_HOURS, DEFAULT_FISH_SIZES } from '../constants';
import { drawFishPreview }                                           from '../fish-renderer';
import type { FishSnapshot, FishType }                               from '../types';

// ─── Sidebar navigation ───────────────────────────────────────────────────────

document.querySelectorAll<HTMLElement>('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll<HTMLElement>('.settings-main > section').forEach(s => (s.hidden = true));
    const page = btn.dataset['page'] ?? '';
    document.getElementById(`page-${page}`)!.hidden = false;
    if (page === 'fish')      loadFishPage();
    if (page === 'released')  loadReleasedPage();
    if (page === 'graveyard') loadGraveyardPage();
  });
});

// ─── Work hours ───────────────────────────────────────────────────────────────

async function load(): Promise<void> {
  const { blocklist = DEFAULT_BLOCKLIST, workHours = DEFAULT_WORK_HOURS } =
    await chrome.storage.local.get(['blocklist', 'workHours']) as {
      blocklist?: string[];
      workHours?: typeof DEFAULT_WORK_HOURS;
    };

  (document.getElementById('wh-enabled') as HTMLInputElement).checked = workHours.enabled;
  (document.getElementById('wh-start')   as HTMLInputElement).value   = workHours.start;
  (document.getElementById('wh-end')     as HTMLInputElement).value   = workHours.end;
  document.getElementById('wh-config')!.classList.toggle('disabled', !workHours.enabled);

  for (let d = 0; d < 7; d++) {
    (document.getElementById(`day-${d}`) as HTMLInputElement).checked = workHours.days.includes(d);
  }

  renderBlocklist(blocklist);
}

async function saveWorkHours(): Promise<void> {
  const enabled = (document.getElementById('wh-enabled') as HTMLInputElement).checked;
  const start   = (document.getElementById('wh-start')   as HTMLInputElement).value;
  const end     = (document.getElementById('wh-end')     as HTMLInputElement).value;
  const days    = [0,1,2,3,4,5,6].filter(d => (document.getElementById(`day-${d}`) as HTMLInputElement).checked);
  await chrome.storage.local.set({ workHours: { enabled, start, end, days } });
  document.getElementById('wh-config')!.classList.toggle('disabled', !enabled);
  toast();
}

document.getElementById('wh-enabled')!.addEventListener('change', saveWorkHours);
document.getElementById('wh-start')!.addEventListener('change', saveWorkHours);
document.getElementById('wh-end')!.addEventListener('change', saveWorkHours);
for (let d = 0; d < 7; d++) {
  document.getElementById(`day-${d}`)!.addEventListener('change', saveWorkHours);
}

// ─── Blocklist ────────────────────────────────────────────────────────────────

function renderBlocklist(sites: string[]): void {
  const ul = document.getElementById('blocklist')!;
  ul.innerHTML = '';
  sites.forEach(site => {
    const li = document.createElement('li');
    li.innerHTML = `<span>${site}</span><button class="remove-btn" data-site="${site}" title="Remove">×</button>`;
    ul.appendChild(li);
  });
}

document.getElementById('blocklist')!.addEventListener('click', async e => {
  const btn = (e.target as HTMLElement).closest<HTMLElement>('.remove-btn');
  if (!btn) return;
  const site = btn.dataset['site']!;
  const { blocklist = DEFAULT_BLOCKLIST } = await chrome.storage.local.get('blocklist') as { blocklist?: string[] };
  const updated = blocklist.filter(s => s !== site);
  await chrome.storage.local.set({ blocklist: updated });
  renderBlocklist(updated);
  toast();
});

async function addSite(): Promise<void> {
  const input = document.getElementById('new-site') as HTMLInputElement;
  const site  = input.value.trim().toLowerCase()
    .replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*$/, '');
  if (!site) return;
  const { blocklist = DEFAULT_BLOCKLIST } = await chrome.storage.local.get('blocklist') as { blocklist?: string[] };
  if (blocklist.includes(site)) { input.value = ''; return; }
  const updated = [...blocklist, site];
  await chrome.storage.local.set({ blocklist: updated });
  renderBlocklist(updated);
  input.value = '';
  toast();
}

document.getElementById('add-site-btn')!.addEventListener('click', addSite);
document.getElementById('new-site')!.addEventListener('keydown', e => { if (e.key === 'Enter') addSite(); });

// ─── Fish status page ─────────────────────────────────────────────────────────

async function loadFishPage(): Promise<void> {
  const { tankFish = [] } = await chrome.storage.local.get('tankFish') as { tankFish?: FishSnapshot[] };
  renderFishList(tankFish);
}

function renderFishList(fishArr: FishSnapshot[]): void {
  const container = document.getElementById('fish-list')!;
  container.innerHTML = '';
  if (!fishArr.length) { container.innerHTML = '<p class="muted-text">No fish in your tank.</p>'; return; }
  fishArr.forEach(f => container.appendChild(buildFishCard(f)));
}

function buildFishCard(f: FishSnapshot): HTMLElement {
  const card = document.createElement('div');
  card.className = 'fish-status-card';

  const canvas = document.createElement('canvas');
  canvas.className = 'fish-mini-preview';
  canvas.width = 70; canvas.height = 50;
  card.appendChild(canvas);
  drawFishPreview(canvas, f.type, f.hue, f.stage);

  const meta    = document.createElement('div');
  meta.className = 'fish-meta';
  const typeLabel = ({ basic: 'Oval', long: 'Tetra', round: 'Puffer' } as Record<string, string>)[f.type] ?? f.type;
  const hpPct     = f.stage === 'dead' ? 0 : Math.round(f.health);
  const hpColor   = f.stage === 'dead' ? '#555' : `hsl(${hpPct * 1.2},80%,45%)`;
  const ageMin    = f.bornAt ? Math.floor((Date.now() - f.bornAt) / 60000) : null;
  const ageStr    = ageMin !== null ? (ageMin < 60 ? `${ageMin}m old` : `${Math.floor(ageMin/60)}h ${ageMin%60}m old`) : '';
  meta.innerHTML  = `
    <div class="fish-name">${typeLabel}</div>
    <div class="fish-stage">${f.stage}${f.stage === 'dead' ? ' ☠' : ''}${ageStr ? ` · ${ageStr}` : ''}</div>
    <div class="fish-hp-bar"><div class="fish-hp-fill" style="width:${hpPct}%;background:${hpColor};"></div></div>
  `;
  card.appendChild(meta);

  const btn = document.createElement('button');
  btn.className   = 'release-btn';
  btn.textContent = 'Release';
  btn.addEventListener('click', () => releaseFish(f.id));
  card.appendChild(btn);

  return card;
}

async function releaseFish(id: string): Promise<void> {
  const { tankFish = [], releasedFish = [] } =
    await chrome.storage.local.get(['tankFish', 'releasedFish']) as {
      tankFish?: FishSnapshot[]; releasedFish?: FishSnapshot[];
    };
  const idx = tankFish.findIndex(f => f.id === id);
  if (idx === -1) return;
  const [released] = tankFish.splice(idx, 1);
  released.releasedAt = Date.now();
  releasedFish.unshift(released);
  await chrome.storage.local.set({ tankFish, releasedFish });
  loadFishPage();
  toast('Fish released into the wild!');
}

// ─── Released fish history page ───────────────────────────────────────────────

async function loadReleasedPage(): Promise<void> {
  const { releasedFish = [] } = await chrome.storage.local.get('releasedFish') as { releasedFish?: FishSnapshot[] };
  renderReleasedList(releasedFish);
}

function renderReleasedList(arr: FishSnapshot[]): void {
  const container = document.getElementById('released-list')!;
  container.innerHTML = '';
  if (!arr.length) { container.innerHTML = '<p class="muted-text">No fish released yet.</p>'; return; }
  for (const f of arr) {
    const card = document.createElement('div');
    card.className = 'released-card';

    const canvas = document.createElement('canvas');
    canvas.className = 'fish-mini-preview';
    canvas.width = 70; canvas.height = 50;
    card.appendChild(canvas);
    drawFishPreview(canvas, f.type, f.hue, f.stage);

    const meta    = document.createElement('div');
    meta.className = 'fish-meta';
    const typeLabel = ({ basic: 'Oval', long: 'Tetra', round: 'Puffer' } as Record<string, string>)[f.type] ?? f.type;
    const dateStr   = f.releasedAt ? new Date(f.releasedAt).toLocaleDateString() : 'Unknown date';
    meta.innerHTML  = `
      <div class="fish-name">${typeLabel}</div>
      <div class="fish-stage">${f.stage}</div>
      <div class="released-date">Released ${dateStr}</div>
    `;
    card.appendChild(meta);
    container.appendChild(card);
  }
}

// ─── Graveyard page ───────────────────────────────────────────────────────────

async function loadGraveyardPage(): Promise<void> {
  const { graveyardFish = [] } = await chrome.storage.local.get('graveyardFish') as { graveyardFish?: FishSnapshot[] };
  const container = document.getElementById('graveyard-list')!;
  container.innerHTML = '';
  if (!graveyardFish.length) { container.innerHTML = '<p class="muted-text">No fish have died yet.</p>'; return; }
  for (const f of graveyardFish) {
    const card = document.createElement('div');
    card.className = 'graveyard-card';

    const canvas = document.createElement('canvas');
    canvas.className = 'fish-mini-preview';
    canvas.width = 70; canvas.height = 50;
    card.appendChild(canvas);
    drawFishPreview(canvas, f.type, f.hue, 'dead');

    const meta = document.createElement('div');
    meta.className = 'fish-meta';
    const typeLabel = ({ basic: 'Oval', long: 'Tetra', round: 'Puffer' } as Record<string, string>)[f.type] ?? f.type;
    const diedStr   = f.diedAt  ? new Date(f.diedAt).toLocaleDateString()  : 'Unknown date';
    const ageMin    = (f.bornAt && f.diedAt) ? Math.floor((f.diedAt - f.bornAt) / 60000) : null;
    meta.innerHTML  = `
      <div class="fish-name">${typeLabel}</div>
      <div class="died-date">Died ${diedStr}${ageMin !== null ? ` · lived ${ageMin}m` : ''}</div>
    `;
    card.appendChild(meta);
    container.appendChild(card);
  }
}

// ─── Toast ────────────────────────────────────────────────────────────────────

let toastTimer: ReturnType<typeof setTimeout> | undefined;

function toast(msg = 'Saved ✓'): void {
  const el = document.getElementById('toast')!;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
}

// ─── Reset tank ───────────────────────────────────────────────────────────────

document.getElementById('reset-tank-btn')!.addEventListener('click', async () => {
  const confirmed = confirm(
    'Reset Tank — this will permanently delete all your fish, coins, and session stats.\n\nAre you sure?'
  );
  if (!confirmed) return;

  // Spawn 3 default adult fish so the tank is never empty after reset
  const now = Date.now();
  const defaultTypes: { type: FishType; hue: number; speed: number }[] = [
    { type: 'basic', hue: 155, speed: 1.2 },
    { type: 'long',  hue:  20, speed: 0.9 },
    { type: 'round', hue: 280, speed: 1.0 },
  ];
  const defaultFish: FishSnapshot[] = defaultTypes.map(({ type, hue, speed }, i) => ({
    id:         (now + i).toString(36) + Math.random().toString(36).slice(2),
    type, hue, speed,
    stage:      'adult',
    health:     80,
    maxSize:    DEFAULT_FISH_SIZES[type],
    growth:     0,
    foodGrowth: 0,
    bornAt:     now,
  }));

  await chrome.storage.local.set({
    tankFish: defaultFish, releasedFish: [], graveyardFish: [], pendingFish: [],
    coins: 0, focusScore: 70, totalFocusMinutes: 0, totalDistractedMinutes: 0,
    lastDailyClaim: 0,
  });
  toast('Tank reset. Starting fresh with 3 fish!');
});

// ─── Init ─────────────────────────────────────────────────────────────────────

document.body.insertAdjacentHTML('beforeend', '<div id="toast"></div>');
load();
