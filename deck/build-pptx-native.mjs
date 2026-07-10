/**
 * Native PPTX build of the Alexa Thinks Ahead deck.
 * Real text boxes + vector shapes (no rasterized slides), so text stays
 * razor-sharp in PowerPoint AND after Google Slides' image recompression.
 *
 * Fonts: Fraunces (display) + Inter (body) — both are Google Fonts, built
 * into Google Slides. For PowerPoint desktop, install them once from
 * fonts.google.com so the deck renders identically.
 */
import pptxgen from 'pptxgenjs';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const HERE = dirname(fileURLToPath(import.meta.url));

// ── palette ─────────────────────────────────────────────────────
const PAPER = 'F6F1E7', INK = '221E17', TEAL = '0E7C72', TEAL_D = '0A5A53';
const AMBER = 'C77414', ROSE = 'B0483A', MUTED = '8A8172', CARD = 'FFFDF8';
const HAIR = 'DDD2BA', BODY = '5C554A', PURPLE = '7A4FB3';

// ── px (1600×900 design space) → inches / points ────────────────
const X = (px) => px / 120;          // 1600 px = 13.333 in
const F = (px) => Math.round(px * 0.6 * 10) / 10; // px → pt

const pptx = new pptxgen();
pptx.defineLayout({ name: 'WIDE', width: 13.333, height: 7.5 });
pptx.layout = 'WIDE';
pptx.author = 'Team Bar Raisers';
pptx.title = 'Alexa Thinks Ahead — HackOn with Amazon';

const DISPLAY = 'Fraunces';
const TEXT = 'Inter';

// ── helpers ─────────────────────────────────────────────────────
function slideBg() {
  const s = pptx.addSlide();
  s.background = { color: PAPER };
  return s;
}

function kicker(s, xPx, yPx, text) {
  s.addText(text.toUpperCase(), {
    x: X(xPx), y: X(yPx), w: X(700), h: X(26), margin: 0,
    fontFace: TEXT, fontSize: F(15), bold: true, color: AMBER, charSpacing: 3,
  });
}

function pageno(s, n) {
  s.addText(`${n} / 9`, {
    x: X(1440), y: X(848), w: X(120), h: X(22), margin: 0, align: 'right',
    fontFace: TEXT, fontSize: F(13), bold: true, color: MUTED, charSpacing: 1.5,
  });
}

function hline(s, xPx, yPx, wPx, color = HAIR, weight = 1) {
  s.addShape(pptx.shapes.LINE, {
    x: X(xPx), y: X(yPx), w: X(wPx), h: 0,
    line: { color, width: weight },
  });
}

/** arrow along straight segments; head only on the final segment */
function path(s, pts, color, { dash = false, head = true, weight = 1.6 } = {}) {
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
    const last = i === pts.length - 2;
    const opts = {
      x: X(Math.min(x1, x2)), y: X(Math.min(y1, y2)),
      w: X(Math.abs(x2 - x1)), h: X(Math.abs(y2 - y1)),
      line: { color, width: weight, ...(dash ? { dashType: 'dash' } : {}), ...(last && head ? { endArrowType: 'triangle' } : {}) },
      flipH: x2 < x1, flipV: y2 < y1,
    };
    s.addShape(pptx.shapes.LINE, opts);
  }
}

function card(s, xPx, yPx, wPx, hPx, accent) {
  s.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: X(xPx), y: X(yPx), w: X(wPx), h: X(hPx), rectRadius: 0.12,
    fill: { color: CARD }, line: { color: HAIR, width: 0.75 },
    shadow: { type: 'outer', color: '3C301A', opacity: 0.14, blur: 14, offset: 3, angle: 90 },
  });
  if (accent) {
    s.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
      x: X(xPx), y: X(yPx), w: X(wPx), h: X(7), rectRadius: 0.02,
      fill: { color: accent }, line: { type: 'none' },
    });
  }
}

