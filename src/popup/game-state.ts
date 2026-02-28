// ─── Game state — storage sync, UI feedback ────────────────────────────────────

import { gameState, fish, saveFish, initFish, checkPendingFish, decorations, saveDecorations } from './tank';
import type { AppState, FishSnapshot, DecorationSnapshot, WorkHours }                           from '../types';
import { DEFAULT_BLOCKLIST, DEFAULT_WORK_HOURS, GAME_BALANCE }                                  from '../constants';

const { IDLE_COIN_RATE, TICK_SECS } = GAME_BALANCE;

function isWithinWorkHours({ enabled, start, end, days }: WorkHours): boolean {
  if (!enabled) return true;
  const now = new Date();
  if (!days.includes(now.getDay())) return false;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const nowMins  = now.getHours() * 60 + now.getMinutes();
  return nowMins >= sh * 60 + sm && nowMins < eh * 60 + em;
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/** Format seconds into a human-readable string. */
export function fmtTime(secs = 0): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  if (h > 0)  return `${h}h ${m}m`;
  if (m > 0)  return `${m}m ${s}s`;
  return `${s}s`;
}

export function scoreColor(s: number): string {
  return `hsl(${s * 1.2},70%,50%)`;
}

// ─── UI feedback ──────────────────────────────────────────────────────────────

export function spawnCoinFloat(text: string): void {
  const panel   = document.getElementById('panel')!;
  const coinRow = document.getElementById('coin-row')!;
  const div     = document.createElement('div');
  div.className   = 'coin-float';
  div.textContent = text;
  div.style.left  = (coinRow.offsetLeft + coinRow.offsetWidth - 65) + 'px';
  div.style.top   = coinRow.offsetTop + 'px';
  panel.appendChild(div);
  div.addEventListener('animationend', () => div.remove());
}

// ─── Apply storage state to DOM ───────────────────────────────────────────────

export function applyState({ focusScore = 70, focusSecs = 0,
  distractedSecs = 0, isDistracting = false, currentSite = '',
  coins = 0, withinWorkHours = true }: Partial<AppState>): void {

  gameState.health = focusScore;
  if (!gameState.debugHealthLocked) {
    gameState.tankHealth = focusScore;
    (document.getElementById('debug-health-slider') as HTMLInputElement).value = String(gameState.tankHealth);
    document.getElementById('debug-health-val')!.textContent = String(Math.round(gameState.tankHealth));
  }

  const bar = document.getElementById('score-bar')!;
  bar.style.width      = focusScore + '%';
  bar.style.background = scoreColor(focusScore);

  const val = document.getElementById('score-value')!;
  val.textContent = String(Math.round(focusScore));
  val.style.color = scoreColor(focusScore);

  const dot   = document.getElementById('status-dot')!;
  const txt   = document.getElementById('status-text')!;
  const badge = document.getElementById('off-hours-badge') as HTMLElement | null;
  const oow   = !withinWorkHours; // outside work hours

  if (!currentSite) {
    dot.className    = oow ? 'off-hours' : 'neutral';
    txt.textContent  = 'No active tab';
  } else if (isDistracting) {
    dot.className    = oow ? 'off-hours' : 'distracted';
    txt.textContent  = oow ? `Browsing — ${currentSite}` : `Distracted — ${currentSite}`;
  } else {
    dot.className    = 'focused';
    txt.textContent  = `Focused — ${currentSite}`;
  }
  if (badge) badge.hidden = !oow;

  document.getElementById('focus-time')!.textContent      = fmtTime(focusSecs);
  document.getElementById('distracted-time')!.textContent = fmtTime(distractedSecs);

  // Highlight the active time cell; off-hours distracted uses purple instead of red
  const focusCell    = document.getElementById('focus-time')!.closest<HTMLElement>('.time-cell')!;
  const distractCell = document.getElementById('distracted-time')!.closest<HTMLElement>('.time-cell')!;
  focusCell.classList.toggle('state-focused',    !isDistracting && !!currentSite);
  distractCell.classList.toggle('state-distracted', isDistracting && withinWorkHours);
  distractCell.classList.toggle('state-off-dist',   isDistracting && oow);
  document.getElementById('coin-value')!.textContent      = String(Math.floor(coins));

  // Notify shop pane of balance change (dispatched as custom event to avoid circular import)
  document.dispatchEvent(new CustomEvent('coins-updated', { detail: coins }));

  if (gameState.lastCoins !== null) {
    const delta = coins - gameState.lastCoins;
    if (delta > 0.005) spawnCoinFloat(`+${delta.toFixed(2)}`);
  }
  gameState.lastCoins = coins;
  _coinFocusScore      = focusScore;
  _coinDistracted      = isDistracting;
  _coinWithinWorkHours = withinWorkHours;
  updateCoinNextUI();

  // Notify mission banner of state change
  document.dispatchEvent(new CustomEvent('state-applied', { detail: { isDistracting } }));
}

