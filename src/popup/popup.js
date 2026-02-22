'use strict';

// ─── Fish ─────────────────────────────────────────────────────────────────────
class Fish {
  constructor({ x, y, size = 22, speed = 1.0, hue = 150, type = 'basic', stage = 'fry', id }) {
    this.id = id ?? (Date.now().toString(36) + Math.random().toString(36).slice(2));
    this.x = x;
    this.y = y;
    this.tx = x;
    this.ty = y;
    this.maxSize = size;
    this.type  = type;
    this.stage = stage;
    this.speed = speed;
    this.hue = hue;
    this.phase = Math.random() * Math.PI * 2;
    this.facing = 1;
    this.wanderCD = 0;
    this.health = 100;
    this._applyStageSize();
  }

  _applyStageSize() {
    const f = { fry: 0.38, juvenile: 0.62, adult: 1.0, dead: 1.0 };
    this.size = Math.round(this.maxSize * (f[this.stage] ?? 1.0));
  }

  cycleStage() {
    const order = ['fry', 'juvenile', 'adult', 'dead'];
    this.stage = order[(order.indexOf(this.stage) + 1) % order.length];
    this._applyStageSize();
    this.wanderCD = 0;
    saveFish();
  }

  hitTest(px, py) {
    return Math.hypot(px - this.x, py - this.y) < this.size * 1.8;
  }

  update(W, H, tankHealth, foodPellets) {
    if (this.stage === 'dead') {
      this.y = Math.max(this.size + 5, this.y - 0.4);
      return;
    }

    // Drain or restore fish health based on tank health.
    // Equilibrium at tankHealth 50; drains at 2 hp/s when tankHealth 0,
    // recovers at 2 hp/s when tankHealth 100.
    // Exponential chase: fish health moves toward tankHealth at hpReact per frame.
    // Non-linear by nature — fast when far apart, slow when close.
    // Same coefficient drives both drain and recovery.
    const delta = (tankHealth - this.health) * hpReact;
    this.health = Math.max(0, Math.min(100, this.health + delta));
    if (this.health < 1) {
      this.stage = 'dead';
      this._applyStageSize();
      saveFish();
      return;
    }

    this.phase += 0.05 + (this.health / 100) * 0.06;
    const speedMult = this.stage === 'fry' ? 1.25 : 1.0;
    const spd = (0.4 + (this.health / 100) * this.speed) * speedMult;

    // Find nearest active pellet within detection range
    const DETECT = 150, EAT = 14;
    let nearest = null, nearestD = Infinity;
    for (const p of foodPellets) {
      if (!p.active) continue;
      const d = Math.hypot(p.x - this.x, p.y - this.y);
      if (d < DETECT && d < nearestD) { nearest = p; nearestD = d; }
    }

    if (nearest) {
      // Chase food, reset wander so fish doesn't immediately re-wander after eating
      this.tx = nearest.x;
      this.ty = nearest.y;
      this.wanderCD = 30;
      if (nearestD < EAT) nearest.eat();
    } else {
      if (--this.wanderCD <= 0) {
        const m = this.size * 2;
        this.tx = m + Math.random() * (W - m * 2);
        this.ty = m + Math.random() * (H - m * 2 - 25);
        this.wanderCD = 80 + Math.random() * 120;
      }
    }

    const dx = this.tx - this.x;
    const dy = this.ty - this.y;
    const d = Math.hypot(dx, dy);
    if (d > 2) {
      const boost = nearest ? 1.6 : 1;
      this.x += (dx / d) * spd * boost;
      this.y += (dy / d) * spd * boost;
      this.facing = dx > 0 ? 1 : -1;
    }
    this.y += Math.sin(this.phase * 0.7) * 0.25;
  }

