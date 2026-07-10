/**
 * FloorPlan2D — Isometric 2.5D "dollhouse" view of the Sharma family smart home.
 *
 * Renders the whole house as a floating isometric diorama (SVG) with shaded
 * walls, hand-built furniture, warm room lighting and a day/night cycle.
 * Devices, family avatars, room labels and speech bubbles live in an HTML
 * overlay that is perfectly registered on top of the SVG viewBox.
 *
 * Public API is identical to the previous flat renderer, so the simulation,
 * power-cut scenario and main.js wiring all keep working:
 *   updateAvatars, updateLighting, highlightDevice, showSpeechBubble, show,
 *   dimRooms, restoreAll, restoreRooms, powerCutFlicker, inverterGlow,
 *   getDevicePosition, getMesh, getAllRoomLights
 */

import { FAMILY_SCHEDULE } from '../data/FamilySchedule.js';

// ═══════════════════════════════════════════════════════════════════
// Isometric projection (classic 2:1)
// ═══════════════════════════════════════════════════════════════════

const U = 34;   // horizontal world unit (px in viewBox space)
const ZU = 27;  // vertical world unit (height)

/** Project world (x, y, z) → screen {X, Y}. */
function iso(x, y, z = 0) {
  return { X: (x - y) * U, Y: ((x + y) * U) / 2 - z * ZU };
}

/** Points list → SVG polygon "points" attribute string. */
function pts(list) {
  return list.map((p) => `${p.X.toFixed(1)},${p.Y.toFixed(1)}`).join(' ');
}