// ─── Coin countdown ───────────────────────────────────────────────────────────

let _coinLastTick       = 0;     // Date.now() of last confirmed coin accrual
let _coinFocusScore     = 70;    // latest focusScore for rate calculation
let _coinDistracted     = false;
let _coinWithinWorkHours = true; // false = outside work hours

function updateCoinNextUI(): void {
  const el = document.getElementById('coin-next');
  if (!el) return;

  if (!_coinWithinWorkHours) {
    // Outside work hours: only passive drip — 0.1 coins/tick × 5s/tick = 1 coin/50s = 5 coins/250s
    const secsFor5 = (5 / IDLE_COIN_RATE) * TICK_SECS; // 250 s
    const elapsed  = _coinLastTick > 0 ? (Date.now() - _coinLastTick) / 1000 : 0;
    const secsLeft = Math.max(1, Math.ceil(secsFor5 - (elapsed % secsFor5)));
    el.textContent = `+5 in ${secsLeft}s`;
    return;
  }

  if (_coinDistracted) { el.textContent = '⏸ paused'; return; }

  const coinsPerMin = Math.round((_coinFocusScore / 100) * 10);
  if (_coinLastTick > 0) {
    const elapsed  = (Date.now() - _coinLastTick) / 1000;
    const secsLeft = Math.max(1, Math.ceil(60 - (elapsed % 60)));
    el.textContent = `+${coinsPerMin} in ${secsLeft}s`;
  } else {
    el.textContent = `+${coinsPerMin} / 60s`;
  }
}

// ─── Local second tracking (storage only updates every TICK_SECS) ─────────────
// The background alarm returns early when the popup is the active window
// (chrome-extension:// URL), so focusSecs/distractedSecs in storage can stall
// while the popup is open. We interpolate locally at 1s resolution instead.

let _secsInit            = false;
let _localFocusSecs      = 0;
let _localDistSecs       = 0;
let _rtFocused           = false;
let _rtDistracted        = false;
let _lastKnownDate       = '';   // "YYYY-MM-DD" — used to detect midnight rollover
let _lastStorageFocusSecs = 0;   // last value read from storage — detects background reset
let _lastStorageDistSecs  = 0;

/** Called every 1 s from main.ts; increments display counters and updates DOM. */
export function tickLocalSeconds(): void {
  if (!_secsInit) return;

  // Midnight rollover: reset local counters when the calendar date changes
  const today = new Date().toLocaleDateString('en-CA');
  if (_lastKnownDate && _lastKnownDate !== today) {
    _localFocusSecs = 0;
    _localDistSecs  = 0;
  }
  _lastKnownDate = today;

  if (_rtFocused)    _localFocusSecs += 1;
  if (_rtDistracted) _localDistSecs  += 1;
  document.getElementById('focus-time')!.textContent      = fmtTime(Math.floor(_localFocusSecs));
  document.getElementById('distracted-time')!.textContent = fmtTime(Math.floor(_localDistSecs));
  updateCoinNextUI();
}

// ─── Poll ─────────────────────────────────────────────────────────────────────

