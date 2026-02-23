// ─── Shop pane — tab UI, previews, purchase logic ──────────────────────────────

import { spawnDropFish }        from './tank';
import { drawFishPreview }      from '../fish-renderer';
import { SHOP_ITEMS }           from '../constants';

// ─── Balance display ──────────────────────────────────────────────────────────

export function updateShopPaneBalance(coins: number): void {
  const el = document.getElementById('shop-pane-coins');
  if (el) el.textContent = String(Math.floor(coins));

  document.querySelectorAll<HTMLButtonElement>('.spc-btn').forEach(btn => {
    const cost = Number(btn.dataset['cost']);
    btn.disabled = coins < cost;
    btn.closest('.spc')?.classList.toggle('unaffordable', coins < cost);
  });
}

// ─── Static preview canvases ──────────────────────────────────────────────────

let previewsRendered = false;

export function renderShopPanePreviews(): void {
  if (previewsRendered) return;
  previewsRendered = true;

  document.querySelectorAll<HTMLCanvasElement>('.spc-canvas').forEach(canvas => {
    const type = canvas.closest<HTMLElement>('.spc')?.dataset['type'];
    const item = SHOP_ITEMS.find(i => i.type === type);
    if (!item) return;
    // Show adult fish in their default demo hue
    const demoHue = type === 'basic' ? 155 : type === 'long' ? 20 : 280;
    drawFishPreview(canvas, item.type, demoHue, 'adult');
  });
}

// ─── Build shop grid from SHOP_ITEMS (single source of truth) ────────────────

function buildShopGrid(): void {
  const grid = document.getElementById('shop-pane-grid')!;
  grid.innerHTML = '';

  for (const item of SHOP_ITEMS) {
    const card = document.createElement('div');
    card.className     = 'spc';
    card.dataset['type'] = item.type;
    card.innerHTML = `
      <canvas class="spc-canvas" width="88" height="58"></canvas>
      <div class="spc-info">
        <span class="spc-name">${item.name}</span>
        <span class="spc-desc">${item.desc}</span>
      </div>
      <button class="spc-btn" data-type="${item.type}" data-cost="${item.cost}">🪙 ${item.cost}</button>
    `;
    grid.appendChild(card);
  }
}

// ─── Purchase handler ─────────────────────────────────────────────────────────

export function initShopPane(switchToTank: () => void): void {
  buildShopGrid();

  // Listen for coin updates from game-state (avoids circular import)
  document.addEventListener('coins-updated', (e: Event) => {
    updateShopPaneBalance((e as CustomEvent<number>).detail);
  });

  document.getElementById('shop-pane-grid')!.addEventListener('click', async e => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.spc-btn');
    if (!btn || btn.disabled) return;

    const type = btn.dataset['type'] as string;
    const cost = Number(btn.dataset['cost']);
    const item = SHOP_ITEMS.find(i => i.type === type);
    if (!item) return;

    try {
      const { coins = 0 } = await chrome.storage.local.get('coins') as { coins?: number };
      if (coins < cost) return;
      const hue      = Math.floor(Math.random() * 360);
      const newCoins = Math.round((coins - cost) * 1000) / 1000;
      await chrome.storage.local.set({ coins: newCoins });
      updateShopPaneBalance(newCoins);
      document.getElementById('coin-value')!.textContent = String(Math.floor(newCoins));
      spawnDropFish(item.type, hue);
      switchToTank();
    } catch { /* outside extension context */ }
  });
}
