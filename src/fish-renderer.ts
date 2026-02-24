// ─── Fish Renderer ───────────────────────────────────────────────────────────
// Single source of truth for all fish and decoration canvas drawing.
// Used by popup/tank.ts (live animation) and settings/main.ts (static previews).

import type { FishType, FishStage, DecorationType } from './types';

// ── Colour palette ─────────────────────────────────────────────────────────

interface DrawColors {
  hue:       number;   // species hue (constant throughout lifetime)
  col:       string;   // main body fill
  dark:      string;   // fins, tail, outline, stripe
  highlight: string;   // lighter gradient centre (always hue-tinted, never white)
}

function adultColors(hue: number, health: number): DrawColors {
  // Hue is fixed — health only shifts saturation and lightness
  const t   = health / 100;
  const sat = Math.round(35 + t * 47);        // 82% healthy → 35% very sick
  const lit = Math.round(36 + t * 14);        // 50% healthy → 36% very sick
  return {
    hue,
    col:       `hsl(${hue},${sat}%,${lit}%)`,
    dark:      `hsl(${hue},${Math.round(sat * 0.9)}%,${Math.round(lit * 0.58)}%)`,
    highlight: `hsl(${hue},${Math.round(sat * 0.68)}%,${Math.min(66, lit + 17)}%)`,
  };
}

function juvenileColors(hue: number): DrawColors {
  // Same hue as adult — monochromatic, just more muted
  return {
    hue,
    col:       `hsl(${hue},38%,44%)`,
    dark:      `hsl(${hue},38%,28%)`,
    highlight: `hsl(${hue},28%,58%)`,
  };
}

const GRAY: DrawColors = {
  hue: 0, col: '#6a6a6a', dark: '#434343', highlight: '#a0a0a0',
};

// ── Shared helpers ─────────────────────────────────────────────────────────

/** Improved eye: white sclera → coloured iris gradient → dark pupil → specular. */
function drawEye(
  ctx: CanvasRenderingContext2D,
  ex: number, ey: number, r: number, hue: number,
): void {
  // Sclera
  ctx.beginPath(); ctx.arc(ex, ey, r, 0, Math.PI * 2);
  ctx.fillStyle = 'white'; ctx.fill();
  // Iris gradient
  const ig = ctx.createRadialGradient(ex + r * 0.1, ey, 0, ex, ey, r * 0.76);
  ig.addColorStop(0, `hsl(${hue},60%,42%)`);
  ig.addColorStop(1, `hsl(${hue},60%,18%)`);
  ctx.beginPath(); ctx.arc(ex + r * 0.1, ey, r * 0.64, 0, Math.PI * 2);
  ctx.fillStyle = ig; ctx.fill();
  // Pupil
  ctx.beginPath(); ctx.arc(ex + r * 0.18, ey, r * 0.34, 0, Math.PI * 2);
  ctx.fillStyle = '#111'; ctx.fill();
  // Specular highlight (small)
  ctx.beginPath(); ctx.arc(ex - r * 0.05, ey - r * 0.3, r * 0.13, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.80)'; ctx.fill();
}

/** Soft colour glow behind the body — only for healthy fish (health > 55). */
function applyGlow(
  ctx: CanvasRenderingContext2D,
  hue: number, health: number, radius: number,
): void {
  if (health > 55) {
    const t = Math.min(1, (health - 55) / 45);
    ctx.shadowColor = `hsla(${hue},100%,60%,${0.22 * t})`;
    ctx.shadowBlur  = radius * 0.55 * t;
  }
}

// ── Shape draw functions ───────────────────────────────────────────────────
// All shapes are drawn with the ctx already translated to the fish centre.
// +X = toward nose,  +Y = downward,  wag = vertical tail displacement.

