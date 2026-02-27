// ─── Tank — Fish class, Decoration class, scene objects, render loop ──────────

import { drawFry, drawLiveFish, drawDeadFish, drawDecoration } from '../fish-renderer';
import { GAME_BALANCE, STAGE_SIZE_FACTORS, DEC_HEALTH_PER, MAX_DEC_BONUS, SPECIES_HUE } from '../constants';
import type { FishType, FishStage, FishSnapshot, DecorationType, DecorationSnapshot, BackgroundType } from '../types';

const { BASE_GROWTH_RATE, FOOD_GROWTH_CAP, FOOD_GROWTH_BONUS } = GAME_BALANCE;

// ─── Shared mutable runtime state ─────────────────────────────────────────────
// Exported as a plain object so any module can read/write without circular deps.

export const gameState = {
  tankHealth:        70,
  health:            70,     // mirrors focusScore; used for fish growth tick
  debugMode:         false,
  debugHealthLocked: false,  // true once health slider is manually moved; stops poll from overriding tankHealth
  hpReact:           0.002,  // exponential HP chase coefficient per frame
  coinAccrualMult:   1,      // debug multiplier
  growthSpeed:       1,      // debug multiplier
  lastCoins:         null as number | null,
  rearrangeMode:     false,
  draggingDecId:     null as string | null,
  selectedBackground: 'default' as BackgroundType,
  foodSupply:        15,
  foodLastRefill:    0,      // ms timestamp; 0 = uninitialised
};

// ─── Canvas setup ─────────────────────────────────────────────────────────────

export const W = 360, H = 260;
export const canvas = document.getElementById('tank') as HTMLCanvasElement;
export const ctx    = canvas.getContext('2d')!;

// ─── Fish ─────────────────────────────────────────────────────────────────────

interface FishOptions {
  x: number; y: number;
  size?:       number;
  speed?:      number;
  hue?:        number;
  type?:       FishType;
  stage?:      FishStage;
  id?:         string;
  entering?:   boolean;
  growth?:     number;
  foodGrowth?: number;
  bornAt?:     number;
}

export class Fish {
  id:          string;
  x:           number;
  y:           number;
  tx:          number;
  ty:          number;
  enterFrames: number;
  growth:      number;
  foodGrowth:  number;
  maxSize:     number;
  size:        number;
  type:        FishType;
  stage:       FishStage;
  speed:       number;
  hue:         number;
  phase:       number;
  facing:      number;
  wanderCD:    number;
  health:      number;
  bornAt:      number;
  deadTimer  = 0;   // frames elapsed since death
  deadAlpha  = 1.0; // fades to 0 after 5 s, then fish is archived
  spurtFrames = 0;  // frames remaining in current growth spurt (0 = no spurt)

  constructor({ x, y, size = 22, speed = 1.0, hue = 150, type = 'basic',
                stage = 'fry', id, entering = false, growth = 0, foodGrowth = 0,
                bornAt }: FishOptions) {
    this.id          = id ?? (Date.now().toString(36) + Math.random().toString(36).slice(2));
    this.bornAt      = bornAt ?? Date.now();
    this.x  = x; this.y  = y;
    this.tx = x; this.ty = y;
    this.enterFrames = entering ? 55 : 0;
    this.growth      = growth;
    this.foodGrowth  = foodGrowth;
    this.maxSize     = size;
    this.type        = type;
    this.stage       = stage;
    this.speed       = speed;
    this.hue         = hue;
    this.phase       = Math.random() * Math.PI * 2;
    this.facing      = 1;
    this.wanderCD    = 0;
    this.health      = 100;
    this.size        = 0;
    this._applyStageSize();
  }

  _applyStageSize(): void {
    this.size = Math.round(this.maxSize * (STAGE_SIZE_FACTORS[this.stage] ?? 1.0));
  }

  cycleStage(): void {
    const order: FishStage[] = ['fry', 'juvenile', 'adult', 'dead'];
    this.stage = order[(order.indexOf(this.stage) + 1) % order.length];
    this._applyStageSize();
    this.wanderCD = 0;
    saveFish();
  }

  hitTest(px: number, py: number, minRadius = 0): boolean {
    return Math.hypot(px - this.x, py - this.y) < Math.max(this.size * 1.8, minRadius);
  }

