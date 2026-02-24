'use strict';

import { DEFAULT_BLOCKLIST, DEFAULT_WORK_HOURS, GAME_BALANCE } from './constants';
import type { WorkHours } from './types';

const { TICK_SECS, DECAY, GAIN, COIN_RATE } = GAME_BALANCE;

// ─── Init ─────────────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    focusScore:      70,
    focusSecs:       0,
    distractedSecs:  0,
    isDistracting:   false,
    currentSite:     '',
    blocklist:       DEFAULT_BLOCKLIST,
    workHours:       DEFAULT_WORK_HOURS,
    coins:           0,
    lastDailyClaim:  '',   // date string "YYYY-MM-DD"; empty = never claimed
  });
  scheduleTick();
});

chrome.runtime.onStartup.addListener(scheduleTick);

function scheduleTick(): void {
  chrome.alarms.create('tick', { periodInMinutes: TICK_SECS / 60 });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getHostname(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); }
  catch { return ''; }
}

function isDistracting(url: string, blocklist: string[]): boolean {
  const host = getHostname(url);
  return blocklist.some(s => host === s || host.endsWith('.' + s));
}

function isWithinWorkHours({ enabled, start, end, days }: WorkHours): boolean {
  if (!enabled) return true;
  const now = new Date();
  if (!days.includes(now.getDay())) return false;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const nowMins  = now.getHours() * 60 + now.getMinutes();
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
    'focusScore', 'focusSecs', 'distractedSecs',
    // legacy keys — migrate on first tick if present
    'totalFocusMinutes', 'totalDistractedMinutes',
    'blocklist', 'workHours', 'coins',
  ]);

  const blocklist = (data['blocklist'] as string[])    ?? DEFAULT_BLOCKLIST;
  const workHours = (data['workHours'] as WorkHours)   ?? DEFAULT_WORK_HOURS;

  if (!isWithinWorkHours(workHours)) return;

  const distracting = isDistracting(url, blocklist);
  const site        = getHostname(url);

  const focusScore = (data['focusScore'] as number) ?? 70;
  const coins      = (data['coins']      as number) ?? 0;

  // Migrate legacy minute counters to seconds on first tick that finds them
  const rawFocusSecs      = data['focusSecs']      as number | undefined;
  const rawDistractedSecs = data['distractedSecs'] as number | undefined;
  const legacyFocusMin    = data['totalFocusMinutes']      as number | undefined;
  const legacyDistMin     = data['totalDistractedMinutes'] as number | undefined;
  const focusSecs         = rawFocusSecs      ?? ((legacyFocusMin   ?? 0) * 60);
  const distractedSecs    = rawDistractedSecs ?? ((legacyDistMin    ?? 0) * 60);

  const newScore = distracting
    ? Math.max(0,   focusScore - DECAY)
    : Math.min(100, focusScore + GAIN);

  const coinGain = distracting ? 0 : (focusScore / 100) * COIN_RATE;
  const newCoins = Math.round((coins + coinGain) * 1000) / 1000;

  await chrome.storage.local.set({
    focusScore:     newScore,
    focusSecs:      focusSecs      + (distracting ? 0 : TICK_SECS),
    distractedSecs: distractedSecs + (distracting ? TICK_SECS : 0),
    isDistracting:  distracting,
    currentSite:    site,
    coins:          newCoins,
  });
});
