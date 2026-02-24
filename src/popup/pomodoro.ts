// ─── Pomodoro timer ────────────────────────────────────────────────────────────

import { spawnRewardFish }    from './tank';
import { showBurst }          from './game-state';
import { GAME_BALANCE }       from '../constants';

const { POMO_DURATION, POMO_REWARD } = GAME_BALANCE;

let pomoActive    = false;
let pomoRemaining = POMO_DURATION;
let pomoInterval: ReturnType<typeof setInterval> | null = null;
let _pomoRunStart: number | null = null; // ms timestamp when the current active run began

function fmtPomo(secs: number): string {
  return `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
}

function savePomo(): void {
  chrome.storage.local.set({
    pomoRemaining,
    pomoRunStart: _pomoRunStart,
  }).catch(() => {});
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
  _pomoRunStart = null;
  if (pomoInterval) { clearInterval(pomoInterval); pomoInterval = null; }
  savePomo();
  updatePomoDisplay();

  // Spawn fish BEFORE any await so saveFish() debounce fires immediately.
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
  // Attach listeners synchronously so the button works immediately
  document.getElementById('pomo-btn')!.addEventListener('click', () => {
    if (pomoActive) {
      // Pause — capture current remaining, clear run start
      pomoActive    = false;
      _pomoRunStart = null;
      if (pomoInterval) { clearInterval(pomoInterval); pomoInterval = null; }
      savePomo();
    } else {
      // Start or resume
      if (pomoRemaining <= 0) pomoRemaining = POMO_DURATION;
      pomoActive    = true;
      _pomoRunStart = Date.now();
      savePomo();
      pomoInterval  = setInterval(() => {
        pomoRemaining--;
        updatePomoDisplay();
        if (pomoRemaining <= 0) completePomodoro();
      }, 1000);
    }
    updatePomoDisplay();
  });

  document.getElementById('debug-pomo-btn')!.addEventListener('click', () => completePomodoro());

  updatePomoDisplay(); // show default 25:00 before storage loads

  // Restore persisted state asynchronously
  chrome.storage.local.get(['pomoRemaining', 'pomoRunStart'])
    .then(data => {
      const sr = (data['pomoRemaining'] as number | undefined) ?? POMO_DURATION;
      const rs = (data['pomoRunStart']  as number | null | undefined) ?? null;

      if (rs !== null) {
        // Timer was running when popup last closed — recompute remaining from elapsed time
        const elapsed   = (Date.now() - rs) / 1000;
        const remaining = sr - elapsed;
        if (remaining <= 0) {
          completePomodoro();
        } else {
          pomoRemaining  = Math.ceil(remaining);
          _pomoRunStart  = rs;
          pomoActive     = true;
          pomoInterval   = setInterval(() => {
            pomoRemaining--;
            updatePomoDisplay();
            if (pomoRemaining <= 0) completePomodoro();
          }, 1000);
          updatePomoDisplay();
        }
      } else {
        // Paused or never started — just restore remaining value
        pomoRemaining = sr;
        updatePomoDisplay();
      }
    })
    .catch(() => { /* outside extension context */ });
}