  update(_W: number, _H: number, tankHealth: number, pellets: FoodPellet[]): void {
    if (this.stage === 'dead') {
      this.y = Math.max(this.size + 5, this.y - 0.4);
      this.deadTimer++;
      // After 5 s (300 frames) start a 2 s fade
      if (this.deadTimer > 300) {
        this.deadAlpha = Math.max(0, 1 - (this.deadTimer - 300) / 120);
      }
      return;
    }

    // Drop-in animation
    if (this.enterFrames > 0) {
      this.enterFrames--;
      this.y += 2.5;
      this.phase += 0.06;
      if (this.enterFrames === 0) { this.tx = this.x; this.ty = this.y; this.wanderCD = 0; }
      return;
    }

    // Health chase
    const delta = (tankHealth - this.health) * gameState.hpReact;
    this.health = Math.max(0, Math.min(100, this.health + delta));
    if (this.health < 1) {
      this.stage = 'dead';
      this._applyStageSize();
      saveFish();
      return;
    }

    this.phase += 0.025 + (this.health / 100) * 0.012;
    const spd       = 0.40 + (this.health / 100) * this.speed * 0.35;

    // Food seeking
    const DETECT = 150, EAT = 14;
    let nearest: FoodPellet | null = null, nearestD = Infinity;
    for (const p of pellets) {
      if (!p.active) continue;
      const d = Math.hypot(p.x - this.x, p.y - this.y);
      if (d < DETECT && d < nearestD) { nearest = p; nearestD = d; }
    }

    if (nearest) {
      this.tx = nearest.x; this.ty = nearest.y; this.wanderCD = 30;
      if (nearestD < EAT) {
        nearest.eat();
        if ((this.stage === 'fry' || this.stage === 'juvenile') && this.foodGrowth < FOOD_GROWTH_CAP) {
          const bonus = Math.min(FOOD_GROWTH_BONUS, FOOD_GROWTH_CAP - this.foodGrowth);
          this.foodGrowth += bonus;
          this.growth = Math.min(100, this.growth + bonus);
        }
      }
    } else {
      if (--this.wanderCD <= 0) {
        const m = this.size * 2;
        this.tx = m + Math.random() * (_W - m * 2);
        this.ty = m + Math.random() * (_H - m * 2 - 25);
        this.wanderCD = 200 + Math.random() * 180;
      }
    }

    const dx = this.tx - this.x, dy = this.ty - this.y;
    const d  = Math.hypot(dx, dy);
    if (d > 2) {
      const boost = nearest ? 1.4 : 1;
      this.x += (dx / d) * spd * boost;
      this.y += (dy / d) * spd * boost;
      this.facing = dx > 0 ? 1 : -1;
    }
    this.y += Math.sin(this.phase * 0.6) * 0.18;

    // Time-based growth (with random spurt mechanic)
    if (this.stage === 'fry' || this.stage === 'juvenile') {
      // ~0.2% chance per frame to trigger a 6-second 4× growth spurt
      if (this.spurtFrames <= 0 && gameState.tankHealth > 35 && Math.random() < 0.002) {
        this.spurtFrames = 360; // 6 s at 60 fps
      }
      const spurtMult = this.spurtFrames > 0 ? 4 : 1;
      if (this.spurtFrames > 0) this.spurtFrames--;

      this.growth += (gameState.tankHealth / 100) * BASE_GROWTH_RATE * gameState.growthSpeed * spurtMult;
      if (this.growth >= 100) {
        this.stage      = this.stage === 'fry' ? 'juvenile' : 'adult';
        this.growth     = 0;
        this.foodGrowth = 0;
        this.spurtFrames = 0;
        this._applyStageSize();
        saveFish();
      }
    }
  }

  draw(_ctx: CanvasRenderingContext2D, health: number): void {
    const { x, y, size: s, phase, facing } = this;
    const wag = Math.sin(phase) * s * 0.38;

    if (this.stage === 'dead') {
      _ctx.save();
      _ctx.globalAlpha = this.deadAlpha;
      drawDeadFish(_ctx, this.type, s, wag, x, y, facing);
      _ctx.restore();
      return;
    }

    _ctx.save();
    _ctx.translate(x, y);
    _ctx.scale(facing, 1);
    drawLiveFish(_ctx, this.type, this.stage, this.hue, s, wag, health);
    _ctx.restore();
  }
}

// ─── Decoration ───────────────────────────────────────────────────────────────

export class Decoration {
  id:               string;
  type:             DecorationType;
  x:                number;
  y:                number;
  hue:              number;
  scale:            number;
  phase:            number;
  spawnFrames:      number;  // >0 on newly purchased items; protects from poll eviction
  debugHealthState: number | null = null; // null = follow tank; 0 = well, 1 = alive, 2 = dead

  constructor(snap: DecorationSnapshot, isNew = false) {
    this.id          = snap.id;
    this.type        = snap.type;
    this.x           = snap.x;
    this.y           = snap.y;
    this.hue         = snap.hue;
    this.scale       = snap.scale;
    this.phase       = Math.random() * Math.PI * 2;
    this.spawnFrames = isNew ? 180 : 0;
  }

  update(): void {
    this.phase += 0.018;
    if (this.spawnFrames > 0) this.spawnFrames--;
  }