function drawBasicShape(
  ctx: CanvasRenderingContext2D, s: number, wag: number,
  c: DrawColors, health?: number,
): void {
  // ── Tail: smooth bezier fan ──
  ctx.beginPath();
  ctx.moveTo(-s * 0.55, s * 0.06);
  ctx.quadraticCurveTo(-s * 1.0,  -s * 0.16 + wag * 0.55, -s * 1.26, -s * 0.58 + wag);
  ctx.quadraticCurveTo(-s * 1.42,  wag * 0.38,              -s * 1.26,  s * 0.58 + wag);
  ctx.quadraticCurveTo(-s * 1.0,   s * 0.16 + wag * 0.55,  -s * 0.55, -s * 0.06);
  ctx.closePath();
  ctx.fillStyle = c.dark; ctx.fill();

  // ── Body: radial gradient for 3-D roundness ──
  if (health !== undefined) applyGlow(ctx, c.hue, health, s);
  const bg = ctx.createRadialGradient(s * 0.18, -s * 0.20, s * 0.06, 0, 0, s * 1.08);
  bg.addColorStop(0,    c.highlight);
  bg.addColorStop(0.38, c.col);
  bg.addColorStop(1,    c.dark);
  ctx.beginPath(); ctx.ellipse(0, 0, s, s * 0.52, 0, 0, Math.PI * 2);
  ctx.fillStyle = bg; ctx.fill();
  ctx.shadowBlur = 0;

  // ── Body outline ──
  ctx.beginPath(); ctx.ellipse(0, 0, s, s * 0.52, 0, 0, Math.PI * 2);
  ctx.strokeStyle = c.dark; ctx.lineWidth = s * 0.042; ctx.stroke();

  // ── Sick tint ──
  if (health !== undefined && health < 20) {
    ctx.beginPath(); ctx.ellipse(0, s * 0.05, s * 0.60, s * 0.38, 0, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(80,200,60,${0.18 + (20 - health) / 100})`; ctx.fill();
  }

  // ── Pectoral fin ──
  ctx.beginPath(); ctx.ellipse(s * 0.20, s * 0.35, s * 0.22, s * 0.09, -0.55, 0, Math.PI * 2);
  ctx.globalAlpha = 0.65; ctx.fillStyle = c.dark; ctx.fill(); ctx.globalAlpha = 1;

  // ── Dorsal fin (bezier for smooth arc) ──
  ctx.beginPath();
  ctx.moveTo(-s * 0.06, -s * 0.52);
  ctx.bezierCurveTo(s * 0.12, -s * 0.98, s * 0.44, -s * 0.96, s * 0.64, -s * 0.52);
  ctx.fillStyle = c.dark; ctx.fill();

  // ── Eye ──
  drawEye(ctx, s * 0.58, -s * 0.07, s * 0.19, c.hue);

  // ── Expression ──
  if (health !== undefined) {
    ctx.lineWidth = s * 0.065; ctx.strokeStyle = c.dark; ctx.lineCap = 'round';
    if      (health < 35) { ctx.beginPath(); ctx.arc(s*0.38, s*0.18, s*0.13, 0.15, Math.PI-0.15);       ctx.stroke(); }
    else if (health > 68) { ctx.beginPath(); ctx.arc(s*0.38, s*0.04, s*0.13, 0.15, Math.PI-0.15, true); ctx.stroke(); }
  }
}

function drawLongShape(
  ctx: CanvasRenderingContext2D, s: number, wag: number,
  c: DrawColors, health?: number,
): void {
  // ── Forked tail: two smooth bezier lobes ──
  for (const sign of [-1, 1] as const) {
    ctx.beginPath();
    ctx.moveTo(-s * 0.82, sign * s * 0.06);
    ctx.quadraticCurveTo(-s * 1.24, sign * s * 0.20 + wag * sign * 0.5, -s * 1.62, sign * s * 0.55 + wag);
    ctx.quadraticCurveTo(-s * 1.34, sign * s * 0.06 + wag * 0.3,         -s * 0.82, sign * s * 0.06);
    ctx.closePath();
    ctx.fillStyle = c.dark; ctx.fill();
  }

  // ── Body: elongated radial gradient ──
  if (health !== undefined) applyGlow(ctx, c.hue, health, s);
  const bg = ctx.createRadialGradient(s * 0.22, -s * 0.16, s * 0.05, 0, 0, s * 1.5);
  bg.addColorStop(0,    c.highlight);
  bg.addColorStop(0.38, c.col);
  bg.addColorStop(1,    c.dark);
  ctx.beginPath(); ctx.ellipse(0, 0, s * 1.4, s * 0.38, 0, 0, Math.PI * 2);
  ctx.fillStyle = bg; ctx.fill();
  ctx.shadowBlur = 0;

  // ── Body outline ──
  ctx.beginPath(); ctx.ellipse(0, 0, s * 1.4, s * 0.38, 0, 0, Math.PI * 2);
  ctx.strokeStyle = c.dark; ctx.lineWidth = s * 0.04; ctx.stroke();

  // ── Lateral stripe (dark mid-band) ──
  ctx.beginPath(); ctx.ellipse(0, 0, s * 1.12, s * 0.11, 0, 0, Math.PI * 2);
  ctx.fillStyle = c.dark; ctx.fill();

  // ── Sick tint ──
  if (health !== undefined && health < 20) {
    ctx.beginPath(); ctx.ellipse(0, 0, s * 0.9, s * 0.30, 0, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(80,200,60,${0.18 + (20 - health) / 100})`; ctx.fill();
  }

  // ── Pectoral fin ──
  ctx.beginPath(); ctx.ellipse(s * 0.30, s * 0.26, s * 0.22, s * 0.09, -0.5, 0, Math.PI * 2);
  ctx.globalAlpha = 0.65; ctx.fillStyle = c.dark; ctx.fill(); ctx.globalAlpha = 1;

  // ── Dorsal fin ──
  ctx.beginPath();
  ctx.moveTo(-s * 0.30, -s * 0.38);
  ctx.bezierCurveTo(s * 0.0, -s * 0.68, s * 0.32, -s * 0.68, s * 0.52, -s * 0.38);
  ctx.fillStyle = c.dark; ctx.fill();

  // ── Eye ──
  drawEye(ctx, s * 0.78, -s * 0.06, s * 0.15, c.hue);

  // ── Expression ──
  if (health !== undefined) {
    ctx.lineWidth = s * 0.055; ctx.strokeStyle = c.dark; ctx.lineCap = 'round';
    if      (health < 35) { ctx.beginPath(); ctx.arc(s*0.62, s*0.14, s*0.10, 0.15, Math.PI-0.15);       ctx.stroke(); }
    else if (health > 68) { ctx.beginPath(); ctx.arc(s*0.62, s*0.04, s*0.10, 0.15, Math.PI-0.15, true); ctx.stroke(); }
  }
}

function drawRoundShape(
  ctx: CanvasRenderingContext2D, s: number, wag: number,
  c: DrawColors, health?: number,
): void {
  // ── Stubby tail: smooth fan ──
  ctx.beginPath();
  ctx.moveTo(-s * 0.62, s * 0.05);
  ctx.quadraticCurveTo(-s * 0.92, -s * 0.10 + wag * 0.5, -s * 1.06, -s * 0.42 + wag);
  ctx.quadraticCurveTo(-s * 1.20,  wag * 0.32,             -s * 1.06,  s * 0.42 + wag);
  ctx.quadraticCurveTo(-s * 0.92,  s * 0.10 + wag * 0.5,  -s * 0.62, -s * 0.05);
  ctx.closePath();
  ctx.fillStyle = c.dark; ctx.fill();

  // ── Body: radial gradient — nearly circular ──
  if (health !== undefined) applyGlow(ctx, c.hue, health, s);
  const bg = ctx.createRadialGradient(s * 0.16, -s * 0.22, s * 0.06, 0, 0, s * 1.0);
  bg.addColorStop(0,    c.highlight);
  bg.addColorStop(0.40, c.col);
  bg.addColorStop(1,    c.dark);
  ctx.beginPath(); ctx.ellipse(0, 0, s * 0.95, s * 0.85, 0, 0, Math.PI * 2);
  ctx.fillStyle = bg; ctx.fill();
  ctx.shadowBlur = 0;

  // ── Body outline ──
  ctx.beginPath(); ctx.ellipse(0, 0, s * 0.95, s * 0.85, 0, 0, Math.PI * 2);
  ctx.strokeStyle = c.dark; ctx.lineWidth = s * 0.042; ctx.stroke();

  // ── Sick tint ──
  if (health !== undefined && health < 20) {
    ctx.beginPath(); ctx.ellipse(0, 0, s * 0.65, s * 0.60, 0, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(80,200,60,${0.18 + (20 - health) / 100})`; ctx.fill();
  }

  // ── Pectoral fins (cute side pair) ──
  for (const [ex, ey, ang] of [[s * 0.08, s * 0.52, -0.28], [s * 0.36, s * 0.55, 0.22]] as [number, number, number][]) {
    ctx.beginPath(); ctx.ellipse(ex, ey, s * 0.24, s * 0.10, ang, 0, Math.PI * 2);
    ctx.globalAlpha = 0.62; ctx.fillStyle = c.dark; ctx.fill(); ctx.globalAlpha = 1;
  }

  // ── Dorsal spines: three curved fin shapes ──
  for (const [bx, tipX, tipY] of [
    [-s * 0.26, -s * 0.20, -s * 1.20],
    [ s * 0.04,  s * 0.08, -s * 1.24],
    [ s * 0.34,  s * 0.40, -s * 1.16],
  ] as [number, number, number][]) {
    ctx.beginPath();
    ctx.moveTo(bx - s * 0.10, -s * 0.84);
    ctx.quadraticCurveTo(tipX - s * 0.04, tipY, tipX, tipY);
    ctx.quadraticCurveTo(tipX + s * 0.04, tipY, bx + s * 0.10, -s * 0.84);
    ctx.closePath();
    ctx.fillStyle = c.dark; ctx.fill();
  }

  // ── Cheek blush ──
  ctx.beginPath(); ctx.arc(s * 0.38, s * 0.12, s * 0.15, 0, Math.PI * 2);
  ctx.fillStyle = `hsla(${c.hue + 30},80%,65%,0.20)`; ctx.fill();

  // ── Big eye ──
  drawEye(ctx, s * 0.48, -s * 0.18, s * 0.24, c.hue);

  // ── Expression ──
  if (health !== undefined) {
    ctx.lineWidth = s * 0.065; ctx.strokeStyle = c.dark; ctx.lineCap = 'round';
    if      (health < 35) { ctx.beginPath(); ctx.arc(s*0.25, s*0.28, s*0.13, 0.15, Math.PI-0.15);       ctx.stroke(); }
    else if (health > 68) { ctx.beginPath(); ctx.arc(s*0.25, s*0.18, s*0.13, 0.15, Math.PI-0.15, true); ctx.stroke(); }
  }
}

function drawAngelShape(
  ctx: CanvasRenderingContext2D, s: number, wag: number,
  c: DrawColors, health?: number,
): void {
  // Angelfish: tall diamond body, long flowing dorsal and ventral fins, short elegant tail.
  // Centre is mid-body; +X = head direction, +Y = down.

  // ── Small rounded tail ──
  ctx.beginPath();
  ctx.moveTo(-s * 0.60, s * 0.04);
  ctx.quadraticCurveTo(-s * 0.88, -s * 0.10 + wag * 0.45, -s * 1.02, -s * 0.35 + wag);
  ctx.quadraticCurveTo(-s * 1.12,  wag * 0.28,             -s * 1.02,  s * 0.35 + wag);
  ctx.quadraticCurveTo(-s * 0.88,  s * 0.10 + wag * 0.45,  -s * 0.60, -s * 0.04);
  ctx.closePath();
  ctx.fillStyle = c.dark; ctx.fill();

  // ── Long dorsal fin sweeping up and back ──
  ctx.beginPath();
  ctx.moveTo(-s * 0.40, -s * 0.90);
  ctx.bezierCurveTo(-s * 0.10, -s * 1.80, s * 0.30, -s * 1.90, s * 0.58, -s * 0.90);
  ctx.quadraticCurveTo(s * 0.20, -s * 1.10, -s * 0.40, -s * 0.90);
  ctx.closePath();
  ctx.globalAlpha = 0.82; ctx.fillStyle = c.dark; ctx.fill(); ctx.globalAlpha = 1;

  // ── Long ventral fin sweeping down and back ──
  ctx.beginPath();
  ctx.moveTo(-s * 0.35, s * 0.85);
  ctx.bezierCurveTo(-s * 0.08, s * 1.70, s * 0.28, s * 1.80, s * 0.52, s * 0.85);
  ctx.quadraticCurveTo(s * 0.18, s * 1.05, -s * 0.35, s * 0.85);
  ctx.closePath();
  ctx.globalAlpha = 0.82; ctx.fillStyle = c.dark; ctx.fill(); ctx.globalAlpha = 1;

  // ── Body: tall, diamond-like (taller than wide) ──
  if (health !== undefined) applyGlow(ctx, c.hue, health, s);
  const bg = ctx.createRadialGradient(s * 0.14, -s * 0.20, s * 0.05, 0, 0, s * 1.10);
  bg.addColorStop(0,    c.highlight);
  bg.addColorStop(0.38, c.col);
  bg.addColorStop(1,    c.dark);
  ctx.beginPath(); ctx.ellipse(0, 0, s * 0.72, s * 1.02, 0, 0, Math.PI * 2);
  ctx.fillStyle = bg; ctx.fill();
  ctx.shadowBlur = 0;

  // ── Body outline ──
  ctx.beginPath(); ctx.ellipse(0, 0, s * 0.72, s * 1.02, 0, 0, Math.PI * 2);
  ctx.strokeStyle = c.dark; ctx.lineWidth = s * 0.04; ctx.stroke();

  // ── Vertical stripe (classic angelfish band) ──
  ctx.beginPath();
  ctx.ellipse(s * 0.05, 0, s * 0.08, s * 0.95, 0, 0, Math.PI * 2);
  ctx.fillStyle = `${c.dark}88`; ctx.fill();

  // ── Sick tint ──
  if (health !== undefined && health < 20) {
    ctx.beginPath(); ctx.ellipse(0, 0, s * 0.55, s * 0.75, 0, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(80,200,60,${0.18 + (20 - health) / 100})`; ctx.fill();
  }

  // ── Small pectoral fin ──
  ctx.beginPath(); ctx.ellipse(s * 0.24, s * 0.28, s * 0.18, s * 0.08, -0.4, 0, Math.PI * 2);
  ctx.globalAlpha = 0.60; ctx.fillStyle = c.dark; ctx.fill(); ctx.globalAlpha = 1;

  // ── Eye ──
  drawEye(ctx, s * 0.42, -s * 0.10, s * 0.17, c.hue);

  // ── Expression ──
  if (health !== undefined) {
    ctx.lineWidth = s * 0.065; ctx.strokeStyle = c.dark; ctx.lineCap = 'round';
    if      (health < 35) { ctx.beginPath(); ctx.arc(s*0.28, s*0.16, s*0.12, 0.15, Math.PI-0.15);       ctx.stroke(); }
    else if (health > 68) { ctx.beginPath(); ctx.arc(s*0.28, s*0.04, s*0.12, 0.15, Math.PI-0.15, true); ctx.stroke(); }
  }
}

function drawBettaShape(
  ctx: CanvasRenderingContext2D, s: number, wag: number,
  c: DrawColors, health?: number,
): void {
  // Betta: oval body with enormous flowing veil tail fan and long dorsal/ventral fins.

  // ── Huge flowing veil tail (multiple bezier fans) ──
  const numRays = 7;
  for (let i = 0; i < numRays; i++) {
    const t = (i / (numRays - 1)) - 0.5; // -0.5 to 0.5
    const tipX = -s * 1.8 + wag * t * 0.4;
    const tipY = t * s * 1.6 + wag;
    ctx.beginPath();
    ctx.moveTo(-s * 0.55, 0);
    ctx.bezierCurveTo(-s * 0.90, t * s * 0.8, tipX + s * 0.3, tipY - t * s * 0.2, tipX, tipY);
    ctx.bezierCurveTo(tipX + s * 0.1, tipY + t * s * 0.1, -s * 0.80, t * s * 0.5, -s * 0.55, 0);
    ctx.globalAlpha = 0.70; ctx.fillStyle = c.dark; ctx.fill(); ctx.globalAlpha = 1;
  }

  // ── Long flowing dorsal fin (ribbon-like across top of body) ──
  ctx.beginPath();
  ctx.moveTo(-s * 0.42, -s * 0.52);
  ctx.bezierCurveTo(-s * 0.10, -s * 1.05, s * 0.28, -s * 1.08, s * 0.62, -s * 0.52);
  ctx.bezierCurveTo(s * 0.30, -s * 0.70, -s * 0.10, -s * 0.74, -s * 0.42, -s * 0.52);
  ctx.closePath();
  ctx.globalAlpha = 0.78; ctx.fillStyle = c.dark; ctx.fill(); ctx.globalAlpha = 1;

  // ── Ventral/anal fin flowing below ──
  ctx.beginPath();
  ctx.moveTo(-s * 0.10, s * 0.52);
  ctx.bezierCurveTo(s * 0.0, s * 1.05, s * 0.38, s * 1.08, s * 0.60, s * 0.52);
  ctx.bezierCurveTo(s * 0.32, s * 0.72, -s * 0.02, s * 0.75, -s * 0.10, s * 0.52);
  ctx.closePath();
  ctx.globalAlpha = 0.70; ctx.fillStyle = c.dark; ctx.fill(); ctx.globalAlpha = 1;

  // ── Body: oval ──
  if (health !== undefined) applyGlow(ctx, c.hue, health, s);
  const bg = ctx.createRadialGradient(s * 0.20, -s * 0.18, s * 0.06, 0, 0, s * 1.05);
  bg.addColorStop(0,    c.highlight);
  bg.addColorStop(0.38, c.col);
  bg.addColorStop(1,    c.dark);
  ctx.beginPath(); ctx.ellipse(0, 0, s, s * 0.56, 0, 0, Math.PI * 2);
  ctx.fillStyle = bg; ctx.fill();
  ctx.shadowBlur = 0;

  // ── Body outline ──
  ctx.beginPath(); ctx.ellipse(0, 0, s, s * 0.56, 0, 0, Math.PI * 2);
  ctx.strokeStyle = c.dark; ctx.lineWidth = s * 0.04; ctx.stroke();

  // ── Iridescent scale shimmer (subtle opalescent overlay) ──
  const shimG = ctx.createRadialGradient(s * 0.15, -s * 0.12, 0, s * 0.10, -s * 0.10, s * 0.65);
  shimG.addColorStop(0, `hsla(${c.hue + 60},80%,70%,0.28)`);
  shimG.addColorStop(1, `hsla(${c.hue + 60},60%,60%,0.00)`);
  ctx.beginPath(); ctx.ellipse(0, 0, s, s * 0.56, 0, 0, Math.PI * 2);
  ctx.fillStyle = shimG; ctx.fill();

  // ── Sick tint ──
  if (health !== undefined && health < 20) {
    ctx.beginPath(); ctx.ellipse(0, s * 0.04, s * 0.65, s * 0.42, 0, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(80,200,60,${0.18 + (20 - health) / 100})`; ctx.fill();
  }

  // ── Pectoral fin ──
  ctx.beginPath(); ctx.ellipse(s * 0.22, s * 0.34, s * 0.20, s * 0.09, -0.52, 0, Math.PI * 2);
  ctx.globalAlpha = 0.60; ctx.fillStyle = c.dark; ctx.fill(); ctx.globalAlpha = 1;

  // ── Eye ──
  drawEye(ctx, s * 0.60, -s * 0.08, s * 0.18, c.hue);

  // ── Expression ──
  if (health !== undefined) {
    ctx.lineWidth = s * 0.065; ctx.strokeStyle = c.dark; ctx.lineCap = 'round';
    if      (health < 35) { ctx.beginPath(); ctx.arc(s*0.40, s*0.18, s*0.12, 0.15, Math.PI-0.15);       ctx.stroke(); }
    else if (health > 68) { ctx.beginPath(); ctx.arc(s*0.40, s*0.06, s*0.12, 0.15, Math.PI-0.15, true); ctx.stroke(); }
  }
}

/** Eye centre for X-eye overlay on dead fish (non-flipped screen pass). */
function eyePos(type: FishType, s: number): { ex: number; ey: number; eyeR: number } {
  if (type === 'long')  return { ex: s * 0.78, ey: s * 0.06, eyeR: s * 0.09 };
  if (type === 'round') return { ex: s * 0.48, ey: s * 0.18, eyeR: s * 0.11 };
  if (type === 'angel') return { ex: s * 0.42, ey: s * 0.10, eyeR: s * 0.09 };
  if (type === 'betta') return { ex: s * 0.60, ey: s * 0.08, eyeR: s * 0.10 };
  return                       { ex: s * 0.58, ey: s * 0.07, eyeR: s * 0.10 };
}

// ── Public drawing functions ───────────────────────────────────────────────

/** Fry: uniform species-agnostic teardrop, teal, with belly glint and eye specular. */
export function drawFry(ctx: CanvasRenderingContext2D, s: number, wag: number): void {
  const col   = 'hsl(175,58%,48%)';
  const dark  = 'hsl(175,58%,30%)';
  const belly = 'hsla(175,45%,78%,0.52)';

  // Tail: smooth fan
  ctx.beginPath();
  ctx.moveTo(-s * 0.58, s * 0.05);
  ctx.quadraticCurveTo(-s * 0.88, wag * 0.5,   -s * 0.96, -s * 0.38 + wag);
  ctx.quadraticCurveTo(-s * 1.06, wag * 0.28,  -s * 0.96,  s * 0.38 + wag);
  ctx.quadraticCurveTo(-s * 0.88, wag * 0.5,   -s * 0.58, -s * 0.05);
  ctx.closePath();
  ctx.fillStyle = dark; ctx.fill();

  // Body
  ctx.beginPath(); ctx.ellipse(0, 0, s, s * 0.65, 0, 0, Math.PI * 2);
  ctx.fillStyle = col; ctx.fill();

  // Body outline
  ctx.beginPath(); ctx.ellipse(0, 0, s, s * 0.65, 0, 0, Math.PI * 2);
  ctx.strokeStyle = dark; ctx.lineWidth = s * 0.04; ctx.stroke();

  // Belly highlight
  ctx.beginPath(); ctx.ellipse(s * 0.06, s * 0.26, s * 0.55, s * 0.26, 0.15, 0, Math.PI * 2);
  ctx.fillStyle = belly; ctx.fill();

  // Eye (small but has glint)
  ctx.beginPath(); ctx.arc(s * 0.50, -s * 0.10, s * 0.14, 0, Math.PI * 2);
  ctx.fillStyle = 'white'; ctx.fill();
  ctx.beginPath(); ctx.arc(s * 0.52, -s * 0.10, s * 0.09, 0, Math.PI * 2);
  ctx.fillStyle = '#111'; ctx.fill();
  ctx.beginPath(); ctx.arc(s * 0.44, -s * 0.16, s * 0.05, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.86)'; ctx.fill();
}

/**
 * Draw a live (non-dead) fish at (0,0) in an already-translated+scaled context.
 * Handles fry / juvenile / adult stages with appropriate colour reveal.
 */
export function drawLiveFish(
  ctx: CanvasRenderingContext2D,
  type: FishType, stage: FishStage, hue: number,
  s: number, wag: number, health: number,
): void {
  if (stage === 'fry') { drawFry(ctx, s, wag); return; }

  const colors = stage === 'juvenile' ? juvenileColors(hue) : adultColors(hue, health);

  if      (type === 'long')  drawLongShape (ctx, s, wag, colors, health);
  else if (type === 'round') drawRoundShape(ctx, s, wag, colors, health);
  else if (type === 'angel') drawAngelShape(ctx, s, wag, colors, health);
  else if (type === 'betta') drawBettaShape(ctx, s, wag, colors, health);
  else                       drawBasicShape(ctx, s, wag, colors, health);
}

/**
 * Draw a dead fish — grayscale, upside-down, species-appropriate shape, X eyes.
 * Manages its own save/translate/scale internally (caller passes world coords).
 */
export function drawDeadFish(
  ctx: CanvasRenderingContext2D,
  type: FishType, s: number, wag: number,
  x: number, y: number, facing: number,
): void {
  // Flipped body (upside-down, no health → no glow / no expression)
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing, -1);
  if      (type === 'long')  drawLongShape (ctx, s, wag, GRAY);
  else if (type === 'round') drawRoundShape(ctx, s, wag, GRAY);
  else if (type === 'angel') drawAngelShape(ctx, s, wag, GRAY);
  else if (type === 'betta') drawBettaShape(ctx, s, wag, GRAY);
  else                       drawBasicShape(ctx, s, wag, GRAY);
  ctx.restore();

  // X eyes — separate non-flipped pass
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing, 1);
  const { ex, ey, eyeR } = eyePos(type, s);
  ctx.strokeStyle = '#333';
  ctx.lineWidth   = Math.max(1, s * 0.07);
  ctx.lineCap     = 'round';
  ctx.beginPath();
  ctx.moveTo(ex - eyeR, ey - eyeR); ctx.lineTo(ex + eyeR, ey + eyeR);
  ctx.moveTo(ex + eyeR, ey - eyeR); ctx.lineTo(ex - eyeR, ey + eyeR);
  ctx.stroke();
  ctx.restore();
}

/**
 * Render a static fish preview onto a canvas (shop cards, settings page).
 * Fills the canvas with a dark gradient then draws the fish centred.
 */
export function drawFishPreview(
  canvas: HTMLCanvasElement,
  type: FishType, hue: number, stage: FishStage,
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const { width: cW, height: cH } = canvas;

  const g = ctx.createLinearGradient(0, 0, 0, cH);
  g.addColorStop(0, 'hsl(210,68%,10%)');
  g.addColorStop(1, 'hsl(220,75%,6%)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, cW, cH);

  const cx = cW / 2;
  const cy = cH / 2;
  // Angel is tall so needs smaller s; betta has wide tail so also slightly smaller
  const s  = type === 'long'  ? Math.round(cH * 0.30)
           : type === 'angel' ? Math.round(cH * 0.25)
           : type === 'betta' ? Math.round(cH * 0.28)
           : Math.round(cH * 0.36);

  ctx.save();
  ctx.translate(cx, cy);

  if (stage === 'fry') {
    drawFry(ctx, Math.round(cH * 0.22), 0);
  } else if (stage === 'dead') {
    ctx.scale(1, -1);
    if      (type === 'long')  drawLongShape (ctx, s, 0, GRAY);
    else if (type === 'round') drawRoundShape(ctx, s, 0, GRAY);
    else if (type === 'angel') drawAngelShape(ctx, s, 0, GRAY);
    else if (type === 'betta') drawBettaShape(ctx, s, 0, GRAY);
    else                       drawBasicShape(ctx, s, 0, GRAY);
    ctx.scale(1, -1); // restore for X eyes
    const { ex, ey, eyeR } = eyePos(type, s);
    ctx.strokeStyle = '#333'; ctx.lineWidth = Math.max(1, s * 0.07); ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(ex - eyeR, ey - eyeR); ctx.lineTo(ex + eyeR, ey + eyeR);
    ctx.moveTo(ex + eyeR, ey - eyeR); ctx.lineTo(ex - eyeR, ey + eyeR);
    ctx.stroke();
  } else {
    const drawHue = stage === 'juvenile' ? Math.round(175 + (hue - 175) * 0.5) : hue;
    const colors  = adultColors(drawHue, 100); // full health for preview
    if      (type === 'long')  drawLongShape (ctx, s, 0, colors, 100);
    else if (type === 'round') drawRoundShape(ctx, s, 0, colors, 100);
    else if (type === 'angel') drawAngelShape(ctx, s, 0, colors, 100);
    else if (type === 'betta') drawBettaShape(ctx, s, 0, colors, 100);
    else                       drawBasicShape(ctx, s, 0, colors, 100);
  }

  ctx.restore();
}

// ── Decoration drawing ─────────────────────────────────────────────────────

function drawKelp(
  ctx: CanvasRenderingContext2D, baseY: number, scale: number, hue: number, phase: number,
): void {
  const h = 55 * scale;
  const joints = 5;
  const segH = h / joints;

  for (let stalk = -1; stalk <= 1; stalk += 2) {
    ctx.strokeStyle = `hsl(${hue},62%,30%)`; ctx.lineWidth = 3.5 * scale; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(stalk * 5 * scale, baseY);
    for (let i = 0; i < joints; i++) {
      const sway = Math.sin(phase + i * 0.7 + stalk * 0.4) * (3 + i * 1.4) * scale;
      ctx.lineTo(stalk * 5 * scale + sway, baseY - (i + 1) * segH);
    }
    ctx.stroke();

    // Fronds at each joint
    for (let i = 1; i < joints; i++) {
      const sway = Math.sin(phase + i * 0.7 + stalk * 0.4) * (3 + i * 1.4) * scale;
      const jx = stalk * 5 * scale + sway;
      const jy = baseY - i * segH;
      const fLen = (8 + i * 2) * scale;
      ctx.beginPath();
      ctx.moveTo(jx, jy);
      ctx.bezierCurveTo(jx + stalk * fLen * 0.5, jy - fLen * 0.3, jx + stalk * fLen * 0.8, jy - fLen * 0.1, jx + stalk * fLen, jy + fLen * 0.2);
      ctx.strokeStyle = `hsl(${hue},58%,36%)`; ctx.lineWidth = 2 * scale; ctx.stroke();
    }
  }
}

function drawCoralFan(
  ctx: CanvasRenderingContext2D, baseY: number, scale: number, hue: number,
): void {
  const h = 42 * scale;
  const w = 36 * scale;
  const numRays = 9;

  // Stem
  ctx.beginPath();
  ctx.moveTo(0, baseY);
  ctx.lineTo(0, baseY - h * 0.25);
  ctx.strokeStyle = `hsl(${hue},45%,28%)`; ctx.lineWidth = 4 * scale; ctx.lineCap = 'round'; ctx.stroke();

  // Fan network (lattice lines)
  for (let i = 0; i < numRays; i++) {
    const angle = Math.PI * (0.15 + (i / (numRays - 1)) * 0.70) - Math.PI / 2;
    const ex = Math.cos(angle) * w;
    const ey = baseY - h * 0.25 + Math.sin(angle) * h;
    ctx.beginPath();
    ctx.moveTo(0, baseY - h * 0.25);
    ctx.quadraticCurveTo(ex * 0.4, baseY - h * 0.25 + (ey - baseY + h * 0.25) * 0.5, ex, ey);
    ctx.strokeStyle = `hsl(${hue},55%,40%)`; ctx.lineWidth = 1.5 * scale; ctx.stroke();
  }
  // Cross-hatch connectors
  for (let ring = 0.35; ring <= 0.85; ring += 0.25) {
    ctx.beginPath();
    for (let i = 0; i < numRays; i++) {
      const angle = Math.PI * (0.15 + (i / (numRays - 1)) * 0.70) - Math.PI / 2;
      const ex = Math.cos(angle) * w * ring;
      const ey = baseY - h * 0.25 + Math.sin(angle) * h * ring;
      if (i === 0) ctx.moveTo(ex, ey); else ctx.lineTo(ex, ey);
    }
    ctx.strokeStyle = `hsl(${hue},48%,38%)`; ctx.lineWidth = 1.0 * scale; ctx.stroke();
  }
}

function drawCoralBranch(
  ctx: CanvasRenderingContext2D, baseY: number, scale: number, hue: number,
): void {
  function branch(x: number, y: number, angle: number, length: number, depth: number): void {
    if (depth === 0) {
      // Tip node
      ctx.beginPath(); ctx.arc(x, y, 3.5 * scale, 0, Math.PI * 2);
      ctx.fillStyle = `hsl(${hue + 15},80%,60%)`; ctx.fill();
      return;
    }
    const ex = x + Math.cos(angle) * length;
    const ey = y + Math.sin(angle) * length;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey);
    ctx.strokeStyle = `hsl(${hue},65%,${35 + depth * 5}%)`; ctx.lineWidth = (depth + 1) * 1.5 * scale; ctx.lineCap = 'round'; ctx.stroke();
    branch(ex, ey, angle - 0.55, length * 0.68, depth - 1);
    branch(ex, ey, angle + 0.45, length * 0.62, depth - 1);
    if (depth > 2) branch(ex, ey, angle - 0.10, length * 0.75, depth - 1);
  }
  branch(0, baseY, -Math.PI / 2, 18 * scale, 3);
}

function drawAnemone(
  ctx: CanvasRenderingContext2D, baseY: number, scale: number, hue: number, phase: number,
): void {
  const numTentacles = 8;
  const tLen = 28 * scale;
  const baseR = 7 * scale;

  // Tentacles
  for (let i = 0; i < numTentacles; i++) {
    const baseAngle = (i / numTentacles) * Math.PI * 2;
    const wave = Math.sin(phase + i * 0.9) * 6 * scale;
    const tx = Math.cos(baseAngle) * tLen * 0.55 + wave;
    const ty = baseY - tLen + Math.sin(phase + i * 0.7) * 4 * scale;
    const bulbX = tx + Math.cos(baseAngle) * 5 * scale;
    const bulbY = ty - 5 * scale;

    ctx.beginPath();
    ctx.moveTo(Math.cos(baseAngle) * baseR * 0.6, baseY - 4 * scale);
    ctx.bezierCurveTo(
      Math.cos(baseAngle) * baseR * 1.2, baseY - tLen * 0.3,
      tx, ty + tLen * 0.1,
      tx, ty,
    );
    ctx.strokeStyle = `hsl(${hue},72%,52%)`; ctx.lineWidth = 2.5 * scale; ctx.lineCap = 'round'; ctx.stroke();

    // Bulb tip
    ctx.beginPath(); ctx.arc(bulbX, bulbY, 3.5 * scale, 0, Math.PI * 2);
    ctx.fillStyle = `hsl(${hue + 20},85%,65%)`; ctx.fill();
  }

  // Central base
  const baseGrad = ctx.createRadialGradient(0, baseY - baseR * 0.5, 0, 0, baseY, baseR * 1.5);
  baseGrad.addColorStop(0, `hsl(${hue},60%,55%)`);
  baseGrad.addColorStop(1, `hsl(${hue},55%,32%)`);
  ctx.beginPath(); ctx.ellipse(0, baseY - baseR * 0.3, baseR, baseR * 0.6, 0, 0, Math.PI * 2);
  ctx.fillStyle = baseGrad; ctx.fill();
}

/**
 * Draw a decoration on the tank canvas.
 * (x, y) is the base position; decorations are drawn upward from that point.
 */
export function drawDecoration(
  ctx: CanvasRenderingContext2D,
  type: DecorationType,
  x: number, y: number,
  hue: number, scale: number, phase: number,
): void {
  ctx.save();
  ctx.translate(x, 0);
  switch (type) {
    case 'kelp':         drawKelp(ctx, y, scale, hue, phase);        break;
    case 'coral_fan':    drawCoralFan(ctx, y, scale, hue);           break;
    case 'coral_branch': drawCoralBranch(ctx, y, scale, hue);        break;
    case 'anemone':      drawAnemone(ctx, y, scale, hue, phase);     break;
  }
  ctx.restore();
}

/**
 * Render a static decoration preview onto a canvas element (shop cards, settings page).
 */
export function drawDecorationPreview(
  canvas: HTMLCanvasElement,
  type: DecorationType,
  hue: number,
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const { width: cW, height: cH } = canvas;

  const g = ctx.createLinearGradient(0, 0, 0, cH);
  g.addColorStop(0, 'hsl(210,68%,10%)');
  g.addColorStop(1, 'hsl(220,75%,6%)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, cW, cH);

  // Sand strip at bottom
  const sand = ctx.createLinearGradient(0, cH - 8, 0, cH);
  sand.addColorStop(0, '#c9aa58'); sand.addColorStop(1, '#a07c30');
  ctx.fillStyle = sand; ctx.fillRect(0, cH - 8, cW, 8);

  ctx.save();
  ctx.translate(cW / 2, 0);
  const baseY = cH - 8;
  const scale = cH / 60;

  switch (type) {
    case 'kelp':         drawKelp(ctx, baseY, scale, hue, 0);        break;
    case 'coral_fan':    drawCoralFan(ctx, baseY, scale, hue);       break;
    case 'coral_branch': drawCoralBranch(ctx, baseY, scale, hue);    break;
    case 'anemone':      drawAnemone(ctx, baseY, scale, hue, 0);     break;
  }
  ctx.restore();
}
