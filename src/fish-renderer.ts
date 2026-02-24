// ─── Fish Renderer ───────────────────────────────────────────────────────────
// Single source of truth for all fish and decoration canvas drawing.
// Used by popup/tank.ts (live animation) and settings/main.ts (static previews).

import type { FishType, FishStage, DecorationType, BackgroundType } from './types';

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
  // Tang / Surgeonfish: deep oval body, tall triangular dorsal & anal fins, forked tail, scalpel spine.

  // ── Forked tail ──
  for (const sign of [-1, 1] as const) {
    ctx.beginPath();
    ctx.moveTo(-s * 0.70, sign * s * 0.04);
    ctx.quadraticCurveTo(-s * 1.02, sign * s * 0.16 + wag * sign * 0.55, -s * 1.42, sign * s * 0.46 + wag);
    ctx.quadraticCurveTo(-s * 1.12, sign * s * 0.06 + wag * 0.30,         -s * 0.70, sign * s * 0.04);
    ctx.closePath();
    ctx.fillStyle = c.dark; ctx.fill();
  }

  // ── Tall triangular dorsal fin ──
  ctx.beginPath();
  ctx.moveTo(-s * 0.55, -s * 0.70);
  ctx.bezierCurveTo(-s * 0.12, -s * 1.62, s * 0.26, -s * 1.58, s * 0.60, -s * 0.70);
  ctx.fillStyle = c.dark; ctx.fill();

  // ── Matching anal fin below (same peak height) ──
  ctx.beginPath();
  ctx.moveTo(-s * 0.44, s * 0.70);
  ctx.bezierCurveTo(-s * 0.02, s * 1.52, s * 0.24, s * 1.48, s * 0.56, s * 0.70);
  ctx.fillStyle = c.dark; ctx.fill();

  // ── Body: deep oval ──
  if (health !== undefined) applyGlow(ctx, c.hue, health, s);
  const bg = ctx.createRadialGradient(s * 0.16, -s * 0.22, s * 0.05, 0, 0, s * 1.06);
  bg.addColorStop(0,    c.highlight);
  bg.addColorStop(0.38, c.col);
  bg.addColorStop(1,    c.dark);
  ctx.beginPath(); ctx.ellipse(0, 0, s * 0.82, s * 0.70, 0, 0, Math.PI * 2);
  ctx.fillStyle = bg; ctx.fill();
  ctx.shadowBlur = 0;

  // ── Body outline ──
  ctx.beginPath(); ctx.ellipse(0, 0, s * 0.82, s * 0.70, 0, 0, Math.PI * 2);
  ctx.strokeStyle = c.dark; ctx.lineWidth = s * 0.042; ctx.stroke();

  // ── Horizontal body stripe (characteristic of many tangs) ──
  ctx.beginPath(); ctx.ellipse(0, 0, s * 0.64, s * 0.20, 0, 0, Math.PI * 2);
  ctx.fillStyle = `${c.dark}55`; ctx.fill();

  // ── Sick tint ──
  if (health !== undefined && health < 20) {
    ctx.beginPath(); ctx.ellipse(0, 0, s * 0.62, s * 0.55, 0, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(80,200,60,${0.18 + (20 - health) / 100})`; ctx.fill();
  }

  // ── Pectoral fin ──
  ctx.beginPath(); ctx.ellipse(s * 0.22, s * 0.34, s * 0.20, s * 0.09, -0.48, 0, Math.PI * 2);
  ctx.globalAlpha = 0.65; ctx.fillStyle = c.dark; ctx.fill(); ctx.globalAlpha = 1;

  // ── Scalpel spine (characteristic tang feature, at caudal peduncle) ──
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-s * 0.70, s * 0.10);
  ctx.lineTo(-s * 0.88, -s * 0.06);
  ctx.strokeStyle = `hsl(${c.hue + 40},88%,72%)`; ctx.lineWidth = s * 0.06; ctx.lineCap = 'round'; ctx.stroke();
  ctx.restore();

  // ── Eye (high and forward) ──
  drawEye(ctx, s * 0.50, -s * 0.24, s * 0.18, c.hue);

  // ── Expression ──
  if (health !== undefined) {
    ctx.lineWidth = s * 0.065; ctx.strokeStyle = c.dark; ctx.lineCap = 'round';
    if      (health < 35) { ctx.beginPath(); ctx.arc(s*0.32, s*0.08, s*0.12, 0.15, Math.PI-0.15);       ctx.stroke(); }
    else if (health > 68) { ctx.beginPath(); ctx.arc(s*0.32, -s*0.04, s*0.12, 0.15, Math.PI-0.15, true); ctx.stroke(); }
  }
}

function drawDragonShape(
  ctx: CanvasRenderingContext2D, s: number, wag: number,
  c: DrawColors, health?: number,
): void {
  // Crown Dragonfish: lyrate tail, swept-back pectoral fins, 5 gradient crown spines.

  // ── Lyrate tail — two long elegantly sweeping lobes ──
  for (const sign of [-1, 1] as const) {
    ctx.beginPath();
    ctx.moveTo(-s * 0.66, sign * s * 0.04);
    ctx.bezierCurveTo(
      -s * 1.00, sign * s * 0.08 + wag * sign * 0.38,
      -s * 1.46, sign * s * 0.40 + wag * sign * 0.52,
      -s * 1.70, sign * s * 0.64 + wag,
    );
    ctx.bezierCurveTo(
      -s * 1.44, sign * s * 0.46 + wag * 0.54,
      -s * 1.02, sign * s * 0.15 + wag * 0.25,
      -s * 0.66, sign * s * 0.04,
    );
    ctx.closePath();
    ctx.fillStyle = c.dark; ctx.fill();
  }

  // ── Swept-back pectoral fins ──
  for (const sign of [-1, 1] as const) {
    ctx.beginPath();
    ctx.moveTo(s * 0.18, sign * s * 0.38);
    ctx.bezierCurveTo(
      -s * 0.05, sign * s * 0.66,
      -s * 0.32, sign * s * 0.75,
      -s * 0.52, sign * s * 0.52,
    );
    ctx.bezierCurveTo(
      -s * 0.30, sign * s * 0.44,
      -s * 0.06, sign * s * 0.40,
      s * 0.18, sign * s * 0.38,
    );
    ctx.closePath();
    ctx.globalAlpha = 0.65; ctx.fillStyle = c.dark; ctx.fill(); ctx.globalAlpha = 1;
  }

  // ── Body ──
  if (health !== undefined) applyGlow(ctx, c.hue, health, s);
  const bg = ctx.createRadialGradient(s * 0.20, -s * 0.14, s * 0.05, 0, 0, s * 1.02);
  bg.addColorStop(0,    c.highlight);
  bg.addColorStop(0.40, c.col);
  bg.addColorStop(1,    c.dark);
  ctx.beginPath(); ctx.ellipse(0, 0, s * 0.88, s * 0.50, 0, 0, Math.PI * 2);
  ctx.fillStyle = bg; ctx.fill();
  ctx.shadowBlur = 0;

  // ── Body outline ──
  ctx.beginPath(); ctx.ellipse(0, 0, s * 0.88, s * 0.50, 0, 0, Math.PI * 2);
  ctx.strokeStyle = c.dark; ctx.lineWidth = s * 0.04; ctx.stroke();

  // ── Crown spines — 5 individual gradient-filled tapered spines ──
  // Each spine: dark at base → body colour mid → bright warm accent at tip (venomous glow)
  const accHue = c.hue + 35;
  const spines = [
    { bx: -s * 0.42, ht: s * 1.08, lean: -s * 0.05 },
    { bx: -s * 0.16, ht: s * 1.36, lean: -s * 0.01 },
    { bx:  s * 0.08, ht: s * 1.50, lean:  s * 0.04 },
    { bx:  s * 0.32, ht: s * 1.28, lean:  s * 0.09 },
    { bx:  s * 0.54, ht: s * 1.00, lean:  s * 0.13 },
  ];
  const hw = s * 0.042; // half-width at spine base
  for (const { bx, ht, lean } of spines) {
    const tx = bx + lean;
    const ty = -s * 0.50 - ht;
    const sg = ctx.createLinearGradient(bx, -s * 0.50, tx, ty);
    sg.addColorStop(0.00, c.dark);
    sg.addColorStop(0.45, c.col);
    sg.addColorStop(1.00, `hsl(${accHue},92%,72%)`);
    ctx.beginPath();
    ctx.moveTo(bx - hw, -s * 0.50);
    ctx.bezierCurveTo(
      bx - hw * 0.4 + lean * 0.45, -s * 0.50 - ht * 0.48,
      tx - hw * 0.2,                ty + ht * 0.12,
      tx, ty,
    );
    ctx.bezierCurveTo(
      tx + hw * 0.2,                ty + ht * 0.12,
      bx + hw * 0.4 + lean * 0.45, -s * 0.50 - ht * 0.48,
      bx + hw, -s * 0.50,
    );
    ctx.closePath();
    ctx.fillStyle = sg; ctx.fill();
  }

  // ── Body bands ──
  for (let i = 0; i < 3; i++) {
    const bx = s * (0.24 - i * 0.38);
    ctx.beginPath(); ctx.ellipse(bx, 0, s * 0.048, s * 0.46, 0, 0, Math.PI * 2);
    ctx.fillStyle = `${c.dark}38`; ctx.fill();
  }

  // ── Sick tint ──
  if (health !== undefined && health < 20) {
    ctx.beginPath(); ctx.ellipse(0, s * 0.04, s * 0.65, s * 0.38, 0, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(80,200,60,${0.18 + (20 - health) / 100})`; ctx.fill();
  }

  // ── Eye ──
  drawEye(ctx, s * 0.56, -s * 0.08, s * 0.20, c.hue);

  // ── Expression ──
  if (health !== undefined) {
    ctx.lineWidth = s * 0.065; ctx.strokeStyle = c.dark; ctx.lineCap = 'round';
    if      (health < 35) { ctx.beginPath(); ctx.arc(s*0.36, s*0.14, s*0.12, 0.15, Math.PI-0.15);       ctx.stroke(); }
    else if (health > 68) { ctx.beginPath(); ctx.arc(s*0.36, s*0.02, s*0.12, 0.15, Math.PI-0.15, true); ctx.stroke(); }
  }
}

