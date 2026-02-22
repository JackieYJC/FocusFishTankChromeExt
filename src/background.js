'use strict';

const DEFAULT_BLOCKLIST = [
  'twitter.com', 'x.com', 'reddit.com', 'facebook.com',
  'instagram.com', 'tiktok.com', 'youtube.com', 'twitch.tv',
  'netflix.com', 'hulu.com', 'disneyplus.com', 'primevideo.com',
  'pinterest.com', 'snapchat.com', 'tumblr.com',
];

const DEFAULT_WORK_HOURS = {
  enabled: true,
  start: '09:00',
  end: '18:00',
  days: [1, 2, 3, 4, 5], // Mon–Fri
};

const TICK_SECS = 5;
const DECAY    = 1.5;
const GAIN     = 0.4;

// ─── Init ─────────────────────────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    focusScore: 70,
    totalFocusMinutes: 0,
    totalDistractedMinutes: 0,
    isDistracting: false,
    currentSite: '',
    blocklist: DEFAULT_BLOCKLIST,
    workHours: DEFAULT_WORK_HOURS,
  });
  scheduleTick();
});

chrome.runtime.onStartup.addListener(scheduleTick);

function scheduleTick() {
  chrome.alarms.create('tick', { periodInMinutes: TICK_SECS / 60 });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getHostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function isDistracting(url, blocklist) {
  const host = getHostname(url);
  return blocklist.some(s => host === s || host.endsWith('.' + s));
}

function isWithinWorkHours({ enabled, start, end, days }) {
  if (!enabled) return true;
  const now = new Date();
  if (!days.includes(now.getDay())) return false;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const nowMins = now.getHours() * 60 + now.getMinutes();
  return nowMins >= sh * 60 + sm && nowMins < eh * 60 + em;
}

// ─── Tick ─────────────────────────────────────────────────────────────────────
chrome.alarms.onAlarm.addListener(async ({ name }) => {
  if (name !== 'tick') return;

  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab?.url) return;

  const url = tab.url;
  if (url.startsWith('chrome://') || url.startsWith('chrome-extension://')) return;

  const data = await chrome.storage.local.get([
    'focusScore', 'totalFocusMinutes', 'totalDistractedMinutes', 'blocklist', 'workHours',
  ]);

  const blocklist = data.blocklist ?? DEFAULT_BLOCKLIST;
  const workHours = data.workHours ?? DEFAULT_WORK_HOURS;

  if (!isWithinWorkHours(workHours)) return;

  const distracting = isDistracting(url, blocklist);
  const site        = getHostname(url);

  const focusScore           = data.focusScore           ?? 70;
  const totalFocusMinutes    = data.totalFocusMinutes    ?? 0;
  const totalDistractedMinutes = data.totalDistractedMinutes ?? 0;

  const newScore = distracting
    ? Math.max(0,   focusScore - DECAY)
    : Math.min(100, focusScore + GAIN);

  await chrome.storage.local.set({
    focusScore: newScore,
    totalFocusMinutes:       totalFocusMinutes      + (distracting ? 0 : TICK_SECS / 60),
    totalDistractedMinutes:  totalDistractedMinutes + (distracting ? TICK_SECS / 60 : 0),
    isDistracting: distracting,
    currentSite: site,
  });
});
