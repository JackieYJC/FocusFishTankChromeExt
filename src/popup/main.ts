// ─── Popup entry point ─────────────────────────────────────────────────────────

import { canvas, fish, foodPellets, ripples, render, initFish, initDecorations, initBackground, decorations, gameState, saveDecorations, Decoration, W, H } from './tank';
import { FoodPellet, Ripple }  from './tank';
import { poll, tickLocalSeconds } from './game-state';
import { initShopPane, renderShopPanePreviews, updateShopPaneBalance } from './shop-pane';
import { initDebugPanel }      from './debug';
import { MAX_FOOD, FOOD_REFILL_SECS }       from '../constants';
import { loadAndApplyTheme }   from '../theme';

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

// ─── Food system ──────────────────────────────────────────────────────────────

/** True while the current tab is on the distraction blocklist (updated via state-applied). */
let _rtDistracted = false;

function updateFoodUI(): void {
  const supply = gameState.foodSupply;
  const bar    = document.getElementById('food-bar') as HTMLDivElement | null;
  const valEl  = document.getElementById('food-value') as HTMLSpanElement | null;
  const nextEl = document.getElementById('food-next') as HTMLSpanElement | null;
  if (!bar || !valEl || !nextEl) return;

  const pct = supply / MAX_FOOD;
  bar.style.width      = (pct * 100) + '%';
  bar.style.background = pct > 0.5 ? '#4caf50' : pct > 0.2 ? '#ff9800' : '#f44336';
  valEl.textContent    = `${supply}/${MAX_FOOD}`;

  if (supply >= MAX_FOOD) {
    nextEl.textContent = 'full';
  } else if (_rtDistracted) {
    nextEl.textContent = '⏸ paused';
  } else {
    const elapsed = (Date.now() - gameState.foodLastRefill) / 1000;
    const secsUntilNext = Math.max(0, Math.ceil(FOOD_REFILL_SECS - (elapsed % FOOD_REFILL_SECS)));
    nextEl.textContent = `+1 in ${secsUntilNext}s`;
  }
}

async function initFoodSystem(): Promise<void> {
  try {
    const stored = await chrome.storage.local.get(['foodSupply', 'foodLastRefill']) as {
      foodSupply?: number; foodLastRefill?: number;
    };
    const isFirstOpen = stored.foodLastRefill === undefined;
    const foodSupply  = stored.foodSupply ?? MAX_FOOD;
    const now         = Date.now();
    // Sanitize: treat missing (0) or future timestamps as now so elapsed >= 0
    const rawRefill      = stored.foodLastRefill ?? 0;
    const foodLastRefill = (rawRefill === 0 || rawRefill > now) ? now : rawRefill;

    // Compute how many pellets have replenished while popup was closed
    const elapsed     = (now - foodLastRefill) / 1000;
    const replenished = Math.max(0, Math.floor(elapsed / FOOD_REFILL_SECS));
    const newSupply   = Math.min(MAX_FOOD, foodSupply + replenished);
    const newRefill   = replenished > 0
      ? foodLastRefill + replenished * FOOD_REFILL_SECS * 1000
      : foodLastRefill;

    gameState.foodSupply     = newSupply;
    gameState.foodLastRefill = newRefill;

    // Always write on first open so the timestamp is anchored
    if (isFirstOpen || replenished > 0) {
      await chrome.storage.local.set({ foodSupply: newSupply, foodLastRefill: newRefill });
    }
  } catch {
    gameState.foodSupply     = MAX_FOOD;
    gameState.foodLastRefill = Date.now();
    await chrome.storage.local.set({ foodSupply: MAX_FOOD, foodLastRefill: Date.now() }).catch(() => {});
  }
  updateFoodUI();
}

/** Called every ~10s to replenish food and refresh the countdown timer. */
function tickFood(): void {
  if (gameState.foodSupply >= MAX_FOOD) { updateFoodUI(); return; }
  // Food does not replenish while on a distracting site
  if (_rtDistracted) { updateFoodUI(); return; }
  const elapsed     = (Date.now() - gameState.foodLastRefill) / 1000;
  const replenished = Math.floor(elapsed / FOOD_REFILL_SECS);
  if (replenished > 0) {
    gameState.foodSupply     = Math.min(MAX_FOOD, gameState.foodSupply + replenished);
    gameState.foodLastRefill = gameState.foodLastRefill + replenished * FOOD_REFILL_SECS * 1000;
    chrome.storage.local.set({
      foodSupply:     gameState.foodSupply,
      foodLastRefill: gameState.foodLastRefill,
    }).catch(() => {});
  }
  updateFoodUI();
}