// ═══ 1 · COVER ═══════════════════════════════════════════════════
{
  const s = slideBg();
  s.addImage({ path: join(HERE, 'assets/cover.png'), x: 0, y: 0, w: 13.333, h: 7.5 });
  s.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: X(48), y: X(818), w: X(560), h: X(44), rectRadius: 0.18,
    fill: { color: 'FFFDF8', transparency: 8 }, line: { color: HAIR, width: 0.75 },
  });
  s.addText([
    { text: 'Team ', options: { color: INK } },
    { text: 'Bar Raisers', options: { color: TEAL, bold: true } },
    { text: ' — Priyanshu Agarwal & Piyush Kumar · HackOn with Amazon', options: { color: INK } },
  ], {
    x: X(48), y: X(818), w: X(560), h: X(44), margin: 0, align: 'center', valign: 'middle',
    fontFace: TEXT, fontSize: F(15.5), bold: true,
  });
}

// ═══ 2 · AGENDA ══════════════════════════════════════════════════
{
  const s = slideBg();
  kicker(s, 140, 110, 'The next ten minutes');
  s.addText([
    { text: 'From a command-taker to a ' },
    { text: 'household partner', options: { italic: true, color: TEAL } },
    { text: '.' },
  ], {
    x: X(140), y: X(150), w: X(660), h: X(410), margin: 0,
    fontFace: DISPLAY, fontSize: F(88), color: INK, lineSpacingMultiple: 0.98, valign: 'top',
  });
  s.addText([
    { text: 'Alexa that learns the rhythm of an Indian home and acts ' },
    { text: 'before', options: { bold: true, color: INK } },
    { text: ' anyone asks — every action explained, every liberty earned.' },
  ], {
    x: X(140), y: X(580), w: X(540), h: X(120), margin: 0,
    fontFace: TEXT, fontSize: F(20), color: BODY, lineSpacingMultiple: 1.25,
  });

  const items = [
    ['01', 'The problem', "What today's Alexa can't do"],
    ['02', 'The scenario', "Dadaji's 6:45 bath — thirty mornings of it"],
    ['03', 'What I need as a customer', 'And what we built for each need'],
    ['04', 'Live demo', 'One day in an Indian home'],
    ['05', 'Tech architecture', 'A routine model + an LLM that knows today'],
    ['06', 'Impact & future vision', 'What this unlocks for the next billion'],
    ['07', 'Questions', ''],
  ];
  let y = 96;
  for (const [no, what, small] of items) {
    const rowH = small ? 96 : 70;
    s.addText(no, {
      x: X(880), y: X(y + 14), w: X(60), h: X(34), margin: 0,
      fontFace: DISPLAY, fontSize: F(26), color: AMBER,
    });
    s.addText(what, {
      x: X(964), y: X(y + 12), w: X(496), h: X(36), margin: 0,
      fontFace: TEXT, fontSize: F(24), bold: true, color: INK,
    });
    if (small) {
      s.addText(small, {
        x: X(964), y: X(y + 52), w: X(496), h: X(26), margin: 0,
        fontFace: TEXT, fontSize: F(15), color: MUTED,
      });
    }
    hline(s, 880, y + rowH, 580);
    y += rowH + 6;
  }
  pageno(s, 2);
}