/** Eye centre for X-eye overlay on dead fish (non-flipped screen pass). */
function eyePos(type: FishType, s: number): { ex: number; ey: number; eyeR: number } {
  if (type === 'long')   return { ex: s * 0.78, ey: s * 0.06, eyeR: s * 0.09 };
  if (type === 'round')  return { ex: s * 0.48, ey: s * 0.18, eyeR: s * 0.11 };
  if (type === 'angel')  return { ex: s * 0.42, ey: s * 0.10, eyeR: s * 0.09 };
  if (type === 'betta')  return { ex: s * 0.50, ey: s * 0.24, eyeR: s * 0.10 }; // tang eye is high
  if (type === 'dragon') return { ex: s * 0.56, ey: s * 0.08, eyeR: s * 0.11 };
  return                        { ex: s * 0.58, ey: s * 0.07, eyeR: s * 0.10 };
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

  if      (type === 'long')   drawLongShape  (ctx, s, wag, colors, health);
  else if (type === 'round')  drawRoundShape (ctx, s, wag, colors, health);
  else if (type === 'angel')  drawAngelShape (ctx, s, wag, colors, health);
  else if (type === 'betta')  drawBettaShape (ctx, s, wag, colors, health);
  else if (type === 'dragon') drawDragonShape(ctx, s, wag, colors, health);
  else                        drawBasicShape (ctx, s, wag, colors, health);
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
  if      (type === 'long')   drawLongShape  (ctx, s, wag, GRAY);
  else if (type === 'round')  drawRoundShape (ctx, s, wag, GRAY);
  else if (type === 'angel')  drawAngelShape (ctx, s, wag, GRAY);
  else if (type === 'betta')  drawBettaShape (ctx, s, wag, GRAY);
  else if (type === 'dragon') drawDragonShape(ctx, s, wag, GRAY);
  else                        drawBasicShape (ctx, s, wag, GRAY);
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
  // Size: angel/dragon need more vertical room; tang (betta) has tall fins; long is wide
  const s  = type === 'long'   ? Math.round(cH * 0.30)
           : type === 'angel'  ? Math.round(cH * 0.24)
           : type === 'betta'  ? Math.round(cH * 0.24)  // tall dorsal fin needs room
           : type === 'dragon' ? Math.round(cH * 0.20)  // crown spines need vertical room
           : Math.round(cH * 0.36);

  ctx.save();
  ctx.translate(cx, cy);

  if (stage === 'fry') {
    drawFry(ctx, Math.round(cH * 0.22), 0);
  } else if (stage === 'dead') {
    ctx.scale(1, -1);
    if      (type === 'long')   drawLongShape  (ctx, s, 0, GRAY);
    else if (type === 'round')  drawRoundShape (ctx, s, 0, GRAY);
    else if (type === 'angel')  drawAngelShape (ctx, s, 0, GRAY);
    else if (type === 'betta')  drawBettaShape (ctx, s, 0, GRAY);
    else if (type === 'dragon') drawDragonShape(ctx, s, 0, GRAY);
    else                        drawBasicShape (ctx, s, 0, GRAY);
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
    if      (type === 'long')   drawLongShape  (ctx, s, 0, colors, 100);
    else if (type === 'round')  drawRoundShape (ctx, s, 0, colors, 100);
    else if (type === 'angel')  drawAngelShape (ctx, s, 0, colors, 100);
    else if (type === 'betta')  drawBettaShape (ctx, s, 0, colors, 100);
    else if (type === 'dragon') drawDragonShape(ctx, s, 0, colors, 100);
    else                        drawBasicShape (ctx, s, 0, colors, 100);
  }

  ctx.restore();
}