export async function poll(): Promise<void> {
  try {
    const data = await chrome.storage.local.get([
      'focusScore', 'focusSecs', 'distractedSecs',
      // legacy migration support
      'totalFocusMinutes', 'totalDistractedMinutes',
      'isDistracting', 'currentSite', 'coins',
      'tankFish', 'tankDecorations', 'blocklist', 'lastFocusDate', 'workHours',
    ]);

    // Seconds — with legacy fallback
    const focusSecs      = (data['focusSecs']      as number | undefined)
                        ?? ((data['totalFocusMinutes']      as number | undefined) ?? 0) * 60;
    const distractedSecs = (data['distractedSecs'] as number | undefined)
                        ?? ((data['totalDistractedMinutes'] as number | undefined) ?? 0) * 60;

    // Real-time focus detection — bypass stale background storage values
    const blocklist = (data['blocklist'] as string[] | undefined) ?? DEFAULT_BLOCKLIST;
    let rtIsDistracting = false;
    let rtCurrentSite   = '';
    try {
      const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      const tab  = tabs.find(t => t.url &&
        !t.url.startsWith('chrome://') &&
        !t.url.startsWith('chrome-extension://'));
      if (tab?.url) {
        try { rtCurrentSite = new URL(tab.url).hostname.replace(/^www\./, ''); } catch { /* noop */ }
        rtIsDistracting = blocklist.some(s => rtCurrentSite === s || rtCurrentSite.endsWith('.' + s));
      }
    } catch { /* tabs API unavailable outside extension context */ }

    // Sync local display counters with storage
    if (!_secsInit) {
      _secsInit             = true;
      _localFocusSecs       = focusSecs;
      _localDistSecs        = distractedSecs;
      _lastKnownDate        = new Date().toLocaleDateString('en-CA');
      _lastStorageFocusSecs = focusSecs;
      _lastStorageDistSecs  = distractedSecs;
      _coinLastTick         = Date.now(); // start countdown from popup open
    } else {
      // Allow downward sync when background performed a midnight reset
      // (storage dropped below last known storage value → background cleared it)
      if (focusSecs < _lastStorageFocusSecs && focusSecs < _localFocusSecs) {
        _localFocusSecs = focusSecs;        // background midnight reset
      } else if (focusSecs > _localFocusSecs) {
        _localFocusSecs = focusSecs;        // storage advanced ahead of local
      }
      if (distractedSecs < _lastStorageDistSecs && distractedSecs < _localDistSecs) {
        _localDistSecs = distractedSecs;
      } else if (distractedSecs > _localDistSecs) {
        _localDistSecs = distractedSecs;
      }
      _lastStorageFocusSecs = focusSecs;
      _lastStorageDistSecs  = distractedSecs;
    }
    _rtFocused    = !!rtCurrentSite && !rtIsDistracting;
    _rtDistracted = rtIsDistracting;

    // Persist local interpolated seconds back to storage so they survive popup close.
    // Background early-returns when popup is the active tab, so these seconds would
    // otherwise be lost when the popup closes.
    const localF = Math.floor(_localFocusSecs);
    const localD = Math.floor(_localDistSecs);
    if (localF > focusSecs || localD > distractedSecs) {
      const writeback: Record<string, number> = {};
      if (localF > focusSecs)      writeback['focusSecs']      = localF;
      if (localD > distractedSecs) writeback['distractedSecs'] = localD;
      chrome.storage.local.set(writeback).catch(() => {});
    }

    const workHours     = (data['workHours'] as WorkHours | undefined) ?? DEFAULT_WORK_HOURS;
    const withinWorkHours = isWithinWorkHours(workHours);

    applyState({
      ...(data as Partial<AppState>),
      focusSecs:      Math.floor(_localFocusSecs),
      distractedSecs: Math.floor(_localDistSecs),
      isDistracting:  rtIsDistracting,
      currentSite:    rtCurrentSite,
      withinWorkHours,
    });

    // Sync fish: remove any whose id is no longer in storage (e.g. released from settings)
    const tankFish = data['tankFish'] as FishSnapshot[] | undefined;
    if (tankFish) {
      const storedIds = new Set(tankFish.map(f => f.id));
      let changed = false;
      for (let i = fish.length - 1; i >= 0; i--) {
        if (fish[i].id && !fish[i].enterFrames && !storedIds.has(fish[i].id)) { fish.splice(i, 1); changed = true; }
      }
      if (changed) saveFish();
      if (fish.length === 0 && tankFish.length > 0) await initFish();
    }

    // Sync decorations: remove any whose id is no longer in storage (e.g. released from settings)
    const tankDecorations = data['tankDecorations'] as DecorationSnapshot[] | undefined;
    if (tankDecorations) {
      const storedDecIds = new Set(tankDecorations.map(d => d.id));
      let decChanged = false;
      for (let i = decorations.length - 1; i >= 0; i--) {
        // Skip newly-purchased decorations whose saveDecorations() debounce hasn't fired yet
        if (decorations[i].spawnFrames > 0) continue;
        if (!storedDecIds.has(decorations[i].id)) { decorations.splice(i, 1); decChanged = true; }
      }
      if (decChanged) saveDecorations();
    }

    await checkPendingFish();
  } catch {
    applyState({ focusScore: gameState.health });
  }
}
