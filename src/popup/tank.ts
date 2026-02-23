// ─── Tank — Fish class, scene objects, render loop ────────────────────────────

import { drawFry, drawLiveFish, drawDeadFish } from '../fish-renderer';
import { GAME_BALANCE, STAGE_SIZE_FACTORS }    from '../constants';
import type { FishType, FishStage, FishSnapshot } from '../types';

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

    // Time-based growth
    if (this.stage === 'fry' || this.stage === 'juvenile') {
      this.growth += (gameState.tankHealth / 100) * BASE_GROWTH_RATE * gameState.growthSpeed;
      if (this.growth >= 100) {
        this.stage      = this.stage === 'fry' ? 'juvenile' : 'adult';
        this.growth     = 0;
        this.foodGrowth = 0;
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
export const bubbles  = Array.from({ length: 14 }, () => new Bubble(W, H));
export const seaweeds = [35, 100, 210, 310].map(x => new Seaweed(x, H));

// ─── Fish persistence ─────────────────────────────────────────────────────────

let saveFishTimer: ReturnType<typeof setTimeout> | null = null;

export function saveFish(): void {
  if (saveFishTimer) clearTimeout(saveFishTimer);
  saveFishTimer = setTimeout(() => {
    const snapshot: FishSnapshot[] = fish.map(f => ({
      id: f.id, type: f.type, hue: f.hue, stage: f.stage,
      health: f.health, maxSize: f.maxSize, speed: f.speed,
      growth: f.growth, foodGrowth: f.foodGrowth, bornAt: f.bornAt,
    }));
    chrome.storage.local.set({ tankFish: snapshot }).catch(() => {});
  }, 250);
}

export async function archiveToGraveyard(f: Fish): Promise<void> {
  try {
    const { graveyardFish = [] } = await chrome.storage.local.get('graveyardFish') as { graveyardFish?: FishSnapshot[] };
    graveyardFish.unshift({
      id: f.id, type: f.type, hue: f.hue, stage: 'dead',
      health: 0, maxSize: f.maxSize, speed: f.speed,
      growth: f.growth, foodGrowth: f.foodGrowth,
      bornAt: f.bornAt, diedAt: Date.now(),
    });
    await chrome.storage.local.set({ graveyardFish });
  } catch { /* ignore */ }
}

export async function initFish(): Promise<void> {
  try {
    const { tankFish } = await chrome.storage.local.get('tankFish') as { tankFish?: FishSnapshot[] };
    if (tankFish && tankFish.length > 0) {
      for (const f of tankFish) {
        const m = Math.round(f.maxSize * 0.38) * 2;
        const x = m + Math.random() * (W - m * 2);
        const y = m + Math.random() * (H - m * 2 - 25);
        const nf = new Fish({ id: f.id, x, y, size: f.maxSize, speed: f.speed, hue: f.hue, type: f.type, stage: f.stage, growth: f.growth ?? 0, foodGrowth: f.foodGrowth ?? 0, bornAt: f.bornAt });
        nf.health = f.health;
        fish.push(nf);
      }
    } else {
      const types: FishType[] = ['basic', 'long', 'round'];
      for (let i = 0; i < 2; i++) {
        const type = types[Math.floor(Math.random() * types.length)];
        const maxS = 17 + Math.floor(Math.random() * 6);
        const m    = Math.round(maxS * 0.38) * 2;
        fish.push(new Fish({ x: m + Math.random() * (W - m * 2), y: m + Math.random() * (H - m * 2 - 25), size: maxS, speed: 0.8 + Math.random() * 0.6, hue: Math.floor(Math.random() * 360), type, stage: 'fry' }));
      }
      saveFish();
    }
  } catch {
    for (let i = 0; i < 2; i++) {
      const type = (['basic', 'long', 'round'] as FishType[])[Math.floor(Math.random() * 3)];
      const maxS = 17 + Math.floor(Math.random() * 6);
      const m    = Math.round(maxS * 0.38) * 2;
      fish.push(new Fish({ x: m + Math.random() * (W - m * 2), y: m + Math.random() * (H - m * 2 - 25), size: maxS, speed: 0.8 + Math.random() * 0.6, hue: Math.floor(Math.random() * 360), type, stage: 'fry' }));
    }
  }
}

// ─── Fish spawning ────────────────────────────────────────────────────────────

export function spawnRewardFish(): void {
  const types: FishType[] = ['basic', 'long', 'round'];
  const type = types[Math.floor(Math.random() * types.length)];
  const hue  = Math.floor(Math.random() * 360);
  const maxS = 17 + Math.floor(Math.random() * 6);
  const frySize = Math.round(maxS * 0.38);
  const m = frySize * 2;
  fish.push(new Fish({ x: m + Math.random() * (W - m * 2), y: m + Math.random() * (H - m * 2 - 25), size: maxS, speed: 0.8 + Math.random() * 0.6, hue, type, stage: 'fry' }));
  saveFish();
}

export function spawnDropFish(type: FishType, hue: number): void {
  const maxS = 17 + Math.floor(Math.random() * 6);
  fish.push(new Fish({ x: 40 + Math.random() * (W - 80), y: -maxS, size: maxS, speed: 0.8 + Math.random() * 0.6, hue, type, stage: 'fry', entering: true }));
  saveFish();
}

export async function checkPendingFish(showBurst: (msg: string) => void): Promise<void> {
  const { pendingFish = [] } = await chrome.storage.local.get('pendingFish') as { pendingFish?: Array<{ type: FishType; hue: number }> };
  if (pendingFish.length === 0) return;
  for (const { type, hue } of pendingFish) {
    const maxS = 17 + Math.floor(Math.random() * 6);
    const frySize = Math.round(maxS * 0.38);
    const m = frySize * 2;
    fish.push(new Fish({ x: m + Math.random() * (W - m * 2), y: m + Math.random() * (H - m * 2 - 25), size: maxS, speed: 0.8 + Math.random() * 0.6, hue, type, stage: 'fry' }));
  }
  saveFish();
  await chrome.storage.local.set({ pendingFish: [] });
  showBurst('🐟 New fish arrived! Check your tank.');
}

// ─── Rendering ────────────────────────────────────────────────────────────────

// Mold blob positions along the sand line (static layout, intensity driven by health)
const MOLD_PATCHES = [
  { x:  25, rx: 38, ry: 10 }, { x:  90, rx: 28, ry:  8 }, { x: 155, rx: 32, ry: 11 },
  { x: 210, rx: 24, ry:  7 }, { x: 265, rx: 30, ry: 10 }, { x: 330, rx: 35, ry:  9 },
];

function drawWater(): void {
  const health = gameState.tankHealth;
  const dark   = (1 - health / 100) * 0.55;

  // ── Background gradient ─────────────────────────────────────────────────────
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, `hsl(210,${68 - dark*30}%,${20 - dark*12}%)`);
  grad.addColorStop(1, `hsl(220,${75 - dark*30}%,${12 - dark*8}%)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // ── Light rays from above (scale with health) ───────────────────────────────
  if (health > 45) {
    const power = (health - 45) / 55;         // 0 → 1 as health goes 45 → 100
    ctx.save();
    ctx.globalAlpha = power * 0.20;
    for (let i = 0; i < 5; i++) {
      const rx = 50 + i * 65;
      ctx.beginPath();
      ctx.moveTo(rx - 12, 0); ctx.lineTo(rx + 12, 0);
      ctx.lineTo(rx + 45, H - 20); ctx.lineTo(rx + 22, H - 20);
      ctx.fillStyle = 'rgba(180,220,255,1)';
      ctx.fill();
    }
    ctx.restore();

    // Surface shimmer at high health
    if (health > 65) {
      const shimmer = (health - 65) / 35;
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
  if (health < 55) {
    const t = (55 - health) / 55;          // 0 → 1 as health 55 → 0
    ctx.save();
    // Blobs along the sand line
    for (const p of MOLD_PATCHES) {
      const ry = p.ry * (0.4 + t * 0.6);
      ctx.beginPath();
      ctx.ellipse(p.x, H - 20, p.rx * (0.3 + t * 0.7), ry, 0, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(28,55,18,${t * 0.72})`;
      ctx.fill();
      // Lighter highlight on each blob
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
  if (health < 40) {
    ctx.fillStyle = `rgba(60,15,0,${(40 - health) / 130})`;
    ctx.fillRect(0, 0, W, H);
  }
}

export function render(): void {
  ctx.clearRect(0, 0, W, H);
  drawWater();
  seaweeds.forEach(s => { s.update(); s.draw(ctx, gameState.tankHealth); });
  bubbles.forEach(b  => { b.update(); b.draw(ctx); });

  for (const p of foodPellets) { p.update(); p.draw(ctx); }
  for (const r of ripples)     { r.update(); r.draw(ctx); }

  // Sparkles — spawn randomly when tank is healthy (>70), rate scales with surplus health
  if (gameState.tankHealth > 70 && Math.random() < (gameState.tankHealth - 70) / 30 * 0.12) {
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

  // Archive fully faded dead fish to graveyard
  for (let i = fish.length - 1; i >= 0; i--) {
    if (fish[i].stage === 'dead' && fish[i].deadAlpha <= 0) {
      archiveToGraveyard(fish[i]);
      fish.splice(i, 1);
      saveFish();
    }
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
    ctx.textAlign = 'left';
    ctx.font = 'bold 10px monospace';
    ctx.fillStyle = '#ff0';
    ctx.fillText('DEBUG', 6, 14);
  }

  requestAnimationFrame(render);
}