// ═══ 3 · PROBLEM ═════════════════════════════════════════════════
{
  const s = slideBg();
  kicker(s, 140, 96, 'The problem');
  s.addText([
    { text: 'Indian homes run on rhythm.\nSmart homes still ' },
    { text: 'wait for orders', options: { color: ROSE } },
    { text: '.' },
  ], {
    x: X(140), y: X(136), w: X(1180), h: X(180), margin: 0,
    fontFace: DISPLAY, fontSize: F(70), color: INK, lineSpacingMultiple: 1.0,
  });
  s.addText([
    { text: '“Alexa, you should already know this.”', options: { fontFace: DISPLAY, italic: true, fontSize: F(24), color: INK } },
    { text: '  — a multi-generational household issues dozens of commands a day to devices that never learn what happens next.', options: {} },
  ], {
    x: X(140), y: X(330), w: X(1240), h: X(70), margin: 0,
    fontFace: TEXT, fontSize: F(21), color: BODY, lineSpacingMultiple: 1.2,
  });

  const beats = [
    ['05:30', 'Morning pooja', TEAL], ['06:15', 'Geyser for bath', AMBER],
    ['07:30', 'Pressure-cooker breakfast', TEAL], ['08:00', 'Water motor on', AMBER],
    ['14:00', 'Power cut', ROSE], ['17:00', 'Tuition hours', AMBER],
    ['18:30', 'Evening chai', TEAL],
  ];
  const bw = 1320 / 7;
  beats.forEach(([t, label, c], i) => {
    const bx = 140 + i * bw;
    s.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
      x: X(bx), y: X(452), w: X(bw - 16), h: X(4), rectRadius: 0.015,
      fill: { color: HAIR }, line: { type: 'none' },
    });
    s.addShape(pptx.shapes.OVAL, {
      x: X(bx - 1), y: X(447), w: X(13), h: X(13), fill: { color: c }, line: { type: 'none' },
    });
    s.addText(t, {
      x: X(bx), y: X(474), w: X(bw - 16), h: X(26), margin: 0,
      fontFace: DISPLAY, fontSize: F(20), color: INK,
    });
    s.addText(label, {
      x: X(bx), y: X(504), w: X(bw - 20), h: X(48), margin: 0,
      fontFace: TEXT, fontSize: F(15), color: BODY, lineSpacingMultiple: 1.1,
    });
  });

  const pains = [
    ['Reactive, not ready', '"Alexa, turn on the geyser" — every single morning. The assistant obeys, but the hot water is still 20 minutes late.'],
    ['Context-blind', "It doesn't know a power cut is different during a child's online class, or that grandparents bathe before everyone wakes."],
    ['Trust was never earned', 'No explanations, no way to correct it — so families keep automation switched off and do everything by hand.'],
  ];
  pains.forEach(([h, p], i) => {
    const px = 140 + i * 448;
    card(s, px, 590, 422, 226, ROSE);
    s.addText(h, {
      x: X(px + 34), y: X(622), w: X(354), h: X(36), margin: 0,
      fontFace: DISPLAY, fontSize: F(26), color: INK,
    });
    s.addText(p, {
      x: X(px + 34), y: X(664), w: X(356), h: X(130), margin: 0,
      fontFace: TEXT, fontSize: F(16), color: BODY, lineSpacingMultiple: 1.25,
    });
  });
  pageno(s, 3);
}