/**
 * Render a static background preview onto a canvas element (shop cards).
 * Fills with the theme gradient + a sand strip at the bottom.
 */
export function drawBackgroundPreview(canvas: HTMLCanvasElement, type: BackgroundType): void {
  const ctx = canvas.getContext('2d')!;
  const { width: W, height: H } = canvas;
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  switch (type) {
    case 'twilight':        grad.addColorStop(0,'hsl(270,65%,18%)');  grad.addColorStop(1,'hsl(260,70%,10%)'); break;
    case 'kelp_forest':     grad.addColorStop(0,'hsl(160,60%,20%)');  grad.addColorStop(1,'hsl(165,68%,12%)'); break;
    case 'coral_reef':      grad.addColorStop(0,'hsl(185,72%,22%)');  grad.addColorStop(1,'hsl(190,80%,14%)'); break;
    case 'abyss':           grad.addColorStop(0,'hsl(215,55%,12%)');  grad.addColorStop(1,'hsl(220,60%,5%)');  break;
    case 'golden_reef':     grad.addColorStop(0,'hsl(40,75%,28%)');   grad.addColorStop(1,'hsl(30,80%,16%)');  break;
    case 'bioluminescent':  grad.addColorStop(0,'hsl(200,42%,8%)');   grad.addColorStop(1,'hsl(210,48%,4%)');  break;
    default:                grad.addColorStop(0,'hsl(210,68%,20%)');  grad.addColorStop(1,'hsl(220,75%,12%)');
  }
  ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
  // Sand strip
  const sand = ctx.createLinearGradient(0, H - 7, 0, H);
  sand.addColorStop(0, '#c9aa58'); sand.addColorStop(1, '#a07c30');
  ctx.fillStyle = sand; ctx.fillRect(0, H - 7, W, 7);
}

