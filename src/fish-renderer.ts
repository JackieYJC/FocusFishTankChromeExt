// ─── Fish Renderer ───────────────────────────────────────────────────────────
// Single source of truth for all fish canvas drawing.
// Used by popup/tank.ts (live animation) and settings/main.ts (static previews).

import type { FishType, FishStage } from './types';

// ── Internal colour helpers ────────────────────────────────────────────────

interface DrawColors { col: string; dark: string; shimmer: string; }

function adultColors(hue: number, health: number): DrawColors {
  const h = (health / 100) * hue;
  return {
    col:     `hsl(${h},65%,45%)`,
    dark:    `hsl(${h},65%,33%)`,
    shimmer: `hsla(${h},65%,67%,0.35)`,
  };
}

function juvenileColors(hue: number): DrawColors {
  const jHue = Math.round(175 + (hue - 175) * 0.5);
  return {
    col:     `hsl(${jHue},30%,42%)`,
    dark:    `hsl(${jHue},30%,30%)`,
    shimmer: `hsla(${jHue},30%,60%,0.35)`,
  };
}

// ── Internal shape drawing (no translate/save — caller must set up ctx) ────

function drawBasicShape(
  ctx: CanvasRenderingContext2D, s: number, wag: number,
  { col, dark, shimmer }: DrawColors, health?: number,
): void {
  // Tail
  ctx.beginPath(); ctx.moveTo(-s*.65,0); ctx.lineTo(-s*1.25,-s*.58+wag); ctx.lineTo(-s*1.25,s*.58+wag); ctx.closePath();
  ctx.fillStyle=dark; ctx.fill();
  // Body
  ctx.beginPath(); ctx.ellipse(0,0,s,s*.52,0,0,Math.PI*2); ctx.fillStyle=col; ctx.fill();
  // Shimmer
  ctx.beginPath(); ctx.ellipse(s*.12,s*.12,s*.52,s*.22,-0.3,0,Math.PI*2); ctx.fillStyle=shimmer; ctx.fill();
  // Sick tint
  if (health !== undefined && health < 20) {
    ctx.beginPath(); ctx.ellipse(0,s*.05,s*.6,s*.38,0,0,Math.PI*2);
    ctx.fillStyle=`rgba(80,200,60,${0.18+(20-health)/100})`; ctx.fill();
  }
  // Dorsal
  ctx.beginPath(); ctx.moveTo(-s*.05,-s*.52); ctx.quadraticCurveTo(s*.28,-s*.9,s*.62,-s*.52); ctx.fillStyle=dark; ctx.fill();
  // Eye
  ctx.beginPath(); ctx.arc(s*.56,-s*.07,s*.18,0,Math.PI*2); ctx.fillStyle='white'; ctx.fill();
  ctx.beginPath(); ctx.arc(s*.60,-s*.07,s*.10,0,Math.PI*2); ctx.fillStyle='#111'; ctx.fill();
  // Expression
  if (health !== undefined) {
    ctx.lineWidth=1.5; ctx.strokeStyle=dark;
    if (health < 35)      { ctx.beginPath(); ctx.arc(s*.38,s*.18,s*.13,0.15,Math.PI-0.15);      ctx.stroke(); }
    else if (health > 68) { ctx.beginPath(); ctx.arc(s*.38,s*.04,s*.13,0.15,Math.PI-0.15,true); ctx.stroke(); }
  }
}