// ─── Canvas coordinates helper ────────────────────────────────────────────────

function canvasCoords(e: MouseEvent): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (W / rect.width),
    y: (e.clientY - rect.top)  * (H / rect.height),
  };
}

// ─── Canvas click — feed fish ─────────────────────────────────────────────────

canvas.style.cursor = 'pointer';
canvas.addEventListener('click', e => {
  if (gameState.rearrangeMode) return; // clicks disabled while rearranging

  const { x, y } = canvasCoords(e);

  if (gameState.debugMode) {
    const hit = fish.find(f => f.hitTest(x, y, 22));
    if (hit) { hit.cycleStage(); return; }
    const hitDec = decorations.find(d => d.isPlant() && d.hitTest(x, y, 26));
    if (hitDec) { hitDec.cycleDebugState(); return; }
  }

  if (gameState.foodSupply <= 0) return; // no food left

  // Consume one food unit
  gameState.foodSupply--;
  chrome.storage.local.set({ foodSupply: gameState.foodSupply }).catch(() => {});
  updateFoodUI();

  const count = 5 + Math.floor(Math.random() * 4);
  for (let i = 0; i < count; i++) foodPellets.push(new FoodPellet(x, y, H));
  ripples.push(new Ripple(x, y));
});

// ─── Drag-and-drop for rearrange mode ────────────────────────────────────────

let draggingDec: Decoration | undefined = undefined;

canvas.addEventListener('mousedown', e => {
  if (!gameState.rearrangeMode) return;
  const { x, y } = canvasCoords(e);
  draggingDec = decorations.find(d => d.hitTest(x, y, 24));
  if (draggingDec) {
    gameState.draggingDecId = draggingDec.id;
    canvas.style.cursor = 'grabbing';
  }
});

canvas.addEventListener('mousemove', e => {
  if (!gameState.rearrangeMode) return;
  const { x, y } = canvasCoords(e);
  if (draggingDec) {
    draggingDec.x = Math.max(18, Math.min(W - 18, x));
    draggingDec.y = Math.max(H * 0.58, Math.min(H - 22, y));
  } else {
    const hover = decorations.find(d => d.hitTest(x, y, 24));
    canvas.style.cursor = hover ? 'grab' : 'default';
  }
});

document.addEventListener('mouseup', () => {
  if (draggingDec) {
    saveDecorations();
    draggingDec = undefined;
    gameState.draggingDecId = null;
    canvas.style.cursor = gameState.rearrangeMode ? 'default' : 'pointer';
  }
});

// ─── Arrange button ───────────────────────────────────────────────────────────

function initArrangeBtn(): void {
  const btn = document.getElementById('arrange-btn') as HTMLButtonElement;
  btn.addEventListener('click', () => {
    gameState.rearrangeMode = !gameState.rearrangeMode;
    btn.classList.toggle('active', gameState.rearrangeMode);
    canvas.style.cursor = gameState.rearrangeMode ? 'default' : 'pointer';
    // Exit on click outside while in rearrange mode is handled naturally (no decoration hit)
  });
}

// ─── Settings button ─────────────────────────────────────────────────────────

document.getElementById('settings-btn')!.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

// ─── Dev console (Tab → type "debug" → Enter to toggle debug button) ─────────

const devConsole = document.getElementById('dev-console')!;
const devInput   = document.getElementById('dev-input') as HTMLInputElement;
const debugBtn   = document.getElementById('debug-btn')!;

function closeDevConsole(): void {
  devInput.value = '';
  devConsole.classList.remove('visible');
}

document.addEventListener('keydown', e => {
  if (e.key === 'Tab') {
    e.preventDefault();
    const opening = !devConsole.classList.contains('visible');
    if (opening) {
      devConsole.classList.add('visible');
      devInput.focus();
    } else {
      closeDevConsole();
    }
  }
});

devInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    if (devInput.value === 'debug') {
      const nowVisible = debugBtn.classList.toggle('dev-visible');
      // If hiding the button while debug panel is open, close the panel too
      if (!nowVisible && gameState.debugMode) {
        gameState.debugMode = false;
        debugBtn.classList.remove('active');
        document.getElementById('debug-panel')!.classList.remove('visible');
      }
    }
    closeDevConsole();
    e.stopPropagation();
  } else if (e.key === 'Escape') {
    closeDevConsole();
    e.stopPropagation();
  } else if (e.key === 'Tab') {
    e.preventDefault();
    closeDevConsole();
  }
});

// ─── Popup toast (triggered by shop-pane via CustomEvent) ─────────────────────

let popupToastTimer: ReturnType<typeof setTimeout> | undefined;

function showPopupToast(msg: string): void {
  const el = document.getElementById('popup-toast')!;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(popupToastTimer);
  popupToastTimer = setTimeout(() => el.classList.remove('show'), 3500);
}

document.addEventListener('shop-toast', (e) => {
  showPopupToast((e as CustomEvent<string>).detail);
});

// ─── Daily coin claim (resets at midnight local time) ─────────────────────────

const DAILY_REWARD = 50;

function todayDateString(): string {
  return new Date().toLocaleDateString('en-CA'); // "YYYY-MM-DD" in local time
}

function initDailyBtn(): void {
  const btn = document.getElementById('daily-btn') as HTMLButtonElement;

  async function refresh(): Promise<void> {
    try {
      const { lastDailyClaim = '' } = await chrome.storage.local.get('lastDailyClaim') as { lastDailyClaim?: string | number };
      // Handle legacy timestamp values (old format was a number)
      const claimedToday = String(lastDailyClaim) === todayDateString();
      if (!claimedToday) {
        btn.disabled    = false;
        btn.textContent = `🎁 Claim Daily +${DAILY_REWARD} coins`;
      } else {
        btn.disabled    = true;
        btn.textContent = '🎁 Come back tomorrow';
      }
    } catch { /* outside extension context */ }
  }

  btn.addEventListener('click', async () => {
    try {
      const { coins = 0, lastDailyClaim = '' } =
        await chrome.storage.local.get(['coins', 'lastDailyClaim']) as {
          coins?: number; lastDailyClaim?: string | number;
        };
      if (String(lastDailyClaim) === todayDateString()) return;
      await chrome.storage.local.set({ coins: coins + DAILY_REWARD, lastDailyClaim: todayDateString() });
      poll();
      refresh();
    } catch { /* outside extension context */ }
  });

  refresh();
  // Refresh the button state at midnight and every minute
  setInterval(refresh, 60_000);
}

// ─── Mission banner ────────────────────────────────────────────────────────────

let _bannerTimer: ReturnType<typeof setTimeout> | undefined;
let _lastBannerState = '';

function updateMissionBanner(isDistracting: boolean): void {
  const supply = gameState.foodSupply;
  let msg      = '';
  let stateKey = '';

  if (isDistracting && supply <= 0) {
    stateKey = 'distracted_nofood';
    msg = "⚠️ You're distracted and out of food — focus to replenish!";
  } else if (isDistracting) {
    stateKey = 'distracted';
    msg = "⚠️ Close that distracting tab! Your fish are counting on you.";
  } else if (supply <= 0) {
    stateKey = 'nofood';
    msg = "⏳ Out of food — stay focused and it'll start replenishing!";
  } else if (supply < 4) {
    stateKey = 'lowfood';
    msg = "🥘 Food is running low — click the tank to feed your fish!";
  } else {
    _lastBannerState = 'ok';
    return; // no urgent message; let any existing banner fade naturally
  }

  if (stateKey !== _lastBannerState) {
    _lastBannerState = stateKey;
    const banner = document.getElementById('mission-banner')!;
    banner.textContent = msg;
    banner.classList.add('show');
    clearTimeout(_bannerTimer);
    _bannerTimer = setTimeout(() => banner.classList.remove('show'), 5000);
  }
}