  draw(ctx, health) {
    if (this.stage === 'dead') { this._drawDead(ctx); return; }

    const { x, y, size: s, phase, facing, hue } = this;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(facing, 1);

    const wag = Math.sin(phase) * s * 0.38;

    // Fry: unified greenish-blue teardrop regardless of type
    if (this.stage === 'fry') {
      this._drawFry(ctx, s, wag);
      ctx.restore();
      return;
    }

    // Stage-based color reveal for juvenile and adult
    const h = (health / 100) * hue;
    let col, dark, shimmer;
    if (this.stage === 'juvenile') {
      const jHue = Math.round(175 + ((hue - 175) * 0.5));
      col     = `hsl(${jHue},30%,42%)`;
      dark    = `hsl(${jHue},30%,30%)`;
      shimmer = `hsla(${jHue},30%,60%,0.35)`;
    } else {
      col     = `hsl(${h},65%,45%)`;
      dark    = `hsl(${h},65%,33%)`;
      shimmer = `hsla(${h},65%,67%,0.35)`;
    }

    if (this.type === 'long')        this._drawLong(ctx, s, wag, col, dark, shimmer, h, health);
    else if (this.type === 'round')  this._drawRound(ctx, s, wag, col, dark, shimmer, h, health);
    else                             this._drawBasic(ctx, s, wag, col, dark, shimmer, h, health);

    ctx.restore();
  }

  _drawFry(ctx, s, wag) {
    const col  = 'hsl(175,55%,48%)';
    const dark = 'hsl(175,55%,35%)';
    // Stubby tail
    ctx.beginPath();
    ctx.moveTo(-s * 0.6, 0);
    ctx.lineTo(-s * 0.95, -s * 0.38 + wag);
    ctx.lineTo(-s * 0.95,  s * 0.38 + wag);
    ctx.closePath();
    ctx.fillStyle = dark; ctx.fill();
    // Round body
    ctx.beginPath();
    ctx.ellipse(0, 0, s, s * 0.65, 0, 0, Math.PI * 2);
    ctx.fillStyle = col; ctx.fill();
    // Small dot eye
    ctx.beginPath();
    ctx.arc(s * 0.5, -s * 0.1, s * 0.12, 0, Math.PI * 2);
    ctx.fillStyle = '#111'; ctx.fill();
  }