// ── Decoration drawing ─────────────────────────────────────────────────────

// Plant health helpers — used by all organic decorations (not treasure_chest).
// health 0-100: <30 = dead (grayscale, static), 30-60 = alive (desaturated, slow), >=60 = well (full).

function plantHsl(hue: number, sat: number, lit: number, health: number): string {
  if (health < 30) return `hsl(0,0%,${Math.round(lit * 0.70)}%)`;
  const sf = Math.min(1, (health - 30) / 30);
  return `hsl(${hue},${Math.round(sat * sf)}%,${lit}%)`;
}

function plantPhase(phase: number, health: number): number {
  if (health < 30) return 0;
  if (health < 60) return phase * (health - 30) / 30;
  return phase;
}

function drawKelp(
  ctx: CanvasRenderingContext2D, baseY: number, scale: number, hue: number, phase: number,
  health = 100,
): void {
  const h = 55 * scale;
  const joints = 5;
  const segH = h / joints;
  const ph = plantPhase(phase, health);
  const dead = health < 30;

  for (let stalk = -1; stalk <= 1; stalk += 2) {
    ctx.strokeStyle = plantHsl(hue, 62, 30, health); ctx.lineWidth = 3.5 * scale; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(stalk * 5 * scale, baseY);
    for (let i = 0; i < joints; i++) {
      const sway = dead ? 0 : Math.sin(ph + i * 0.7 + stalk * 0.4) * (3 + i * 1.4) * scale;
      ctx.lineTo(stalk * 5 * scale + sway, baseY - (i + 1) * segH);
    }
    ctx.stroke();

    // Fronds at each joint
    for (let i = 1; i < joints; i++) {
      const sway = dead ? 0 : Math.sin(ph + i * 0.7 + stalk * 0.4) * (3 + i * 1.4) * scale;
      const jx = stalk * 5 * scale + sway;
      const jy = baseY - i * segH;
      const fLen = (8 + i * 2) * scale;
      ctx.beginPath();
      ctx.moveTo(jx, jy);
      ctx.bezierCurveTo(jx + stalk * fLen * 0.5, jy - fLen * 0.3, jx + stalk * fLen * 0.8, jy - fLen * 0.1, jx + stalk * fLen, jy + fLen * 0.2);
      ctx.strokeStyle = plantHsl(hue, 58, 36, health); ctx.lineWidth = 2 * scale; ctx.stroke();
    }
  }
}