  hitTest(px: number, py: number, r: number): boolean {
    return Math.hypot(px - this.x, py - this.y) < r;
  }

  isPlant(): boolean {
    return this.type === 'kelp' || this.type === 'coral_fan'
        || this.type === 'coral_branch' || this.type === 'anemone';
  }

  /** Debug mode only: cycles well → alive → dead → well. */
  cycleDebugState(): void {
    if (!this.isPlant()) return;
    this.debugHealthState = this.debugHealthState === null ? 0
                          : (this.debugHealthState + 1) % 3;
  }

  draw(_ctx: CanvasRenderingContext2D): void {
    let health: number;
    if (this.isPlant()) {
      if (this.debugHealthState !== null) {
        health = this.debugHealthState === 0 ? 100 : this.debugHealthState === 1 ? 50 : 15;
      } else {
        health = gameState.tankHealth;
      }
    } else {
      health = 100; // treasure_chest unaffected by tank health
    }
    drawDecoration(_ctx, this.type, this.x, this.y, this.hue, this.scale, this.phase, health);
  }

  toSnapshot(): DecorationSnapshot {
    return { id: this.id, type: this.type, x: this.x, y: this.y, hue: this.hue, scale: this.scale };
  }
}

// ─── Bubble ───────────────────────────────────────────────────────────────────

class Bubble {
  x: number; y: number; r: number; vy: number; wobble: number;
  constructor(private W: number, private H: number) { this.x=0; this.y=0; this.r=0; this.vy=0; this.wobble=0; this.reset(true); }
  reset(initial = false): void {
    this.x      = 20 + Math.random() * (this.W - 40);
    this.y      = initial ? Math.random() * this.H : this.H + 5;
    this.r      = 1.5 + Math.random() * 3.5;
    this.vy     = 0.25 + Math.random() * 0.45;
    this.wobble = Math.random() * Math.PI * 2;
  }
  update(): void { this.y -= this.vy; this.wobble += 0.04; this.x += Math.sin(this.wobble) * 0.35; if (this.y < -10) this.reset(); }
  draw(c: CanvasRenderingContext2D): void {
    c.beginPath(); c.arc(this.x, this.y, this.r, 0, Math.PI*2);
    c.strokeStyle='rgba(160,210,255,0.4)'; c.lineWidth=0.8; c.stroke();
    c.beginPath(); c.arc(this.x - this.r*.3, this.y - this.r*.3, this.r*.3, 0, Math.PI*2);
    c.fillStyle='rgba(255,255,255,0.35)'; c.fill();
  }
}

// ─── Seaweed ──────────────────────────────────────────────────────────────────

class Seaweed {
  baseY:  number;
  joints: number;
  phase:  number;
  segH:   number;
  constructor(public x: number, H: number) {
    this.baseY  = H - 18;
    this.joints = 5 + Math.floor(Math.random() * 4);
    this.phase  = Math.random() * Math.PI * 2;
    this.segH   = 13 + Math.random() * 4;
  }
  update(): void { this.phase += 0.018; }
  draw(c: CanvasRenderingContext2D, health: number): void {
    const hue = 110 + (1 - health / 100) * -70;
    c.strokeStyle=`hsl(${hue},55%,32%)`; c.lineWidth=3; c.lineCap='round'; c.lineJoin='round';
    c.beginPath(); c.moveTo(this.x, this.baseY);
    for (let i = 0; i < this.joints; i++) {
      const sway = Math.sin(this.phase + i * 0.6) * (3 + i * 1.2);
      c.lineTo(this.x + sway, this.baseY - (i + 1) * this.segH);
    }
    c.stroke();
  }
}

// ─── Food Pellet ──────────────────────────────────────────────────────────────

export class FoodPellet {
  x: number; y: number; r: number; vy: number; vx: number;
  alpha: number; ttl: number;
  private _eaten = false;
  constructor(x: number, y: number, private H: number) {
    this.x = x + (Math.random() - 0.5) * 22;
    this.y = y + (Math.random() - 0.5) * 10;
    this.r  = 2 + Math.random() * 1.5;
    this.vy = 0.35 + Math.random() * 0.35;
    this.vx = (Math.random() - 0.5) * 0.4;
    this.alpha = 1; this.ttl = 700;
  }
  eat(): void { this._eaten = true; }
  update(): void {
    if (this._eaten) { this.alpha -= 0.07; return; }
    if (--this.ttl <= 0) { this._eaten = true; return; }
    this.y += this.vy; this.x += this.vx;
    if (this.y > this.H - 22) { this.y = this.H - 22; this.vy = 0; this.vx = 0; }
  }
  draw(c: CanvasRenderingContext2D): void {
    if (this.alpha <= 0) return;
    c.save(); c.globalAlpha = this.alpha;
    c.beginPath(); c.arc(this.x, this.y, this.r, 0, Math.PI*2); c.fillStyle='#d48c2a'; c.fill();
    c.beginPath(); c.arc(this.x-this.r*.35, this.y-this.r*.35, this.r*.38, 0, Math.PI*2); c.fillStyle='rgba(255,220,140,0.75)'; c.fill();
    c.restore();
  }
  get active(): boolean { return this.alpha > 0 && !this._eaten; }
  get alive():  boolean { return this.alpha > 0; }
}