document.addEventListener('state-applied', (e) => {
  const { isDistracting } = (e as CustomEvent<{ isDistracting: boolean }>).detail;
  // When returning to focus from distraction, anchor the food refill timer to now
  if (_rtDistracted && !isDistracting && gameState.foodSupply < MAX_FOOD) {
    gameState.foodLastRefill = Date.now();
    chrome.storage.local.set({ foodLastRefill: gameState.foodLastRefill }).catch(() => {});
  }
  _rtDistracted = isDistracting;
  updateMissionBanner(isDistracting);
});

// ─── While you were away ───────────────────────────────────────────────────────

const FLAVOR_EVENTS = [
  'A curious seahorse peeked through the glass.',
  'A gentle current swept through the tank.',
  'A tiny snail crept slowly across the glass.',
  'The bubbles were extra bubbly today.',
  'A mysterious shadow drifted past outside.',
  'The kelp swayed in a quiet underwater breeze.',
  'Some algae tried to creep in from the corner.',
  'A school of tiny fish swam by outside.',
  'The water shimmered with an eerie calm.',
];

function showAwayModal(gapMins: number, coinsEarned: number, scoreDelta: number): void {
  const modal = document.getElementById('away-modal')!;
  const body  = document.getElementById('away-body')!;
  const lines: string[] = [];

  const h = Math.floor(gapMins / 60);
  const m = gapMins % 60;
  lines.push(`You were gone for ${h > 0 ? `${h}h ${m}m` : `${gapMins}m`}.`);

  if (coinsEarned > 0)      lines.push(`🪙 Earned ${coinsEarned} coins while away.`);
  if (scoreDelta > 5)       lines.push(`📈 Focus score improved by ${scoreDelta} pts!`);
  else if (scoreDelta < -5) lines.push(`📉 Focus score dropped by ${Math.abs(scoreDelta)} pts.`);

  const shuffled = [...FLAVOR_EVENTS].sort(() => Math.random() - 0.5);
  const count    = Math.floor(Math.random() * 2) + 1;
  shuffled.slice(0, count).forEach(f => lines.push(`✦ ${f}`));

  body.innerHTML = lines.map(l => `<p>${l}</p>`).join('');
  modal.classList.add('show');
}

async function checkAwayMessage(): Promise<void> {
  try {
    const data     = await chrome.storage.local.get(['popupLastSeen', 'awaySnap', 'coins', 'focusScore']);
    const lastSeen = data['popupLastSeen'] as number | undefined;
    const awaySnap = data['awaySnap']     as { coins: number; score: number } | undefined;
    const coins    = (data['coins']       as number) ?? 0;
    const score    = (data['focusScore']  as number) ?? 70;

    if (lastSeen && awaySnap && Date.now() - lastSeen >= 5 * 60 * 1000) {
      const gapMins    = Math.floor((Date.now() - lastSeen) / 60_000);
      const coinsEarned = Math.max(0, Math.round((coins - awaySnap.coins) * 10) / 10);
      const scoreDelta  = Math.round(score - awaySnap.score);
      showAwayModal(gapMins, coinsEarned, scoreDelta);
    }
    // Save fresh snapshot so next open can compare
    await chrome.storage.local.set({ popupLastSeen: Date.now(), awaySnap: { coins, score } });
  } catch { /* outside extension context */ }
}

function saveAwaySnap(): void {
  chrome.storage.local.set({
    popupLastSeen: Date.now(),
    awaySnap: { coins: gameState.lastCoins ?? 0, score: gameState.health },
  }).catch(() => {});
}

document.getElementById('away-dismiss')!.addEventListener('click', () => {
  document.getElementById('away-modal')!.classList.remove('show');
});

window.addEventListener('pagehide', saveAwaySnap);

// ─── Boot ─────────────────────────────────────────────────────────────────────

loadAndApplyTheme();
initDebugPanel();
initShopPane();
initDailyBtn();
initArrangeBtn();
checkAwayMessage().catch(() => {});
setInterval(saveAwaySnap, 5000); // keep snapshot fresh while popup is open

render();
initFoodSystem().then(() => {
  // Check for refills every 10 s; refresh countdown display every 1 s
  setInterval(tickFood, 10_000);
  setInterval(updateFoodUI, 1_000);
});

initFish().then(async () => {
  await initDecorations();
  await initBackground();
  poll();
  setInterval(poll, 2000);
  setInterval(tickLocalSeconds, 1000);
});