// ═══ 4 · LEARNING GRID (the bathing scenario) ════════════════════
{
  const s = slideBg();
  kicker(s, 140, 84, "The scenario — Dadaji's bath");
  s.addText([
    { text: '30 mornings. ' },
    { text: 'One pattern.', options: { italic: true, color: TEAL } },
  ], {
    x: X(140), y: X(122), w: X(1000), h: X(90), margin: 0,
    fontFace: DISPLAY, fontSize: F(64), color: INK,
  });

  // grid geometry (design px)
  const GX = 240, GY = 288, GW = 720, ROW = 17.6, DAYS = 30;
  const T0 = 5.5 * 60, T1 = 9 * 60;
  const tx = (min) => GX + ((min - T0) / (T1 - T0)) * GW;

  // deterministic data — same PRNG as the HTML deck
  function mulberry(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const rnd = mulberry(42);
  const days = [];
  for (let d = 0; d < DAYS; d++) {
    const dow = d % 7, sunday = dow === 6;
    let t = sunday ? 485 + (rnd() - 0.5) * 26 : 405 + (rnd() - 0.5) * 18;
    if (d === 2) t = 448;
    if (d === 9) t = 391;
    days.push({ t, sunday, dow });
  }
  const wd = days.filter((d) => !d.sunday).map((d) => d.t);
  const sun = days.filter((d) => d.sunday).map((d) => d.t);
  const band = (arr) => {
    const m = arr.reduce((a, b) => a + b) / arr.length;
    const sd = Math.sqrt(arr.reduce((a, b) => a + (b - m) ** 2, 0) / arr.length) + 4;
    return [tx(m - sd * 1.7), tx(m + sd * 1.7)];
  };
  const [w0, w1] = band(wd), [s0, s1] = band(sun);
  const gridH = DAYS * ROW;

  // bands
  s.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: X(w0), y: X(GY - 6), w: X(w1 - w0), h: X(gridH + 12), rectRadius: 0.07,
    fill: { color: TEAL, transparency: 90 }, line: { type: 'none' },
  });
  s.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: X(s0), y: X(GY - 6), w: X(s1 - s0), h: X(gridH + 12), rectRadius: 0.07,
    fill: { color: AMBER, transparency: 90 }, line: { type: 'none' },
  });

  // hour gridlines + labels
  for (let h = 6; h <= 9; h++) {
    const gx = tx(h * 60);
    s.addShape(pptx.shapes.LINE, {
      x: X(gx), y: X(GY - 8), w: 0, h: X(gridH + 8),
      line: { color: 'D9D2C2', width: 0.75 },
    });
    s.addText(`${h} AM`, {
      x: X(gx - 40), y: X(GY - 40), w: X(80), h: X(22), margin: 0, align: 'center',
      fontFace: TEXT, fontSize: F(11.5), bold: true, color: MUTED, charSpacing: 0.8,
    });
  }

  // day rows + dots
  const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  days.forEach((day, i) => {
    const cy = GY + i * ROW;
    s.addText(`Day ${i + 1}`, {
      x: X(GX - 105), y: X(cy - 8), w: X(62), h: X(18), margin: 0, align: 'right',
      fontFace: TEXT, fontSize: F(10.5), bold: true, color: day.sunday ? AMBER : 'B4AC9C',
    });
    s.addText(DOW[day.dow], {
      x: X(GX - 36), y: X(cy - 8), w: X(18), h: X(18), margin: 0, align: 'center',
      fontFace: TEXT, fontSize: F(9.5), bold: true, color: day.sunday ? AMBER : 'CFC8B8',
    });
    s.addShape(pptx.shapes.OVAL, {
      x: X(tx(day.t) - 5.5), y: X(cy - 5.5), w: X(11), h: X(11),
      fill: { color: day.sunday ? AMBER : TEAL }, line: { type: 'none' },
    });
  });

  // learned 6:45 marker
  s.addShape(pptx.shapes.LINE, {
    x: X(tx(405)), y: X(GY - 6), w: 0, h: X(gridH + 14),
    line: { color: TEAL_D, width: 1.4, dashType: 'sysDot' },
  });
  s.addText('6:45 AM', {
    x: X(tx(405) - 50), y: X(GY + gridH + 14), w: X(100), h: X(22), margin: 0, align: 'center',
    fontFace: TEXT, fontSize: F(13), bold: true, color: TEAL_D,
  });

  // side panel
  s.addText([
    { text: '96', options: { fontSize: F(92), color: INK } },
    { text: '%', options: { fontSize: F(42), color: MUTED } },
  ], {
    x: X(1064), y: X(280), w: X(400), h: X(120), margin: 0, fontFace: DISPLAY,
  });
  s.addText("SURE ABOUT DADAJI'S BATH", {
    x: X(1064), y: X(400), w: X(400), h: X(24), margin: 0,
    fontFace: TEXT, fontSize: F(12), bold: true, color: MUTED, charSpacing: 2.2,
  });
  const statuses = [
    [[{ text: 'Day 14 — ', options: { bold: true } }, { text: "she's sure now. Dadaji bathes at " }, { text: '6:45', options: { bold: true } }, { text: ', every weekday.' }], TEAL],
    [[{ text: 'Sundays? ' }, { text: 'Around 8.', options: { bold: true } }, { text: ' She knows that too.' }], AMBER],
    [[{ text: 'No one told her. She just ' }, { text: 'watched the geyser.', options: { bold: true } }], TEAL],
  ];
  let sy = 470;
  for (const [runs, c] of statuses) {
    s.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
      x: X(1064), y: X(sy), w: X(4), h: X(78), rectRadius: 0.01,
      fill: { color: c }, line: { type: 'none' },
    });
    s.addText(runs, {
      x: X(1084), y: X(sy - 2), w: X(380), h: X(86), margin: 0,
      fontFace: TEXT, fontSize: F(17), color: INK, lineSpacingMultiple: 1.2,
    });
    sy += 100;
  }
  pageno(s, 4);
}