function drawCoralFan(
  ctx: CanvasRenderingContext2D, baseY: number, scale: number, hue: number,
  health = 100,
): void {
  const h = 42 * scale;
  const w = 36 * scale;
  const numRays = 9;

  // Stem
  ctx.beginPath();
  ctx.moveTo(0, baseY);
  ctx.lineTo(0, baseY - h * 0.25);
  ctx.strokeStyle = plantHsl(hue, 45, 28, health); ctx.lineWidth = 4 * scale; ctx.lineCap = 'round'; ctx.stroke();

  // Fan network (lattice lines)
  for (let i = 0; i < numRays; i++) {
    const angle = Math.PI * (0.15 + (i / (numRays - 1)) * 0.70) - Math.PI / 2;
    const ex = Math.cos(angle) * w;
    const ey = baseY - h * 0.25 + Math.sin(angle) * h;
    ctx.beginPath();
    ctx.moveTo(0, baseY - h * 0.25);
    ctx.quadraticCurveTo(ex * 0.4, baseY - h * 0.25 + (ey - baseY + h * 0.25) * 0.5, ex, ey);
    ctx.strokeStyle = plantHsl(hue, 55, 40, health); ctx.lineWidth = 1.5 * scale; ctx.stroke();
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
    ctx.strokeStyle = plantHsl(hue, 48, 38, health); ctx.lineWidth = 1.0 * scale; ctx.stroke();
  }
}

