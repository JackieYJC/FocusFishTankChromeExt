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

document.getElementById('reset-btn')!.addEventListener('click', async () => {
  await chrome.storage.local.set({ focusScore: 70, totalFocusMinutes: 0, totalDistractedMinutes: 0 });
  poll();
});

// ─── Boot ─────────────────────────────────────────────────────────────────────

initDebugPanel();
initPomodoro();
initShopPane(() => switchTab('tank'));

render();
initFish().then(() => {
  poll();
  setInterval(poll, 2000);
});