// ─── Ripple ───────────────────────────────────────────────────────────────────

export class Ripple {
  r = 4; alpha = 0.65;
  constructor(public x: number, public y: number) {}
  update(): void { this.r += 1.8; this.alpha -= 0.045; }
  draw(c: CanvasRenderingContext2D): void {
    if (this.alpha <= 0) return;
    c.beginPath(); c.arc(this.x, this.y, this.r, 0, Math.PI*2);
    c.strokeStyle=`rgba(255,210,100,${this.alpha})`; c.lineWidth=1.5; c.stroke();
  }
  get alive(): boolean { return this.alpha > 0; }
}

// ─── Sparkle (high-health shimmer particles) ──────────────────────────────────

class Sparkle {
  x: number; y: number;
  alpha = 0;
  maxAlpha: number;
  size: number;
  phase: number;
  ttl: number;
  maxTtl: number;

  constructor(W: number, H: number) {
    this.x       = 15 + Math.random() * (W - 30);
    this.y       = 8  + Math.random() * (H * 0.72);
    this.maxAlpha = 0.45 + Math.random() * 0.45;
    this.size    = 1.5 + Math.random() * 2.5;
    this.phase   = Math.random() * Math.PI * 2;
    this.maxTtl  = 70 + Math.random() * 60;
    this.ttl     = this.maxTtl;
  }

  update(): void {
    this.ttl--;
    this.phase += 0.12;
    const p = 1 - this.ttl / this.maxTtl;
    if      (p < 0.2) this.alpha = (p / 0.2) * this.maxAlpha;
    else if (p > 0.7) this.alpha = ((1 - p) / 0.3) * this.maxAlpha;
    else              this.alpha = this.maxAlpha;
  }

  draw(c: CanvasRenderingContext2D): void {
    if (this.alpha <= 0) return;
    const s = this.size * (0.85 + Math.sin(this.phase) * 0.15);
    c.save();
    c.globalAlpha = this.alpha;
    c.translate(this.x, this.y);
    c.strokeStyle = '#cce8ff';
    c.lineWidth   = 0.9;
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI;
      c.beginPath();
      c.moveTo(Math.cos(angle) * s * 0.25, Math.sin(angle) * s * 0.25);
      c.lineTo(Math.cos(angle) * s,         Math.sin(angle) * s);
      c.stroke();
    }
    c.beginPath();
    c.arc(0, 0, s * 0.22, 0, Math.PI * 2);
    c.fillStyle = 'rgba(255,255,255,0.9)';
    c.fill();
    c.restore();
  }

  get alive(): boolean { return this.ttl > 0; }
}

// ─── Scene arrays ─────────────────────────────────────────────────────────────
// Declared after class definitions to avoid TDZ errors (classes are not hoisted).

export const fish:        Fish[]       = [];
export const foodPellets: FoodPellet[] = [];
export const ripples:     Ripple[]     = [];
export const sparkles:    Sparkle[]   = [];
export const decorations: Decoration[] = [];
export const bubbles  = Array.from({ length: 14 }, () => new Bubble(W, H));
export const seaweeds = [35, 100, 210, 310].map(x => new Seaweed(x, H));

// ─── Fish persistence ─────────────────────────────────────────────────────────

let saveFishTimer: ReturnType<typeof setTimeout> | null = null;

function _buildFishSnapshot(): FishSnapshot[] {
  return fish.map(f => ({
    id: f.id, type: f.type, hue: f.hue, stage: f.stage,
    health: f.health, maxSize: f.maxSize, speed: f.speed,
    growth: f.growth, foodGrowth: f.foodGrowth, bornAt: f.bornAt,
  }));
}

export function saveFish(): void {
  if (saveFishTimer) clearTimeout(saveFishTimer);
  saveFishTimer = setTimeout(() => {
    chrome.storage.local.set({ tankFish: _buildFishSnapshot() }).catch(() => {});
  }, 250);
}

/** Non-debounced save — use after archiving dead fish so they're removed immediately. */
export function saveFishNow(): void {
  if (saveFishTimer) { clearTimeout(saveFishTimer); saveFishTimer = null; }
  chrome.storage.local.set({ tankFish: _buildFishSnapshot() }).catch(() => {});
}