// ═══ 5 · CUSTOMER NEEDS ══════════════════════════════════════════
{
  const s = slideBg();
  kicker(s, 140, 84, 'What I need as a customer');
  s.addText([
    { text: 'Four things a family would ' },
    { text: 'actually ask for', options: { italic: true, color: TEAL } },
    { text: '.' },
  ], {
    x: X(140), y: X(122), w: X(1320), h: X(90), margin: 0,
    fontFace: DISPLAY, fontSize: F(62), color: INK,
  });

  const needs = [
    ['It should already be ready.',
      [{ text: 'It acts ahead of the routine', options: { bold: true, color: INK } },
       { text: ' — the geyser is hot before the 6:45 bath, the living room is cool before Rajesh walks in. Zero commands for the daily rhythm.' }]],
    ['It should understand my home.',
      [{ text: 'India-first context, not hardcoded rules', options: { bold: true, color: INK } },
       { text: ' — pooja mornings, tariff windows, power cuts, tuition hours all ride into the reasoning as context it actually weighs.' }]],
    ['It should never overreach.',
      [{ text: 'Autonomy is graduated and earned', options: { bold: true, color: INK } },
       { text: ' — five trust tiers per device category; one override immediately lowers what it may do on its own.' }]],
    ['It should explain itself.',
      [{ text: 'Every action ships with a plain-language reason', options: { bold: true, color: INK } },
       { text: ' — "pre-heating the geyser at 05:15, the family wakes around 06:00" — and a one-tap Override.' }]],
  ];
  let y = 252;
  for (const [q, a] of needs) {
    s.addText([
      { text: '“', options: { color: AMBER } },
      { text: q, options: { color: INK } },
      { text: '”', options: { color: AMBER } },
    ], {
      x: X(140), y: X(y + 16), w: X(520), h: X(72), margin: 0,
      fontFace: DISPLAY, fontSize: F(28),
    });
    s.addText(a, {
      x: X(730), y: X(y + 14), w: X(730), h: X(96), margin: 0,
      fontFace: TEXT, fontSize: F(17), color: BODY, lineSpacingMultiple: 1.25,
    });
    hline(s, 140, y + 118, 1320);
    y += 122;
  }
  s.addText([
    { text: 'And quietly, a fifth: ' },
    { text: 'privacy', options: { bold: true, color: '4C4639' } },
    { text: " — the routines are learned from the home's own history, and they stay the home's." },
  ], {
    x: X(140), y: X(y + 18), w: X(1320), h: X(30), margin: 0,
    fontFace: TEXT, fontSize: F(16.5), color: MUTED,
  });
  pageno(s, 5);
}

// ═══ 6 · DEMO ════════════════════════════════════════════════════
{
  const s = slideBg();
  s.addText('LIVE DEMO', {
    x: 0, y: X(74), w: 13.333, h: X(26), margin: 0, align: 'center',
    fontFace: TEXT, fontSize: F(15), bold: true, color: AMBER, charSpacing: 3,
  });
  s.addText([
    { text: 'One day in an ' },
    { text: 'Indian home', options: { italic: true, color: TEAL } },
    { text: '.' },
  ], {
    x: 0, y: X(112), w: 13.333, h: X(80), margin: 0, align: 'center',
    fontFace: DISPLAY, fontSize: F(58), color: INK,
  });
  s.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: X(210), y: X(226), w: X(1180), h: X(664), rectRadius: 0.18,
    fill: { color: '1D1A15' }, line: { type: 'none' },
    shadow: { type: 'outer', color: '3C301A', opacity: 0.3, blur: 22, offset: 6, angle: 90 },
  });
  const demoPath = join(HERE, 'assets/demo.mp4');
  if (existsSync(demoPath)) {
    s.addMedia({ type: 'video', path: demoPath, x: X(210), y: X(226), w: X(1180), h: X(664) });
  } else {
    s.addText([
      { text: 'demo.mp4\n', options: { fontFace: DISPLAY, fontSize: F(32), color: 'EFE6D3' } },
      { text: 'insert the screen-recording here (Insert → Video)', options: { fontFace: TEXT, fontSize: F(17), color: 'B9AB8F' } },
    ], {
      x: X(210), y: X(226), w: X(1180), h: X(664), margin: 0, align: 'center', valign: 'middle', lineSpacingMultiple: 1.4,
    });
  }
  pageno(s, 6);
}