function drawCoralBranch(
  ctx: CanvasRenderingContext2D, baseY: number, scale: number, hue: number,
  health = 100,
): void {
  function branch(x: number, y: number, angle: number, length: number, depth: number): void {
    if (depth === 0) {
      ctx.beginPath(); ctx.arc(x, y, 3.5 * scale, 0, Math.PI * 2);
      ctx.fillStyle = plantHsl(hue + 15, 80, 60, health); ctx.fill();
      return;
    }
    const ex = x + Math.cos(angle) * length;
    const ey = y + Math.sin(angle) * length;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey);
    ctx.strokeStyle = plantHsl(hue, 65, 35 + depth * 5, health); ctx.lineWidth = (depth + 1) * 1.5 * scale; ctx.lineCap = 'round'; ctx.stroke();
    branch(ex, ey, angle - 0.55, length * 0.68, depth - 1);
    branch(ex, ey, angle + 0.45, length * 0.62, depth - 1);
    if (depth > 2) branch(ex, ey, angle - 0.10, length * 0.75, depth - 1);
  }
  branch(0, baseY, -Math.PI / 2, 18 * scale, 3);
}

function drawAnemone(
  ctx: CanvasRenderingContext2D, baseY: number, scale: number, hue: number, phase: number,
  health = 100,
): void {
  const numTentacles = 8;
  const tLen = 28 * scale;
  const baseR = 7 * scale;
  const ph   = plantPhase(phase, health);
  const dead = health < 30;

  // Tentacles
  for (let i = 0; i < numTentacles; i++) {
    const baseAngle = (i / numTentacles) * Math.PI * 2;
    const wave = dead ? 0 : Math.sin(ph + i * 0.9) * 6 * scale;
    const tx = Math.cos(baseAngle) * tLen * 0.55 + wave;
    const ty = baseY - tLen + (dead ? 0 : Math.sin(ph + i * 0.7) * 4 * scale);
    const bulbX = tx + Math.cos(baseAngle) * 5 * scale;
    const bulbY = ty - 5 * scale;

    ctx.beginPath();
    ctx.moveTo(Math.cos(baseAngle) * baseR * 0.6, baseY - 4 * scale);
    ctx.bezierCurveTo(
      Math.cos(baseAngle) * baseR * 1.2, baseY - tLen * 0.3,
      tx, ty + tLen * 0.1,
      tx, ty,
    );
    ctx.strokeStyle = plantHsl(hue, 72, 52, health); ctx.lineWidth = 2.5 * scale; ctx.lineCap = 'round'; ctx.stroke();

    // Bulb tip
    ctx.beginPath(); ctx.arc(bulbX, bulbY, 3.5 * scale, 0, Math.PI * 2);
    ctx.fillStyle = plantHsl(hue + 20, 85, 65, health); ctx.fill();
  }

  // Central base
  const baseGrad = ctx.createRadialGradient(0, baseY - baseR * 0.5, 0, 0, baseY, baseR * 1.5);
  baseGrad.addColorStop(0, plantHsl(hue, 60, 55, health));
  baseGrad.addColorStop(1, plantHsl(hue, 55, 32, health));
  ctx.beginPath(); ctx.ellipse(0, baseY - baseR * 0.3, baseR, baseR * 0.6, 0, 0, Math.PI * 2);
  ctx.fillStyle = baseGrad; ctx.fill();
}

