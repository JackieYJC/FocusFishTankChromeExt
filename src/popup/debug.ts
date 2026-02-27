// ─── Debug panel ───────────────────────────────────────────────────────────────

import { gameState, spawnDropFish } from './tank';
import type { FishType }            from '../types';
import { poll }                     from './game-state';
import { MAX_FOOD }                 from '../constants';

export function initDebugPanel(): void {
  document.getElementById('debug-btn')!.addEventListener('click', () => {
    gameState.debugMode = !gameState.debugMode;
    document.getElementById('debug-btn')!.classList.toggle('active', gameState.debugMode);
    document.getElementById('debug-panel')!.classList.toggle('visible', gameState.debugMode);
  });

  document.getElementById('debug-health-slider')!.addEventListener('input', e => {
    gameState.tankHealth        = Number((e.target as HTMLInputElement).value);
    gameState.debugHealthLocked = true;
    document.getElementById('debug-health-val')!.textContent = String(gameState.tankHealth);
  });

  document.getElementById('debug-rate-slider')!.addEventListener('input', e => {
    const v = Number((e.target as HTMLInputElement).value);
    gameState.hpReact = v / 1000;
    document.getElementById('debug-rate-val')!.textContent = v.toFixed(1);
  });

  document.getElementById('debug-accrual-slider')!.addEventListener('input', e => {
    gameState.coinAccrualMult = Number((e.target as HTMLInputElement).value);
    document.getElementById('debug-accrual-val')!.textContent = gameState.coinAccrualMult + '×';
  });

  document.getElementById('debug-grow-slider')!.addEventListener('input', e => {
    gameState.growthSpeed = Number((e.target as HTMLInputElement).value);
    document.getElementById('debug-grow-val')!.textContent = gameState.growthSpeed + '×';
  });

  document.getElementById('debug-coin-btns')!.addEventListener('click', async e => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('.dbg-coin');
    if (!btn) return;
    const amt = Number(btn.dataset['amt']);
    try {
      const { coins = 0 } = await chrome.storage.local.get('coins') as { coins?: number };
      await chrome.storage.local.set({ coins: Math.max(0, Math.round((coins + amt) * 1000) / 1000) });
      poll();
    } catch { /* outside extension context */ }
  });

  document.getElementById('debug-food-btn')!.addEventListener('click', () => {
    gameState.foodSupply = MAX_FOOD;
    chrome.storage.local.set({ foodSupply: MAX_FOOD }).catch(() => {});
  });

  document.getElementById('debug-fish-btn')!.addEventListener('click', () => {
    const types: FishType[] = ['basic', 'long', 'round', 'angel', 'betta', 'dragon', 'seahorse'];
    spawnDropFish(types[Math.floor(Math.random() * types.length)]);
  });

  // Extra coin accrual while debug is active
  setInterval(async () => {
    if (!gameState.debugMode || gameState.coinAccrualMult <= 1) return;
    const extra = (gameState.health / 100) * 0.2 * (0.5 / 5) * (gameState.coinAccrualMult - 1);
    try {
      const { coins = 0 } = await chrome.storage.local.get('coins') as { coins?: number };
      await chrome.storage.local.set({ coins: Math.round((coins + extra) * 1000) / 1000 });
    } catch { /* outside extension context */ }
  }, 500);
}
