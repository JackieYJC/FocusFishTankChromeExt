// ─── Shop pane — tab UI, previews, purchase logic ──────────────────────────────

import { spawnDropFish, spawnDropDecoration, saveBackground } from './tank';
import { drawFishPreview, drawDecorationPreview, drawBackgroundPreview } from '../fish-renderer';
import { SHOP_ITEMS, DECORATION_ITEMS, BACKGROUND_ITEMS, SPECIES_HUE } from '../constants';
import type { FishType, DecorationType, BackgroundType } from '../types';

// ─── Background state (module-level) ─────────────────────────────────────────

let unlockedBackgrounds: BackgroundType[] = ['default'];
let activeBackground:    BackgroundType   = 'default';

// ─── Balance display ──────────────────────────────────────────────────────────

export function updateShopPaneBalance(coins: number): void {
  const el = document.getElementById('shop-pane-coins');
  if (el) el.textContent = String(Math.floor(coins));

  // Fish buttons
  document.querySelectorAll<HTMLButtonElement>('.spc-btn').forEach(btn => {
    const cost = Number(btn.dataset['cost']);
    btn.disabled = coins < cost;
    btn.closest('.spc')?.classList.toggle('unaffordable', coins < cost);
  });

  // Decoration buttons
  document.querySelectorAll<HTMLButtonElement>('.spc-dec-btn').forEach(btn => {
    const cost = Number(btn.dataset['cost']);
    btn.disabled = coins < cost;
    btn.closest('.spc')?.classList.toggle('unaffordable', coins < cost);
  });

  // Background buy buttons (not equip buttons — those are always free)
  document.querySelectorAll<HTMLButtonElement>('.spc-bg-btn:not(.equip-btn)').forEach(btn => {
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

  // Fish previews
  document.querySelectorAll<HTMLCanvasElement>('.spc-canvas').forEach(canvas => {
    const type = canvas.closest<HTMLElement>('.spc')?.dataset['type'];
    const item = SHOP_ITEMS.find(i => i.type === type);
    if (!item) return;
    drawFishPreview(canvas, item.type, SPECIES_HUE[item.type], 'adult');
  });

  // Decoration previews
  document.querySelectorAll<HTMLCanvasElement>('.spc-dec-canvas').forEach(canvas => {
    const type = canvas.closest<HTMLElement>('.spc')?.dataset['decType'];
    const item = DECORATION_ITEMS.find(i => i.type === type);
    if (!item) return;
    drawDecorationPreview(canvas, item.type, item.hue);
  });
}

// ─── Build shop grid from SHOP_ITEMS (single source of truth) ────────────────

function buildFishGrid(): void {
  const grid = document.getElementById('shop-pane-grid')!;
  grid.innerHTML = '';

  for (const item of SHOP_ITEMS) {
    const card = document.createElement('div');
    card.className       = 'spc';
    card.dataset['type'] = item.type;
    card.innerHTML = `
      <canvas class="spc-canvas" width="80" height="48"></canvas>
      <div class="spc-info">
        <span class="spc-name">${item.name}</span>
        <span class="spc-desc">${item.desc}</span>
      </div>
      <button class="spc-btn" data-type="${item.type}" data-cost="${item.cost}">🪙 ${item.cost}</button>
    `;
    grid.appendChild(card);
  }
}

function buildDecGrid(): void {
  const grid = document.getElementById('shop-dec-grid')!;
  if (!grid) return;
  grid.innerHTML = '';

  for (const item of DECORATION_ITEMS) {
    const card = document.createElement('div');
    card.className            = 'spc';
    card.dataset['decType']   = item.type;
    card.innerHTML = `
      <canvas class="spc-dec-canvas" width="80" height="48"></canvas>
      <div class="spc-info">
        <span class="spc-name">${item.name}</span>
        <span class="spc-desc">${item.desc}</span>
      </div>
      <button class="spc-dec-btn" data-dec-type="${item.type}" data-cost="${item.cost}">🪙 ${item.cost}</button>
    `;
    grid.appendChild(card);
  }
}

function buildBgGrid(): void {
  const grid = document.getElementById('shop-bg-grid');
  if (!grid) return;
  grid.innerHTML = '';

  for (const item of BACKGROUND_ITEMS) {
    const isActive   = activeBackground === item.type;
    const isUnlocked = unlockedBackgrounds.includes(item.type);

    const actionEl = isActive
      ? `<span class="bg-equipped-label">Equipped</span>`
      : isUnlocked
        ? `<button class="spc-bg-btn equip-btn" data-bg-type="${item.type}" data-cost="0">Equip</button>`
        : `<button class="spc-bg-btn" data-bg-type="${item.type}" data-cost="${item.cost}">🪙 ${item.cost}</button>`;

    const card = document.createElement('div');
    card.className = 'spc';
    card.dataset['bgType'] = item.type;
    card.innerHTML = `
      <canvas class="spc-bg-canvas" width="80" height="48"></canvas>
      <div class="spc-info">
        <span class="spc-name">${item.name}</span>
        <span class="spc-desc">${item.desc}</span>
      </div>
      ${actionEl}
    `;
    grid.appendChild(card);

    const canvas = card.querySelector<HTMLCanvasElement>('.spc-bg-canvas')!;
    drawBackgroundPreview(canvas, item.type);
  }
}

// ─── Purchase handler ─────────────────────────────────────────────────────────

export async function initShopPane(): Promise<void> {
  buildFishGrid();
  buildDecGrid();

  // Load background unlock state before building bg grid
  try {
    const { tankBackground = 'default', unlockedBackgrounds: storedBgs = ['default'] } =
      await chrome.storage.local.get(['tankBackground', 'unlockedBackgrounds']) as {
        tankBackground?: BackgroundType;
        unlockedBackgrounds?: BackgroundType[];
      };
    unlockedBackgrounds = storedBgs;
    activeBackground    = tankBackground;
  } catch { /* ignore */ }

  buildBgGrid();

  // Background click handler (buy + equip)
  const bgGrid = document.getElementById('shop-bg-grid');
  if (bgGrid) {
    bgGrid.addEventListener('click', async e => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.spc-bg-btn');
      if (!btn || btn.disabled) return;

      const type = btn.dataset['bgType'] as BackgroundType;
      const cost = Number(btn.dataset['cost']);

      if (cost > 0) {
        // Purchase: deduct coins, unlock
        try {
          const { coins = 0 } = await chrome.storage.local.get('coins') as { coins?: number };
          if (coins < cost) return;
          const newCoins = Math.round((coins - cost) * 1000) / 1000;
          if (!unlockedBackgrounds.includes(type)) unlockedBackgrounds = [...unlockedBackgrounds, type];
          await chrome.storage.local.set({ coins: newCoins, unlockedBackgrounds });
          updateShopPaneBalance(newCoins);
          document.getElementById('coin-value')!.textContent = String(Math.floor(newCoins));
          const bgName = BACKGROUND_ITEMS.find(b => b.type === type)?.name ?? type;
          document.dispatchEvent(new CustomEvent('shop-toast', { detail: `🎨 ${bgName} unlocked!` }));
        } catch { return; }
      }

      // Equip (always after purchase or for free equip)
      activeBackground = type;
      saveBackground(type);
      buildBgGrid();
      // Re-apply affordability after grid rebuild (new buttons start as enabled by default)
      try {
        const { coins: freshCoins = 0 } = await chrome.storage.local.get('coins') as { coins?: number };
        updateShopPaneBalance(freshCoins as number);
      } catch { /* ignore */ }
    });
  }

  // Listen for coin updates from game-state (avoids circular import)
  document.addEventListener('coins-updated', (e: Event) => {
    updateShopPaneBalance((e as CustomEvent<number>).detail);
  });

  // Fish purchases
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
      const newCoins = Math.round((coins - cost) * 1000) / 1000;
      await chrome.storage.local.set({ coins: newCoins });
      updateShopPaneBalance(newCoins);
      document.getElementById('coin-value')!.textContent = String(Math.floor(newCoins));
      spawnDropFish(item.type);
      document.dispatchEvent(new CustomEvent('shop-toast', { detail: `🐟 ${item.name} on the way!` }));
    } catch { /* outside extension context */ }
  });

  // Decoration purchases
  const decGrid = document.getElementById('shop-dec-grid');
  if (decGrid) {
    decGrid.addEventListener('click', async e => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.spc-dec-btn');
      if (!btn || btn.disabled) return;

      const type = btn.dataset['decType'] as string;
      const cost = Number(btn.dataset['cost']);
      const item = DECORATION_ITEMS.find(i => i.type === type);
      if (!item) return;

      try {
        const { coins = 0 } = await chrome.storage.local.get('coins') as { coins?: number };
        if (coins < cost) return;
        const hue      = Math.floor(Math.random() * 360);
        const newCoins = Math.round((coins - cost) * 1000) / 1000;
        await chrome.storage.local.set({ coins: newCoins });
        updateShopPaneBalance(newCoins);
        document.getElementById('coin-value')!.textContent = String(Math.floor(newCoins));
        spawnDropDecoration(item.type, hue);
        document.dispatchEvent(new CustomEvent('shop-toast', { detail: `🪸 ${item.name} placed in your tank!` }));
      } catch { /* outside extension context */ }
    });
  }
}
