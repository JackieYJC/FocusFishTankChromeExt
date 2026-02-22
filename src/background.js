'use strict';

const DISTRACTING_SITES = [
  'twitter.com', 'x.com', 'reddit.com', 'facebook.com',
  'instagram.com', 'tiktok.com', 'youtube.com', 'twitch.tv',
  'netflix.com', 'hulu.com', 'disneyplus.com', 'primevideo.com',
  'pinterest.com', 'snapchat.com', 'tumblr.com',
];

const TICK_SECS = 5;   // alarm interval
const DECAY    = 1.5;  // score lost per tick on a distracting site
const GAIN     = 0.4;  // score gained per tick on a focused site

// ─── Init ─────────────────────────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    focusScore: 70,
    totalFocusMinutes: 0,
    totalDistractedMinutes: 0,
    isDistracting: false,
    currentSite: '',
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

function isDistracting(url) {
  const host = getHostname(url);
  return DISTRACTING_SITES.some(s => host === s || host.endsWith('.' + s));
}

// ─── Tick ─────────────────────────────────────────────────────────────────────
chrome.alarms.onAlarm.addListener(async ({ name }) => {
  if (name !== 'tick') return;

  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab?.url) return;

  const url = tab.url;
  if (url.startsWith('chrome://') || url.startsWith('chrome-extension://')) return;

  const distracting = isDistracting(url);
  const site = getHostname(url);

  const {
    focusScore = 70,
    totalFocusMinutes = 0,
    totalDistractedMinutes = 0,
  } = await chrome.storage.local.get(['focusScore', 'totalFocusMinutes', 'totalDistractedMinutes']);

  const newScore = distracting
    ? Math.max(0,   focusScore - DECAY)
    : Math.min(100, focusScore + GAIN);

  await chrome.storage.local.set({
    focusScore: newScore,
    totalFocusMinutes:      totalFocusMinutes      + (distracting ? 0 : TICK_SECS / 60),
    totalDistractedMinutes: totalDistractedMinutes + (distracting ? TICK_SECS / 60 : 0),
    isDistracting: distracting,
    currentSite: site,
  });
});