  _drawBasic(ctx, s, wag, col, dark, shimmer, h, health) {
    // Tail
    ctx.beginPath();
    ctx.moveTo(-s * 0.65, 0);
    ctx.lineTo(-s * 1.25, -s * 0.58 + wag);
    ctx.lineTo(-s * 1.25,  s * 0.58 + wag);
    ctx.closePath();
    ctx.fillStyle = dark; ctx.fill();
    // Body
    ctx.beginPath();
    ctx.ellipse(0, 0, s, s * 0.52, 0, 0, Math.PI * 2);
    ctx.fillStyle = col; ctx.fill();
    // Belly shimmer
    ctx.beginPath();
    ctx.ellipse(s * 0.12, s * 0.12, s * 0.52, s * 0.22, -0.3, 0, Math.PI * 2);
    ctx.fillStyle = shimmer; ctx.fill();
    // Sick tint
    if (health < 20) {
      ctx.beginPath();
      ctx.ellipse(0, s * 0.05, s * 0.6, s * 0.38, 0, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(80,200,60,${0.18 + (20 - health) / 100})`; ctx.fill();
    }
    // Dorsal fin
    ctx.beginPath();
    ctx.moveTo(-s * 0.05, -s * 0.52);
    ctx.quadraticCurveTo(s * 0.28, -s * 0.9, s * 0.62, -s * 0.52);
    ctx.fillStyle = dark; ctx.fill();
    // Eye
    ctx.beginPath();
    ctx.arc(s * 0.56, -s * 0.07, s * 0.18, 0, Math.PI * 2);
    ctx.fillStyle = 'white'; ctx.fill();
    ctx.beginPath();
    ctx.arc(s * 0.60, -s * 0.07, s * 0.10, 0, Math.PI * 2);
    ctx.fillStyle = '#111'; ctx.fill();
    // Expression
    ctx.lineWidth = 1.5; ctx.strokeStyle = dark;
    if (health < 35) {
      ctx.beginPath(); ctx.arc(s * 0.38, s * 0.18, s * 0.13, 0.15, Math.PI - 0.15); ctx.stroke();
    } else if (health > 68) {
      ctx.beginPath(); ctx.arc(s * 0.38, s * 0.04, s * 0.13, 0.15, Math.PI - 0.15, true); ctx.stroke();
    }
  }

  _drawLong(ctx, s, wag, col, dark, shimmer, h, health) {
    // Forked tail — two separate lobes
    for (const sign of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(-s * 0.8, 0);
      ctx.lineTo(-s * 1.6, sign * s * 0.55 + wag);
      ctx.lineTo(-s * 1.2, sign * s * 0.1  + wag * 0.5);
      ctx.closePath();
      ctx.fillStyle = dark; ctx.fill();
    }
    // Elongated body
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 1.4, s * 0.38, 0, 0, Math.PI * 2);
    ctx.fillStyle = col; ctx.fill();
    // Lateral stripe (characteristic tetra feature)
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 1.1, s * 0.12, 0, 0, Math.PI * 2);
    ctx.fillStyle = dark; ctx.fill();
    // Belly shimmer
    ctx.beginPath();
    ctx.ellipse(s * 0.1, s * 0.1, s * 0.9, s * 0.16, -0.2, 0, Math.PI * 2);
    ctx.fillStyle = shimmer; ctx.fill();
    // Sick tint
    if (health < 20) {
      ctx.beginPath();
      ctx.ellipse(0, 0, s * 0.9, s * 0.3, 0, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(80,200,60,${0.18 + (20 - health) / 100})`; ctx.fill();
    }
    // Small dorsal
    ctx.beginPath();
    ctx.moveTo(-s * 0.3, -s * 0.38);
    ctx.quadraticCurveTo(s * 0.1, -s * 0.65, s * 0.5, -s * 0.38);
    ctx.fillStyle = dark; ctx.fill();
    // Eye (forward on long body)
    ctx.beginPath();
    ctx.arc(s * 0.78, -s * 0.06, s * 0.15, 0, Math.PI * 2);
    ctx.fillStyle = 'white'; ctx.fill();
    ctx.beginPath();
    ctx.arc(s * 0.82, -s * 0.06, s * 0.08, 0, Math.PI * 2);
    ctx.fillStyle = '#111'; ctx.fill();
    // Expression
    ctx.lineWidth = 1.5; ctx.strokeStyle = dark;
    if (health < 35) {
      ctx.beginPath(); ctx.arc(s * 0.62, s * 0.14, s * 0.10, 0.15, Math.PI - 0.15); ctx.stroke();
    } else if (health > 68) {
      ctx.beginPath(); ctx.arc(s * 0.62, s * 0.04, s * 0.10, 0.15, Math.PI - 0.15, true); ctx.stroke();
    }
  }

  _drawRound(ctx, s, wag, col, dark, shimmer, h, health) {
    // Stubby tail
    ctx.beginPath();
    ctx.moveTo(-s * 0.65, 0);
    ctx.lineTo(-s * 1.05, -s * 0.42 + wag);
    ctx.lineTo(-s * 1.05,  s * 0.42 + wag);
    ctx.closePath();
    ctx.fillStyle = dark; ctx.fill();
    // Chubby body
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.95, s * 0.85, 0, 0, Math.PI * 2);
    ctx.fillStyle = col; ctx.fill();
    // Belly shimmer
    ctx.beginPath();
    ctx.ellipse(s * 0.1, s * 0.18, s * 0.55, s * 0.38, -0.3, 0, Math.PI * 2);
    ctx.fillStyle = shimmer; ctx.fill();
    // Sick tint
    if (health < 20) {
      ctx.beginPath();
      ctx.ellipse(0, 0, s * 0.65, s * 0.6, 0, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(80,200,60,${0.18 + (20 - health) / 100})`; ctx.fill();
    }
    // Spiky dorsal — 3 triangles
    for (const sx of [-s * 0.25, s * 0.05, s * 0.38]) {
      ctx.beginPath();
      ctx.moveTo(sx - s * 0.12, -s * 0.85);
      ctx.lineTo(sx,             -s * 1.15);
      ctx.lineTo(sx + s * 0.12, -s * 0.85);
      ctx.closePath();
      ctx.fillStyle = dark; ctx.fill();
    }
    // Big eye
    ctx.beginPath();
    ctx.arc(s * 0.48, -s * 0.18, s * 0.24, 0, Math.PI * 2);
    ctx.fillStyle = 'white'; ctx.fill();
    ctx.beginPath();
    ctx.arc(s * 0.52, -s * 0.18, s * 0.14, 0, Math.PI * 2);
    ctx.fillStyle = '#111'; ctx.fill();
    ctx.beginPath();
    ctx.arc(s * 0.44, -s * 0.24, s * 0.07, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.65)'; ctx.fill();
    // Expression
    ctx.lineWidth = 1.5; ctx.strokeStyle = dark;
    if (health < 35) {
      ctx.beginPath(); ctx.arc(s * 0.25, s * 0.28, s * 0.13, 0.15, Math.PI - 0.15); ctx.stroke();
    } else if (health > 68) {
      ctx.beginPath(); ctx.arc(s * 0.25, s * 0.18, s * 0.13, 0.15, Math.PI - 0.15, true); ctx.stroke();
    }
  }

  _drawDead(ctx) {
    const { x, y, size: s, phase, facing } = this;

    // Grayscale upside-down body (y-axis flipped)
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(facing, -1);

    const wag = Math.sin(phase) * s * 0.38;

    // Tail
    ctx.beginPath();
    ctx.moveTo(-s * 0.65, 0);
    ctx.lineTo(-s * 1.25, -s * 0.58 + wag);
    ctx.lineTo(-s * 1.25,  s * 0.58 + wag);
    ctx.closePath();
    ctx.fillStyle = '#555';
    ctx.fill();

    // Body
    ctx.beginPath();
    ctx.ellipse(0, 0, s, s * 0.52, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#777';
    ctx.fill();

    // Belly shimmer
    ctx.beginPath();
    ctx.ellipse(s * 0.12, s * 0.12, s * 0.52, s * 0.22, -0.3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(180,180,180,0.35)';
    ctx.fill();

    // Dorsal fin
    ctx.beginPath();
    ctx.moveTo(-s * 0.05, -s * 0.52);
    ctx.quadraticCurveTo(s * 0.28, -s * 0.9, s * 0.62, -s * 0.52);
    ctx.fillStyle = '#555';
    ctx.fill();

    // Eye socket
    ctx.beginPath();
    ctx.arc(s * 0.56, -s * 0.07, s * 0.18, 0, Math.PI * 2);
    ctx.fillStyle = '#999';
    ctx.fill();

    ctx.restore();

    // X eyes — separate pass without y-flip so they sit at the visual eye position
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(facing, 1);

    const ex = s * 0.56;
    const ey = s * 0.07; // mirrored from normal -s*0.07 due to y-flip above
    const r  = s * 0.10;
    ctx.strokeStyle = '#333';
    ctx.lineWidth = Math.max(1, s * 0.07);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(ex - r, ey - r);
    ctx.lineTo(ex + r, ey + r);
    ctx.moveTo(ex + r, ey - r);
    ctx.lineTo(ex - r, ey + r);
    ctx.stroke();

    ctx.restore();
  }
}

// ─── Bubble ───────────────────────────────────────────────────────────────────
class Bubble {
  constructor(W, H) {
    this.W = W;
    this.H = H;
    this.reset(true);
  }
  reset(initial = false) {
    this.x  = 20 + Math.random() * (this.W - 40);
    this.y  = initial ? Math.random() * this.H : this.H + 5;
    this.r  = 1.5 + Math.random() * 3.5;
    this.vy = 0.25 + Math.random() * 0.45;
    this.wobble = Math.random() * Math.PI * 2;
  }
  update() {
    this.y -= this.vy;
    this.wobble += 0.04;
    this.x += Math.sin(this.wobble) * 0.35;
    if (this.y < -10) this.reset();
  }
  draw(ctx) {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(160,210,255,0.4)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(this.x - this.r * 0.3, this.y - this.r * 0.3, this.r * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fill();
  }
}

// ─── Seaweed ──────────────────────────────────────────────────────────────────
class Seaweed {
  constructor(x, H) {
    this.x = x;
    this.baseY = H - 18;
    this.joints = 5 + Math.floor(Math.random() * 4);
    this.phase = Math.random() * Math.PI * 2;
    this.segH = 13 + Math.random() * 4;
  }
  update() { this.phase += 0.018; }
  draw(ctx, health) {
    const hue = 110 + (1 - health / 100) * -70;
    ctx.strokeStyle = `hsl(${hue},55%,32%)`;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    let px = this.x, py = this.baseY;
    ctx.beginPath();
    ctx.moveTo(px, py);
    for (let i = 0; i < this.joints; i++) {
      const sway = Math.sin(this.phase + i * 0.6) * (3 + i * 1.2);
      ctx.lineTo(this.x + sway, this.baseY - (i + 1) * this.segH);
    }
    ctx.stroke();
  }
}

// ─── Food Pellet ──────────────────────────────────────────────────────────────
class FoodPellet {
  constructor(x, y, H) {
    this.H = H;
    this.x = x + (Math.random() - 0.5) * 22;
    this.y = y + (Math.random() - 0.5) * 10;
    this.r = 2 + Math.random() * 1.5;
    this.vy = 0.35 + Math.random() * 0.35;
    this.vx = (Math.random() - 0.5) * 0.4;
    this.alpha = 1;
    this._eaten = false;
    this.ttl = 700; // auto-expire after ~700 frames if uneaten
  }

  eat() {
    if (this._eaten) return;
    this._eaten = true;
  }

  update() {
    if (this._eaten) {
      this.alpha -= 0.07;
      return;
    }
    this.ttl--;
    if (this.ttl <= 0) { this._eaten = true; return; }

    this.y += this.vy;
    this.x += this.vx;
    // Rest on sand
    if (this.y > this.H - 22) {
      this.y = this.H - 22;
      this.vy = 0;
      this.vx = 0;
    }
  }

  draw(ctx) {
    if (this.alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    ctx.fillStyle = '#d48c2a';
    ctx.fill();
    // Highlight
    ctx.beginPath();
    ctx.arc(this.x - this.r * 0.35, this.y - this.r * 0.35, this.r * 0.38, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,220,140,0.75)';
    ctx.fill();
    ctx.restore();
  }

  get active() { return this.alpha > 0 && !this._eaten; }
  get alive()  { return this.alpha > 0; }
}

// ─── Ripple ───────────────────────────────────────────────────────────────────
class Ripple {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.r = 4; this.alpha = 0.65;
  }
  update() { this.r += 1.8; this.alpha -= 0.045; }
  draw(ctx) {
    if (this.alpha <= 0) return;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,210,100,${this.alpha})`;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  get alive() { return this.alpha > 0; }
}

// ─── Scene setup ─────────────────────────────────────────────────────────────
const W = 360, H = 260;
const canvas = document.getElementById('tank');
const ctx = canvas.getContext('2d');

let fish = [];
const bubbles  = Array.from({ length: 14 }, () => new Bubble(W, H));
const seaweeds = [35, 100, 210, 310].map(x => new Seaweed(x, H));

let health = 70;
let tankHealth = 70;   // drives all canvas visuals; mirrors focusScore outside debug mode
const foodPellets = [];
const ripples = [];
let debugMode = false;
let hpReact        = 0.002; // exponential chase coefficient (per frame); slider shows value * 1000
let coinAccrualMult = 1;    // debug multiplier for coin accrual speed
let lastCoins = null;       // track coin delta for animation; null = first poll (skip animation)

// ─── Fish persistence ─────────────────────────────────────────────────────────
let saveFishTimer = null;
function saveFish() {
  clearTimeout(saveFishTimer);
  saveFishTimer = setTimeout(() => {
    const snapshot = fish.map(f => ({
      id: f.id, type: f.type, hue: f.hue, stage: f.stage,
      health: f.health, maxSize: f.maxSize, speed: f.speed,
    }));
    chrome.storage.local.set({ tankFish: snapshot }).catch(() => {});
  }, 250);
}

async function initFish() {
  try {
    const { tankFish } = await chrome.storage.local.get('tankFish');
    if (tankFish && tankFish.length > 0) {
      for (const f of tankFish) {
        const m = Math.round(f.maxSize * 0.38) * 2;
        const x = m + Math.random() * (W - m * 2);
        const y = m + Math.random() * (H - m * 2 - 25);
        const newFish = new Fish({ id: f.id, x, y, size: f.maxSize, speed: f.speed, hue: f.hue, type: f.type, stage: f.stage });
        newFish.health = f.health;
        fish.push(newFish);
      }
    } else {
      fish.push(new Fish({ x: 180, y: 100, size: 24, speed: 1.2, hue: 155, type: 'basic', stage: 'adult' }));
      fish.push(new Fish({ x:  80, y: 160, size: 22, speed: 0.9, hue:  20, type: 'long',  stage: 'adult' }));
      fish.push(new Fish({ x: 280, y: 130, size: 21, speed: 1.0, hue: 280, type: 'round', stage: 'adult' }));
      saveFish();
    }
  } catch {
    // Outside extension context
    fish.push(new Fish({ x: 180, y: 100, size: 24, speed: 1.2, hue: 155, type: 'basic', stage: 'adult' }));
    fish.push(new Fish({ x:  80, y: 160, size: 22, speed: 0.9, hue:  20, type: 'long',  stage: 'adult' }));
    fish.push(new Fish({ x: 280, y: 130, size: 21, speed: 1.0, hue: 280, type: 'round', stage: 'adult' }));
  }
}

function drawWater() {
  const dark = (1 - tankHealth / 100) * 0.55;
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, `hsl(210,${68 - dark * 30}%,${20 - dark * 12}%)`);
  grad.addColorStop(1, `hsl(220,${75 - dark * 30}%,${12 - dark * 8}%)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Caustic light rays when healthy
  if (tankHealth > 45) {
    ctx.save();
    ctx.globalAlpha = ((tankHealth - 45) / 55) * 0.07;
    for (let i = 0; i < 5; i++) {
      const rx = 50 + i * 65;
      ctx.beginPath();
      ctx.moveTo(rx - 12, 0);
      ctx.lineTo(rx + 12, 0);
      ctx.lineTo(rx + 45, H - 20);
      ctx.lineTo(rx + 22, H - 20);
      ctx.fillStyle = 'rgba(180,220,255,1)';
      ctx.fill();
    }
    ctx.restore();
  }

  // Sand
  const sand = ctx.createLinearGradient(0, H - 20, 0, H);
  sand.addColorStop(0, '#c9aa58');
  sand.addColorStop(1, '#a07c30');
  ctx.fillStyle = sand;
  ctx.fillRect(0, H - 20, W, 20);

  // Murk overlay
  if (tankHealth < 40) {
    ctx.fillStyle = `rgba(60,15,0,${(40 - tankHealth) / 130})`;
    ctx.fillRect(0, 0, W, H);
  }
}

function render() {
  ctx.clearRect(0, 0, W, H);
  drawWater();
  seaweeds.forEach(s => { s.update(); s.draw(ctx, tankHealth); });
  bubbles.forEach(b => { b.update(); b.draw(ctx); });

  // Food & ripples
  for (const p of foodPellets) { p.update(); p.draw(ctx); }
  for (const r of ripples)     { r.update(); r.draw(ctx); }

  // Prune dead objects
  const prune = arr => { for (let i = arr.length - 1; i >= 0; i--) if (!arr[i].alive) arr.splice(i, 1); };
  prune(foodPellets);
  prune(ripples);

  fish.sort((a, b) => a.size - b.size);
  fish.forEach(f => { f.update(W, H, tankHealth, foodPellets); f.draw(ctx, f.health); });

  if (debugMode) {
    ctx.textAlign = 'center';
    ctx.font = 'bold 9px monospace';
    for (const f of fish) {
      const barW = f.size * 2.2;
      const barH = 4;
      const bx = f.x - barW / 2;
      const by = f.y - f.size - 14;

      // Bar background
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(bx, by, barW, barH);

      // Bar fill — green → yellow → red based on fish health
      const hpPct = f.stage === 'dead' ? 0 : f.health / 100;
      ctx.fillStyle = `hsl(${hpPct * 120},90%,50%)`;
      ctx.fillRect(bx, by, barW * hpPct, barH);

      // Stage label
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

// ─── Feed on click ────────────────────────────────────────────────────────────
canvas.style.cursor = 'pointer';
canvas.addEventListener('click', e => {
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (W / rect.width);
  const y = (e.clientY - rect.top)  * (H / rect.height);

  if (debugMode) {
    const hit = fish.find(f => f.hitTest(x, y));
    if (hit) { hit.cycleStage(); return; }
  }

  const count = 5 + Math.floor(Math.random() * 4);
  for (let i = 0; i < count; i++) foodPellets.push(new FoodPellet(x, y, H));
  ripples.push(new Ripple(x, y));
});

// ─── UI ───────────────────────────────────────────────────────────────────────
function fmtTime(min = 0) {
  if (min < 60) return `${Math.floor(min)}m`;
  return `${Math.floor(min / 60)}h ${Math.floor(min % 60)}m`;
}

function scoreColor(s) {
  return `hsl(${s * 1.2},70%,50%)`;
}

function spawnCoinFloat(text) {
  const panel   = document.getElementById('panel');
  const coinRow = document.getElementById('coin-row');
  const div = document.createElement('div');
  div.className = 'coin-float';
  div.textContent = text;
  div.style.left = (coinRow.offsetLeft + coinRow.offsetWidth - 65) + 'px';
  div.style.top  = (coinRow.offsetTop) + 'px';
  panel.appendChild(div);
  div.addEventListener('animationend', () => div.remove());
}

function showBurst(label) {
  const el = document.getElementById('pomo-burst');
  el.textContent = label;
  el.classList.remove('show');
  void el.offsetWidth; // force reflow to restart animation
  el.classList.add('show');
  el.addEventListener('animationend', () => el.classList.remove('show'), { once: true });
}

function applyState({ focusScore = 70, totalFocusMinutes = 0, totalDistractedMinutes = 0,
                      isDistracting = false, currentSite = '', coins = 0 }) {
  health = focusScore;
  if (!debugMode) {
    tankHealth = focusScore;
    document.getElementById('debug-health-slider').value = tankHealth;
    document.getElementById('debug-health-val').textContent = Math.round(tankHealth);
  }

  const bar = document.getElementById('score-bar');
  bar.style.width = focusScore + '%';
  bar.style.background = scoreColor(focusScore);

  const val = document.getElementById('score-value');
  val.textContent = Math.round(focusScore);
  val.style.color = scoreColor(focusScore);

  const dot = document.getElementById('status-dot');
  const txt = document.getElementById('status-text');
  if (!currentSite) {
    dot.className = 'neutral';
    txt.textContent = 'No active tab';
  } else if (isDistracting) {
    dot.className = 'distracted';
    txt.textContent = `Distracted — ${currentSite}`;
  } else {
    dot.className = 'focused';
    txt.textContent = `Focused — ${currentSite}`;
  }

  document.getElementById('focus-time').textContent      = fmtTime(totalFocusMinutes);
  document.getElementById('distracted-time').textContent = fmtTime(totalDistractedMinutes);
  document.getElementById('coin-value').textContent      = Math.floor(coins);

  // Coin delta animation
  if (lastCoins !== null) {
    const delta = coins - lastCoins;
    if (delta > 0.005) spawnCoinFloat(`+${delta.toFixed(2)}`);
  }
  lastCoins = coins;
}

// ─── Pomodoro ─────────────────────────────────────────────────────────────────
const POMO_DURATION = 25 * 60;
let pomoActive    = false;
let pomoRemaining = POMO_DURATION;
let pomoInterval  = null;

function fmtPomo(secs) {
  return `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
}

function updatePomoDisplay() {
  document.getElementById('pomo-display').textContent = fmtPomo(pomoRemaining);
  const btn = document.getElementById('pomo-btn');
  btn.textContent = pomoActive ? 'Pause' : (pomoRemaining < POMO_DURATION ? 'Resume' : 'Start');
  document.getElementById('pomo-row').classList.toggle('active', pomoActive);
}

function spawnRewardFish() {
  const types = ['basic', 'long', 'round'];
  const type  = types[Math.floor(Math.random() * types.length)];
  const hue   = Math.floor(Math.random() * 360);
  const maxS  = 11 + Math.floor(Math.random() * 5);
  const frySize = Math.round(maxS * 0.38);
  const m = frySize * 2;
  const x = m + Math.random() * (W - m * 2);
  const y = m + Math.random() * (H - m * 2 - 25);
  fish.push(new Fish({ x, y, size: maxS, speed: 0.8 + Math.random() * 0.6, hue, type, stage: 'fry' }));
  saveFish();
}

async function completePomodoro() {
  pomoActive    = false;
  pomoRemaining = POMO_DURATION;
  clearInterval(pomoInterval);
  pomoInterval  = null;
  updatePomoDisplay();
  try {
    const { coins = 0 } = await chrome.storage.local.get('coins');
    await chrome.storage.local.set({ coins: Math.round((coins + 25) * 1000) / 1000 });
    poll();
  } catch { /* outside extension context */ }
  spawnRewardFish();
  showBurst('🎉 POMODORO COMPLETE! +25 coins & a new fry!');
}

document.getElementById('pomo-btn').addEventListener('click', () => {
  if (pomoActive) {
    pomoActive = false;
    clearInterval(pomoInterval);
    pomoInterval = null;
  } else {
    if (pomoRemaining <= 0) pomoRemaining = POMO_DURATION;
    pomoActive = true;
    pomoInterval = setInterval(() => {
      pomoRemaining--;
      updatePomoDisplay();
      if (pomoRemaining <= 0) completePomodoro();
    }, 1000);
  }
  updatePomoDisplay();
});

document.getElementById('debug-pomo-btn').addEventListener('click', () => {
  completePomodoro();
});

updatePomoDisplay();

async function checkPendingFish() {
  const { pendingFish = [] } = await chrome.storage.local.get('pendingFish');
  if (pendingFish.length === 0) return;
  for (const { type, hue } of pendingFish) {
    const maxS    = 11 + Math.floor(Math.random() * 5);
    const frySize = Math.round(maxS * 0.38);
    const m = frySize * 2;
    const x = m + Math.random() * (W - m * 2);
    const y = m + Math.random() * (H - m * 2 - 25);
    fish.push(new Fish({ x, y, size: maxS, speed: 0.8 + Math.random() * 0.6, hue, type, stage: 'fry' }));
  }
  saveFish();
  await chrome.storage.local.set({ pendingFish: [] });
  showBurst('🐟 New fish arrived! Check your tank.');
}

async function poll() {
  try {
    const data = await chrome.storage.local.get([
      'focusScore', 'totalFocusMinutes', 'totalDistractedMinutes',
      'isDistracting', 'currentSite', 'coins', 'tankFish',
    ]);
    applyState(data);
    // Sync released fish: remove any whose id is no longer in tankFish
    if (data.tankFish) {
      const storedIds = new Set(data.tankFish.map(f => f.id));
      let changed = false;
      for (let i = fish.length - 1; i >= 0; i--) {
        if (fish[i].id && !storedIds.has(fish[i].id)) {
          fish.splice(i, 1);
          changed = true;
        }
      }
      if (changed) saveFish();
    }
    await checkPendingFish();
  } catch {
    // Running outside extension context (e.g. browser preview)
    applyState({ focusScore: health });
  }
}

document.getElementById('reset-btn').addEventListener('click', async () => {
  await chrome.storage.local.set({ focusScore: 70, totalFocusMinutes: 0, totalDistractedMinutes: 0 });
  poll();
});

render();
initFish().then(() => {
  poll();
  setInterval(poll, 2000);
});

// ─── Settings & Shop ──────────────────────────────────────────────────────────
document.getElementById('settings-btn').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

document.getElementById('shop-btn').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('src/shop/shop.html') });
});

