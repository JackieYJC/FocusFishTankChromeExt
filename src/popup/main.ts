// ─── Popup entry point ─────────────────────────────────────────────────────────

import { canvas, fish, foodPellets, ripples, render, initFish, gameState } from './tank';
import { FoodPellet, Ripple }  from './tank';
import { poll }                from './game-state';
import { initPomodoro }        from './pomodoro';
import { initShopPane, renderShopPanePreviews, updateShopPaneBalance } from './shop-pane';
import { initDebugPanel }      from './debug';

// ─── Tab switching ────────────────────────────────────────────────────────────

function switchTab(name: string): void {
  document.querySelectorAll<HTMLElement>('.tab-btn').forEach(b =>
    b.classList.toggle('active', b.dataset['tab'] === name),
  );
  const panel    = document.getElementById('panel')!;
  const shopPane = document.getElementById('shop-pane')!;
  panel.hidden    = name !== 'tank';
  shopPane.hidden = name !== 'shop';

  if (name === 'shop') {
    chrome.storage.local.get('coins')
      .then(({ coins = 0 }) => updateShopPaneBalance(coins as number))
      .catch(() => {});
    renderShopPanePreviews();
  }
}

document.querySelectorAll<HTMLElement>('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset['tab'] ?? 'tank'));
});

// ─── Feed on click ────────────────────────────────────────────────────────────

canvas.style.cursor = 'pointer';
canvas.addEventListener('click', e => {
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (360 / rect.width);
  const y = (e.clientY - rect.top)  * (260 / rect.height);

  if (gameState.debugMode) {
    const hit = fish.find(f => f.hitTest(x, y, 22));
    if (hit) { hit.cycleStage(); return; }
  }

  const count = 5 + Math.floor(Math.random() * 4);
  for (let i = 0; i < count; i++) foodPellets.push(new FoodPellet(x, y, 260));
  ripples.push(new Ripple(x, y));
});

// ─── Settings and reset ───────────────────────────────────────────────────────

document.getElementById('settings-btn')!.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

// ─── Daily coin claim ─────────────────────────────────────────────────────────

const DAILY_REWARD    = 50;
const DAILY_MS        = 24 * 60 * 60 * 1000;

function initDailyBtn(): void {
  const btn = document.getElementById('daily-btn') as HTMLButtonElement;

  async function refresh(): Promise<void> {
    try {
      const { lastDailyClaim = 0 } = await chrome.storage.local.get('lastDailyClaim') as { lastDailyClaim?: number };
      const elapsed = Date.now() - lastDailyClaim;
      if (elapsed >= DAILY_MS) {
        btn.disabled    = false;
        btn.textContent = `🎁 Claim Daily +${DAILY_REWARD} coins`;
      } else {
        btn.disabled = true;
        const remaining = Math.ceil((DAILY_MS - elapsed) / 60000);
        const h = Math.floor(remaining / 60), m = remaining % 60;
        btn.textContent = `🎁 Next claim in ${h}h ${m}m`;
      }
    } catch { /* outside extension context */ }
  }

  btn.addEventListener('click', async () => {
    try {
      const { coins = 0, lastDailyClaim = 0 } = await chrome.storage.local.get(['coins', 'lastDailyClaim']) as { coins?: number; lastDailyClaim?: number };
      if (Date.now() - lastDailyClaim < DAILY_MS) return;
      await chrome.storage.local.set({ coins: coins + DAILY_REWARD, lastDailyClaim: Date.now() });
      poll();
      refresh();
    } catch { /* outside extension context */ }
  });

  refresh();
  setInterval(refresh, 60_000); // update the "next claim" countdown every minute
}

// ─── Boot ─────────────────────────────────────────────────────────────────────

initDebugPanel();
initPomodoro();
initShopPane();
initDailyBtn();

render();
initFish().then(() => {
  poll();
  setInterval(poll, 2000);
});
