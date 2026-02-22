'use strict';

// ─── Fish ─────────────────────────────────────────────────────────────────────
class Fish {
  constructor({ x, y, size = 22, speed = 1.0, hue = 150 }) {
    this.x = x;
    this.y = y;
    this.tx = x;
    this.ty = y;
    this.size = size;
    this.speed = speed;
    this.hue = hue;
    this.phase = Math.random() * Math.PI * 2;
    this.facing = 1;
    this.wanderCD = 0;
  }

  update(W, H, health) {
    this.phase += 0.05 + (health / 100) * 0.06;
    const spd = 0.4 + (health / 100) * this.speed;

    if (--this.wanderCD <= 0) {
      const m = this.size * 2;
      this.tx = m + Math.random() * (W - m * 2);
      this.ty = m + Math.random() * (H - m * 2 - 25);
      this.wanderCD = 80 + Math.random() * 120;
    }

    const dx = this.tx - this.x;
    const dy = this.ty - this.y;
    const d = Math.hypot(dx, dy);
    if (d > 2) {
      this.x += (dx / d) * spd;
      this.y += (dy / d) * spd;
      this.facing = dx > 0 ? 1 : -1;
    }
    this.y += Math.sin(this.phase * 0.7) * 0.25;
  }

  draw(ctx, health) {
    const { x, y, size: s, phase, facing, hue } = this;
    const t = health / 100;
    const h = t * hue;
    const col  = `hsl(${h},65%,45%)`;
    const dark = `hsl(${h},65%,33%)`;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(facing, 1);

    const wag = Math.sin(phase) * s * 0.38;

    // Tail
    ctx.beginPath();
    ctx.moveTo(-s * 0.65, 0);
    ctx.lineTo(-s * 1.25, -s * 0.58 + wag);
    ctx.lineTo(-s * 1.25,  s * 0.58 + wag);
    ctx.closePath();
    ctx.fillStyle = dark;
    ctx.fill();

    // Body
    ctx.beginPath();
    ctx.ellipse(0, 0, s, s * 0.52, 0, 0, Math.PI * 2);
    ctx.fillStyle = col;
    ctx.fill();

    // Belly shimmer
    ctx.beginPath();
    ctx.ellipse(s * 0.12, s * 0.12, s * 0.52, s * 0.22, -0.3, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${h},65%,67%,0.35)`;
    ctx.fill();

    // Dorsal fin
    ctx.beginPath();
    ctx.moveTo(-s * 0.05, -s * 0.52);
    ctx.quadraticCurveTo(s * 0.28, -s * 0.9, s * 0.62, -s * 0.52);
    ctx.fillStyle = dark;
    ctx.fill();

    // Eye white
    ctx.beginPath();
    ctx.arc(s * 0.56, -s * 0.07, s * 0.18, 0, Math.PI * 2);
    ctx.fillStyle = 'white';
    ctx.fill();

    // Pupil
    ctx.beginPath();
    ctx.arc(s * 0.60, -s * 0.07, s * 0.10, 0, Math.PI * 2);
    ctx.fillStyle = '#111';
    ctx.fill();

    // Expression
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = dark;
    if (health < 35) {
      ctx.beginPath();
      ctx.arc(s * 0.38, s * 0.18, s * 0.13, 0.15, Math.PI - 0.15);
      ctx.stroke();
    } else if (health > 68) {
      ctx.beginPath();
      ctx.arc(s * 0.38, s * 0.04, s * 0.13, 0.15, Math.PI - 0.15, true);
      ctx.stroke();
    }

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

// ─── Scene setup ─────────────────────────────────────────────────────────────
const W = 360, H = 260;
const canvas = document.getElementById('tank');
const ctx = canvas.getContext('2d');

const fish = [
  new Fish({ x: 180, y: 100, size: 24, speed: 1.2, hue: 155 }),
  new Fish({ x:  80, y: 160, size: 16, speed: 0.9, hue: 170 }),
  new Fish({ x: 280, y: 130, size: 19, speed: 1.0, hue: 140 }),
];
const bubbles  = Array.from({ length: 14 }, () => new Bubble(W, H));
const seaweeds = [35, 100, 210, 310].map(x => new Seaweed(x, H));

let health = 70;

function drawWater() {
  const dark = (1 - health / 100) * 0.55;
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, `hsl(210,${68 - dark * 30}%,${20 - dark * 12}%)`);
  grad.addColorStop(1, `hsl(220,${75 - dark * 30}%,${12 - dark * 8}%)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Caustic light rays when healthy
  if (health > 45) {
    ctx.save();
    ctx.globalAlpha = ((health - 45) / 55) * 0.07;
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
  if (health < 40) {
    ctx.fillStyle = `rgba(60,15,0,${(40 - health) / 130})`;
    ctx.fillRect(0, 0, W, H);
  }
}

function render() {
  ctx.clearRect(0, 0, W, H);
  drawWater();
  seaweeds.forEach(s => { s.update(); s.draw(ctx, health); });
  bubbles.forEach(b => { b.update(); b.draw(ctx); });
  fish.sort((a, b) => a.size - b.size);
  fish.forEach(f => { f.update(W, H, health); f.draw(ctx, health); });
  requestAnimationFrame(render);
}

// ─── UI ───────────────────────────────────────────────────────────────────────
function fmtTime(min = 0) {
  if (min < 60) return `${Math.floor(min)}m`;
  return `${Math.floor(min / 60)}h ${Math.floor(min % 60)}m`;
}

function scoreColor(s) {
  return `hsl(${s * 1.2},70%,50%)`;
}

function applyState({ focusScore = 70, totalFocusMinutes = 0, totalDistractedMinutes = 0,
                      isDistracting = false, currentSite = '' }) {
  health = focusScore;

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
}

async function poll() {
  try {
    const data = await chrome.storage.local.get([
      'focusScore', 'totalFocusMinutes', 'totalDistractedMinutes', 'isDistracting', 'currentSite',
    ]);
    applyState(data);
  } catch {
    // Running outside extension context (e.g. browser preview)
    applyState({ focusScore: health });
  }
}

document.getElementById('reset-btn').addEventListener('click', async () => {
  await chrome.storage.local.set({ focusScore: 70, totalFocusMinutes: 0, totalDistractedMinutes: 0 });
  poll();
});

poll();
setInterval(poll, 2000);
render();
