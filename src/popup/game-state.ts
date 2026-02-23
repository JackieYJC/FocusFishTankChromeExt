// ─── Game state — storage sync, UI feedback ────────────────────────────────────

import { gameState, fish, saveFish, checkPendingFish } from './tank';
import type { AppState, FishSnapshot } from '../types';

// ─── Pure helpers ─────────────────────────────────────────────────────────────

export function fmtTime(min = 0): string {
  if (min < 60) return `${Math.floor(min)}m`;
  return `${Math.floor(min / 60)}h ${Math.floor(min % 60)}m`;
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

export function showBurst(label: string): void {
  const el = document.getElementById('pomo-burst')!;
  el.textContent = label;
  el.classList.remove('show');
  void el.offsetWidth; // force reflow to restart animation
  el.classList.add('show');
  el.addEventListener('animationend', () => el.classList.remove('show'), { once: true });
}

// ─── Apply storage state to DOM ───────────────────────────────────────────────

export function applyState({ focusScore = 70, totalFocusMinutes = 0,
  totalDistractedMinutes = 0, isDistracting = false, currentSite = '', coins = 0 }: Partial<AppState>): void {

  gameState.health = focusScore;
  if (!gameState.debugMode) {
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

  const dot = document.getElementById('status-dot')!;
  const txt = document.getElementById('status-text')!;
  if (!currentSite)       { dot.className = 'neutral';    txt.textContent = 'No active tab'; }
  else if (isDistracting) { dot.className = 'distracted'; txt.textContent = `Distracted — ${currentSite}`; }
  else                    { dot.className = 'focused';    txt.textContent = `Focused — ${currentSite}`;    }

  document.getElementById('focus-time')!.textContent      = fmtTime(totalFocusMinutes);
  document.getElementById('distracted-time')!.textContent = fmtTime(totalDistractedMinutes);
  document.getElementById('coin-value')!.textContent      = String(Math.floor(coins));

  // Notify shop pane of balance change (dispatched as custom event to avoid circular import)
  document.dispatchEvent(new CustomEvent('coins-updated', { detail: coins }));

  if (gameState.lastCoins !== null) {
    const delta = coins - gameState.lastCoins;
    if (delta > 0.005) spawnCoinFloat(`+${delta.toFixed(2)}`);
  }
  gameState.lastCoins = coins;
}

// ─── Poll ─────────────────────────────────────────────────────────────────────

export async function poll(): Promise<void> {
  try {
    const data = await chrome.storage.local.get([
      'focusScore', 'totalFocusMinutes', 'totalDistractedMinutes',
      'isDistracting', 'currentSite', 'coins', 'tankFish',
    ]);
    applyState(data as Partial<AppState>);

    // Sync released fish: remove any whose id is no longer in storage
    const tankFish = data['tankFish'] as FishSnapshot[] | undefined;
    if (tankFish) {
      const storedIds = new Set(tankFish.map(f => f.id));
      let changed = false;
      for (let i = fish.length - 1; i >= 0; i--) {
        // Skip fish still entering (enterFrames > 0): they haven't been persisted yet.
        if (fish[i].id && !fish[i].enterFrames && !storedIds.has(fish[i].id)) { fish.splice(i, 1); changed = true; }
      }
      if (changed) saveFish();
    }

    await checkPendingFish(showBurst);
  } catch {
    applyState({ focusScore: gameState.health });
  }
}