// ═══ 7 · ARCHITECTURE ════════════════════════════════════════════
{
  const s = slideBg();
  kicker(s, 140, 56, 'Tech architecture');
  s.addText([
    { text: 'A routine model that knows the house, an LLM that knows ' },
    { text: 'today', options: { italic: true, color: TEAL } },
    { text: '.' },
  ], {
    x: X(140), y: X(92), w: X(1330), h: X(58), margin: 0,
    fontFace: DISPLAY, fontSize: F(42), color: INK,
  });
  s.addText('Two timescales, one decision: slow-learned trends meet live context inside the reasoning core.', {
    x: X(140), y: X(154), w: X(1200), h: X(28), margin: 0,
    fontFace: TEXT, fontSize: F(17), color: BODY,
  });

  // diagram in design px, origin at (140, 200); svg coords carried over
  const ox = 140, oy = 200;
  const N = (sx, sy, w, h, num, title, lines, accent) => {
    card(s, ox + sx, oy + sy, w, h, accent);
    let ty = sy + 16;
    if (num) {
      s.addText(num, {
        x: X(ox + sx + 20), y: X(oy + ty), w: X(w - 40), h: X(18), margin: 0,
        fontFace: TEXT, fontSize: F(11.5), bold: true, charSpacing: 1.8,
        color: accent === INK ? MUTED : accent,
      });
      ty += 22;
    }
    s.addText(title, {
      x: X(ox + sx + 20), y: X(oy + ty), w: X(w - 36), h: X(24), margin: 0,
      fontFace: TEXT, fontSize: F(17.5), bold: true, color: INK,
    });
    s.addText(lines.join('\n'), {
      x: X(ox + sx + 20), y: X(oy + ty + 28), w: X(w - 36), h: X(h - (ty - sy) - 34), margin: 0,
      fontFace: TEXT, fontSize: F(13), color: MUTED, lineSpacingMultiple: 1.15,
    });
  };
  const LANE = (sx, sy, text, color) => s.addText(text, {
    x: X(ox + sx), y: X(oy + sy - 14), w: X(600), h: X(20), margin: 0,
    fontFace: TEXT, fontSize: F(12.5), bold: true, color, charSpacing: 2,
  });
  const LBL = (sx, sy, text, color = MUTED, align = 'center', w = 220) => s.addText(text, {
    x: X(ox + sx - (align === 'center' ? w / 2 : 0)), y: X(oy + sy), w: X(w), h: X(40), margin: 0, align,
    fontFace: TEXT, fontSize: F(12.5), bold: true, color, lineSpacingMultiple: 1.1,
  });
  const ARROW = (pts, color, dash = false) => path(s, pts.map(([px, py]) => [ox + px, oy + py]), color, { dash });

  LANE(0, 24, 'REAL-TIME — THE DECISION PATH', TEAL);
  N(0, 44, 240, 170, '1 · CAPTURE', 'Home events',
    ['who left or arrived', 'lights & appliances on/off', 'geyser · AC · motor usage', 'temperature & occupancy', 'voice interactions'], TEAL);
  N(300, 62, 185, 134, '2 · INGEST', 'Event stream',
    ['validate & de-duplicate,', 'enrich with device,', 'member, room, time'], TEAL);
  N(545, 62, 190, 134, '3 · STORE', 'Time-series DB',
    ['raw event log —', "months of the home's", 'own history'], TEAL);
  N(795, 44, 265, 170, '6 · REASONING CORE', 'Amazon Bedrock (Claude)',
    ["learned patterns + today's", 'context → "what should the', 'home do next, and why" —', 'the Alexa+ pattern'], PURPLE);
  N(1120, 44, 200, 170, '7 · TRUST GATE', 'Safety & permissions',
    ['confidence score ×', 'earned trust tier →', 'act · suggest ·', 'stay silent'], INK);

  ARROW([[240, 130], [294, 130]], TEAL);
  ARROW([[485, 130], [539, 130]], TEAL);
  ARROW([[735, 110], [789, 110]], TEAL);
  LBL(762, 52, 'recent\ncontext', TEAL_D, 'center', 120);
  ARROW([[1060, 100], [1114, 100]], TEAL);
  LBL(1087, 48, 'action +\nreason', MUTED, 'center', 120);
  ARROW([[1220, 214], [1220, 274]], TEAL);
  N(1120, 280, 200, 100, '8 · ALEXA ACTS', 'Speaks or automates',
    ['geyser, AC, lights, locks,', 'announcements'], TEAL);

  N(795, 280, 265, 100, 'LIVE', "Today's context",
    ['occupancy · festival or special', 'day · tariff window · weather'], AMBER);
  ARROW([[927, 280], [927, 220]], AMBER);

  LANE(520, 428, 'OFFLINE — LEARNING THE RHYTHM, NIGHTLY', AMBER);
  N(300, 444, 185, 140, '4 · PROCESS', 'Feature pipeline',
    ['clean & sessionize by', 'time window; features:', 'time, season, occupancy'], AMBER);
  N(545, 444, 190, 140, '5 · TRAIN', 'Routine model — DNN',
    ['sequence model over the', 'event series (LSTM /', 'Transformer)'], AMBER);

  ARROW([[600, 196], [600, 406], [396, 406], [396, 438]], AMBER);
  LBL(610, 290, 'historical data\n(months)', AMBER, 'left', 160);
  ARROW([[485, 514], [539, 514]], AMBER);
  ARROW([[735, 514], [1090, 514], [1090, 170], [1066, 170]], AMBER);
  LBL(913, 484, 'learned patterns — P(event x at time t)', AMBER, 'center', 360);

  ARROW([[1220, 380], [1220, 608], [30, 608], [30, 218]], MUTED, true);
  LBL(640, 616, "outcome — accepted or overridden → trust rises or falls · every action becomes tomorrow's training data", MUTED, 'center', 900);

  const legend = [[TEAL, 'real-time decision path', false], [AMBER, 'offline learning path', false], [MUTED, 'feedback loop', true]];
  legend.forEach(([c, label, dash], i) => {
    const ly = 452 + i * 26;
    s.addShape(pptx.shapes.LINE, {
      x: X(ox + 70), y: X(oy + ly), w: X(42), h: 0,
      line: { color: c, width: 1.6, ...(dash ? { dashType: 'dash' } : {}) },
    });
    s.addText(label, {
      x: X(ox + 122), y: X(oy + ly - 9), w: X(240), h: X(20), margin: 0,
      fontFace: TEXT, fontSize: F(13), color: BODY,
    });
  });
  pageno(s, 7);
}

