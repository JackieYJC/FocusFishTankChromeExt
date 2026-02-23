// ─── Fish Renderer ───────────────────────────────────────────────────────────
// Single source of truth for all fish canvas drawing.
// Used by popup/tank.ts (live animation) and settings/main.ts (static previews).

import type { FishType, FishStage } from './types';

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

  // ── Shimmer ellipse ──
  ctx.beginPath(); ctx.ellipse(s * 0.10, -s * 0.20, s * 0.56, s * 0.34, -0.28, 0, Math.PI * 2);
  ctx.fillStyle = c.shimmer; ctx.fill();

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

/** Eye centre for X-eye overlay on dead fish (non-flipped screen pass). */
function eyePos(type: FishType, s: number): { ex: number; ey: number; eyeR: number } {
  if (type === 'long')  return { ex: s * 0.78, ey: s * 0.06, eyeR: s * 0.09 };
  if (type === 'round') return { ex: s * 0.48, ey: s * 0.18, eyeR: s * 0.11 };
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
  const s  = type === 'long' ? Math.round(cH * 0.30) : Math.round(cH * 0.36);

  ctx.save();
  ctx.translate(cx, cy);

  if (stage === 'fry') {
    drawFry(ctx, Math.round(cH * 0.22), 0);
  } else if (stage === 'dead') {
    ctx.scale(1, -1);
    if      (type === 'long')  drawLongShape (ctx, s, 0, GRAY);
    else if (type === 'round') drawRoundShape(ctx, s, 0, GRAY);
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
    else                       drawBasicShape(ctx, s, 0, colors, 100);
  }

  ctx.restore();
}
