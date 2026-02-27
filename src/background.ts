'use strict';

import { DEFAULT_BLOCKLIST, DEFAULT_WORK_HOURS, GAME_BALANCE } from './constants';
import type { WorkHours } from './types';

const { TICK_SECS, DECAY, GAIN, SCORE_FLOOR, COIN_RATE, IDLE_COIN_RATE, PASSIVE_COIN_CAP } = GAME_BALANCE;

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
    lastFocusDate:   '',   // date string "YYYY-MM-DD"; resets daily counters at midnight
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
    'blocklist', 'workHours', 'coins', 'lastFocusDate',
    'isDistracting', 'focusTicksSinceNotif',
  ]);

  const blocklist            = (data['blocklist']            as string[])  ?? DEFAULT_BLOCKLIST;
  const workHours            = (data['workHours']            as WorkHours) ?? DEFAULT_WORK_HOURS;
  const lastFocusDate        = (data['lastFocusDate']        as string)    ?? '';
  const prevIsDistracting    = (data['isDistracting']        as boolean)   ?? false;
  const focusTicksSinceNotif = (data['focusTicksSinceNotif'] as number)    ?? 0;
  const today                = new Date().toLocaleDateString('en-CA'); // "YYYY-MM-DD"

  const distracting = isDistracting(url, blocklist);
  const site        = getHostname(url);

  // Migrate legacy minute counters to seconds on first tick that finds them
  const rawFocusSecs      = data['focusSecs']               as number | undefined;
  const rawDistractedSecs = data['distractedSecs']          as number | undefined;
  const legacyFocusMin    = data['totalFocusMinutes']       as number | undefined;
  const legacyDistMin     = data['totalDistractedMinutes']  as number | undefined;
  let   focusSecs         = rawFocusSecs      ?? ((legacyFocusMin  ?? 0) * 60);
  let   distractedSecs    = rawDistractedSecs ?? ((legacyDistMin   ?? 0) * 60);

  // Daily reset at midnight: clear counters when calendar day rolls over
  if (lastFocusDate !== today) {
    focusSecs    = 0;
    distractedSecs = 0;
  }

  const newFocusSecs    = focusSecs      + (distracting ? 0        : TICK_SECS);
  const newDistractSecs = distractedSecs + (distracting ? TICK_SECS : 0);

  // ── Distraction alert ─────────────────────────────────────────────────────
  // Fires once when the user first lands on a blocked site.
  // Runs BEFORE the work-hours gate so it always triggers, even outside work hours.
  if (!prevIsDistracting && distracting) {
    chrome.notifications.create('distraction', {
      type:    'basic',
      iconUrl: 'icons/icon48.png',
      title:   'Distraction detected!',
      message: `${site} is on your blocklist. Your fish are counting on you!`,
    });
  }

  // Time counters always update regardless of work hours.
  // Passive coin replenishment still accrues when outside work hours, capped at PASSIVE_COIN_CAP.
  if (!isWithinWorkHours(workHours)) {
    const coinsOow   = (data['coins'] as number) ?? 0;
    const idleGain   = coinsOow < PASSIVE_COIN_CAP ? IDLE_COIN_RATE : 0;
    const newCoinsOow = Math.round((coinsOow + idleGain) * 1000) / 1000;
    await chrome.storage.local.set({
      focusSecs:      newFocusSecs,
      distractedSecs: newDistractSecs,
      isDistracting:  distracting,
      currentSite:    site,
      lastFocusDate:  today,
      coins:          newCoinsOow,
    });
    return;
  }

  // Within work hours: also update focus score and coins
  const focusScore = (data['focusScore'] as number) ?? 70;
  const coins      = (data['coins']      as number) ?? 0;

  const newScore = distracting
    ? Math.max(SCORE_FLOOR, focusScore - DECAY)
    : Math.min(100, focusScore + GAIN);

  // Active gain: full focus rate when not distracting; zero when distracting
  // Passive gain: slow idle rate always, but only while below the passive cap
  const activeGain  = distracting ? 0 : (focusScore / 100) * COIN_RATE;
  const passiveGain = coins < PASSIVE_COIN_CAP ? IDLE_COIN_RATE : 0;
  const newCoins    = Math.round((coins + activeGain + passiveGain) * 1000) / 1000;

  // ── Focus streak reminder ─────────────────────────────────────────────────
  // Fires every ~25 minutes of uninterrupted focus.
  const REMINDER_TICKS = 300; // 300 × 5 s = 25 min
  const FOCUS_MESSAGES = [
    'Your fish are thriving! Keep it up.',
    'Your fish are happy and healthy — you\'re on a roll!',
    '25 minutes of focus! Your fish are living their best life.',
    'Your fish are glowing with health. Stay in the zone!',
    'You\'re unstoppable! Your fish couldn\'t be happier.',
  ];
  let newFocusTicks = distracting ? 0 : focusTicksSinceNotif + 1;
  if (!distracting && newFocusTicks >= REMINDER_TICKS) {
    chrome.notifications.create('focus-reminder', {
      type:    'basic',
      iconUrl: 'icons/icon48.png',
      title:   'Focus streak! 🐟',
      message: FOCUS_MESSAGES[Math.floor(Math.random() * FOCUS_MESSAGES.length)],
    });
    newFocusTicks = 0;
  }

  await chrome.storage.local.set({
    focusScore:          newScore,
    focusSecs:           newFocusSecs,
    distractedSecs:      newDistractSecs,
    isDistracting:       distracting,
    currentSite:         site,
    coins:               newCoins,
    lastFocusDate:       today,
    focusTicksSinceNotif: newFocusTicks,
  });
});