// ═══ 8 · IMPACT & VISION ═════════════════════════════════════════
{
  const s = slideBg();
  kicker(s, 140, 90, 'Impact & future vision');
  s.addText([
    { text: 'Built for the ' },
    { text: 'next billion', options: { italic: true, color: TEAL } },
    { text: ' homes.' },
  ], {
    x: X(140), y: X(128), w: X(1200), h: X(90), margin: 0,
    fontFace: DISPLAY, fontSize: F(64), color: INK,
  });

  const stats = [
    ['0', TEAL, 'commands needed for the morning routine — hot water, lights and locks are simply ready'],
    ['~30%', AMBER, 'of flexible load shifted off peak tariff by anticipating usage, not reacting to it'],
    ['100%', ROSE, 'of proactive actions explained in plain language — with a one-tap Override'],
    ['5', PURPLE, 'autonomy tiers per device category — families decide how much Alexa may do alone'],
  ];
  stats.forEach(([v, c, p], i) => {
    const px = 140 + i * 336;
    card(s, px, 250, 310, 200);
    s.addText(v, {
      x: X(px + 30), y: X(276), w: X(250), h: X(52), margin: 0,
      fontFace: DISPLAY, fontSize: F(42), color: c,
    });
    s.addText(p, {
      x: X(px + 30), y: X(336), w: X(252), h: X(104), margin: 0,
      fontFace: TEXT, fontSize: F(15.5), color: '4C4639', lineSpacingMultiple: 1.2,
    });
  });

  s.addText('WHERE THIS GOES NEXT', {
    x: X(140), y: X(508), w: X(500), h: X(24), margin: 0,
    fontFace: TEXT, fontSize: F(14), bold: true, color: MUTED, charSpacing: 2.4,
  });
  const vision = [
    ['Sensor fusion', 'Hear the pressure-cooker whistle and the water-motor hum — context from sound and power signatures, no new hardware.'],
    ['Hindi & Hinglish voice', 'Proactive suggestions in the language the household actually speaks, member by member.'],
    ['Private by default', 'Routine learning moves on-device; only anonymised patterns ever reach the cloud.'],
    ['Beyond one home', 'Matter ecosystem support and society-level insight: a colony that pre-arms for the 14:00 power cut together.'],
  ];
  vision.forEach(([b, p], i) => {
    const px = 140 + i * 336;
    hline(s, px, 552, 310, TEAL, 2.25);
    s.addText(b, {
      x: X(px), y: X(568), w: X(310), h: X(28), margin: 0,
      fontFace: TEXT, fontSize: F(19), bold: true, color: INK,
    });
    s.addText(p, {
      x: X(px), y: X(602), w: X(310), h: X(140), margin: 0,
      fontFace: TEXT, fontSize: F(15.5), color: BODY, lineSpacingMultiple: 1.25,
    });
  });
  pageno(s, 8);
}