// ─── Debug mode ───────────────────────────────────────────────────────────────
document.getElementById('debug-btn').addEventListener('click', () => {
  debugMode = !debugMode;
  document.getElementById('debug-btn').classList.toggle('active', debugMode);
  document.getElementById('debug-panel').classList.toggle('visible', debugMode);
});

// ─── Debug coin controls ───────────────────────────────────────────────────────
// Extra coin accrual while in debug mode (adds on top of background's base rate)
setInterval(async () => {
  if (!debugMode || coinAccrualMult <= 1) return;
  const extra = (health / 100) * 0.2 * (0.5 / 5) * (coinAccrualMult - 1);
  try {
    const { coins = 0 } = await chrome.storage.local.get('coins');
    await chrome.storage.local.set({ coins: Math.round((coins + extra) * 1000) / 1000 });
  } catch { /* outside extension context */ }
}, 500);

document.getElementById('debug-coin-btns').addEventListener('click', async e => {
  const btn = e.target.closest('.dbg-coin');
  if (!btn) return;
  const amt = Number(btn.dataset.amt);
  try {
    const { coins = 0 } = await chrome.storage.local.get('coins');
    await chrome.storage.local.set({ coins: Math.max(0, Math.round((coins + amt) * 1000) / 1000) });
    poll();
  } catch { /* outside extension context */ }
});

document.getElementById('debug-accrual-slider').addEventListener('input', e => {
  coinAccrualMult = Number(e.target.value);
  document.getElementById('debug-accrual-val').textContent = coinAccrualMult + '×';
});

document.getElementById('debug-health-slider').addEventListener('input', e => {
  tankHealth = Number(e.target.value);
  document.getElementById('debug-health-val').textContent = tankHealth;
});

document.getElementById('debug-rate-slider').addEventListener('input', e => {
  hpReact = Number(e.target.value) / 1000;
  document.getElementById('debug-rate-val').textContent = Number(e.target.value).toFixed(1);
});