/** Batch-archives one or more dead fish; deduplicates by id to prevent repeated entries. */
export async function archiveBatchToGraveyard(deadFish: Fish[]): Promise<void> {
  if (deadFish.length === 0) return;
  try {
    const { graveyardFish = [] } = await chrome.storage.local.get('graveyardFish') as { graveyardFish?: FishSnapshot[] };
    const now = Date.now();
    for (const f of deadFish) {
      if (graveyardFish.some(g => g.id === f.id)) continue; // dedup
      graveyardFish.unshift({
        id: f.id, type: f.type, hue: f.hue, stage: 'dead',
        health: 0, maxSize: f.maxSize, speed: f.speed,
        growth: f.growth, foodGrowth: f.foodGrowth,
        bornAt: f.bornAt, diedAt: now,
      });
    }
    await chrome.storage.local.set({ graveyardFish });
  } catch { /* ignore */ }
}

export async function initFish(): Promise<void> {
  const allTypes: FishType[] = ['basic', 'long', 'round', 'angel', 'betta'];
  function spawnDefaultFry(): void {
    for (let i = 0; i < 2; i++) {
      const type = allTypes[Math.floor(Math.random() * allTypes.length)];
      const maxS = 17 + Math.floor(Math.random() * 6);
      const m    = Math.round(maxS * 0.38) * 2;
      fish.push(new Fish({ x: m + Math.random() * (W - m * 2), y: m + Math.random() * (H - m * 2 - 25), size: maxS, speed: 0.8 + Math.random() * 0.6, hue: SPECIES_HUE[type], type, stage: 'fry' }));
    }
    saveFish();
  }

  try {
    const { tankFish } = await chrome.storage.local.get('tankFish') as { tankFish?: FishSnapshot[] };
    if (tankFish && tankFish.length > 0) {
      const liveFish = tankFish.filter(f => f.stage !== 'dead');
      const deadFish = tankFish.filter(f => f.stage === 'dead');

      // Archive any dead fish lingering in tankFish (popup closed during fade animation)
      if (deadFish.length > 0) {
        try {
          const { graveyardFish = [] } = await chrome.storage.local.get('graveyardFish') as { graveyardFish?: FishSnapshot[] };
          const now = Date.now();
          for (const f of deadFish) {
            if (graveyardFish.some(g => g.id === f.id)) continue;
            graveyardFish.unshift({ id: f.id, type: f.type, hue: f.hue, stage: 'dead', health: 0, maxSize: f.maxSize, speed: f.speed, growth: f.growth ?? 0, foodGrowth: f.foodGrowth ?? 0, bornAt: f.bornAt, diedAt: now });
          }
          chrome.storage.local.set({ graveyardFish }).catch(() => {});
        } catch { /* ignore */ }
        // Clean dead fish out of tankFish storage
        chrome.storage.local.set({ tankFish: liveFish }).catch(() => {});
      }

      if (liveFish.length > 0) {
        for (const f of liveFish) {
          const m = Math.round(f.maxSize * 0.38) * 2;
          const x = m + Math.random() * (W - m * 2);
          const y = m + Math.random() * (H - m * 2 - 25);
          const nf = new Fish({ id: f.id, x, y, size: f.maxSize, speed: f.speed, hue: f.hue, type: f.type, stage: f.stage, growth: f.growth ?? 0, foodGrowth: f.foodGrowth ?? 0, bornAt: f.bornAt });
          nf.health = f.health;
          fish.push(nf);
        }
        return;
      }
    }
    spawnDefaultFry();
  } catch {
    // fallback if storage unavailable
    const type = allTypes[Math.floor(Math.random() * allTypes.length)];
    const maxS = 17 + Math.floor(Math.random() * 6);
    const m    = Math.round(maxS * 0.38) * 2;
    fish.push(new Fish({ x: m + Math.random() * (W - m * 2), y: m + Math.random() * (H - m * 2 - 25), size: maxS, speed: 0.8 + Math.random() * 0.6, hue: SPECIES_HUE[type], type, stage: 'fry' }));
  }
}

// ─── Decoration persistence ───────────────────────────────────────────────────

let saveDecTimer: ReturnType<typeof setTimeout> | null = null;

export function saveDecorations(): void {
  if (saveDecTimer) clearTimeout(saveDecTimer);
  saveDecTimer = setTimeout(() => {
    const snapshot = decorations.map(d => d.toSnapshot());
    chrome.storage.local.set({ tankDecorations: snapshot }).catch(() => {});
  }, 250);
}

export async function initDecorations(): Promise<void> {
  try {
    const { tankDecorations = [] } = await chrome.storage.local.get('tankDecorations') as { tankDecorations?: DecorationSnapshot[] };
    for (const snap of tankDecorations) {
      decorations.push(new Decoration(snap));
    }
  } catch { /* ignore */ }
}

// ─── Background persistence ───────────────────────────────────────────────────