// ═══ 9 · CLOSE ═══════════════════════════════════════════════════
{
  const s = slideBg();
  kicker(s, 150, 236, 'Thank you');
  s.addText('Questions?', {
    x: X(150), y: X(282), w: X(1200), h: X(130), margin: 0,
    fontFace: DISPLAY, fontSize: F(92), color: INK,
  });
  s.addText('An Alexa that earns trust, one morning chai at a time.', {
    x: X(150), y: X(420), w: X(1000), h: X(44), margin: 0,
    fontFace: DISPLAY, fontSize: F(26), italic: true, color: BODY,
  });

  s.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: X(150), y: X(504), w: X(340), h: X(52), rectRadius: 0.21,
    fill: { color: INK }, line: { type: 'none' },
  });
  s.addText('Live demo — 54.252.207.144', {
    x: X(150), y: X(504), w: X(340), h: X(52), margin: 0, align: 'center', valign: 'middle',
    fontFace: TEXT, fontSize: F(17), bold: true, color: PAPER,
  });
  s.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: X(510), y: X(504), w: X(420), h: X(52), rectRadius: 0.21,
    fill: { color: PAPER }, line: { color: INK, width: 1.25 },
  });
  s.addText('github.com/piyushk-dev/hackon_project', {
    x: X(510), y: X(504), w: X(420), h: X(52), margin: 0, align: 'center', valign: 'middle',
    fontFace: TEXT, fontSize: F(17), bold: true, color: INK,
  });

  s.addText([
    { text: 'Team ' },
    { text: 'Bar Raisers', options: { color: INK, bold: true } },
    { text: ' — Priyanshu Agarwal & Piyush Kumar · HackOn with Amazon' },
  ], {
    x: X(150), y: X(626), w: X(1000), h: X(28), margin: 0,
    fontFace: TEXT, fontSize: F(17), bold: true, color: MUTED,
  });
  pageno(s, 9);
}

await pptx.writeFile({ fileName: join(HERE, 'Alexa-Thinks-Ahead-Bar-Raisers.pptx') });
console.log('native pptx written — 9 slides, vector text & shapes');