function drawLongShape(
  ctx: CanvasRenderingContext2D, s: number, wag: number,
  { col, dark, shimmer }: DrawColors, health?: number,
): void {
  // Forked tail
  for (const sign of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(-s*.8,0); ctx.lineTo(-s*1.6,sign*s*.55+wag); ctx.lineTo(-s*1.2,sign*s*.1+wag*.5); ctx.closePath();
    ctx.fillStyle=dark; ctx.fill();
  }
  // Body + lateral stripe
  ctx.beginPath(); ctx.ellipse(0,0,s*1.4,s*.38,0,0,Math.PI*2); ctx.fillStyle=col; ctx.fill();
  ctx.beginPath(); ctx.ellipse(0,0,s*1.1,s*.12,0,0,Math.PI*2); ctx.fillStyle=dark; ctx.fill();
  // Shimmer
  ctx.beginPath(); ctx.ellipse(s*.1,s*.1,s*.9,s*.16,-0.2,0,Math.PI*2); ctx.fillStyle=shimmer; ctx.fill();
  // Sick tint
  if (health !== undefined && health < 20) {
    ctx.beginPath(); ctx.ellipse(0,0,s*.9,s*.3,0,0,Math.PI*2);
    ctx.fillStyle=`rgba(80,200,60,${0.18+(20-health)/100})`; ctx.fill();
  }
  // Dorsal
  ctx.beginPath(); ctx.moveTo(-s*.3,-s*.38); ctx.quadraticCurveTo(s*.1,-s*.65,s*.5,-s*.38); ctx.fillStyle=dark; ctx.fill();
  // Eye
  ctx.beginPath(); ctx.arc(s*.78,-s*.06,s*.15,0,Math.PI*2); ctx.fillStyle='white'; ctx.fill();
  ctx.beginPath(); ctx.arc(s*.82,-s*.06,s*.08,0,Math.PI*2); ctx.fillStyle='#111'; ctx.fill();
  // Expression
  if (health !== undefined) {
    ctx.lineWidth=1.5; ctx.strokeStyle=dark;
    if (health < 35)      { ctx.beginPath(); ctx.arc(s*.62,s*.14,s*.10,0.15,Math.PI-0.15);      ctx.stroke(); }
    else if (health > 68) { ctx.beginPath(); ctx.arc(s*.62,s*.04,s*.10,0.15,Math.PI-0.15,true); ctx.stroke(); }
  }
}

function drawRoundShape(
  ctx: CanvasRenderingContext2D, s: number, wag: number,
  { col, dark, shimmer }: DrawColors, health?: number,
): void {
  // Stubby tail
  ctx.beginPath(); ctx.moveTo(-s*.65,0); ctx.lineTo(-s*1.05,-s*.42+wag); ctx.lineTo(-s*1.05,s*.42+wag); ctx.closePath();
  ctx.fillStyle=dark; ctx.fill();
  // Chubby body
  ctx.beginPath(); ctx.ellipse(0,0,s*.95,s*.85,0,0,Math.PI*2); ctx.fillStyle=col; ctx.fill();
  // Shimmer
  ctx.beginPath(); ctx.ellipse(s*.1,s*.18,s*.55,s*.38,-0.3,0,Math.PI*2); ctx.fillStyle=shimmer; ctx.fill();
  // Sick tint
  if (health !== undefined && health < 20) {
    ctx.beginPath(); ctx.ellipse(0,0,s*.65,s*.6,0,0,Math.PI*2);
    ctx.fillStyle=`rgba(80,200,60,${0.18+(20-health)/100})`; ctx.fill();
  }
  // Spiky dorsal — 3 triangles
  for (const sx of [-s*.25, s*.05, s*.38]) {
    ctx.beginPath(); ctx.moveTo(sx-s*.12,-s*.85); ctx.lineTo(sx,-s*1.15); ctx.lineTo(sx+s*.12,-s*.85); ctx.closePath();
    ctx.fillStyle=dark; ctx.fill();
  }
  // Big eye
  ctx.beginPath(); ctx.arc(s*.48,-s*.18,s*.24,0,Math.PI*2); ctx.fillStyle='white'; ctx.fill();
  ctx.beginPath(); ctx.arc(s*.52,-s*.18,s*.14,0,Math.PI*2); ctx.fillStyle='#111'; ctx.fill();
  ctx.beginPath(); ctx.arc(s*.44,-s*.24,s*.07,0,Math.PI*2); ctx.fillStyle='rgba(255,255,255,0.65)'; ctx.fill();
  // Expression
  if (health !== undefined) {
    ctx.lineWidth=1.5; ctx.strokeStyle=dark;
    if (health < 35)      { ctx.beginPath(); ctx.arc(s*.25,s*.28,s*.13,0.15,Math.PI-0.15);      ctx.stroke(); }
    else if (health > 68) { ctx.beginPath(); ctx.arc(s*.25,s*.18,s*.13,0.15,Math.PI-0.15,true); ctx.stroke(); }
  }
}

