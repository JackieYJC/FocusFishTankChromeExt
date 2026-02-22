'use strict';

const DEFAULT_BLOCKLIST = [
  'twitter.com','x.com','reddit.com','facebook.com','instagram.com','tiktok.com',
  'youtube.com','twitch.tv','netflix.com','hulu.com','disneyplus.com',
  'primevideo.com','pinterest.com','snapchat.com','tumblr.com',
];
const DEFAULT_WORK_HOURS = { enabled: true, start: '09:00', end: '18:00', days: [1,2,3,4,5] };

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

// ─── Saved toast ──────────────────────────────────────────────────────────────
let toastTimer;
function toast() {
  const el = document.getElementById('toast');
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
}

// ─── Init ─────────────────────────────────────────────────────────────────────
document.body.insertAdjacentHTML('beforeend', '<div id="toast">Saved ✓</div>');
load();