export async function initBackground(): Promise<void> {
  try {
    const { tankBackground = 'default' } =
      await chrome.storage.local.get('tankBackground') as { tankBackground?: BackgroundType };
    gameState.selectedBackground = tankBackground;
  } catch { /* ignore */ }
}

export function saveBackground(type: BackgroundType): void {
  gameState.selectedBackground = type;
  chrome.storage.local.set({ tankBackground: type }).catch(() => {});
}

// ─── Fish spawning ────────────────────────────────────────────────────────────

export function spawnDropFish(type: FishType): void {
  const maxS = 17 + Math.floor(Math.random() * 6);
  fish.push(new Fish({ x: 40 + Math.random() * (W - 80), y: -maxS, size: maxS, speed: 0.8 + Math.random() * 0.6, hue: SPECIES_HUE[type], type, stage: 'fry', entering: true }));
  saveFish();
}

export function spawnDropDecoration(type: DecorationType, hue: number): void {
  const id    = Date.now().toString(36) + Math.random().toString(36).slice(2);
  const x     = 40 + Math.random() * (W - 80);
  const y     = H - 20;                          // sit on the sand
  const scale = 0.85 + Math.random() * 0.30;     // slight size variation
  decorations.push(new Decoration({ id, type, x, y, hue, scale }, true)); // isNew=true protects from poll eviction
  saveDecorations();
}

export async function checkPendingFish(): Promise<void> {
  const { pendingFish = [] } = await chrome.storage.local.get('pendingFish') as { pendingFish?: Array<{ type: FishType; hue?: number }> };
  if (pendingFish.length === 0) return;
  for (const { type } of pendingFish) {
    const maxS = 17 + Math.floor(Math.random() * 6);
    const frySize = Math.round(maxS * 0.38);
    const m = frySize * 2;
    fish.push(new Fish({ x: m + Math.random() * (W - m * 2), y: m + Math.random() * (H - m * 2 - 25), size: maxS, speed: 0.8 + Math.random() * 0.6, hue: SPECIES_HUE[type] ?? 155, type, stage: 'fry' }));
  }
  saveFish();
  await chrome.storage.local.set({ pendingFish: [] });
}

// ─── Rendering ────────────────────────────────────────────────────────────────

// Mold blob positions along the sand line (static layout, intensity driven by health)
const MOLD_PATCHES = [
  { x:  25, rx: 38, ry: 10 }, { x:  90, rx: 28, ry:  8 }, { x: 155, rx: 32, ry: 11 },
  { x: 210, rx: 24, ry:  7 }, { x: 265, rx: 30, ry: 10 }, { x: 330, rx: 35, ry:  9 },
];