/** Multiply a hex color by factor f (0..~1.4). */
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v) => Math.max(0, Math.min(255, Math.round(v * f)));
  const r = ch((n >> 16) & 255);
  const g = ch((n >> 8) & 255);
  const b = ch(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/** An axis-aligned iso box from (x0,y0,z0) to (x1,y1,z1). Returns SVG string. */
function box(x0, y0, x1, y1, z0, z1, base, opts = {}) {
  const top = opts.top || shade(base, 1);
  const faceY = opts.faceY || shade(base, 0.74); // face at y = y1 (lower-left)
  const faceX = opts.faceX || shade(base, 0.56); // face at x = x1 (lower-right)
  const o = opts.opacity !== undefined ? ` opacity="${opts.opacity}"` : '';
  const cls = opts.cls ? ` class="${opts.cls}"` : '';
  const a = iso(x0, y0, z1), b = iso(x1, y0, z1), c = iso(x1, y1, z1), d = iso(x0, y1, z1);
  const e = iso(x1, y0, z0), f = iso(x1, y1, z0), g = iso(x0, y1, z0);
  return (
    `<g${cls}${o}>` +
    `<polygon points="${pts([g, f, c, d])}" fill="${faceY}"/>` +
    `<polygon points="${pts([e, f, c, b])}" fill="${faceX}"/>` +
    `<polygon points="${pts([a, b, c, d])}" fill="${top}"/>` +
    `</g>`
  );
}

/** Flat parallelogram on the floor plane at height z. */
function flat(x0, y0, x1, y1, z, fill, opts = {}) {
  const a = iso(x0, y0, z), b = iso(x1, y0, z), c = iso(x1, y1, z), d = iso(x0, y1, z);
  const extra = opts.attrs || '';
  return `<polygon points="${pts([a, b, c, d])}" fill="${fill}" ${extra}/>`;
}

/** Iso circle (rug / glow / shadow) of world radius r centered (cx,cy) at height z. */
function isoEllipse(cx, cy, z, r, fill, opts = {}) {
  const c = iso(cx, cy, z);
  const rx = r * U * 1.414, ry = r * U * 0.707;
  const extra = opts.attrs || '';
  return `<ellipse cx="${c.X.toFixed(1)}" cy="${c.Y.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="${fill}" ${extra}/>`;
}

/** Vertical cylinder (plant pot, tank…). */
function cyl(cx, cy, r, z0, z1, base, opts = {}) {
  const rx = r * U * 1.414, ry = r * U * 0.707;
  const t = iso(cx, cy, z1), b = iso(cx, cy, z0);
  const side = opts.side || shade(base, 0.62);
  const top = opts.top || shade(base, 1);
  return (
    `<path d="M ${(b.X - rx).toFixed(1)} ${b.Y.toFixed(1)} A ${rx.toFixed(1)} ${ry.toFixed(1)} 0 0 0 ${(b.X + rx).toFixed(1)} ${b.Y.toFixed(1)} L ${(t.X + rx).toFixed(1)} ${t.Y.toFixed(1)} A ${rx.toFixed(1)} ${ry.toFixed(1)} 0 0 1 ${(t.X - rx).toFixed(1)} ${t.Y.toFixed(1)} Z" fill="${side}"/>` +
    `<ellipse cx="${t.X.toFixed(1)}" cy="${t.Y.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="${top}"/>`
  );
}

/** Quad on the back wall plane y = yw (used for windows / art on that wall). */
function wallQuadY(x0, x1, yw, z0, z1, fill, cls = '') {
  const a = iso(x0, yw, z1), b = iso(x1, yw, z1), c = iso(x1, yw, z0), d = iso(x0, yw, z0);
  return `<polygon class="${cls}" points="${pts([a, b, c, d])}" fill="${fill}"/>`;
}

/** Quad on the side wall plane x = xw. */
function wallQuadX(y0, y1, xw, z0, z1, fill, cls = '') {
  const a = iso(xw, y0, z1), b = iso(xw, y1, z1), c = iso(xw, y1, z0), d = iso(xw, y0, z0);
  return `<polygon class="${cls}" points="${pts([a, b, c, d])}" fill="${fill}"/>`;
}

// ═══════════════════════════════════════════════════════════════════
// House data
// ═══════════════════════════════════════════════════════════════════

const HOUSE_W = 16;
const HOUSE_D = 10;
const WALL_H = 2.35;      // exterior back walls
const KNEE_H = 0.82;      // interior partitions
const BATH_WALL_H = 1.28; // bath privacy walls

const ROOMS = {
  master_bedroom: { x: 0,    y: 0, w: 5.5, d: 5, name: 'Master Bedroom', floor: 'wood',
    labelShift: [1.15, -1.15], // clear of the living-room TV across the partition
    spots: [[2.0, 2.4], [3.0, 3.9], [4.5, 2.6], [1.4, 4.1]] },
  study_room:     { x: 5.5,  y: 0, w: 4.5, d: 5, name: 'Study', floor: 'wood2',
    labelShift: [-1.15, -0.2], // clear of the wall-mounted geyser chip
    spots: [[7.3, 2.1], [8.6, 3.4], [6.4, 3.6]] },
  kitchen:        { x: 10,   y: 0, w: 6,   d: 5, name: 'Kitchen', floor: 'tile',
    spots: [[12.0, 2.2], [14.3, 2.6], [11.2, 3.6], [13.2, 4.1]] },
  living_room:    { x: 0,    y: 5, w: 6.5, d: 5, name: 'Living Room', floor: 'wood',
    spots: [[3.0, 8.6], [4.6, 8.8], [1.8, 8.4], [5.6, 7.2], [1.2, 6.6], [4.9, 6.3]] },
  bath:           { x: 6.5,  y: 5, w: 3,   d: 5, name: 'Bath', floor: 'btile',
    spots: [[8.3, 7.6], [7.3, 8.6]] },
  kids_room:      { x: 9.5,  y: 5, w: 3.5, d: 5, name: 'Kids Room', floor: 'wood2',
    spots: [[11.6, 8.5], [12.4, 7.2], [10.6, 6.6]] },
  balcony:        { x: 13,   y: 5, w: 3,   d: 5, name: 'Balcony', floor: 'stone', outdoor: true,
    spots: [[14.2, 7.4], [15.0, 8.6], [13.8, 9.0]] },
};

const FLOORS = {
  wood:  { base: '#e7c9a1', alt: '#dfbf94', edge: '#c9a87e' },
  wood2: { base: '#dfba8e', alt: '#d7b183', edge: '#bf9a6e' },
  tile:  { base: '#e3e7ea', alt: '#d9dee2', edge: '#c2c9cf' },
  btile: { base: '#d9e7eb', alt: '#cfe0e5', edge: '#b6cdd4' },
  stone: { base: '#dbd8cf', alt: '#d2cfc5', edge: '#bcb9ae' },
};

/** Device catalog — same IDs as before. x/y are absolute grid coords, z = float height. */
const DEVICE_PLACEMENTS = {
  living_room_ac:  { room: 'living_room', x: 0.45, y: 8.85, z: 1.85, icon: 'ac',      label: 'AC' },
  smart_tv:        { room: 'living_room', x: 2.5,  y: 5.55, z: 1.7,  icon: 'tv',      label: 'TV' },
  echo_living:     { room: 'living_room', x: 5.15, y: 5.7,  z: 0.85, icon: 'echo',    label: 'Echo' },
  kitchen_hub:     { room: 'kitchen',     x: 13.35, y: 3.4, z: 1.05, icon: 'hub',     label: 'Hub' },
  water_purifier:  { room: 'kitchen',     x: 11.9, y: 0.5,  z: 1.75, icon: 'drop',    label: 'Purifier' },
  security_camera: { room: 'balcony',     x: 13.5, y: 5.55, z: 2.1,  icon: 'cam',     label: 'Camera' },
  smart_lock:      { room: 'balcony',     x: 13.1, y: 8.1,  z: 1.0,  icon: 'lock',    label: 'Lock' },
  smart_geyser:    { room: 'bath',        x: 8.9,  y: 5.55, z: 1.6,  icon: 'geyser',  label: 'Geyser' },
  inverter_ups:    { room: 'kitchen',     x: 15.45, y: 4.35, z: 1.05, icon: 'battery', label: 'Inverter' },
  echo_study:      { room: 'study_room',  x: 8.05, y: 0.75, z: 1.25, icon: 'echo',    label: 'Echo' },
  echo_kids:       { room: 'kids_room',   x: 12.5, y: 5.75, z: 1.15, icon: 'echo',    label: 'Echo' },
  // One smart light per room — rendered as smaller, subordinate markers.
  smart_lights_living_room:    { room: 'living_room',    x: 3.2,  y: 7.4, z: 2.5, icon: 'bulb', label: 'Lights', light: true },
  smart_lights_master_bedroom: { room: 'master_bedroom', x: 2.7,  y: 2.4, z: 2.5, icon: 'bulb', label: 'Lights', light: true },
  smart_lights_kitchen:        { room: 'kitchen',        x: 13.0, y: 2.3, z: 2.5, icon: 'bulb', label: 'Lights', light: true },
  smart_lights_bath:           { room: 'bath',           x: 8.0,  y: 7.3, z: 2.3, icon: 'bulb', label: 'Lights', light: true },
  smart_lights_study_room:     { room: 'study_room',     x: 7.75, y: 2.4, z: 2.5, icon: 'bulb', label: 'Lights', light: true },
  smart_lights_kids_room:      { room: 'kids_room',      x: 11.2, y: 7.3, z: 2.4, icon: 'bulb', label: 'Lights', light: true },
  smart_lights_balcony:        { room: 'balcony',        x: 14.5, y: 7.2, z: 2.2, icon: 'bulb', label: 'Lights', light: true },
};

const DEVICE_DEFAULT_STATES = {
  living_room_ac:  { active: false, onLabel: 'Cooling',   offLabel: 'Off' },
  smart_tv:        { active: false, onLabel: 'Playing',   offLabel: 'Off' },
  echo_living:     { active: true,  onLabel: 'Online',    offLabel: 'Muted' },
  kitchen_hub:     { active: true,  onLabel: 'Ready',     offLabel: 'Paused' },
  water_purifier:  { active: true,  onLabel: 'Filtering', offLabel: 'Off' },
  security_camera: { active: true,  onLabel: 'Recording', offLabel: 'Idle' },
  smart_lock:      { active: true,  onLabel: 'Locked',    offLabel: 'Unlocked' },
  smart_geyser:    { active: false, onLabel: 'Heating',   offLabel: 'Off' },
  inverter_ups:    { active: false, onLabel: 'Backup',    offLabel: 'Standby' },
  echo_study:      { active: true,  onLabel: 'Online',    offLabel: 'Muted' },
  echo_kids:       { active: true,  onLabel: 'Online',    offLabel: 'Muted' },
};

const DEVICE_ALIASES = {
  echo_devices: 'echo_living',
  smart_lights: 'smart_lights_living_room',
};

const AVATARS = {
  rajesh: { color: '#ff8f6b', name: 'Rajesh' },
  priya:  { color: '#4ecdc4', name: 'Priya' },
  arjun:  { color: '#5eb3f6', name: 'Arjun' },
  ananya: { color: '#f7d774', name: 'Ananya' },
  dadaji: { color: '#c39be8', name: 'Dadaji' },
  dadiji: { color: '#8fe3a9', name: 'Dadiji' },
};

/** Minimal stroke icons (24×24), lucide-style. */
const ICONS = {
  bulb:    '<path d="M9.5 17.5h5M10.5 20.5h3M12 3.5a5.5 5.5 0 0 0-3.7 9.6c.8.7 1.2 1.5 1.2 2.4h5c0-.9.4-1.7 1.2-2.4A5.5 5.5 0 0 0 12 3.5z"/>',
  ac:      '<rect x="3" y="6" width="18" height="8" rx="2"/><path d="M7 17.5l-1 2.5M12 17.5V21M17 17.5l1 2.5M6.5 11h11"/>',
  tv:      '<rect x="3" y="4.5" width="18" height="12" rx="2"/><path d="M8.5 20h7"/>',
  echo:    '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.5"/>',
  hub:     '<path d="M5 10.5h14v4.5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z"/><path d="M9 7.5c0-2.5 6-2.5 6 0M3.5 10.5h17"/>',
  drop:    '<path d="M12 3.5s6 6.4 6 10.5a6 6 0 0 1-12 0C6 9.9 12 3.5 12 3.5z"/>',
  cam:     '<rect x="3" y="7.5" width="12.5" height="9" rx="2"/><path d="M15.5 11l5-2.5v7l-5-2.5"/>',
  lock:    '<rect x="5.5" y="10.5" width="13" height="9" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>',
  geyser:  '<path d="M12 3.5c1.5 3-3.5 4.6-3.5 8.3a3.5 3.5 0 0 0 7 0c0-1.6-.8-2.9-1.7-4.1-.7-1-1.4-2.4-1.8-4.2z"/><path d="M9 20.5h6"/>',
  battery: '<rect x="3" y="8" width="15" height="9" rx="2"/><path d="M21 11.5v2M12 9.5l-2.5 3h4l-2.5 3"/>',
};

// ═══════════════════════════════════════════════════════════════════
// Renderer
// ═══════════════════════════════════════════════════════════════════

export class FloorPlan2D {
  constructor(containerEl) {
    this.container = containerEl;
    this.container.innerHTML = '';
    this.container.classList.add('iso-scene');

    /** @type {Map<string, SVGGElement>} */
    this.roomGroups = new Map();
    /** @type {Map<string, HTMLElement>} */
    this.deviceEls = new Map();
    /** @type {Map<string, HTMLElement>} */
    this.avatarEls = new Map();
    /** @type {Map<string, HTMLElement>} */
    this.speechBubbles = new Map();
    /** @type {Map<string, { active: boolean }>} */
    this.deviceStates = new Map();
    this.selectedDeviceId = null;
    this._daypart = null;
    this._lastLightBucket = null;

    /** Alexa mode — kept for API compatibility ('learning' | 'deployment') */
    this.alexaMode = 'learning';

    // ViewBox bounds (computed from projection extremes + padding).
    // Padding stays tight so the house fills the stage; speech bubbles are
    // clamped to the stage edges instead of relying on margin here.
    const padX = 30;
    this.vb = {
      x: -HOUSE_D * U - padX,
      y: -WALL_H * ZU - 38,
      w: (HOUSE_W + HOUSE_D) * U + padX * 2,
      h: ((HOUSE_W + HOUSE_D) * U) / 2 + WALL_H * ZU + 38 + 52,
    };

    this._injectStyles();
    this._initializeDeviceStates();
    this._buildScene();
    this._buildDevices();
    this._buildAvatars();
    this.updateAvatars(0);
    this.updateLighting(0);
  }

  // ── coordinate helpers ─────────────────────────────────────────

  /** World → percentage position inside the stage (for HTML overlay). */
  _pct(x, y, z = 0) {
    const p = iso(x, y, z);
    return {
      left: ((p.X - this.vb.x) / this.vb.w) * 100,
      top: ((p.Y - this.vb.y) / this.vb.h) * 100,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // Public API (unchanged contract)
  // ═══════════════════════════════════════════════════════════════

  updateAvatars(timeMinutes) {
    // Group present members by room, then seat them on that room's spots.
    const byRoom = new Map();
    for (const [memberId, schedule] of Object.entries(FAMILY_SCHEDULE)) {
      const entry = schedule.find((s) => timeMinutes >= s.start && timeMinutes < s.end);
      const roomId = entry ? entry.room : null;
      if (roomId) {
        if (!byRoom.has(roomId)) byRoom.set(roomId, []);
        byRoom.get(roomId).push({ memberId, activity: entry.activity });
      } else {
        const el = this.avatarEls.get(memberId);
        if (el) el.classList.add('is-away');
      }
    }

    for (const [roomId, members] of byRoom) {
      const room = ROOMS[roomId];
      if (!room) continue;
      members.forEach(({ memberId, activity }, i) => {
        const el = this.avatarEls.get(memberId);
        if (!el) return;
        const spot = room.spots[i % room.spots.length];
        const jitter = i >= room.spots.length ? 0.5 : 0;
        const pos = this._pct(spot[0] + jitter, spot[1] + jitter, 0);
        el.style.left = `${pos.left}%`;
        el.style.top = `${pos.top}%`;
        el.classList.remove('is-away');
        el.dataset.activity = activity || '';
      });
    }
  }

  updateLighting(timeMinutes) {
    // Day part drives the sky + ambient tint via CSS attribute selectors.
    let daypart;
    if (timeMinutes < 330 || timeMinutes >= 1140) daypart = 'night';
    else if (timeMinutes < 420) daypart = 'dawn';
    else if (timeMinutes < 1020) daypart = 'day';
    else daypart = 'dusk';

    if (daypart !== this._daypart) {
      this._daypart = daypart;
      this.container.dataset.daypart = daypart;
      const appRoot = document.getElementById('app');
      if (appRoot) appRoot.dataset.daypart = daypart;
    }
  }

  /**
   * Switch Alexa's phase ('learning' | 'deployment'). Kept for main.js wiring;
   * Alexa's presence is now shown through the Echo devices themselves.
   * @param {'learning'|'deployment'} mode
   */
  setAlexaMode(mode) {
    this.alexaMode = mode;
  }

  highlightDevice(deviceId, duration = 2000) {
    const resolvedId = DEVICE_ALIASES[deviceId] || deviceId;
    const el = this.deviceEls.get(resolvedId);
    if (!el) return;
    el.classList.add('is-highlight');
    const placement = DEVICE_PLACEMENTS[resolvedId];
    if (placement) {
      const g = this.roomGroups.get(placement.room);
      if (g) {
        g.classList.add('is-flash');
        setTimeout(() => g.classList.remove('is-flash'), duration);
      }
    }
    setTimeout(() => el.classList.remove('is-highlight'), duration);
  }

  showSpeechBubble(deviceId, text, duration = 5000) {
    const resolvedId = DEVICE_ALIASES[deviceId] || deviceId;
    const el = this.deviceEls.get(resolvedId);
    if (!el) return;

    // Alexa says one thing at a time — a new utterance replaces whatever is
    // still on screen, so bubbles never pile up at high simulation speeds.
    this._dismissActiveBubble();

    const bubble = document.createElement('div');
    bubble.className = 'iso-bubble';
    bubble.innerHTML = `<span class="iso-bubble-dot"></span><span class="iso-bubble-text"></span>`;
    bubble.querySelector('.iso-bubble-text').textContent = text;
    el.appendChild(bubble);
    el.classList.add('has-bubble');
    this.speechBubbles.set(resolvedId, bubble);
    this._activeBubble = { bubble, resolvedId };

    this._clampBubble(bubble);
    requestAnimationFrame(() => bubble.classList.add('visible'));
    bubble._hideTimer = setTimeout(() => {
      bubble.classList.remove('visible');
      bubble._removeTimer = setTimeout(() => this._removeBubble(bubble, resolvedId), 350);
    }, duration);
  }

  /** Instantly clear the currently visible utterance, if any. */
  _dismissActiveBubble() {
    const active = this._activeBubble;
    if (!active) return;
    clearTimeout(active.bubble._hideTimer);
    clearTimeout(active.bubble._removeTimer);
    this._removeBubble(active.bubble, active.resolvedId);
  }

  _removeBubble(bubble, resolvedId) {
    bubble.remove();
    if (this.speechBubbles.get(resolvedId) === bubble) {
      this.speechBubbles.delete(resolvedId);
      this.deviceEls.get(resolvedId)?.classList.remove('has-bubble');
    }
    if (this._activeBubble && this._activeBubble.bubble === bubble) {
      this._activeBubble = null;
    }
  }

  /** Nudge a bubble horizontally so it never spills past the stage edges. */
  _clampBubble(bubble) {
    const stage = this.stage || this.container;
    if (!stage || typeof bubble.getBoundingClientRect !== 'function') return;
    const sr = stage.getBoundingClientRect();
    const br = bubble.getBoundingClientRect();
    if (!sr.width || !br.width) return;
    const pad = 10;
    let shift = 0;
    if (br.left < sr.left + pad) shift = sr.left + pad - br.left;
    else if (br.right > sr.right - pad) shift = sr.right - pad - br.right;
    if (shift) bubble.style.setProperty('--bx', `${Math.round(shift)}px`);
  }

  /** SpeechBubbleManager compatibility. */
  show(target, text, duration = 5000) {
    const deviceId = typeof target === 'string' ? target : 'echo_living';
    this.showSpeechBubble(deviceId, text, duration);
  }

  dimRooms(roomsToKeepLit) {
    for (const [roomId, g] of this.roomGroups) {
      if (roomsToKeepLit.includes(roomId)) {
        g.classList.add('is-powered');
        g.classList.remove('is-dim');
      } else {
        g.classList.add('is-dim');
        g.classList.remove('is-powered');
      }
    }
    this.container.classList.add('is-powercut');
  }

  restoreAll() {
    for (const [, g] of this.roomGroups) {
      g.classList.remove('is-dim', 'is-powered', 'is-flash');
    }
    for (const [, el] of this.deviceEls) {
      el.classList.remove('is-highlight', 'inverter-active');
    }
    this.container.classList.remove('is-powercut');
  }

  restoreRooms() {
    this.restoreAll();
  }

  powerCutFlicker() {
    const overlay = document.getElementById('flicker-overlay');
    if (!overlay) return;
    overlay.style.display = 'block';
    overlay.style.opacity = '0';
    const duration = 800;
    const cycleTime = duration / 4;
    const startTime = performance.now();
    const animate = () => {
      const elapsed = performance.now() - startTime;
      if (elapsed >= duration) {
        overlay.style.display = 'none';
        overlay.style.opacity = '0';
        return;
      }
      overlay.style.opacity = Math.floor(elapsed / cycleTime) % 2 === 0 ? '0.8' : '0';
      requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }

  inverterGlow(deviceId) {
    const resolvedId = DEVICE_ALIASES[deviceId] || deviceId;
    const el = this.deviceEls.get(resolvedId);
    if (el) el.classList.add('inverter-active');
  }

  getDevicePosition(deviceId) {
    const resolvedId = DEVICE_ALIASES[deviceId] || deviceId;
    const el = this.deviceEls.get(resolvedId);
    if (!el) return undefined;
    const rect = el.getBoundingClientRect();
    const containerRect = this.container.getBoundingClientRect();
    const pos = {
      x: rect.left - containerRect.left + rect.width / 2,
      y: rect.top - containerRect.top + rect.height / 2,
    };
    pos.clone = () => ({ ...pos, clone: pos.clone });
    return pos;
  }

  getMesh(deviceId) {
    const pos = this.getDevicePosition(deviceId);
    if (!pos) return undefined;
    return { position: pos };
  }

  getAllRoomLights() {
    const lights = [];
    for (const [roomId] of this.roomGroups) {
      lights.push({ roomId, lightMesh: { material: {} } });
    }
    return lights;
  }

  // ═══════════════════════════════════════════════════════════════
  // Scene construction
  // ═══════════════════════════════════════════════════════════════

  _initializeDeviceStates() {
    for (const deviceId of Object.keys(DEVICE_PLACEMENTS)) {
      const defaults = DEVICE_DEFAULT_STATES[deviceId];
      const isSmartLight = deviceId.startsWith('smart_lights_');
      this.deviceStates.set(deviceId, { active: defaults ? defaults.active : isSmartLight });
    }
  }

  _buildScene() {
    const stage = document.createElement('div');
    stage.className = 'iso-stage';
    stage.style.aspectRatio = `${this.vb.w} / ${this.vb.h}`;
    this.stage = stage;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `${this.vb.x} ${this.vb.y} ${this.vb.w} ${this.vb.h}`);
    svg.setAttribute('class', 'iso-svg');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    let html = this._defs();
    html += this._ground();
    html += this._backWalls();

    svg.innerHTML = html;

    // Room groups (floor + furniture + glow) — appended as real nodes so we
    // can toggle classes per room. Order matters (painter's algorithm).
    const order = [
      'master_bedroom', 'div:x:5.5:0:5', 'study_room', 'div:x:10:0:5', 'kitchen',
      'div:y:5:0:16',
      'living_room', 'bathwalls', 'bath', 'div:x:9.5:5:10', 'kids_room', 'div:x:13:5:10', 'balcony',
    ];

    for (const token of order) {
      if (token.startsWith('div:')) {
        const [, axis, at, from, to] = token.split(':');
        svg.appendChild(this._partition(axis, +at, +from, +to));
      } else if (token === 'bathwalls') {
        svg.appendChild(this._bathWalls());
      } else {
        svg.appendChild(this._roomGroup(token));
      }
    }

    // Front floor lip (finishes the cut edge of the slab)
    const lip = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    lip.innerHTML =
      box(0, HOUSE_D - 0.06, HOUSE_W, HOUSE_D, -0.5, 0.06, '#cdc9be') +
      box(HOUSE_W - 0.06, 0, HOUSE_W, HOUSE_D, -0.5, 0.06, '#cdc9be');
    svg.appendChild(lip);

    stage.appendChild(svg);

    // HTML overlay — devices, avatars, labels
    const overlay = document.createElement('div');
    overlay.className = 'iso-overlay';
    this.overlay = overlay;
    stage.appendChild(overlay);

    // Room labels
    for (const [roomId, r] of Object.entries(ROOMS)) {
      const label = document.createElement('button');
      label.type = 'button';
      label.className = 'iso-room-label';
      label.dataset.roomLabel = roomId;
      label.textContent = r.name;
      const [lsx, lsy] = r.labelShift || [0, 0];
      const pos = this._pct(r.x + r.w / 2 + lsx, r.y + r.d - 0.55 + lsy, 0);
      label.style.left = `${pos.left}%`;
      label.style.top = `${pos.top}%`;
      label.addEventListener('click', (ev) => this._onRoomClick(roomId, ev));
      overlay.appendChild(label);
    }

    this.container.appendChild(stage);
  }

  _defs() {
    return `<defs>
      <radialGradient id="isoGlowWarm" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#ffd489" stop-opacity="0.55"/>
        <stop offset="55%" stop-color="#ffbf66" stop-opacity="0.18"/>
        <stop offset="100%" stop-color="#ffbf66" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="isoBase" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#a89f90" stop-opacity="0.28"/>
        <stop offset="60%" stop-color="#a89f90" stop-opacity="0.10"/>
        <stop offset="100%" stop-color="#a89f90" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="isoWinDay" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#bfe6ff" stop-opacity="0.85"/>
        <stop offset="100%" stop-color="#6db5e8" stop-opacity="0.55"/>
      </linearGradient>
      <linearGradient id="isoWinNight" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#5b6a8a" stop-opacity="0.85"/>
        <stop offset="100%" stop-color="#485672" stop-opacity="0.8"/>
      </linearGradient>
      <linearGradient id="isoTvScreen" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#16324a"/>
        <stop offset="100%" stop-color="#0b1524"/>
      </linearGradient>
    </defs>`;
  }

  _ground() {
    let s = '';
    // Soft glow pool under the floating slab
    s += isoEllipse(HOUSE_W / 2 + 0.6, HOUSE_D / 2 + 0.6, -2.6, 11.5, 'url(#isoBase)', { attrs: 'class="iso-basefade"' });
    // Slab sides (foundation) + underside steps → floating island feel
    s += box(0, 0, HOUSE_W, HOUSE_D, -0.5, 0, '#d9d5ca');
    s += box(2.2, 1.8, HOUSE_W - 1.6, HOUSE_D - 1.2, -1.05, -0.5, '#ccc8bc');
    s += box(4.8, 3.4, HOUSE_W - 4.2, HOUSE_D - 2.6, -1.5, -1.05, '#bfbbaf');
    return s;
  }

  _backWalls() {
    let s = '<g class="iso-walls">';
    const wallBase = '#e8e4db';
    // Left exterior wall (x = 0 plane), drawn as slab behind rooms
    s += box(-0.22, 0, 0, HOUSE_D, 0, WALL_H, wallBase, {
      top: shade(wallBase, 1.05), faceX: shade(wallBase, 0.94), faceY: shade(wallBase, 0.8),
    });
    // Back exterior wall (y = 0 plane)
    s += box(-0.22, -0.22, HOUSE_W, 0, 0, WALL_H, wallBase, {
      top: shade(wallBase, 1.05), faceX: shade(wallBase, 0.84), faceY: shade(wallBase, 0.9),
    });
    // Windows on back wall (y=0): master, study, kitchen
    for (const [x0, x1] of [[1.4, 3.1], [6.6, 8.2], [11.2, 12.8], [14.0, 15.2]]) {
      s += wallQuadY(x0, x1, 0, 0.85, 1.85, 'url(#isoWinDay)', 'iso-window');
      s += wallQuadY(x0, x1, 0, 0.85, 1.85, 'none',
        'iso-window-frame');
    }
    // Windows on left wall (x=0): master, living
    for (const [y0, y1] of [[1.6, 3.2], [6.6, 8.2]]) {
      s += wallQuadX(y0, y1, 0, 0.85, 1.85, 'url(#isoWinDay)', 'iso-window');
      s += wallQuadX(y0, y1, 0, 0.85, 1.85, 'none', 'iso-window-frame');
    }
    // Thin accent line along wall tops
    s += `<polyline points="${pts([iso(0, HOUSE_D, WALL_H), iso(0, 0, WALL_H), iso(HOUSE_W, 0, WALL_H)])}" fill="none" stroke="#7d766a" stroke-opacity="0.3" stroke-width="1.2"/>`;
    s += '</g>';
    return s;
  }

  _partition(axis, at, from, to) {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'iso-partition');
    const t = 0.14;
    const base = '#ded9cf';
    let s;
    if (axis === 'x') {
      s = box(at - t / 2, from, at + t / 2, to, 0, KNEE_H, base, {
        top: shade(base, 1.06), faceY: shade(base, 0.86), faceX: shade(base, 0.72),
      });
    } else {
      s = box(from, at - t / 2, to, at + t / 2, 0, KNEE_H, base, {
        top: shade(base, 1.06), faceY: shade(base, 0.86), faceX: shade(base, 0.72),
      });
    }
    g.innerHTML = s;
    return g;
  }

  _bathWalls() {
    // Slightly taller, tiled privacy walls around the bath
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'iso-partition');
    const base = '#d3e0e4';
    const t = 0.14;
    const opts = { top: shade(base, 1.06), faceY: shade(base, 0.86), faceX: shade(base, 0.72) };
    g.innerHTML =
      box(6.5 - t / 2, 5, 6.5 + t / 2, 10, 0, BATH_WALL_H, base, opts) +
      box(9.5 - t / 2, 5, 9.5 + t / 2, 10, 0, BATH_WALL_H, base, opts) +
      box(6.5, 5 - t / 2, 9.5, 5 + t / 2, 0, BATH_WALL_H + 0.35, base, opts);
    return g;
  }

  _roomGroup(roomId) {
    const r = ROOMS[roomId];
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', `iso-room iso-room-${roomId}`);
    g.dataset.roomId = roomId;
    g.dataset.lights = this.deviceStates.get(`smart_lights_${roomId}`)?.active ? 'on' : 'off';

    let s = '';
    s += this._floor(r);
    s += this._furniture(roomId, r);
    // Warm light pool — sits above furniture so it reads as room lighting
    s += isoEllipse(r.x + r.w / 2, r.y + r.d / 2, 0.02, Math.min(r.w, r.d) * 0.52,
      'url(#isoGlowWarm)', { attrs: 'class="iso-glow"' });
    g.innerHTML = s;

    g.addEventListener('click', (ev) => this._onRoomClick(roomId, ev));
    this.roomGroups.set(roomId, g);
    return g;
  }

  _floor(r) {
    const pal = FLOORS[r.floor];
    let s = flat(r.x, r.y, r.x + r.w, r.y + r.d, 0, pal.base);
    // Plank / tile striping
    if (r.floor === 'wood' || r.floor === 'wood2') {
      for (let i = 0; i < Math.floor(r.w / 0.72); i++) {
        const px = r.x + 0.36 + i * 0.72;
        if (i % 2 === 0) s += flat(px, r.y, Math.min(px + 0.36, r.x + r.w), r.y + r.d, 0.004, pal.alt);
      }
    } else {
      for (let ix = 0; ix < Math.ceil(r.w); ix++) {
        for (let iy = 0; iy < Math.ceil(r.d); iy++) {
          if ((ix + iy) % 2 === 0) {
            s += flat(r.x + ix, r.y + iy, Math.min(r.x + ix + 1, r.x + r.w), Math.min(r.y + iy + 1, r.y + r.d), 0.004, pal.alt);
          }
        }
      }
    }
    // Inner edge shadowing near back walls for depth
    s += flat(r.x, r.y, r.x + r.w, r.y + 0.35, 0.006, 'rgba(100,90,70,0.13)');
    s += flat(r.x, r.y, r.x + 0.35, r.y + r.d, 0.006, 'rgba(100,90,70,0.10)');
    return s;
  }

  // ── Furniture (hand-built per room) ────────────────────────────

  _furniture(roomId, r) {
    switch (roomId) {
      case 'master_bedroom': return this._furnMaster();
      case 'study_room':     return this._furnStudy();
      case 'kitchen':        return this._furnKitchen();
      case 'living_room':    return this._furnLiving();
      case 'bath':           return this._furnBath();
      case 'kids_room':      return this._furnKids();
      case 'balcony':        return this._furnBalcony();
      default: return '';
    }
  }

  _shadow(x0, y0, x1, y1) {
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const rr = Math.max(x1 - x0, y1 - y0) * 0.62;
    return isoEllipse(cx, cy, 0.01, rr, 'rgba(95,85,70,0.11)');
  }

  _furnMaster() {
    let s = '';
    // Rug — peeks out from under the bed's foot end
    s += isoEllipse(3.45, 2.65, 0.012, 1.05, '#cbbcdd');
    s += isoEllipse(3.45, 2.65, 0.016, 0.76, '#d7cbe6');
    // Wardrobe against back wall
    s += this._shadow(3.8, 0.25, 5.25, 1.0);
    s += box(3.8, 0.25, 5.25, 1.0, 0, 1.72, '#b58a5c');
    s += `<polyline points="${pts([iso(4.52, 1.0, 0.12), iso(4.52, 1.0, 1.62)])}" stroke="#8f6b42" stroke-width="1.4" fill="none"/>`;
    // Nightstand at the head end (matches the one at the foot)
    s += box(0.75, 0.3, 1.45, 0.9, 0, 0.5, '#b58a5c');
    s += cyl(1.1, 0.6, 0.07, 0.5, 0.82, '#c8ccd4');
    s += cyl(1.1, 0.6, 0.15, 0.82, 1.0, '#ffd894', { side: '#e0b06a' });
    // Bed: frame, mattress, pillows, throw
    s += this._shadow(0.7, 1.1, 3.15, 3.7);
    s += box(0.7, 1.1, 3.15, 3.7, 0, 0.34, '#a9805a');
    s += box(0.78, 1.18, 3.07, 3.62, 0.34, 0.56, '#e8e2d4', { faceY: '#c9c2b2', faceX: '#b0a996' });
    s += box(0.86, 1.26, 1.35, 2.1, 0.56, 0.72, '#f4efe3', { faceY: '#d8d2c2', faceX: '#c2bcab' });
    s += box(0.86, 2.25, 1.35, 3.1, 0.56, 0.72, '#f4efe3', { faceY: '#d8d2c2', faceX: '#c2bcab' });
    s += box(1.9, 1.18, 3.07, 3.62, 0.56, 0.6, '#a48ac9', { faceY: '#8f76b3', faceX: '#7d68a0' });
    // Folded blanket band at the foot of the bed
    s += box(2.62, 1.18, 3.07, 3.62, 0.6, 0.66, '#8f76b3', { faceY: '#7d68a0', faceX: '#6c5a8c' });
    // Headboard
    s += box(0.62, 1.05, 0.72, 3.75, 0, 0.95, '#94714e');
    // Nightstand + lamp at the foot side
    s += box(0.75, 3.95, 1.45, 4.55, 0, 0.5, '#b58a5c');
    s += cyl(1.1, 4.25, 0.07, 0.5, 0.86, '#c8ccd4');
    s += cyl(1.1, 4.25, 0.17, 0.86, 1.06, '#ffd894', { side: '#e0b06a' });
    s += isoEllipse(1.1, 4.25, 1.07, 0.3, 'rgba(255,214,140,0.35)', { attrs: 'class="iso-lamp-glow"' });
    return s;
  }

  _furnStudy() {
    let s = '';
    // Bookshelf against back wall
    s += this._shadow(5.85, 0.25, 7.15, 0.95);
    s += box(5.85, 0.25, 7.15, 0.95, 0, 1.8, '#b1875c');
    for (const z of [0.5, 0.95, 1.4]) {
      s += `<polyline points="${pts([iso(5.85, 0.95, z), iso(7.15, 0.95, z)])}" stroke="#8f6b42" stroke-width="1.2" fill="none"/>`;
    }
    // Books (colored spines on shelf front face)
    for (let i = 0; i < 6; i++) {
      const bx = 5.98 + i * 0.185;
      const colors = ['#c96a5a', '#5a9bc9', '#c9b45a', '#7fc95a', '#a05ac9', '#5ac9b0'];
      s += wallQuadY(bx, bx + 0.13, 0.95, 1.44, 1.76, colors[i]);
    }
    // Desk with laptop
    s += this._shadow(7.6, 0.3, 9.6, 1.15);
    s += box(7.6, 0.3, 9.6, 1.15, 0.72, 0.82, '#c39a6b');
    s += box(7.72, 0.42, 7.86, 1.03, 0, 0.72, '#96744f');
    s += box(9.34, 0.42, 9.48, 1.03, 0, 0.72, '#96744f');
    s += box(8.35, 0.55, 8.95, 0.92, 0.82, 0.86, '#2a3345');
    s += wallQuadY(8.35, 8.95, 0.55, 0.86, 1.28, '#1b2b45', 'iso-screen');
    // Mug on the desk
    s += cyl(9.25, 0.68, 0.07, 0.82, 0.98, '#c96a5a');
    // Office chair — seat, backrest, pedestal with base
    s += isoEllipse(8.62, 1.82, 0.015, 0.26, '#4b525e');
    s += cyl(8.62, 1.82, 0.045, 0.02, 0.46, '#5a6272');
    s += box(8.32, 1.52, 8.92, 2.1, 0.46, 0.6, '#5f6673', { faceY: '#4f5663', faceX: '#434a56' });
    s += box(8.32, 2.02, 8.92, 2.14, 0.6, 1.32, '#4b525e', { faceY: '#3f4550', faceX: '#363c46' });
    // Plant
    s += cyl(9.0, 4.15, 0.24, 0, 0.42, '#c39a6b');
    s += isoEllipse(8.9, 3.95, 0.62, 0.32, '#3f8f5f');
    s += isoEllipse(9.14, 4.2, 0.72, 0.3, '#2f7a4e');
    s += isoEllipse(9.0, 4.1, 0.9, 0.24, '#4da06c');
    return s;
  }

  _furnKitchen() {
    let s = '';
    // Counter along back wall
    s += this._shadow(10.3, 0.25, 15.0, 1.35);
    s += box(10.3, 0.25, 15.0, 1.35, 0, 0.88, '#b9c3cf');
    s += box(10.3, 0.25, 15.0, 1.35, 0.88, 0.96, '#e3e8ee', { faceY: '#c3cad4', faceX: '#aeb7c4' });
    // Sink
    s += isoEllipse(11.2, 0.8, 0.965, 0.34, '#8d99a9');
    s += isoEllipse(11.2, 0.8, 0.97, 0.26, '#c6d4e2');
    // Stove + burners
    s += box(13.3, 0.4, 14.5, 1.25, 0.96, 1.0, '#3c434e');
    s += isoEllipse(13.62, 0.68, 1.01, 0.15, '#59606c');
    s += isoEllipse(14.16, 0.95, 1.01, 0.15, '#59606c');
    s += isoEllipse(13.62, 0.68, 1.015, 0.09, '#5a86c9');
    s += isoEllipse(14.16, 0.95, 1.015, 0.09, '#5a86c9');
    // Fridge
    s += this._shadow(15.15, 0.3, 15.85, 1.15);
    s += box(15.15, 0.3, 15.85, 1.15, 0, 1.9, '#aab6c6', { top: '#c3cedb', faceY: '#8996a8', faceX: '#707d8f' });
    s += `<polyline points="${pts([iso(15.15, 1.15, 1.12), iso(15.85, 1.15, 1.12)])}" stroke="#9aa5b3" stroke-width="1.4" fill="none"/>`;
    // Dining set — wood table, four chairs, fruit bowl
    const dchair = (x0, y0, backAtFront) => {
      let c = '';
      c += box(x0 + 0.04, y0 + 0.04, x0 + 0.12, y0 + 0.12, 0, 0.44, '#96744f');
      c += box(x0 + 0.42, y0 + 0.04, x0 + 0.5, y0 + 0.12, 0, 0.44, '#96744f');
      c += box(x0 + 0.04, y0 + 0.42, x0 + 0.12, y0 + 0.5, 0, 0.44, '#96744f');
      c += box(x0 + 0.42, y0 + 0.42, x0 + 0.5, y0 + 0.5, 0, 0.44, '#96744f');
      c += box(x0, y0, x0 + 0.54, y0 + 0.54, 0.44, 0.52, '#c39a6b');
      c += backAtFront
        ? box(x0, y0 + 0.44, x0 + 0.54, y0 + 0.54, 0.52, 1.12, '#b58a5c')
        : box(x0, y0, x0 + 0.54, y0 + 0.1, 0.52, 1.12, '#b58a5c');
      return c;
    };
    s += dchair(12.05, 1.95, false);           // back row (before the table)
    s += dchair(13.1, 1.95, false);
    s += this._shadow(11.85, 2.6, 13.95, 3.75);
    for (const [lx, ly] of [[11.95, 2.7], [13.75, 2.7], [11.95, 3.55], [13.75, 3.55]]) {
      s += box(lx, ly, lx + 0.1, ly + 0.1, 0, 0.72, '#96744f');
    }
    s += box(11.85, 2.6, 13.95, 3.75, 0.72, 0.82, '#c39a6b');
    // Fruit bowl
    s += isoEllipse(12.9, 3.15, 0.84, 0.22, '#b98e60');
    s += `<circle cx="${iso(12.82, 3.08, 0.9).X}" cy="${iso(12.82, 3.08, 0.9).Y}" r="3" fill="#f2a03d"/>`;
    s += `<circle cx="${iso(13.0, 3.2, 0.9).X}" cy="${iso(13.0, 3.2, 0.9).Y}" r="3" fill="#d96a5a"/>`;
    s += `<circle cx="${iso(12.9, 3.28, 0.93).X}" cy="${iso(12.9, 3.28, 0.93).Y}" r="2.6" fill="#7fc95a"/>`;
    s += dchair(12.05, 3.9, true);             // front row (after the table)
    s += dchair(13.1, 3.9, true);
    // Inverter unit (front-right)
    s += box(15.25, 4.05, 15.85, 4.7, 0, 0.72, '#828b9c');
    s += `<circle cx="${iso(15.55, 4.7, 0.5).X}" cy="${iso(15.55, 4.7, 0.5).Y}" r="2.6" fill="#4ade80" class="iso-inverter-led"/>`;
    return s;
  }

  _furnLiving() {
    let s = '';
    // Rug
    s += isoEllipse(3.6, 7.6, 0.012, 1.4, '#a9c9c2');
    s += isoEllipse(3.6, 7.6, 0.016, 1.05, '#bad4ce');
    // Media feature wall — hides the TV's back from the bedroom side
    s += box(1.15, 4.96, 3.85, 5.06, 0, 1.8, '#d8d2c4', { faceY: '#c4bdae', faceX: '#aaa392' });
    // TV console + TV against the media wall
    s += this._shadow(1.15, 5.15, 3.85, 5.85);
    s += box(1.15, 5.15, 3.85, 5.85, 0, 0.5, '#b58a5c');
    s += `<polyline points="${pts([iso(2.5, 5.85, 0.1), iso(2.5, 5.85, 0.42)])}" stroke="#8f6b42" stroke-width="1.2" fill="none"/>`;
    s += box(1.55, 5.22, 3.45, 5.34, 0.6, 1.62, '#141b29', { faceY: '#0e1420', faceX: '#0a0f19' });
    s += wallQuadY(1.62, 3.38, 5.345, 0.68, 1.55, 'url(#isoTvScreen)', 'iso-screen iso-tv-screen');
    // Sofa facing the TV — muted blue body, light throw pillows
    s += this._shadow(2.1, 8.0, 5.3, 9.4);
    s += box(2.1, 8.15, 5.3, 9.15, 0, 0.42, '#8ba3c7');
    s += box(2.1, 9.05, 5.3, 9.42, 0.42, 1.05, '#7b93b9');           // backrest
    s += box(2.02, 8.1, 2.32, 9.4, 0.42, 0.78, '#7b93b9');           // arm L
    s += box(5.08, 8.1, 5.38, 9.4, 0.42, 0.78, '#7b93b9');           // arm R
    s += box(2.38, 8.2, 3.7, 9.05, 0.42, 0.62, '#9db2d2', { faceY: '#8aa0c0', faceX: '#7890b2' });
    s += box(3.76, 8.2, 5.05, 9.05, 0.42, 0.62, '#9db2d2', { faceY: '#8aa0c0', faceX: '#7890b2' });
    s += box(2.5, 8.72, 3.05, 9.08, 0.62, 0.92, '#efe9d8', { faceY: '#d5cfbe', faceX: '#c2bcab' }); // pillow
    s += box(4.4, 8.75, 4.95, 9.1, 0.62, 0.9, '#e6b97e', { faceY: '#cfa163', faceX: '#b98d52' });   // pillow
    // Coffee table — slim legs, tray and a book
    s += this._shadow(3.05, 7.1, 4.35, 7.85);
    for (const [lx, ly] of [[3.1, 7.15], [4.22, 7.15], [3.1, 7.72], [4.22, 7.72]]) {
      s += box(lx, ly, lx + 0.08, ly + 0.08, 0, 0.28, '#96744f');
    }
    s += box(3.05, 7.1, 4.35, 7.85, 0.28, 0.38, '#c39a6b');
    s += cyl(3.35, 7.35, 0.15, 0.38, 0.44, '#c9c2b2');
    s += box(3.85, 7.5, 4.18, 7.75, 0.38, 0.43, '#c96a5a');          // book
    // Plant by the window corner
    s += cyl(0.6, 9.3, 0.26, 0, 0.5, '#a4917c');
    s += isoEllipse(0.5, 9.1, 0.7, 0.34, '#3f8f5f');
    s += isoEllipse(0.75, 9.4, 0.82, 0.3, '#2f7a4e');
    s += isoEllipse(0.6, 9.25, 1.0, 0.26, '#4da06c');
    // Side table under the Echo, next to the media wall
    s += box(4.9, 5.45, 5.42, 5.95, 0, 0.55, '#b58a5c');
    // Floor lamp beside the TV console
    s += cyl(1.05, 6.15, 0.05, 0, 1.5, '#8b95a5');
    s += cyl(1.05, 6.15, 0.22, 1.5, 1.78, '#ffd894', { side: '#e0b06a' });
    s += isoEllipse(1.05, 6.15, 1.8, 0.36, 'rgba(255,214,140,0.35)', { attrs: 'class="iso-lamp-glow"' });
    return s;
  }

  _furnBath() {
    let s = '';
    // Bath mat by the tub
    s += isoEllipse(7.5, 7.35, 0.012, 0.5, '#b6cfda');
    // Bathtub
    s += this._shadow(6.75, 5.3, 8.25, 6.55);
    s += box(6.75, 5.3, 8.25, 6.55, 0, 0.62, '#d7dde3', { top: '#e9eef2', faceY: '#b6bfc9', faceX: '#98a2ad' });
    s += flat(6.92, 5.45, 8.08, 6.4, 0.63, '#7fb4cc');
    s += isoEllipse(7.9, 6.05, 0.64, 0.1, '#a9d4e6');
    // Towel on the tub wall
    s += wallQuadY(6.8, 7.35, 5.17, 0.72, 1.18, '#8ba3c7');
    s += `<polyline points="${pts([iso(6.72, 5.16, 1.2), iso(7.43, 5.16, 1.2)])}" stroke="#9aa4b0" stroke-width="1.6" fill="none"/>`;
    // Basin
    s += cyl(6.95, 8.8, 0.13, 0, 0.78, '#c3cad2');
    s += isoEllipse(6.95, 8.8, 0.79, 0.3, '#e9eef2');
    s += isoEllipse(6.95, 8.8, 0.795, 0.2, '#9fc6da');
    // Toilet — bowl, seat, cistern against the right partition
    s += this._shadow(8.75, 8.55, 9.4, 9.25);
    s += box(9.08, 8.6, 9.32, 9.18, 0.2, 0.85, '#e9eef2', { faceY: '#c5cdd5', faceX: '#aab4be' });
    s += cyl(8.85, 8.9, 0.19, 0.05, 0.38, '#dfe5ea', { top: '#eef2f5' });
    s += isoEllipse(8.85, 8.9, 0.39, 0.14, '#c9d4dc');
    // Geyser tank on back privacy wall
    s += box(8.62, 5.16, 9.28, 5.62, 1.28, 1.86, '#dfe4e9', { top: '#eef2f5', faceY: '#bcc4cd', faceX: '#9aa4b0' });
    s += `<circle cx="${iso(8.95, 5.62, 1.42).X}" cy="${iso(8.95, 5.62, 1.42).Y}" r="2.2" fill="#fb8f6b"/>`;
    // Shower head on the same wall over the tub
    s += `<polyline points="${pts([iso(7.4, 5.16, 1.95), iso(7.4, 5.3, 1.8)])}" stroke="#aab4c0" stroke-width="2" fill="none"/>`;
    return s;
  }

  _furnKids() {
    let s = '';
    // Play rug
    s += isoEllipse(11.5, 8.3, 0.012, 0.85, '#aacfda');
    s += isoEllipse(11.5, 8.3, 0.016, 0.6, '#bcdbe4');
    // Bunk bed along left wall
    s += this._shadow(9.75, 5.3, 10.95, 7.6);
    s += box(9.75, 5.3, 10.95, 7.6, 0, 0.32, '#a9805a');
    s += box(9.82, 5.38, 10.88, 7.52, 0.32, 0.5, '#e8e2d4', { faceY: '#c9c2b2', faceX: '#b0a996' });
    s += box(9.82, 5.38, 10.88, 6.3, 0.5, 0.62, '#5eb3f6', { faceY: '#4d97d1', faceX: '#3f7fb1' });
    s += box(9.75, 5.3, 10.95, 7.6, 1.05, 1.32, '#a9805a');
    s += box(9.82, 5.38, 10.88, 7.52, 1.32, 1.5, '#e8e2d4', { faceY: '#c9c2b2', faceX: '#b0a996' });
    s += box(9.82, 6.6, 10.88, 7.52, 1.5, 1.62, '#f7d774', { faceY: '#d9ba5c', faceX: '#bda04c' });
    // Posts
    for (const [px, py] of [[9.78, 5.33], [10.9, 5.33], [9.78, 7.55], [10.9, 7.55]]) {
      s += box(px, py, px + 0.06, py + 0.06, 0, 1.55, '#94714e');
    }
    // Ladder
    s += `<polyline points="${pts([iso(10.95, 6.5, 0), iso(10.95, 6.5, 1.4)])}" stroke="#94714e" stroke-width="2" fill="none"/>`;
    // Teddy bear on the rug
    s += isoEllipse(10.95, 8.35, 0.05, 0.16, '#b98455');
    s += isoEllipse(10.87, 8.24, 0.28, 0.11, '#c99465');
    s += `<circle cx="${iso(10.83, 8.19, 0.42).X}" cy="${iso(10.83, 8.19, 0.42).Y}" r="1.5" fill="#a8744a"/>` +
         `<circle cx="${iso(10.93, 8.29, 0.42).X}" cy="${iso(10.93, 8.29, 0.42).Y}" r="1.5" fill="#a8744a"/>`;
    // Ball
    s += `<circle cx="${iso(12.0, 8.75, 0.12).X}" cy="${iso(12.0, 8.75, 0.12).Y}" r="5" fill="#d96a5a"/>`;
    s += `<circle cx="${iso(12.0, 8.75, 0.12).X - 1.4}" cy="${iso(12.0, 8.75, 0.12).Y - 1.2}" r="2" fill="#f2ded9"/>`;
    // Toy chest + blocks beside it
    s += this._shadow(12.3, 8.55, 12.95, 9.15);
    s += box(12.3, 8.55, 12.95, 9.15, 0, 0.45, '#b06a4f');
    s += box(12.3, 8.55, 12.95, 9.15, 0.45, 0.52, '#c97d5f', { faceY: '#a86449', faceX: '#8f5540' });
    s += box(12.15, 9.25, 12.4, 9.5, 0, 0.25, '#c95a5a');
    s += box(12.45, 9.32, 12.65, 9.52, 0, 0.2, '#5a9bc9');
    return s;
  }

  _furnBalcony() {
    let s = '';
    // Glass railing along the outer edges x=16 and y=10
    const post = (x, y) => box(x, y, x + 0.07, y + 0.07, 0, 0.8, '#c2ccd6', { faceY: '#c3cad4', faceX: '#aeb7c4' });
    s += wallQuadX(5.1, 10.0, 15.96, 0.12, 0.78, 'rgba(176, 205, 226, 0.4)');
    s += wallQuadY(13.1, 16.0, 9.96, 0.12, 0.78, 'rgba(176, 205, 226, 0.4)');
    for (let i = 0; i <= 5; i++) s += post(15.93, 5.1 + i * 0.95);
    for (let i = 0; i <= 3; i++) s += post(13.2 + i * 0.9, 9.93);
    // Top rails
    s += box(15.9, 5.05, 16.0, 10.0, 0.8, 0.9, '#d3dbe2');
    s += box(13.05, 9.9, 16.0, 10.0, 0.8, 0.9, '#d3dbe2');
    // Camera pole (holds the security camera chip)
    s += cyl(13.5, 5.55, 0.04, 0.82, 1.95, '#8b95a5');
    s += box(13.38, 5.43, 13.62, 5.67, 1.95, 2.08, '#aab4c0');
    // Lounge chair looking out over the railing
    s += this._shadow(14.55, 6.35, 15.4, 7.2);
    s += box(14.62, 6.42, 15.32, 7.12, 0.22, 0.42, '#7fb6c9', { faceY: '#6da2b4', faceX: '#5d8fa0' });
    s += box(14.62, 6.42, 14.82, 7.12, 0.42, 1.1, '#6da2b4', { faceY: '#5d8fa0', faceX: '#4f7d8d' });
    for (const [lx, ly] of [[14.66, 6.46], [15.24, 6.46], [14.66, 7.04], [15.24, 7.04]]) {
      s += box(lx, ly, lx + 0.07, ly + 0.07, 0, 0.22, '#96744f');
    }
    // Round side table with a cup
    s += cyl(15.0, 7.75, 0.26, 0, 0.45, '#c39a6b');
    s += cyl(15.05, 7.72, 0.07, 0.45, 0.56, '#e9eef2');
    // Planters
    for (const [px, py] of [[15.5, 8.7], [14.55, 9.5], [13.4, 9.4]]) {
      s += cyl(px, py, 0.2, 0, 0.34, '#b98e60');
      s += isoEllipse(px - 0.08, py - 0.12, 0.5, 0.26, '#3f8f5f');
      s += isoEllipse(px + 0.12, py + 0.08, 0.58, 0.24, '#4da06c');
    }
    return s;
  }

  // ── Devices & avatars (HTML overlay) ───────────────────────────

  _buildDevices() {
    for (const [deviceId, placement] of Object.entries(DEVICE_PLACEMENTS)) {
      const roomName = ROOMS[placement.room]?.name || placement.room;
      const el = document.createElement('button');
      el.type = 'button';
      el.className = `iso-device${placement.light ? ' iso-device-light' : ''}${placement.icon === 'echo' ? ' iso-device-echo' : ''}`;
      el.dataset.deviceId = deviceId;
      const pos = this._pct(placement.x, placement.y, placement.z || 0);
      el.style.left = `${pos.left}%`;
      el.style.top = `${pos.top}%`;
      el.title = `${placement.label} — ${roomName}`;
      el.setAttribute('aria-label', `${placement.label} in ${roomName}`);
      el.innerHTML = `
        <span class="iso-device-ring" aria-hidden="true"></span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[placement.icon] || ICONS.bulb}</svg>
      `;
      el.addEventListener('click', (ev) => this._onDeviceClick(deviceId, ev));
      this.overlay.appendChild(el);
      this.deviceEls.set(deviceId, el);
      this._applyDeviceState(deviceId);
    }
  }

  _buildAvatars() {
    for (const [memberId, meta] of Object.entries(AVATARS)) {
      const el = document.createElement('div');
      el.className = 'iso-avatar is-away';
      el.dataset.memberId = memberId;
      el.style.setProperty('--avatar-color', meta.color);
      el.innerHTML = `
        <span class="iso-avatar-pin"><span class="iso-avatar-initial">${meta.name.charAt(0)}</span></span>
        <span class="iso-avatar-shadow" aria-hidden="true"></span>
        <span class="iso-avatar-name">${meta.name}</span>
      `;
      this.overlay.appendChild(el);
      this.avatarEls.set(memberId, el);
    }
  }

  // ── Interactions ───────────────────────────────────────────────

  _onRoomClick(roomId, event) {
    if (event?.target?.closest?.('.iso-device')) return;
    const r = ROOMS[roomId];
    if (!r) return;

    const devices = Object.entries(DEVICE_PLACEMENTS)
      .filter(([, p]) => p.room === roomId)
      .map(([id, p]) => ({ id, icon: p.icon, label: p.label, status: this._getDeviceStateLabel(id) }));

    const people = [];
    for (const [memberId, el] of this.avatarEls) {
      if (el.classList.contains('is-away')) continue;
      const left = parseFloat(el.style.left), top = parseFloat(el.style.top);
      const c0 = this._pct(r.x, r.y, 0), c1 = this._pct(r.x + r.w, r.y + r.d, 0);
      // Rough containment check in overlay space using room corner projections
      const minL = Math.min(c0.left, c1.left) - 8, maxL = Math.max(c0.left, c1.left) + 8;
      const minT = Math.min(c0.top, c1.top) - 8, maxT = Math.max(c0.top, c1.top) + 8;
      if (left >= minL && left <= maxL && top >= minT && top <= maxT) {
        people.push(AVATARS[memberId].name);
      }
    }
    this._showRoomInfo(roomId, r.name, devices, people);
  }

  _showRoomInfo(roomId, roomName, devices, people) {
    this._removeInfoPanels();
    if (this.selectedDeviceId) {
      this.deviceEls.get(this.selectedDeviceId)?.classList.remove('selected');
      this.selectedDeviceId = null;
    }

    const info = document.createElement('div');
    info.className = 'iso-info-card';
    info.innerHTML = `
      <button class="iso-info-close" type="button" aria-label="Close">✕</button>
      <div class="iso-info-title">
        <span class="iso-info-kicker">Room</span>
        <h3>${roomName}</h3>
      </div>
      <div class="iso-info-section">
        <span class="iso-info-label">Devices</span>
        <div class="iso-info-devices">
          ${devices.length ? devices.map((d) => `
            <button type="button" class="iso-info-device" data-device-id="${d.id}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[d.icon] || ICONS.bulb}</svg>
              <span>${d.label}</span>
              <em>${d.status}</em>
            </button>`).join('') : '<span class="iso-info-empty">None</span>'}
        </div>
      </div>
      <div class="iso-info-section">
        <span class="iso-info-label">People here</span>
        <div class="iso-info-people">${people.length ? people.join(' · ') : 'Nobody right now'}</div>
      </div>
    `;
    info.querySelector('.iso-info-close').addEventListener('click', () => info.remove());
    info.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-device-id]');
      if (btn) this._onDeviceClick(btn.dataset.deviceId, event);
    });
    this.container.appendChild(info);
  }

  _onDeviceClick(deviceId, event) {
    event?.stopPropagation();
    const resolvedId = DEVICE_ALIASES[deviceId] || deviceId;
    const placement = DEVICE_PLACEMENTS[resolvedId];
    if (!placement) return;

    if (this.selectedDeviceId && this.selectedDeviceId !== resolvedId) {
      this.deviceEls.get(this.selectedDeviceId)?.classList.remove('selected');
    }
    this.selectedDeviceId = resolvedId;
    this.deviceEls.get(resolvedId)?.classList.add('selected');
    this.highlightDevice(resolvedId, 1200);
    this._showDeviceInfo(resolvedId);
  }

  _showDeviceInfo(deviceId) {
    this._removeInfoPanels();
    const placement = DEVICE_PLACEMENTS[deviceId];
    const room = ROOMS[placement.room];
    const stateLabel = this._getDeviceStateLabel(deviceId);
    const active = this.deviceStates.get(deviceId)?.active;

    const info = document.createElement('div');
    info.className = 'iso-info-card';
    info.innerHTML = `
      <button class="iso-info-close" type="button" aria-label="Close">✕</button>
      <div class="iso-info-device-head">
        <span class="iso-info-device-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[placement.icon] || ICONS.bulb}</svg></span>
        <div>
          <h3>${placement.label}</h3>
          <p>${room?.name || placement.room}</p>
        </div>
        <span class="iso-info-state ${active ? 'is-on' : 'is-off'}">${stateLabel}</span>
      </div>
      <div class="iso-info-actions">
        <button type="button" class="iso-info-action" data-action="toggle">${active ? 'Turn off' : 'Turn on'}</button>
        <button type="button" class="iso-info-action is-ghost" data-action="announce">Announce</button>
      </div>
    `;
    info.querySelector('.iso-info-close').addEventListener('click', () => {
      info.remove();
      this.deviceEls.get(deviceId)?.classList.remove('selected');
      if (this.selectedDeviceId === deviceId) this.selectedDeviceId = null;
    });
    info.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-action]');
      if (!btn) return;
      if (btn.dataset.action === 'toggle') {
        this._toggleDeviceState(deviceId);
      } else {
        this.showSpeechBubble(deviceId, `${placement.label} is ${this._getDeviceStateLabel(deviceId)}.`, 3000);
      }
    });
    this.container.appendChild(info);
  }

  _toggleDeviceState(deviceId) {
    const state = this.deviceStates.get(deviceId) || { active: true };
    this.deviceStates.set(deviceId, { ...state, active: !state.active });
    this._applyDeviceState(deviceId);
    this.highlightDevice(deviceId, 800);
    this._showDeviceInfo(deviceId);
  }

  _applyDeviceState(deviceId) {
    const el = this.deviceEls.get(deviceId);
    if (!el) return;
    const state = this.deviceStates.get(deviceId) || { active: true };
    el.dataset.state = state.active ? 'on' : 'off';
    el.classList.toggle('is-off', !state.active);
    // Smart lights drive the room glow
    if (deviceId.startsWith('smart_lights_')) {
      const roomId = deviceId.replace('smart_lights_', '');
      const g = this.roomGroups.get(roomId);
      if (g) g.dataset.lights = state.active ? 'on' : 'off';
    }
  }

  _getDeviceStateLabel(deviceId) {
    const state = this.deviceStates.get(deviceId) || { active: true };
    const defaults = DEVICE_DEFAULT_STATES[deviceId] || {};
    const isSmartLight = deviceId.startsWith('smart_lights_');
    if (state.active) return defaults.onLabel || (isSmartLight ? 'On' : 'Active');
    return defaults.offLabel || 'Off';
  }

  _removeInfoPanels() {
    this.container.querySelectorAll('.iso-info-card').forEach((el) => el.remove());
  }

  // ═══════════════════════════════════════════════════════════════
  // Styles
  // ═══════════════════════════════════════════════════════════════

  _injectStyles() {
    const prev = document.getElementById('floor-plan-2d-styles');
    if (prev) prev.remove();
    const style = document.createElement('style');
    style.id = 'floor-plan-2d-styles';
    style.textContent = `
      .iso-scene { position: relative; display: flex; align-items: center; justify-content: center; }

      .iso-stage { position: relative; width: 100%; max-height: 100%; margin: auto; }

      .iso-svg { display: block; width: 100%; height: 100%; overflow: visible; }

      /* ── day/night ambience — gentle dimming on a light scene ──── */
      .iso-room { transition: filter 1.2s ease, opacity 1.2s ease; }
      [data-daypart="night"] .iso-room { filter: brightness(0.78) saturate(0.88); }
      [data-daypart="dawn"]  .iso-room { filter: brightness(0.95) sepia(0.06); }
      [data-daypart="dusk"]  .iso-room { filter: brightness(0.9) sepia(0.1); }
      [data-daypart="night"] .iso-walls,
      [data-daypart="night"] .iso-partition { filter: brightness(0.84); }
      [data-daypart="dusk"] .iso-walls,
      [data-daypart="dusk"] .iso-partition { filter: brightness(0.93); }
      .iso-walls, .iso-partition { transition: filter 1.2s ease; }

      .iso-window { transition: fill 1.2s ease; }
      [data-daypart="night"] .iso-window { fill: url(#isoWinNight); }
      .iso-window-frame { stroke: #b3aea2; stroke-width: 2; fill: none; }

      /* Warm room glow — only reads after dark; daylight stays crisp */
      .iso-glow { opacity: 0; transition: opacity 1.2s ease; pointer-events: none; }
      [data-daypart="night"] .iso-room[data-lights="on"] .iso-glow,
      [data-daypart="dusk"] .iso-room[data-lights="on"] .iso-glow { opacity: 0.8; }
      .iso-lamp-glow { opacity: 0; transition: opacity 1.2s ease; }
      [data-daypart="dusk"] .iso-lamp-glow { opacity: 0.5; }
      [data-daypart="night"] .iso-lamp-glow { opacity: 0.75; }

      /* Brief lift when Alexa acts in a room */
      .iso-room.is-flash { filter: brightness(1.07) saturate(1.1) !important; }

      /* Power-cut states */
      .iso-room.is-dim { filter: brightness(0.6) saturate(0.35) !important; }
      .iso-room.is-powered { filter: drop-shadow(0 0 14px rgba(31, 138, 93, 0.4)) !important; }
      .iso-room.is-powered .iso-glow { opacity: 0.85 !important; }
      .is-powercut .iso-walls, .is-powercut .iso-partition { filter: brightness(0.72); }

      .iso-inverter-led { opacity: 0.5; }
      .is-powercut .iso-inverter-led { opacity: 1; animation: iso-led-blink 1s ease-in-out infinite; }
      @keyframes iso-led-blink { 50% { opacity: 0.25; } }

      .iso-tv-screen { transition: fill 0.5s ease; }

      /* ── HTML overlay ─────────────────────────────────────────── */
      .iso-overlay { position: absolute; inset: 0; pointer-events: none; }

      /* Room labels — small dark tags floating over the rooms */
      .iso-room-label {
        position: absolute;
        transform: translate(-50%, -50%);
        pointer-events: auto;
        border: none;
        background: rgba(29, 31, 35, 0.82);
        color: #f2f3f5;
        font-family: var(--font-body, 'Inter', sans-serif);
        font-size: clamp(0.46rem, 0.7vw, 0.64rem);
        font-weight: 600;
        letter-spacing: 0.01em;
        padding: 0.36em 0.9em;
        border-radius: 8px;
        backdrop-filter: blur(3px);
        -webkit-backdrop-filter: blur(3px);
        cursor: pointer;
        transition: background 0.2s ease;
        white-space: nowrap;
        z-index: 4;
      }
      .iso-room-label:hover { background: rgba(23, 24, 26, 0.95); }
      :root[data-theme="dark"] .iso-room-label { background: rgba(16, 17, 20, 0.8); }
      :root[data-theme="dark"] .iso-room-label:hover { background: rgba(16, 17, 20, 0.95); }

      /* Devices — quiet white chips */
      .iso-device {
        position: absolute;
        transform: translate(-50%, -50%);
        width: clamp(18px, 2.1vw, 26px);
        height: clamp(18px, 2.1vw, 26px);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        border-radius: 50%;
        border: 1px solid #dedbd2;
        background: #ffffff;
        color: #6b6f75;
        cursor: pointer;
        pointer-events: auto;
        z-index: 6;
        box-shadow: 0 2px 6px rgba(70, 62, 48, 0.18);
        transition: transform 0.18s ease, color 0.2s ease, border-color 0.2s ease, opacity 0.3s ease, box-shadow 0.2s ease;
      }
      .iso-device svg { width: 58%; height: 58%; }
      .iso-device:hover, .iso-device:focus-visible, .iso-device.selected {
        transform: translate(-50%, -50%) scale(1.16);
        color: #17181a;
        border-color: #17181a;
        outline: none;
        z-index: 9;
      }
      .iso-device.is-off { opacity: 0.55; }
      .iso-device.has-bubble { z-index: 22; }

      /* Smart lights — tiny warm dots, icon-free */
      .iso-device.iso-device-light {
        width: 9px;
        height: 9px;
        border: none;
        background: #f2b01e;
        box-shadow: 0 0 8px rgba(242, 176, 30, 0.65);
      }
      .iso-device.iso-device-light svg { display: none; }
      .iso-device.iso-device-light:hover,
      .iso-device.iso-device-light.selected { transform: translate(-50%, -50%) scale(1.5); }
      .iso-device.iso-device-light.is-off { background: #c6c2b6; box-shadow: none; }

      /* Echo devices — a small charcoal cylinder, light ring on the top rim */
      .iso-device.iso-device-echo {
        width: clamp(15px, 1.7vw, 21px);
        height: clamp(23px, 2.7vw, 32px);
        border: none;
        border-radius: 50% / 14%;
        background: linear-gradient(180deg, #3d444b 0%, #272c31 55%, #171a1e 100%);
        box-shadow: 0 3px 8px rgba(70, 62, 48, 0.4);
        color: transparent;
      }
      .iso-device.iso-device-echo svg { display: none; }
      .iso-device.iso-device-echo::before {
        content: '';
        position: absolute;
        top: -1px;
        left: 0;
        right: 0;
        height: 32%;
        box-sizing: border-box;
        border-radius: 50%;
        background: linear-gradient(180deg, #545c64 0%, #363c42 100%);
        border: 1.5px solid rgba(0, 184, 232, 0.4);
        transition: border-color 0.25s ease, box-shadow 0.25s ease;
      }
      .iso-device.iso-device-echo::after {
        content: '';
        position: absolute;
        top: 30%;
        bottom: 8%;
        left: 18%;
        width: 22%;
        border-radius: 50%;
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.14), rgba(255, 255, 255, 0));
        pointer-events: none;
      }
      .iso-device.iso-device-echo:hover,
      .iso-device.iso-device-echo:focus-visible,
      .iso-device.iso-device-echo.selected { transform: translate(-50%, -50%) scale(1.12); }
      .iso-device.iso-device-echo.has-bubble::before,
      .iso-device.iso-device-echo.is-highlight::before {
        border-color: #35d5f5;
        box-shadow: 0 0 9px rgba(0, 184, 232, 0.9), inset 0 0 5px rgba(0, 184, 232, 0.55);
        animation: iso-echo-talk 0.9s ease-in-out infinite;
      }
      @keyframes iso-echo-talk { 50% { filter: brightness(1.5); } }

      .iso-device-ring {
        position: absolute;
        inset: -3px;
        border-radius: 50%;
        border: 1.5px solid transparent;
        pointer-events: none;
      }
      .iso-device.is-highlight .iso-device-ring {
        border-color: rgba(0, 184, 232, 0.85);
        animation: iso-ping 0.7s ease-out 3;
      }
      .iso-device.is-highlight {
        color: #17181a;
        border-color: #00b8e8;
        box-shadow: 0 0 14px rgba(0, 184, 232, 0.45);
      }
      @keyframes iso-ping {
        0% { transform: scale(0.9); opacity: 1; }
        100% { transform: scale(2.1); opacity: 0; }
      }
      .iso-device.inverter-active {
        color: #1f8a5d;
        border-color: rgba(31, 138, 93, 0.8);
        box-shadow: 0 0 16px rgba(31, 138, 93, 0.45);
      }

      /* Avatars */
      .iso-avatar {
        position: absolute;
        transform: translate(-50%, -100%);
        pointer-events: auto;
        z-index: 7;
        transition: left 1.1s cubic-bezier(0.5, 0, 0.3, 1), top 1.1s cubic-bezier(0.5, 0, 0.3, 1), opacity 0.6s ease;
        display: flex;
        flex-direction: column;
        align-items: center;
        cursor: default;
      }
      .iso-avatar.is-away { opacity: 0; pointer-events: none; }
      .iso-avatar-pin {
        display: flex;
        align-items: center;
        justify-content: center;
        width: clamp(16px, 1.9vw, 23px);
        height: clamp(16px, 1.9vw, 23px);
        border-radius: 50% 50% 50% 4px;
        transform: rotate(-45deg);
        background: linear-gradient(135deg, color-mix(in srgb, var(--avatar-color) 82%, #ffffff), var(--avatar-color));
        border: 1.5px solid #ffffff;
        box-shadow: 0 2px 7px rgba(70, 62, 48, 0.35);
        color: rgba(20, 22, 26, 0.82);
        font-size: clamp(0.48rem, 0.76vw, 0.64rem);
        font-weight: 700;
        line-height: 1;
        user-select: none;
        pointer-events: none;
        font-family: var(--font-display, 'Space Grotesk', sans-serif);
      }
      .iso-avatar-initial { transform: rotate(45deg); display: block; }
      .iso-avatar-shadow {
        width: 11px;
        height: 4px;
        margin-top: 2px;
        border-radius: 50%;
        background: rgba(70, 62, 48, 0.32);
        filter: blur(1px);
      }
      .iso-avatar-name {
        position: absolute;
        bottom: calc(100% + 4px);
        left: 50%;
        transform: translateX(-50%) translateY(3px);
        padding: 2px 8px;
        border-radius: 7px;
        background: var(--surface, #ffffff);
        border: 1px solid var(--border, #e3e0d8);
        color: var(--text, #1a1c1e);
        font-size: 0.62rem;
        font-weight: 600;
        white-space: nowrap;
        box-shadow: 0 2px 6px rgba(70, 62, 48, 0.18);
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.18s ease, transform 0.18s ease;
      }
      .iso-avatar:hover .iso-avatar-name { opacity: 1; transform: translateX(-50%) translateY(0); }
      .iso-avatar:hover { z-index: 12; }

      /* Speech bubbles */
      .iso-bubble {
        position: absolute;
        bottom: calc(100% + 10px);
        left: 50%;
        transform: translateX(calc(-50% + var(--bx, 0px))) translateY(8px) scale(0.96);
        display: flex;
        gap: 0.5rem;
        align-items: flex-start;
        width: max-content;
        max-width: 240px;
        padding: 0.55rem 0.75rem;
        border-radius: 12px 12px 12px 3px;
        background: var(--surface, #ffffff);
        border: 1px solid var(--border, #e8e6e0);
        box-shadow: 0 10px 24px rgba(70, 62, 48, 0.24);
        color: var(--text, #1a1c1e);
        font-size: 0.68rem;
        font-weight: 500;
        line-height: 1.45;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.3s ease, transform 0.3s ease;
        z-index: 20;
      }
      .iso-bubble.visible { opacity: 1; transform: translateX(calc(-50% + var(--bx, 0px))) translateY(0) scale(1); }

      .iso-bubble-dot {
        flex-shrink: 0;
        width: 9px;
        height: 9px;
        margin-top: 3px;
        border-radius: 50%;
        background: conic-gradient(from 0deg, #00b8e8, #2e6be6, #35d5f5, #00b8e8);
        -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2.6px));
        mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2.6px));
        animation: iso-bubble-spin 2.6s linear infinite;
      }
      @keyframes iso-bubble-spin { to { transform: rotate(360deg); } }

      /* Info cards — fixed so they float above every panel layer */
      .iso-info-card {
        position: fixed;
        top: calc(var(--topbar-h, 62px) + 26px);
        left: 50%;
        transform: translateX(-50%);
        z-index: 950;
        width: min(280px, calc(100% - 28px));
        padding: 1rem 1.1rem;
        border-radius: 16px;
        background: var(--surface, #ffffff);
        border: 1px solid var(--border, #e8e6e0);
        box-shadow: 0 18px 44px rgba(23, 24, 26, 0.22);
        animation: iso-card-in 0.22s ease;
        font-family: var(--font-body, 'Inter', sans-serif);
      }
      @keyframes iso-card-in {
        from { opacity: 0; transform: translateX(-50%) translateY(-6px); }
        to { opacity: 1; transform: translateX(-50%) translateY(0); }
      }
      .iso-info-close {
        position: absolute;
        top: 10px;
        right: 12px;
        background: none;
        border: none;
        color: var(--text-mute, #90959a);
        font-size: 0.85rem;
        cursor: pointer;
        padding: 2px;
      }
      .iso-info-close:hover { color: var(--text, #1a1c1e); }
      .iso-info-kicker, .iso-info-label {
        display: block;
        font-size: 0.58rem;
        font-weight: 700;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--text-mute, #90959a);
        margin-bottom: 0.3rem;
      }
      .iso-info-title h3, .iso-info-device-head h3 {
        margin: 0;
        font-family: var(--font-display, 'Space Grotesk', sans-serif);
        font-size: 0.95rem;
        letter-spacing: -0.01em;
        color: var(--text, #1a1c1e);
      }
      .iso-info-title { margin-bottom: 0.85rem; }
      .iso-info-section { margin-bottom: 0.8rem; }
      .iso-info-section:last-child { margin-bottom: 0; }
      .iso-info-devices { display: grid; gap: 5px; }
      .iso-info-device {
        display: grid;
        grid-template-columns: 20px 1fr auto;
        align-items: center;
        gap: 0.55rem;
        width: 100%;
        padding: 0.42rem 0.55rem;
        border-radius: 9px;
        border: 1px solid transparent;
        background: var(--well, #f7f6f2);
        color: var(--text, #1a1c1e);
        font: inherit;
        font-size: 0.74rem;
        font-weight: 600;
        text-align: left;
        cursor: pointer;
        transition: border-color 0.15s ease, background 0.15s ease;
      }
      .iso-info-device:hover {
        border-color: var(--border-strong, #d8d5cc);
        background: var(--well-2, #f1efe9);
      }
      .iso-info-device svg { width: 15px; height: 15px; color: var(--text-dim, #5d6165); }
      .iso-info-device em {
        font-style: normal;
        font-size: 0.62rem;
        font-weight: 500;
        color: var(--text-mute, #90959a);
      }
      .iso-info-empty, .iso-info-people { font-size: 0.75rem; color: var(--text-dim, #5d6165); }
      .iso-info-device-head {
        display: flex;
        align-items: center;
        gap: 0.7rem;
        margin-bottom: 0.9rem;
        padding-right: 1.2rem;
      }
      .iso-info-device-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        flex-shrink: 0;
        border-radius: 11px;
        background: var(--well, #f7f6f2);
        border: 1px solid var(--border, #e8e6e0);
        color: var(--text, #17181a);
      }
      .iso-info-device-icon svg { width: 18px; height: 18px; }
      .iso-info-device-head p { margin: 2px 0 0; font-size: 0.68rem; color: var(--text-mute, #90959a); }
      .iso-info-state {
        margin-left: auto;
        font-size: 0.6rem;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        padding: 0.22rem 0.5rem;
        border-radius: 999px;
      }
      .iso-info-state.is-on { color: #1f8a5d; background: rgba(31, 138, 93, 0.1); }
      .iso-info-state.is-off { color: var(--text-dim, #5d6165); background: var(--well-2, #f1efe9); }
      .iso-info-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
      .iso-info-action {
        min-height: 34px;
        border-radius: 999px;
        border: none;
        background: var(--ink, #17181a);
        color: var(--on-ink, #ffffff);
        font: inherit;
        font-size: 0.74rem;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.15s ease, transform 0.15s ease;
      }
      .iso-info-action:hover { background: var(--ink-hover, #2b2e33); transform: translateY(-1px); }
      .iso-info-action.is-ghost {
        background: var(--surface, #ffffff);
        border: 1px solid var(--border-strong, #d8d5cc);
        color: var(--text, #1a1c1e);
      }
      .iso-info-action.is-ghost:hover { background: var(--well, #f7f6f2); }
    `;
    document.head.appendChild(style);
  }
}