/** Eye centre (in unflipped screen coords relative to fish origin) for X eyes on dead fish. */
function eyePos(type: FishType, s: number): { ex: number; ey: number; eyeR: number } {
  if (type === 'long')  return { ex: s*0.78, ey: s*0.06, eyeR: s*0.08 };
  if (type === 'round') return { ex: s*0.48, ey: s*0.18, eyeR: s*0.10 };
  return                       { ex: s*0.56, ey: s*0.07, eyeR: s*0.10 };
}

// ── Public drawing functions ───────────────────────────────────────────────

/** Draw fry shape at (0,0) — uniform teardrop regardless of species. */
export function drawFry(ctx: CanvasRenderingContext2D, s: number, wag: number): void {
  const col  = 'hsl(175,55%,48%)';
  const dark = 'hsl(175,55%,35%)';
  ctx.beginPath(); ctx.moveTo(-s*.6,0); ctx.lineTo(-s*.95,-s*.38+wag); ctx.lineTo(-s*.95,s*.38+wag); ctx.closePath();
  ctx.fillStyle=dark; ctx.fill();
  ctx.beginPath(); ctx.ellipse(0,0,s,s*.65,0,0,Math.PI*2); ctx.fillStyle=col; ctx.fill();
  ctx.beginPath(); ctx.arc(s*.5,-s*.1,s*.12,0,Math.PI*2); ctx.fillStyle='#111'; ctx.fill();
}

/**
 * Draw a live (non-dead) fish at (0,0), already translated & scaled by caller.
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
 * Uses the fish's world position (x, y) and facing direction.
 */
export function drawDeadFish(
  ctx: CanvasRenderingContext2D,
  type: FishType, s: number, wag: number,
  x: number, y: number, facing: number,
): void {
  const gray: DrawColors = { col: '#777', dark: '#555', shimmer: 'rgba(180,180,180,0.35)' };

  // Flipped body
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing, -1);
  if      (type === 'long')  drawLongShape (ctx, s, wag, gray);
  else if (type === 'round') drawRoundShape(ctx, s, wag, gray);
  else                       drawBasicShape(ctx, s, wag, gray);
  ctx.restore();

  // X eyes — separate pass without y-flip
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing, 1);
  const { ex, ey, eyeR } = eyePos(type, s);
  ctx.strokeStyle = '#333';
  ctx.lineWidth   = Math.max(1, s * 0.07);
  ctx.lineCap     = 'round';
  ctx.beginPath();
  ctx.moveTo(ex-eyeR, ey-eyeR); ctx.lineTo(ex+eyeR, ey+eyeR);
  ctx.moveTo(ex+eyeR, ey-eyeR); ctx.lineTo(ex-eyeR, ey+eyeR);
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
  // Scale fish size relative to canvas height
  const s  = type === 'long' ? Math.round(cH * 0.30) : Math.round(cH * 0.36);

  ctx.save();
  ctx.translate(cx, cy);

  if (stage === 'fry') {
    drawFry(ctx, Math.round(cH * 0.22), 0);
  } else {
    const drawHue = stage === 'juvenile'
      ? Math.round(175 + (hue - 175) * 0.5)
      : hue;
    const colors = adultColors(drawHue, 100); // always full colour for preview
    if      (type === 'long')  drawLongShape (ctx, s, 0, colors);
    else if (type === 'round') drawRoundShape(ctx, s, 0, colors);
    else                       drawBasicShape(ctx, s, 0, colors);
  }

  ctx.restore();
}
