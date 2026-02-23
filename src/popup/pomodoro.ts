// ─── Pomodoro timer ────────────────────────────────────────────────────────────

import { spawnRewardFish }    from './tank';
import { showBurst }          from './game-state';
import { GAME_BALANCE }       from '../constants';

const { POMO_DURATION, POMO_REWARD } = GAME_BALANCE;

let pomoActive    = false;
let pomoRemaining = POMO_DURATION;
let pomoInterval: ReturnType<typeof setInterval> | null = null;

function fmtPomo(secs: number): string {
  return `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
}

export function updatePomoDisplay(): void {
  document.getElementById('pomo-display')!.textContent = fmtPomo(pomoRemaining);
  const btn = document.getElementById('pomo-btn')!;
  btn.textContent = pomoActive ? 'Pause' : (pomoRemaining < POMO_DURATION ? 'Resume' : 'Start');
  document.getElementById('pomo-row')!.classList.toggle('active', pomoActive);
}

export async function completePomodoro(): Promise<void> {
  pomoActive    = false;
  pomoRemaining = POMO_DURATION;
  if (pomoInterval) { clearInterval(pomoInterval); pomoInterval = null; }
  updatePomoDisplay();

  // Spawn fish BEFORE any await so saveFish() debounce fires immediately.
  // Calling poll() here would race the debounce and evict the new fish.
  spawnRewardFish();

  try {
    const { coins = 0 } = await chrome.storage.local.get('coins') as { coins?: number };
    const newCoins = Math.round((coins + POMO_REWARD) * 1000) / 1000;
    await chrome.storage.local.set({ coins: newCoins });
    document.getElementById('coin-value')!.textContent = String(Math.floor(newCoins));
  } catch { /* outside extension context */ }

  showBurst(`🎉 POMODORO COMPLETE! +${POMO_REWARD} coins & a new fry!`);
}

export function initPomodoro(): void {
  document.getElementById('pomo-btn')!.addEventListener('click', () => {
    if (pomoActive) {
      pomoActive = false;
      if (pomoInterval) { clearInterval(pomoInterval); pomoInterval = null; }
    } else {
      if (pomoRemaining <= 0) pomoRemaining = POMO_DURATION;
      pomoActive    = true;
      pomoInterval  = setInterval(() => {
        pomoRemaining--;
        updatePomoDisplay();
        if (pomoRemaining <= 0) completePomodoro();
      }, 1000);
    }
    updatePomoDisplay();
  });

  document.getElementById('debug-pomo-btn')!.addEventListener('click', () => completePomodoro());

  updatePomoDisplay();
}
