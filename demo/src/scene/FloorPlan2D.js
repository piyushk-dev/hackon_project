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
    spots: [[2.0, 2.4], [3.0, 3.9], [4.5, 2.6], [1.4, 4.1]] },
  study_room:     { x: 5.5,  y: 0, w: 4.5, d: 5, name: 'Study', floor: 'wood2',
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
  wood:  { base: '#8f6b46', alt: '#856240', edge: '#6b4e32' },
  wood2: { base: '#84654a', alt: '#7a5d43', edge: '#615037' },
  tile:  { base: '#5c6a7d', alt: '#556275', edge: '#3f4b5c' },
  btile: { base: '#5e7d88', alt: '#57737e', edge: '#42606b' },
  stone: { base: '#586173', alt: '#515a6b', edge: '#3d4554' },
};

/** Device catalog — same IDs as before. x/y are absolute grid coords, z = float height. */
const DEVICE_PLACEMENTS = {
  living_room_ac:  { room: 'living_room', x: 0.45, y: 7.0,  z: 1.85, icon: 'ac',      label: 'AC' },
  smart_tv:        { room: 'living_room', x: 2.5,  y: 5.55, z: 1.7,  icon: 'tv',      label: 'TV' },
  echo_living:     { room: 'living_room', x: 5.15, y: 5.7,  z: 0.95, icon: 'echo',    label: 'Echo' },
  kitchen_hub:     { room: 'kitchen',     x: 13.0, y: 3.05, z: 1.35, icon: 'hub',     label: 'Hub' },
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

    /** Alexa presence orb state */
    this.alexaMode = 'learning';
    this._scanTimer = null;
    this._scanIndex = 0;
    this._orbReturnTimer = null;

    // ViewBox bounds (computed from projection extremes + padding)
    const padX = 60;
    this.vb = {
      x: -HOUSE_D * U - padX,
      y: -WALL_H * ZU - 68,
      w: (HOUSE_W + HOUSE_D) * U + padX * 2,
      h: ((HOUSE_W + HOUSE_D) * U) / 2 + WALL_H * ZU + 68 + 96,
    };

    this._injectStyles();
    this._initializeDeviceStates();
    this._buildScene();
    this._buildDevices();
    this._buildAvatars();
    this._buildAlexaOrb();
    this.updateAvatars(0);
    this.updateLighting(0);
    this.setAlexaMode('learning');
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
   * Switch Alexa's presence behavior.
   * 'learning'  → the orb sweeps room to room, studying the household.
   * 'deployment' → the orb perches by the living-room Echo and flies to
   *                whichever device it acts on.
   * @param {'learning'|'deployment'} mode
   */
  setAlexaMode(mode) {
    this.alexaMode = mode;
    this._stopLearningScan();
    if (mode === 'learning') {
      this._startLearningScan();
    } else {
      this._orbToHome('Ready — thinking ahead');
    }
  }

  highlightDevice(deviceId, duration = 2000) {
    const resolvedId = DEVICE_ALIASES[deviceId] || deviceId;
    const el = this.deviceEls.get(resolvedId);
    if (!el) return;
    this._alexaAttend(resolvedId, false, duration + 1200);
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

    this._alexaAttend(resolvedId, true, duration + 600);

    const existing = this.speechBubbles.get(resolvedId);
    if (existing) existing.remove();

    const bubble = document.createElement('div');
    bubble.className = 'iso-bubble';
    bubble.innerHTML = `<span class="iso-bubble-dot"></span><span class="iso-bubble-text"></span>`;
    bubble.querySelector('.iso-bubble-text').textContent = text;
    el.appendChild(bubble);
    el.classList.add('has-bubble');
    this.speechBubbles.set(resolvedId, bubble);

    requestAnimationFrame(() => bubble.classList.add('visible'));
    setTimeout(() => {
      bubble.classList.remove('visible');
      setTimeout(() => {
        bubble.remove();
        if (this.speechBubbles.get(resolvedId) === bubble) {
          this.speechBubbles.delete(resolvedId);
          this.deviceEls.get(resolvedId)?.classList.remove('has-bubble');
        }
      }, 350);
    }, duration);
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
      box(0, HOUSE_D - 0.06, HOUSE_W, HOUSE_D, -0.5, 0.06, '#2b3550') +
      box(HOUSE_W - 0.06, 0, HOUSE_W, HOUSE_D, -0.5, 0.06, '#2b3550');
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
      const pos = this._pct(r.x + r.w / 2, r.y + r.d - 0.55, 0);
      label.style.left = `${pos.left}%`;
      label.style.top = `${pos.top}%`;
      label.addEventListener('click', (ev) => this._onRoomClick(roomId, ev));
      overlay.appendChild(label);
    }

    // Ambient floating motes for the diorama feel
    const motes = document.createElement('div');
    motes.className = 'iso-motes';
    motes.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 10; i++) {
      const m = document.createElement('span');
      m.style.setProperty('--mx', `${8 + Math.random() * 84}%`);
      m.style.setProperty('--my', `${12 + Math.random() * 70}%`);
      m.style.setProperty('--md', `${6 + Math.random() * 9}s`);
      m.style.setProperty('--ms', `${0.5 + Math.random() * 0.9}`);
      m.style.animationDelay = `${-Math.random() * 12}s`;
      motes.appendChild(m);
    }
    stage.appendChild(motes);

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
        <stop offset="0%" stop-color="#00caff" stop-opacity="0.28"/>
        <stop offset="60%" stop-color="#2e6be6" stop-opacity="0.10"/>
        <stop offset="100%" stop-color="#2e6be6" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="isoWinDay" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#bfe6ff" stop-opacity="0.85"/>
        <stop offset="100%" stop-color="#6db5e8" stop-opacity="0.55"/>
      </linearGradient>
      <linearGradient id="isoWinNight" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#1c2a4d" stop-opacity="0.95"/>
        <stop offset="100%" stop-color="#141d38" stop-opacity="0.9"/>
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
    // Slab sides (foundation) + underside rocks → floating island feel
    s += box(0, 0, HOUSE_W, HOUSE_D, -0.5, 0, '#324061');
    s += box(2.2, 1.8, HOUSE_W - 1.6, HOUSE_D - 1.2, -1.05, -0.5, '#26314c');
    s += box(4.8, 3.4, HOUSE_W - 4.2, HOUSE_D - 2.6, -1.5, -1.05, '#1d2740');
    return s;
  }

  _backWalls() {
    let s = '<g class="iso-walls">';
    const wallBase = '#43507a';
    // Left exterior wall (x = 0 plane), drawn as slab behind rooms
    s += box(-0.22, 0, 0, HOUSE_D, 0, WALL_H, wallBase, {
      top: shade(wallBase, 1.12), faceX: shade(wallBase, 0.88), faceY: shade(wallBase, 0.52),
    });
    // Back exterior wall (y = 0 plane)
    s += box(-0.22, -0.22, HOUSE_W, 0, 0, WALL_H, wallBase, {
      top: shade(wallBase, 1.12), faceX: shade(wallBase, 0.62), faceY: shade(wallBase, 0.7),
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
    s += `<polyline points="${pts([iso(0, HOUSE_D, WALL_H), iso(0, 0, WALL_H), iso(HOUSE_W, 0, WALL_H)])}" fill="none" stroke="#8fb4ff" stroke-opacity="0.35" stroke-width="1.6"/>`;
    s += '</g>';
    return s;
  }

  _partition(axis, at, from, to) {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'iso-partition');
    const t = 0.14;
    const base = '#3b4768';
    let s;
    if (axis === 'x') {
      s = box(at - t / 2, from, at + t / 2, to, 0, KNEE_H, base, {
        top: shade(base, 1.18), faceY: shade(base, 0.72), faceX: shade(base, 0.5),
      });
    } else {
      s = box(from, at - t / 2, to, at + t / 2, 0, KNEE_H, base, {
        top: shade(base, 1.18), faceY: shade(base, 0.72), faceX: shade(base, 0.5),
      });
    }
    g.innerHTML = s;
    return g;
  }

  _bathWalls() {
    // Slightly taller, tiled privacy walls around the bath
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'iso-partition');
    const base = '#46607a';
    const t = 0.14;
    const opts = { top: shade(base, 1.22), faceY: shade(base, 0.74), faceX: shade(base, 0.52) };
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
    s += flat(r.x, r.y, r.x + r.w, r.y + 0.35, 0.006, 'rgba(10,14,28,0.28)');
    s += flat(r.x, r.y, r.x + 0.35, r.y + r.d, 0.006, 'rgba(10,14,28,0.22)');
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
    return isoEllipse(cx, cy, 0.01, rr, 'rgba(6,9,20,0.30)');
  }

  _furnMaster() {
    let s = '';
    // Rug
    s += isoEllipse(4.0, 3.5, 0.012, 1.0, '#6f5a86');
    s += isoEllipse(4.0, 3.5, 0.016, 0.72, '#7d6894');
    // Wardrobe against back wall
    s += this._shadow(3.8, 0.25, 5.25, 1.0);
    s += box(3.8, 0.25, 5.25, 1.0, 0, 1.72, '#6e5138');
    s += `<polyline points="${pts([iso(4.52, 1.0, 0.12), iso(4.52, 1.0, 1.62)])}" stroke="#3f2d1e" stroke-width="1.4" fill="none"/>`;
    // Bed: frame, mattress, pillows, throw
    s += this._shadow(0.7, 1.1, 3.15, 3.7);
    s += box(0.7, 1.1, 3.15, 3.7, 0, 0.34, '#5d4530');
    s += box(0.78, 1.18, 3.07, 3.62, 0.34, 0.56, '#e8e2d4', { faceY: '#c9c2b2', faceX: '#b0a996' });
    s += box(0.86, 1.26, 1.35, 2.1, 0.56, 0.72, '#f4efe3', { faceY: '#d8d2c2', faceX: '#c2bcab' });
    s += box(0.86, 2.25, 1.35, 3.1, 0.56, 0.72, '#f4efe3', { faceY: '#d8d2c2', faceX: '#c2bcab' });
    s += box(1.9, 1.18, 3.07, 3.62, 0.56, 0.6, '#8d6bb8', { faceY: '#77599c', faceX: '#644a85' });
    // Headboard
    s += box(0.62, 1.05, 0.72, 3.75, 0, 0.95, '#4a3624');
    // Nightstand + lamp
    s += box(0.75, 3.95, 1.45, 4.55, 0, 0.5, '#6e5138');
    s += cyl(1.1, 4.25, 0.07, 0.5, 0.86, '#c8ccd4');
    s += cyl(1.1, 4.25, 0.17, 0.86, 1.06, '#ffd894', { side: '#e0b06a' });
    s += isoEllipse(1.1, 4.25, 1.07, 0.3, 'rgba(255,214,140,0.35)', { attrs: 'class="iso-lamp-glow"' });
    return s;
  }

  _furnStudy() {
    let s = '';
    // Bookshelf against back wall
    s += this._shadow(5.85, 0.25, 7.15, 0.95);
    s += box(5.85, 0.25, 7.15, 0.95, 0, 1.8, '#6a4f36');
    for (const z of [0.5, 0.95, 1.4]) {
      s += `<polyline points="${pts([iso(5.85, 0.95, z), iso(7.15, 0.95, z)])}" stroke="#443322" stroke-width="1.2" fill="none"/>`;
    }
    // Books (colored spines on shelf front face)
    for (let i = 0; i < 6; i++) {
      const bx = 5.98 + i * 0.185;
      const colors = ['#c96a5a', '#5a9bc9', '#c9b45a', '#7fc95a', '#a05ac9', '#5ac9b0'];
      s += wallQuadY(bx, bx + 0.13, 0.95, 1.44, 1.76, colors[i]);
    }
    // Desk with laptop
    s += this._shadow(7.6, 0.3, 9.6, 1.15);
    s += box(7.6, 0.3, 9.6, 1.15, 0.72, 0.82, '#7a5a3d');
    s += box(7.72, 0.42, 7.86, 1.03, 0, 0.72, '#4f3a26');
    s += box(9.34, 0.42, 9.48, 1.03, 0, 0.72, '#4f3a26');
    s += box(8.35, 0.55, 8.95, 0.92, 0.82, 0.86, '#2a3345');
    s += wallQuadY(8.35, 8.95, 0.55, 0.86, 1.28, '#1b2b45', 'iso-screen');
    // Chair
    s += box(8.3, 1.55, 8.95, 2.15, 0.42, 0.52, '#37527a');
    s += box(8.3, 1.5, 8.95, 1.62, 0.52, 1.15, '#2c4263');
    s += cyl(8.62, 1.85, 0.06, 0, 0.42, '#20293c');
    // Plant
    s += cyl(9.0, 4.15, 0.24, 0, 0.42, '#7a5a3d');
    s += isoEllipse(8.9, 3.95, 0.62, 0.32, '#3f8f5f');
    s += isoEllipse(9.14, 4.2, 0.72, 0.3, '#2f7a4e');
    s += isoEllipse(9.0, 4.1, 0.9, 0.24, '#4da06c');
    // Floor cushion / reading nook
    s += isoEllipse(6.4, 3.7, 0.05, 0.5, '#8a5f7c');
    return s;
  }

  _furnKitchen() {
    let s = '';
    // Counter along back wall
    s += this._shadow(10.3, 0.25, 15.0, 1.35);
    s += box(10.3, 0.25, 15.0, 1.35, 0, 0.88, '#5f6f85');
    s += box(10.3, 0.25, 15.0, 1.35, 0.88, 0.96, '#8b9bb0', { faceY: '#71809a', faceX: '#5d6a80' });
    // Sink
    s += isoEllipse(11.2, 0.8, 0.965, 0.34, '#3a4557');
    s += isoEllipse(11.2, 0.8, 0.97, 0.26, '#9fb4cc');
    // Stove + burners
    s += box(13.3, 0.4, 14.5, 1.25, 0.96, 1.0, '#212a3a');
    s += isoEllipse(13.62, 0.68, 1.01, 0.15, '#37445c');
    s += isoEllipse(14.16, 0.95, 1.01, 0.15, '#37445c');
    s += isoEllipse(13.62, 0.68, 1.015, 0.09, '#5a86c9');
    s += isoEllipse(14.16, 0.95, 1.015, 0.09, '#5a86c9');
    // Fridge
    s += this._shadow(15.15, 0.3, 15.85, 1.15);
    s += box(15.15, 0.3, 15.85, 1.15, 0, 1.9, '#aab6c6', { top: '#c3cedb', faceY: '#8996a8', faceX: '#707d8f' });
    s += `<polyline points="${pts([iso(15.15, 1.15, 1.12), iso(15.85, 1.15, 1.12)])}" stroke="#5d6a7c" stroke-width="1.4" fill="none"/>`;
    // Island
    s += this._shadow(12.1, 2.55, 13.9, 3.55);
    s += box(12.1, 2.55, 13.9, 3.55, 0, 0.82, '#4f5d72');
    s += box(12.1, 2.55, 13.9, 3.55, 0.82, 0.9, '#93a3b8', { faceY: '#77869c', faceX: '#606e83' });
    // Bowl on island
    s += isoEllipse(12.7, 3.0, 0.92, 0.18, '#c98a5a');
    // Inverter unit (front-right)
    s += box(15.25, 4.05, 15.85, 4.7, 0, 0.72, '#39415a');
    s += `<circle cx="${iso(15.55, 4.7, 0.5).X}" cy="${iso(15.55, 4.7, 0.5).Y}" r="2.6" fill="#4ade80" class="iso-inverter-led"/>`;
    // Stools
    s += cyl(12.5, 4.1, 0.16, 0, 0.5, '#7a5a3d');
    s += cyl(13.5, 4.25, 0.16, 0, 0.5, '#7a5a3d');
    return s;
  }

  _furnLiving() {
    let s = '';
    // Rug
    s += isoEllipse(3.6, 7.7, 0.012, 1.45, '#465a80');
    s += isoEllipse(3.6, 7.7, 0.016, 1.1, '#516790');
    // TV console + TV against row wall
    s += this._shadow(1.15, 5.15, 3.85, 5.85);
    s += box(1.15, 5.15, 3.85, 5.85, 0, 0.5, '#6e5138');
    s += box(1.55, 5.22, 3.45, 5.34, 0.6, 1.62, '#141b29', { faceY: '#0e1420', faceX: '#0a0f19' });
    s += wallQuadY(1.62, 3.38, 5.345, 0.68, 1.55, 'url(#isoTvScreen)', 'iso-screen iso-tv-screen');
    // Sofa facing the TV
    s += this._shadow(2.1, 8.0, 5.3, 9.4);
    s += box(2.1, 8.15, 5.3, 9.15, 0, 0.42, '#3f5578');
    s += box(2.1, 9.05, 5.3, 9.42, 0.42, 1.05, '#35486a');           // backrest
    s += box(2.02, 8.1, 2.32, 9.4, 0.42, 0.78, '#35486a');           // arm L
    s += box(5.08, 8.1, 5.38, 9.4, 0.42, 0.78, '#35486a');           // arm R
    s += box(2.38, 8.2, 3.7, 9.05, 0.42, 0.62, '#4a6288', { faceY: '#3d5274', faceX: '#324361' });
    s += box(3.76, 8.2, 5.05, 9.05, 0.42, 0.62, '#4a6288', { faceY: '#3d5274', faceX: '#324361' });
    s += box(4.35, 8.95, 4.95, 9.3, 0.62, 0.82, '#c9995a');          // cushion
    // Coffee table
    s += this._shadow(3.05, 7.1, 4.35, 7.85);
    s += box(3.05, 7.1, 4.35, 7.85, 0.24, 0.34, '#7a5a3d');
    s += cyl(3.35, 7.35, 0.05, 0.34, 0.42, '#c9c2b2');
    s += isoEllipse(3.95, 7.6, 0.35, 0.16, '#3f8f5f');
    // Side table + plant near window wall
    s += cyl(0.6, 9.3, 0.26, 0, 0.5, '#57493a');
    s += isoEllipse(0.5, 9.1, 0.7, 0.34, '#3f8f5f');
    s += isoEllipse(0.75, 9.4, 0.82, 0.3, '#2f7a4e');
    s += isoEllipse(0.6, 9.25, 1.0, 0.26, '#4da06c');
    // Floor lamp right of sofa
    s += cyl(5.95, 6.1, 0.05, 0, 1.5, '#8b95a5');
    s += cyl(5.95, 6.1, 0.22, 1.5, 1.78, '#ffd894', { side: '#e0b06a' });
    s += isoEllipse(5.95, 6.1, 1.8, 0.36, 'rgba(255,214,140,0.35)', { attrs: 'class="iso-lamp-glow"' });
    return s;
  }

  _furnBath() {
    let s = '';
    // Bath mat
    s += isoEllipse(7.6, 7.5, 0.012, 0.55, '#6f8fa5');
    // Bathtub
    s += this._shadow(6.75, 5.3, 8.25, 6.55);
    s += box(6.75, 5.3, 8.25, 6.55, 0, 0.62, '#d7dde3', { top: '#e9eef2', faceY: '#b6bfc9', faceX: '#98a2ad' });
    s += flat(6.92, 5.45, 8.08, 6.4, 0.63, '#7fb4cc');
    s += isoEllipse(7.9, 6.05, 0.64, 0.1, '#a9d4e6');
    // Basin
    s += cyl(6.95, 8.8, 0.13, 0, 0.78, '#c3cad2');
    s += isoEllipse(6.95, 8.8, 0.79, 0.3, '#e9eef2');
    s += isoEllipse(6.95, 8.8, 0.795, 0.2, '#9fc6da');
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
    s += isoEllipse(11.5, 8.3, 0.012, 0.85, '#4f7f8f');
    s += isoEllipse(11.5, 8.3, 0.016, 0.6, '#5c93a5');
    // Bunk bed along left wall
    s += this._shadow(9.75, 5.3, 10.95, 7.6);
    s += box(9.75, 5.3, 10.95, 7.6, 0, 0.32, '#5d4530');
    s += box(9.82, 5.38, 10.88, 7.52, 0.32, 0.5, '#e8e2d4', { faceY: '#c9c2b2', faceX: '#b0a996' });
    s += box(9.82, 5.38, 10.88, 6.3, 0.5, 0.62, '#5eb3f6', { faceY: '#4d97d1', faceX: '#3f7fb1' });
    s += box(9.75, 5.3, 10.95, 7.6, 1.05, 1.32, '#5d4530');
    s += box(9.82, 5.38, 10.88, 7.52, 1.32, 1.5, '#e8e2d4', { faceY: '#c9c2b2', faceX: '#b0a996' });
    s += box(9.82, 6.6, 10.88, 7.52, 1.5, 1.62, '#f7d774', { faceY: '#d9ba5c', faceX: '#bda04c' });
    // Posts
    for (const [px, py] of [[9.78, 5.33], [10.9, 5.33], [9.78, 7.55], [10.9, 7.55]]) {
      s += box(px, py, px + 0.06, py + 0.06, 0, 1.55, '#4a3624');
    }
    // Ladder
    s += `<polyline points="${pts([iso(10.95, 6.5, 0), iso(10.95, 6.5, 1.4)])}" stroke="#4a3624" stroke-width="2" fill="none"/>`;
    // Toy chest + blocks
    s += box(12.3, 8.55, 12.95, 9.15, 0, 0.45, '#b06a4f');
    s += box(11.15, 9.0, 11.4, 9.25, 0, 0.25, '#c95a5a');
    s += box(11.45, 9.1, 11.65, 9.3, 0, 0.2, '#5a9bc9');
    // Small desk
    s += box(12.15, 5.35, 12.9, 6.15, 0.62, 0.72, '#7a5a3d');
    s += box(12.25, 5.45, 12.35, 6.05, 0, 0.62, '#4f3a26');
    s += box(12.72, 5.45, 12.82, 6.05, 0, 0.62, '#4f3a26');
    return s;
  }

  _furnBalcony() {
    let s = '';
    // Railing: outer edges x=16 and y=10 of balcony
    const post = (x, y) => box(x, y, x + 0.07, y + 0.07, 0, 0.8, '#8fa3b8', { faceY: '#71809a', faceX: '#5d6a80' });
    for (let i = 0; i <= 5; i++) post && (s += post(15.93, 5.1 + i * 0.95));
    for (let i = 0; i <= 3; i++) s += post(13.2 + i * 0.9, 9.93);
    // Top rails
    s += box(15.9, 5.05, 16.0, 10.0, 0.8, 0.9, '#a9bccf');
    s += box(13.05, 9.9, 16.0, 10.0, 0.8, 0.9, '#a9bccf');
    // Water tank
    s += cyl(15.1, 5.75, 0.5, 0, 1.25, '#3c4a63', { top: '#55668a' });
    s += `<ellipse cx="${iso(15.1, 5.75, 1.25).X}" cy="${iso(15.1, 5.75, 1.25).Y}" rx="9" ry="4.5" fill="none" stroke="#7d90b3" stroke-width="1.2"/>`;
    // Bench
    s += box(13.25, 6.3, 14.25, 6.85, 0.32, 0.44, '#7a5a3d');
    s += box(13.25, 6.3, 13.37, 6.85, 0, 0.32, '#57493a');
    s += box(14.13, 6.3, 14.25, 6.85, 0, 0.32, '#57493a');
    // Planters
    for (const [px, py] of [[15.5, 8.6], [14.6, 9.5]]) {
      s += cyl(px, py, 0.2, 0, 0.34, '#8a5c40');
      s += isoEllipse(px - 0.08, py - 0.12, 0.5, 0.26, '#3f8f5f');
      s += isoEllipse(px + 0.12, py + 0.08, 0.58, 0.24, '#4da06c');
    }
    // Camera pole
    s += cyl(13.5, 5.45, 0.035, 0.85, 2.0, '#8b95a5');
    // Diya / prayer corner (Dadiji's spot)
    s += isoEllipse(13.9, 8.9, 0.02, 0.32, '#7f5f8a');
    return s;
  }

  // ── Devices & avatars (HTML overlay) ───────────────────────────

  _buildDevices() {
    for (const [deviceId, placement] of Object.entries(DEVICE_PLACEMENTS)) {
      const roomName = ROOMS[placement.room]?.name || placement.room;
      const el = document.createElement('button');
      el.type = 'button';
      el.className = `iso-device${placement.light ? ' iso-device-light' : ''}`;
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

  // ── Alexa presence orb ─────────────────────────────────────────

  _buildAlexaOrb() {
    const orb = document.createElement('div');
    orb.className = 'alexa-orb';
    orb.dataset.state = 'idle';
    orb.innerHTML = `
      <span class="alexa-orb-ripple" aria-hidden="true"></span>
      <span class="alexa-orb-ring" aria-hidden="true"></span>
      <span class="alexa-orb-core" aria-hidden="true"></span>
      <span class="alexa-orb-label">Alexa</span>
    `;
    this.overlay.appendChild(orb);
    this.alexaOrb = orb;
    this._orbLabel = orb.querySelector('.alexa-orb-label');
  }

  /** Move the orb to a world position and set its state + caption. */
  _setOrb(x, y, z, state, label) {
    if (!this.alexaOrb) return;
    const pos = this._pct(x, y, z);
    this.alexaOrb.style.left = `${pos.left}%`;
    this.alexaOrb.style.top = `${pos.top}%`;
    this.alexaOrb.dataset.state = state;
    if (this._orbLabel) this._orbLabel.textContent = label || 'Alexa';
  }

  /** Home perch: hovering above the living-room Echo. */
  _orbToHome(label = 'Ready') {
    const home = DEVICE_PLACEMENTS.echo_living;
    this._setOrb(home.x, home.y, 2.9, 'idle', label);
  }

  _startLearningScan() {
    const roomIds = Object.keys(ROOMS);
    const step = () => {
      const roomId = roomIds[this._scanIndex % roomIds.length];
      const r = ROOMS[roomId];
      this._scanIndex += 1;
      this._setOrb(r.x + r.w / 2, r.y + r.d / 2, 2.7, 'scan', `Studying · ${r.name}`);
      const g = this.roomGroups.get(roomId);
      if (g) {
        g.classList.add('is-scan');
        setTimeout(() => g.classList.remove('is-scan'), 2100);
      }
    };
    step();
    this._scanTimer = setInterval(step, 2600);
  }

  _stopLearningScan() {
    if (this._scanTimer) {
      clearInterval(this._scanTimer);
      this._scanTimer = null;
    }
    for (const [, g] of this.roomGroups) g.classList.remove('is-scan');
  }

  /** Fly to a device while Alexa acts on it / announces through it. */
  _alexaAttend(deviceId, speaking, holdMs = 4000) {
    if (this.alexaMode !== 'deployment' || !this.alexaOrb) return;
    const p = DEVICE_PLACEMENTS[deviceId];
    if (!p) return;
    clearTimeout(this._orbReturnTimer);
    // Hover up-left of the device so the speech bubble stays unobscured.
    this._setOrb(
      p.x - 0.95, p.y - 0.35, (p.z || 0) + 0.85,
      speaking ? 'speak' : 'act',
      speaking ? 'Announcing…' : 'Acting ahead…'
    );
    this._orbReturnTimer = setTimeout(() => this._orbToHome('Ready — thinking ahead'), holdMs);
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
      .iso-scene {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .iso-stage {
        position: relative;
        width: 100%;
        max-height: 100%;
        margin: auto;
      }

      .iso-svg {
        display: block;
        width: 100%;
        height: 100%;
        overflow: visible;
      }

      /* ── day/night ambience on the SVG house ─────────────────── */
      .iso-room { transition: filter 1.2s ease, opacity 1.2s ease; }
      [data-daypart="night"] .iso-room { filter: brightness(0.62) saturate(0.82); }
      [data-daypart="dawn"]  .iso-room { filter: brightness(0.82) saturate(0.9) sepia(0.08); }
      [data-daypart="dusk"]  .iso-room { filter: brightness(0.78) sepia(0.14); }
      [data-daypart="night"] .iso-walls,
      [data-daypart="night"] .iso-partition { filter: brightness(0.66); }
      [data-daypart="dusk"] .iso-walls,
      [data-daypart="dusk"] .iso-partition { filter: brightness(0.8); }
      .iso-walls, .iso-partition { transition: filter 1.2s ease; }

      .iso-window { transition: fill 1.2s ease; }
      [data-daypart="night"] .iso-window { fill: url(#isoWinNight); }
      .iso-window-frame {
        stroke: #202c4a;
        stroke-width: 2.4;
        fill: none;
      }

      /* Warm room glow — only meaningful when the room lights are on */
      .iso-glow { opacity: 0; transition: opacity 1.2s ease; pointer-events: none; }
      .iso-room[data-lights="on"] .iso-glow { opacity: 0.4; }
      [data-daypart="night"] .iso-room[data-lights="on"] .iso-glow,
      [data-daypart="dusk"] .iso-room[data-lights="on"] .iso-glow { opacity: 0.95; }
      .iso-lamp-glow { opacity: 0.25; }
      [data-daypart="night"] .iso-lamp-glow { opacity: 0.8; }

      /* Highlight flash when Alexa acts in a room */
      .iso-room.is-flash { filter: brightness(1.25) saturate(1.15) !important; }

      /* Learning sweep — Alexa studying a room */
      .iso-room.is-scan {
        filter: brightness(1.3) saturate(1.25) drop-shadow(0 0 18px rgba(0, 202, 255, 0.35)) !important;
      }

      /* Power-cut states */
      .iso-room.is-dim { filter: brightness(0.24) saturate(0.25) !important; }
      .iso-room.is-powered {
        filter: brightness(0.9) drop-shadow(0 0 14px rgba(74, 222, 128, 0.35)) !important;
      }
      .iso-room.is-powered .iso-glow { opacity: 0.9 !important; }
      .is-powercut .iso-walls, .is-powercut .iso-partition { filter: brightness(0.4); }

      .iso-inverter-led { opacity: 0.5; }
      .is-powercut .iso-inverter-led {
        opacity: 1;
        animation: iso-led-blink 1s ease-in-out infinite;
      }
      @keyframes iso-led-blink { 50% { opacity: 0.25; } }

      .iso-tv-screen { transition: fill 0.5s ease; }

      /* ── HTML overlay ─────────────────────────────────────────── */
      .iso-overlay {
        position: absolute;
        inset: 0;
        pointer-events: none;
      }

      .iso-room-label {
        position: absolute;
        transform: translate(-50%, -50%);
        pointer-events: auto;
        border: none;
        background: rgba(8, 12, 26, 0.55);
        color: rgba(214, 226, 245, 0.72);
        font-family: var(--font-display, 'Sora', sans-serif);
        font-size: clamp(0.42rem, 0.72vw, 0.62rem);
        font-weight: 600;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        padding: 0.22em 0.7em;
        border-radius: 999px;
        border: 1px solid rgba(148, 184, 255, 0.14);
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
        cursor: pointer;
        transition: color 0.2s ease, border-color 0.2s ease, background 0.2s ease;
        white-space: nowrap;
        z-index: 4;
      }
      .iso-room-label:hover {
        color: #dff3ff;
        border-color: rgba(0, 202, 255, 0.5);
        background: rgba(10, 18, 38, 0.85);
      }

      /* Devices */
      .iso-device {
        position: absolute;
        transform: translate(-50%, -50%);
        width: clamp(20px, 2.4vw, 30px);
        height: clamp(20px, 2.4vw, 30px);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        border-radius: 50%;
        border: 1px solid rgba(148, 184, 255, 0.35);
        background: radial-gradient(circle at 32% 28%, rgba(38, 52, 84, 0.95), rgba(11, 17, 34, 0.95));
        color: #9fdcff;
        cursor: pointer;
        pointer-events: auto;
        z-index: 6;
        box-shadow: 0 4px 14px rgba(2, 6, 18, 0.55);
        transition: transform 0.18s ease, color 0.2s ease, border-color 0.2s ease, opacity 0.3s ease;
      }
      .iso-device svg { width: 58%; height: 58%; }
      .iso-device:hover, .iso-device:focus-visible, .iso-device.selected {
        transform: translate(-50%, -50%) scale(1.18);
        color: #ffffff;
        border-color: rgba(0, 202, 255, 0.9);
        outline: none;
        z-index: 9;
      }
      .iso-device.is-off { opacity: 0.45; color: #6b7690; }
      .iso-device.has-bubble { z-index: 22; }
      .iso-device.iso-device-light {
        width: clamp(15px, 1.7vw, 22px);
        height: clamp(15px, 1.7vw, 22px);
        color: #ffd894;
        border-color: rgba(255, 216, 148, 0.3);
      }
      .iso-device.iso-device-light.is-off { color: #5d6474; }

      .iso-device-ring {
        position: absolute;
        inset: -3px;
        border-radius: 50%;
        border: 1.5px solid transparent;
        pointer-events: none;
      }
      .iso-device.is-highlight .iso-device-ring {
        border-color: rgba(0, 202, 255, 0.9);
        animation: iso-ping 0.7s ease-out 3;
      }
      .iso-device.is-highlight {
        color: #fff;
        border-color: rgba(0, 202, 255, 1);
        box-shadow: 0 0 18px rgba(0, 202, 255, 0.55);
      }
      @keyframes iso-ping {
        0% { transform: scale(0.9); opacity: 1; }
        100% { transform: scale(2.1); opacity: 0; }
      }
      .iso-device.inverter-active {
        color: #4ade80;
        border-color: rgba(74, 222, 128, 0.9);
        box-shadow: 0 0 20px rgba(74, 222, 128, 0.6);
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
        width: clamp(17px, 2vw, 25px);
        height: clamp(17px, 2vw, 25px);
        border-radius: 50% 50% 50% 4px;
        transform: rotate(-45deg);
        background: linear-gradient(135deg, var(--avatar-color), color-mix(in srgb, var(--avatar-color) 65%, #101728));
        border: 1.5px solid rgba(255, 255, 255, 0.75);
        box-shadow: 0 3px 10px rgba(2, 6, 18, 0.6);
        color: rgba(8, 10, 20, 0.85);
        font-size: clamp(0.5rem, 0.8vw, 0.68rem);
        font-weight: 800;
        line-height: 1;
        user-select: none;
        pointer-events: none;
        font-family: var(--font-display, 'Sora', sans-serif);
      }
      .iso-avatar-initial { transform: rotate(45deg); display: block; }
      .iso-avatar-shadow {
        width: 12px;
        height: 5px;
        margin-top: 2px;
        border-radius: 50%;
        background: rgba(4, 6, 16, 0.55);
        filter: blur(1px);
      }
      .iso-avatar-name {
        position: absolute;
        bottom: calc(100% + 4px);
        left: 50%;
        transform: translateX(-50%) translateY(3px);
        padding: 2px 8px;
        border-radius: 6px;
        background: rgba(8, 12, 26, 0.92);
        border: 1px solid rgba(148, 184, 255, 0.25);
        color: #e8eef7;
        font-size: 0.62rem;
        font-weight: 600;
        white-space: nowrap;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.18s ease, transform 0.18s ease;
      }
      .iso-avatar:hover .iso-avatar-name { opacity: 1; transform: translateX(-50%) translateY(0); }
      .iso-avatar:hover { z-index: 12; }

      /* ── Alexa presence orb ───────────────────────────────────── */
      .alexa-orb {
        position: absolute;
        transform: translate(-50%, -50%);
        width: 40px;
        height: 40px;
        z-index: 16;
        pointer-events: none;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: left 1.5s cubic-bezier(0.45, 0, 0.25, 1), top 1.5s cubic-bezier(0.45, 0, 0.25, 1);
      }

      .alexa-orb-core {
        position: absolute;
        width: 15px;
        height: 15px;
        border-radius: 50%;
        background: radial-gradient(circle at 35% 30%, #eafcff 0%, #7fe4ff 38%, #00caff 72%, #0086cc 100%);
        box-shadow: 0 0 14px rgba(0, 202, 255, 0.9), 0 0 36px rgba(0, 202, 255, 0.4);
        animation: alexa-bob 3.2s ease-in-out infinite;
      }

      .alexa-orb-ring {
        position: absolute;
        width: 30px;
        height: 30px;
        border-radius: 50%;
        background: conic-gradient(from 0deg, #00e5ff, #2e6be6 40%, #00caff 70%, #00e5ff);
        -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 2.6px), #000 calc(100% - 2.2px));
        mask: radial-gradient(farthest-side, transparent calc(100% - 2.6px), #000 calc(100% - 2.2px));
        opacity: 0.9;
        animation: alexa-spin 4.6s linear infinite, alexa-bob 3.2s ease-in-out infinite;
      }

      @keyframes alexa-spin { to { rotate: 1turn; } }
      @keyframes alexa-bob { 0%, 100% { translate: 0 0; } 50% { translate: 0 -4px; } }

      .alexa-orb-ripple {
        position: absolute;
        bottom: -13px;
        width: 34px;
        height: 15px;
        border-radius: 50%;
        border: 1.5px solid rgba(0, 202, 255, 0.6);
        opacity: 0;
      }

      .alexa-orb[data-state="scan"] .alexa-orb-ripple,
      .alexa-orb[data-state="speak"] .alexa-orb-ripple,
      .alexa-orb[data-state="act"] .alexa-orb-ripple {
        animation: alexa-ripple 1.5s ease-out infinite;
      }

      @keyframes alexa-ripple {
        0% { transform: scale(0.4); opacity: 0.85; }
        100% { transform: scale(1.7); opacity: 0; }
      }

      .alexa-orb[data-state="scan"] .alexa-orb-ring { animation-duration: 1.4s, 3.2s; }
      .alexa-orb[data-state="act"] .alexa-orb-core,
      .alexa-orb[data-state="speak"] .alexa-orb-core { scale: 1.25; }
      .alexa-orb[data-state="speak"] .alexa-orb-core {
        animation: alexa-bob 3.2s ease-in-out infinite, alexa-talk 0.85s ease-in-out infinite;
      }

      @keyframes alexa-talk {
        50% { box-shadow: 0 0 24px rgba(0, 202, 255, 1), 0 0 54px rgba(0, 202, 255, 0.65); }
      }

      .alexa-orb-label {
        position: absolute;
        bottom: calc(100% + 7px);
        left: 50%;
        transform: translateX(-50%);
        white-space: nowrap;
        font-family: var(--font-body, 'Inter', sans-serif);
        font-size: 0.58rem;
        font-weight: 700;
        letter-spacing: 0.05em;
        color: #c8f2ff;
        background: rgba(10, 16, 24, 0.88);
        border: 1px solid rgba(0, 202, 255, 0.32);
        padding: 2px 9px;
        border-radius: 999px;
        backdrop-filter: blur(6px);
        -webkit-backdrop-filter: blur(6px);
        transition: opacity 0.4s ease;
      }

      .alexa-orb[data-state="idle"] .alexa-orb-label { opacity: 0.55; }

      /* Speech bubbles */
      .iso-bubble {
        position: absolute;
        bottom: calc(100% + 10px);
        left: 50%;
        transform: translateX(-50%) translateY(8px) scale(0.96);
        display: flex;
        gap: 0.5rem;
        align-items: flex-start;
        width: max-content;
        max-width: 240px;
        padding: 0.55rem 0.75rem;
        border-radius: 12px 12px 12px 3px;
        background: #ffffff;
        border: 1px solid #e8e6e0;
        box-shadow: 0 10px 28px rgba(2, 6, 18, 0.45);
        color: #1a1c1e;
        font-size: 0.68rem;
        font-weight: 500;
        line-height: 1.45;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.3s ease, transform 0.3s ease;
        z-index: 20;
      }
      .iso-bubble.visible { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }

      /* Echo-style light bar along the bottom of every Alexa utterance */
      .iso-bubble::after {
        content: '';
        position: absolute;
        left: 12px;
        right: 12px;
        bottom: -1.5px;
        height: 3px;
        border-radius: 999px;
        background: linear-gradient(90deg, #00e5ff, #2e6be6 55%, #00caff);
        box-shadow: 0 0 10px rgba(0, 202, 255, 0.65);
      }

      .iso-bubble-dot {
        flex-shrink: 0;
        width: 9px;
        height: 9px;
        margin-top: 3px;
        border-radius: 50%;
        background: conic-gradient(from 0deg, #00e5ff, #2e6be6, #00caff, #00e5ff);
        -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2.6px));
        mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2.6px));
        animation: alexa-spin 2.6s linear infinite;
      }

      /* Floating motes */
      .iso-motes { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
      .iso-motes span {
        position: absolute;
        left: var(--mx);
        top: var(--my);
        width: calc(3px * var(--ms));
        height: calc(3px * var(--ms));
        border-radius: 50%;
        background: rgba(140, 210, 255, 0.5);
        box-shadow: 0 0 6px rgba(140, 210, 255, 0.5);
        animation: iso-mote var(--md) ease-in-out infinite;
      }
      @keyframes iso-mote {
        0%, 100% { transform: translate(0, 0); opacity: 0.15; }
        50% { transform: translate(6px, -14px); opacity: 0.7; }
      }
      [data-daypart="day"] .iso-motes { opacity: 0.25; }

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
        background: #ffffff;
        border: 1px solid #e8e6e0;
        box-shadow: 0 18px 44px rgba(23, 24, 26, 0.28);
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
        color: #6f7373;
        font-size: 0.85rem;
        cursor: pointer;
        padding: 2px;
      }
      .iso-info-close:hover { color: #1a1c1e; }
      .iso-info-kicker, .iso-info-label {
        display: block;
        font-size: 0.58rem;
        font-weight: 700;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: #6f7373;
        margin-bottom: 0.3rem;
      }
      .iso-info-title h3, .iso-info-device-head h3 {
        margin: 0;
        font-family: var(--font-display, 'Space Grotesk', sans-serif);
        font-size: 0.95rem;
        letter-spacing: -0.01em;
        color: #1a1c1e;
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
        background: #f7f6f2;
        color: #1a1c1e;
        font: inherit;
        font-size: 0.74rem;
        font-weight: 600;
        text-align: left;
        cursor: pointer;
        transition: border-color 0.15s ease, background 0.15s ease;
      }
      .iso-info-device:hover {
        border-color: #d8d5cc;
        background: #f1efe9;
      }
      .iso-info-device svg { width: 15px; height: 15px; color: #5d6165; }
      .iso-info-device em {
        font-style: normal;
        font-size: 0.62rem;
        font-weight: 500;
        color: #6f7373;
      }
      .iso-info-empty, .iso-info-people { font-size: 0.75rem; color: #5d6165; }
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
        background: #f7f6f2;
        border: 1px solid #e8e6e0;
        color: #17181a;
      }
      .iso-info-device-icon svg { width: 18px; height: 18px; }
      .iso-info-device-head p { margin: 2px 0 0; font-size: 0.68rem; color: #6f7373; }
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
      .iso-info-state.is-off { color: #5d6165; background: #f1efe9; }
      .iso-info-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
      .iso-info-action {
        min-height: 34px;
        border-radius: 999px;
        border: none;
        background: #17181a;
        color: #ffffff;
        font: inherit;
        font-size: 0.74rem;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.15s ease, transform 0.15s ease;
      }
      .iso-info-action:hover { background: #2b2e33; transform: translateY(-1px); }
      .iso-info-action.is-ghost {
        background: #ffffff;
        border: 1px solid #d8d5cc;
        color: #1a1c1e;
      }
      .iso-info-action.is-ghost:hover { background: #f7f6f2; }
    `;
    document.head.appendChild(style);
  }
}