function drawTreasureChest(
  ctx: CanvasRenderingContext2D, baseY: number, scale: number, _hue: number,
): void {
  const w = 22 * scale;
  const h = 14 * scale;
  const lidH = 6.5 * scale;

  // Shadow
  ctx.beginPath(); ctx.ellipse(0, baseY, w * 0.65, 2.5 * scale, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.30)'; ctx.fill();

  // Body
  const bodyG = ctx.createLinearGradient(0, baseY - h, 0, baseY);
  bodyG.addColorStop(0, '#8B5A1E'); bodyG.addColorStop(1, '#4A2808');
  ctx.fillStyle = bodyG;
  ctx.fillRect(-w, baseY - h, w * 2, h);
  // Darkening overlay for depth
  const depthG = ctx.createLinearGradient(-w, 0, w, 0);
  depthG.addColorStop(0, 'rgba(0,0,0,0.28)'); depthG.addColorStop(0.5, 'rgba(0,0,0,0)'); depthG.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.fillStyle = depthG; ctx.fillRect(-w, baseY - h, w * 2, h);

  // Metal bands
  ctx.strokeStyle = '#C8941A'; ctx.lineWidth = 2.2 * scale;
  ctx.strokeRect(-w, baseY - h, w * 2, h);
  for (const bx of [-w * 0.40, w * 0.40]) {
    ctx.beginPath(); ctx.moveTo(bx, baseY - h); ctx.lineTo(bx, baseY); ctx.stroke();
  }
  // Horizontal mid-band
  ctx.beginPath(); ctx.moveTo(-w, baseY - h * 0.48); ctx.lineTo(w, baseY - h * 0.48); ctx.stroke();

  // Lid (open, arched)
  const lidG = ctx.createLinearGradient(0, baseY - h - lidH, 0, baseY - h);
  lidG.addColorStop(0, '#A0702A'); lidG.addColorStop(1, '#5A3210');
  ctx.beginPath();
  ctx.moveTo(-w, baseY - h);
  ctx.bezierCurveTo(-w, baseY - h - lidH * 1.55, w, baseY - h - lidH * 1.55, w, baseY - h);
  ctx.fillStyle = lidG; ctx.fill();
  ctx.strokeStyle = '#C8941A'; ctx.lineWidth = 2 * scale;
  ctx.beginPath();
  ctx.moveTo(-w, baseY - h);
  ctx.bezierCurveTo(-w, baseY - h - lidH * 1.55, w, baseY - h - lidH * 1.55, w, baseY - h);
  ctx.stroke();

  // Gold glow inside chest
  const glow = ctx.createRadialGradient(0, baseY - h * 0.55, 0, 0, baseY - h * 0.55, w * 0.88);
  glow.addColorStop(0,   'rgba(255,215,50,0.92)');
  glow.addColorStop(0.42, 'rgba(255,165,0,0.50)');
  glow.addColorStop(1,   'rgba(255,140,0,0.00)');
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.ellipse(0, baseY - h * 0.55, w * 0.86, h * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();

  // Spilling coins
  for (const [cx, cy, rx, ry, ang] of [
    [-w * 0.55, baseY - 2.5 * scale, 3.8 * scale, 2.1 * scale,  0.18],
    [-w * 0.18, baseY - 5.0 * scale, 4.2 * scale, 2.3 * scale,  0.00],
    [ w * 0.15, baseY - 2.0 * scale, 3.5 * scale, 1.9 * scale, -0.14],
    [ w * 0.52, baseY - 4.0 * scale, 3.8 * scale, 2.1 * scale,  0.12],
  ] as [number, number, number, number, number][]) {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang);
    ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#F5C842'; ctx.fill();
    ctx.strokeStyle = '#B8861A'; ctx.lineWidth = scale; ctx.stroke();
    ctx.restore();
  }

  // Clasp
  ctx.beginPath(); ctx.arc(0, baseY - h * 0.50, 3.8 * scale, 0, Math.PI * 2);
  ctx.fillStyle = '#D4AF37'; ctx.fill();
  ctx.strokeStyle = '#7A5410'; ctx.lineWidth = 1.5 * scale; ctx.stroke();
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
  health = 100,
): void {
  ctx.save();
  ctx.translate(x, 0);
  switch (type) {
    case 'kelp':           drawKelp(ctx, y, scale, hue, phase, health);        break;
    case 'coral_fan':      drawCoralFan(ctx, y, scale, hue, health);           break;
    case 'coral_branch':   drawCoralBranch(ctx, y, scale, hue, health);        break;
    case 'anemone':        drawAnemone(ctx, y, scale, hue, phase, health);     break;
    case 'treasure_chest': drawTreasureChest(ctx, y, scale, hue);              break;
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
    case 'kelp':           drawKelp(ctx, baseY, scale, hue, 0);        break;
    case 'coral_fan':      drawCoralFan(ctx, baseY, scale, hue);       break;
    case 'coral_branch':   drawCoralBranch(ctx, baseY, scale, hue);    break;
    case 'anemone':        drawAnemone(ctx, baseY, scale, hue, 0);     break;
    case 'treasure_chest': drawTreasureChest(ctx, baseY, scale, hue);  break;
  }
  ctx.restore();
}