function drawBgGradient(dark: number): void {
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  switch (gameState.selectedBackground) {
    case 'twilight':
      grad.addColorStop(0, `hsl(270,${65 - dark*28}%,${18 - dark*10}%)`);
      grad.addColorStop(1, `hsl(260,${70 - dark*28}%,${10 - dark*6}%)`);  break;
    case 'kelp_forest':
      grad.addColorStop(0, `hsl(160,${60 - dark*26}%,${20 - dark*11}%)`);
      grad.addColorStop(1, `hsl(165,${68 - dark*26}%,${12 - dark*7}%)`);  break;
    case 'coral_reef':
      grad.addColorStop(0, `hsl(185,${72 - dark*30}%,${22 - dark*12}%)`);
      grad.addColorStop(1, `hsl(190,${80 - dark*30}%,${14 - dark*8}%)`);  break;
    case 'abyss':
      grad.addColorStop(0, `hsl(215,${55 - dark*24}%,${12 - dark*8}%)`);
      grad.addColorStop(1, `hsl(220,${60 - dark*24}%,${5  - dark*3}%)`);  break;
    case 'golden_reef':
      grad.addColorStop(0, `hsl(40,${75 - dark*30}%,${28 - dark*14}%)`);
      grad.addColorStop(1, `hsl(30,${80 - dark*30}%,${16 - dark*10}%)`);  break;
    case 'bioluminescent':
      grad.addColorStop(0, `hsl(200,${42 - dark*20}%,${8 - dark*5}%)`);
      grad.addColorStop(1, `hsl(210,${48 - dark*20}%,${4 - dark*2}%)`);   break;
    default:
      grad.addColorStop(0, `hsl(210,${68 - dark*30}%,${20 - dark*12}%)`);
      grad.addColorStop(1, `hsl(220,${75 - dark*30}%,${12 - dark*8}%)`);
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
}

function getBgRayColor(): string {
  switch (gameState.selectedBackground) {
    case 'twilight':    return 'rgba(180,160,255,1)';
    case 'kelp_forest': return 'rgba(140,220,160,1)';
    case 'coral_reef':  return 'rgba(220,240,255,1)';
    case 'golden_reef': return 'rgba(255,200,80,1)';
    default:            return 'rgba(180,220,255,1)';
  }
}

function drawWater(displayHealth: number): void {
  const dark   = (1 - displayHealth / 100) * 0.55;

  // ── Background gradient ─────────────────────────────────────────────────────
  drawBgGradient(dark);

  // ── Light rays from above (scale with health) ───────────────────────────────
  if (displayHealth > 45 && gameState.selectedBackground !== 'abyss' && gameState.selectedBackground !== 'bioluminescent') {
    const power = (displayHealth - 45) / 55;
    ctx.save();
    ctx.globalAlpha = power * 0.20;
    for (let i = 0; i < 5; i++) {
      const rx = 50 + i * 65;
      ctx.beginPath();
      ctx.moveTo(rx - 12, 0); ctx.lineTo(rx + 12, 0);
      ctx.lineTo(rx + 45, H - 20); ctx.lineTo(rx + 22, H - 20);
      ctx.fillStyle = getBgRayColor();
      ctx.fill();
    }
    ctx.restore();

    // Surface shimmer at high health
    if (displayHealth > 65) {
      const shimmer = (displayHealth - 65) / 35;
      ctx.save();
      const sg = ctx.createLinearGradient(0, 0, 0, 20);
      sg.addColorStop(0, `rgba(190,235,255,${shimmer * 0.28})`);
      sg.addColorStop(1, 'rgba(190,235,255,0)');
      ctx.fillStyle = sg;
      ctx.fillRect(0, 0, W, 20);
      ctx.restore();
    }
  }

  // ── Sand ────────────────────────────────────────────────────────────────────
  const sand = ctx.createLinearGradient(0, H - 20, 0, H);
  sand.addColorStop(0, '#c9aa58'); sand.addColorStop(1, '#a07c30');
  ctx.fillStyle = sand;
  ctx.fillRect(0, H - 20, W, 20);

  // ── Mold patches at low health ──────────────────────────────────────────────
  if (displayHealth < 55) {
    const t = (55 - displayHealth) / 55;
    ctx.save();
    for (const p of MOLD_PATCHES) {
      const ry = p.ry * (0.4 + t * 0.6);
      ctx.beginPath();
      ctx.ellipse(p.x, H - 20, p.rx * (0.3 + t * 0.7), ry, 0, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(28,55,18,${t * 0.72})`;
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(p.x - 4, H - 20 - ry * 0.4, p.rx * 0.3 * t, ry * 0.35 * t, -0.3, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(55,90,30,${t * 0.45})`;
      ctx.fill();
    }
    // Corner mold creeping up the walls
    const wallH = (H - 20) * t * 0.35;
    const wg1 = ctx.createLinearGradient(0, H - 20, 0, H - 20 - wallH);
    wg1.addColorStop(0, `rgba(25,52,15,${t * 0.55})`);
    wg1.addColorStop(1, 'rgba(25,52,15,0)');
    ctx.fillStyle = wg1;
    ctx.fillRect(0, H - 20 - wallH, 28, wallH);
    const wg2 = ctx.createLinearGradient(0, H - 20, 0, H - 20 - wallH);
    wg2.addColorStop(0, `rgba(25,52,15,${t * 0.55})`);
    wg2.addColorStop(1, 'rgba(25,52,15,0)');
    ctx.fillStyle = wg2;
    ctx.fillRect(W - 28, H - 20 - wallH, 28, wallH);
    ctx.restore();
  }

  // ── Dark murky overlay at very low health ───────────────────────────────────
  if (displayHealth < 40) {
    ctx.fillStyle = `rgba(60,15,0,${(40 - displayHealth) / 130})`;
    ctx.fillRect(0, 0, W, H);
  }
}

export function render(): void {
  ctx.clearRect(0, 0, W, H);

  // Decoration bonus boosts water visuals (not fish HP)
  const decBonus      = Math.min(MAX_DEC_BONUS, decorations.length * DEC_HEALTH_PER);
  const displayHealth = Math.min(100, gameState.tankHealth + decBonus);

  drawWater(displayHealth);
  seaweeds.forEach(s => { s.update(); s.draw(ctx, displayHealth); });
  bubbles.forEach(b  => { b.update(); b.draw(ctx); });

  // Decorations — drawn between seaweeds and fish (on the sand)
  for (const d of decorations) {
    d.update();
    d.draw(ctx);
    // Rearrange-mode highlight ring
    if (gameState.rearrangeMode) {
      const isGrabbed = d.id === gameState.draggingDecId;
      ctx.save();
      ctx.beginPath();
      ctx.arc(d.x, d.y - 10, 16, 0, Math.PI * 2);
      ctx.strokeStyle = isGrabbed ? 'rgba(0,255,220,0.9)' : 'rgba(0,200,180,0.45)';
      ctx.lineWidth   = isGrabbed ? 2.5 : 1.5;
      ctx.setLineDash([4, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
  }

  for (const p of foodPellets) { p.update(); p.draw(ctx); }
  for (const r of ripples)     { r.update(); r.draw(ctx); }

  // Sparkles — spawn randomly when tank is healthy (>70), rate scales with surplus health
  if (displayHealth > 70 && Math.random() < (displayHealth - 70) / 30 * 0.12) {
    sparkles.push(new Sparkle(W, H));
  }
  for (const sp of sparkles) { sp.update(); sp.draw(ctx); }

  const prune = <T extends { alive: boolean }>(arr: T[]) => {
    for (let i = arr.length - 1; i >= 0; i--) if (!arr[i].alive) arr.splice(i, 1);
  };
  prune(foodPellets);
  prune(ripples);
  prune(sparkles);

  fish.sort((a, b) => a.size - b.size);
  fish.forEach(f => { f.update(W, H, gameState.tankHealth, foodPellets); f.draw(ctx, f.health); });

  // Growth-spurt sparkles: small green crosshairs near spurting fry/juvenile
  for (const f of fish) {
    if (f.spurtFrames <= 0 || (f.stage !== 'fry' && f.stage !== 'juvenile')) continue;
    if (Math.random() > 0.3) continue;
    ctx.save();
    ctx.globalAlpha = 0.5 + Math.random() * 0.45;
    ctx.strokeStyle = '#88ff99';
    ctx.lineWidth   = 1.2;
    const sx = f.x + (Math.random() - 0.5) * f.size * 2.8;
    const sy = f.y + (Math.random() - 0.5) * f.size * 2.8;
    const ss = 2 + Math.random() * 2.5;
    ctx.beginPath(); ctx.moveTo(sx, sy - ss); ctx.lineTo(sx, sy + ss); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(sx - ss, sy); ctx.lineTo(sx + ss, sy); ctx.stroke();
    ctx.restore();
  }

  // Batch-archive fully faded dead fish to graveyard (single storage write avoids race conditions)
  const toArchive: Fish[] = [];
  for (let i = fish.length - 1; i >= 0; i--) {
    if (fish[i].stage === 'dead' && fish[i].deadAlpha <= 0) {
      toArchive.push(fish[i]);
      fish.splice(i, 1);
    }
  }
  if (toArchive.length > 0) {
    archiveBatchToGraveyard(toArchive);
    saveFishNow(); // immediate save so dead fish are removed from tankFish before popup closes
  }

  if (gameState.debugMode) {
    // Growth bars for fry and juvenile
    for (const f of fish) {
      if (f.stage === 'adult' || f.stage === 'dead' || f.enterFrames > 0) continue;
      const barW = Math.max(f.size * 2.5, 18);
      const bx   = f.x - barW / 2;
      const by   = f.y + f.size + 4;
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.fillRect(bx, by, barW, 4);
      ctx.fillStyle = f.stage === 'fry' ? '#44cc88' : '#6699ff';
      ctx.fillRect(bx, by, barW * (f.growth / 100), 4);
    }
    ctx.textAlign = 'center';
    ctx.font = 'bold 9px monospace';
    for (const f of fish) {
      const barW = f.size * 2.2, barH = 4;
      const bx   = f.x - barW / 2;
      const by   = f.y - f.size - 14;
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(bx, by, barW, barH);
      const hpPct = f.stage === 'dead' ? 0 : f.health / 100;
      ctx.fillStyle = `hsl(${hpPct * 120},90%,50%)`; ctx.fillRect(bx, by, barW * hpPct, barH);
      if (f.stage === 'fry' || f.stage === 'juvenile') {
        const gy = by + barH + 2;
        ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(bx, gy, barW, barH);
        ctx.fillStyle = f.stage === 'fry' ? '#44cc88' : '#6699ff';
        ctx.fillRect(bx, gy, barW * (f.growth / 100), barH);
      }
      ctx.fillStyle = f.stage === 'dead' ? '#f55' : '#ff0';
      ctx.fillText(f.stage, f.x, by - 2);
    }
    // Plant health state labels
    ctx.font = 'bold 8px monospace';
    for (const d of decorations) {
      if (!d.isPlant()) continue;
      const s = d.debugHealthState !== null
        ? (['well', 'alive', 'dead'] as const)[d.debugHealthState]
        : gameState.tankHealth >= 60 ? 'well' : gameState.tankHealth >= 30 ? 'alive' : 'dead';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#0ff';
      ctx.fillText(s, d.x, d.y - 32);
    }

    ctx.textAlign = 'left';
    ctx.font = 'bold 10px monospace';
    ctx.fillStyle = '#ff0';
    ctx.fillText('DEBUG', 6, 14);
  }

  requestAnimationFrame(render);
}
