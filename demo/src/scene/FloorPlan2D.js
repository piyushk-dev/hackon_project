/**
 * FloorPlan2D — Flat 2D dollhouse cutaway of the Sharma family home.
 * A clean architectural side-view illustration: flat vector rooms in a grid,
 * warm light palette, no perspective or fake depth.
 *
 * Layout (cutaway):
 * ┌─────────────── roof ─────────────────────┐
 * │ Master Bedroom │ Study Room │ Kitchen    │
 * ├───────────────┬┴────────────┼────────────┤
 * │ Living Room   │ Bath        │ Kids │Bal. │
 * └───────────────┴─────────────┴──────┴─────┘
 */

import { FAMILY_SCHEDULE } from '../data/FamilySchedule.js';

// ─── Palette ─────────────────────────────────────────────────────
// bg #F7F6F3 · walls #E3E1DC · ink #1F2933 · blue #2E7CF6 · amber #F5A623

// ─── Room Layout (cutaway house percentages) ─────────────────────
const ROOM_LAYOUT = {
  master_bedroom: { top: 0, left: 0, width: 33, height: 42, name: 'Master Bedroom', color: '#EFECF6' },
  study_room: { top: 0, left: 33, width: 27, height: 42, name: 'Study Room', color: '#EDF2EC' },
  kitchen: { top: 0, left: 60, width: 40, height: 42, name: 'Kitchen', color: '#F7F1E3' },
  living_room: { top: 42, left: 0, width: 42, height: 58, name: 'Living Room', color: '#EAF0F7' },
  bath: { top: 42, left: 42, width: 20, height: 58, name: 'Bath', color: '#E8F3F2' },
  kids_room: { top: 42, left: 62, width: 23, height: 58, name: 'Kids Room', color: '#F8EFE9' },
  balcony: { top: 42, left: 85, width: 15, height: 58, name: 'Balcony', color: '#EBF3ED' },
};

// ─── Device Placements (% offsets within room) ───────────────────
const DEVICE_PLACEMENTS = {
  living_room_ac: { room: 'living_room', x: 85, y: 15, icon: 'ac', label: 'AC' },
  smart_tv: { room: 'living_room', x: 22, y: 38, icon: 'tv', label: 'TV' },
  echo_living: { room: 'living_room', x: 62, y: 74, icon: 'speaker', label: 'Echo' },
  kitchen_hub: { room: 'kitchen', x: 70, y: 46, icon: 'stove', label: 'Hub' },
  water_purifier: { room: 'kitchen', x: 25, y: 82, icon: 'droplet', label: 'Purifier' },
  security_camera: { room: 'balcony', x: 55, y: 22, icon: 'camera', label: 'Camera' },
  smart_lock: { room: 'balcony', x: 50, y: 64, icon: 'lock', label: 'Lock' },
  smart_geyser: { room: 'bath', x: 48, y: 42, icon: 'heater', label: 'Geyser' },
  inverter_ups: { room: 'kitchen', x: 86, y: 82, icon: 'battery', label: 'Inverter' },
  echo_study: { room: 'study_room', x: 60, y: 58, icon: 'speaker', label: 'Echo' },
  echo_kids: { room: 'kids_room', x: 54, y: 66, icon: 'speaker', label: 'Echo' },
  // Smart lights — one per room
  smart_lights_living_room: { room: 'living_room', x: 50, y: 14, icon: 'bulb', label: 'Light' },
  smart_lights_master_bedroom: { room: 'master_bedroom', x: 50, y: 16, icon: 'bulb', label: 'Light' },
  smart_lights_kitchen: { room: 'kitchen', x: 55, y: 16, icon: 'bulb', label: 'Light' },
  smart_lights_bath: { room: 'bath', x: 26, y: 16, icon: 'bulb', label: 'Light' },
  smart_lights_study_room: { room: 'study_room', x: 50, y: 16, icon: 'bulb', label: 'Light' },
  smart_lights_kids_room: { room: 'kids_room', x: 50, y: 16, icon: 'bulb', label: 'Light' },
  smart_lights_balcony: { room: 'balcony', x: 50, y: 40, icon: 'bulb', label: 'Light' },
};

// ─── Flat SVG icons (16px, stroke, currentColor) ─────────────────
const ICON_PATHS = {
  ac: '<path d="M12 3v18M4 7l16 10M20 7L4 17"/>',
  tv: '<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8"/>',
  speaker: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3"/>',
  stove: '<path d="M5 10h14v6a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3zM9 3v3M15 3v3"/>',
  droplet: '<path d="M12 3.5s6 6.7 6 10.5a6 6 0 0 1-12 0C6 10.2 12 3.5 12 3.5z"/>',
  camera: '<path d="M3 8h4l2-2.5h6L17 8h4v11H3z"/><circle cx="12" cy="13" r="3.2"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7.5a4 4 0 0 1 8 0V11"/>',
  heater: '<path d="M12 3c3.2 3.6 6 5.8 6 9.6A6 6 0 0 1 6 12.6c0-1.8.9-3.6 2.7-5.4.2 1.7.9 2.7 1.9 3-1-2.9-.1-5.3 1.4-7.2z"/>',
  battery: '<rect x="3" y="8" width="16" height="8" rx="2"/><path d="M21 11v2M9 10l-2 3h4l-2 3"/>',
  bulb: '<path d="M12 3a6 6 0 0 1 3.7 10.7c-.5.4-.7 1-.7 1.6v.7h-6v-.7c0-.6-.2-1.2-.7-1.6A6 6 0 0 1 12 3z"/><path d="M10 19.5h4"/>',
};

function iconSvg(name, size = 13) {
  const paths = ICON_PATHS[name] || ICON_PATHS.bulb;
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}

const DEVICE_DEFAULT_STATES = {
  living_room_ac: { active: false, onLabel: 'Cooling', offLabel: 'Off' },
  smart_tv: { active: false, onLabel: 'Playing', offLabel: 'Off' },
  echo_living: { active: true, onLabel: 'Online', offLabel: 'Muted' },
  kitchen_hub: { active: true, onLabel: 'Ready', offLabel: 'Paused' },
  water_purifier: { active: true, onLabel: 'Filtering', offLabel: 'Off' },
  security_camera: { active: true, onLabel: 'Recording', offLabel: 'Idle' },
  smart_lock: { active: true, onLabel: 'Locked', offLabel: 'Unlocked' },
  smart_geyser: { active: false, onLabel: 'Heating', offLabel: 'Off' },
  inverter_ups: { active: false, onLabel: 'Backup', offLabel: 'Standby' },
  echo_study: { active: true, onLabel: 'Online', offLabel: 'Muted' },
  echo_kids: { active: true, onLabel: 'Online', offLabel: 'Muted' },
};

const ROOM_DECOR = {
  master_bedroom: [
    { type: 'window', x: 9, y: 16, w: 16, h: 18 },
    { type: 'bed', x: 10, y: 58, w: 42, h: 24 },
    { type: 'side-table', x: 54, y: 62, w: 12, h: 16 },
    { type: 'lamp', x: 59, y: 49, w: 7, h: 17 },
    { type: 'picture', x: 72, y: 24, w: 12, h: 16 },
  ],
  study_room: [
    { type: 'window', x: 10, y: 14, w: 18, h: 17 },
    { type: 'bookshelf', x: 12, y: 40, w: 20, h: 42 },
    { type: 'desk', x: 47, y: 58, w: 40, h: 18 },
    { type: 'chair', x: 57, y: 70, w: 13, h: 16 },
    { type: 'plant', x: 84, y: 60, w: 8, h: 24 },
  ],
  kitchen: [
    { type: 'window', x: 8, y: 14, w: 16, h: 17 },
    { type: 'cabinet', x: 38, y: 16, w: 45, h: 18 },
    { type: 'counter', x: 9, y: 65, w: 78, h: 17 },
    { type: 'stove', x: 48, y: 52, w: 18, h: 18 },
    { type: 'sink', x: 21, y: 55, w: 16, h: 12 },
  ],
  living_room: [
    { type: 'window', x: 8, y: 12, w: 14, h: 17 },
    { type: 'tv-unit', x: 10, y: 48, w: 24, h: 20 },
    { type: 'sofa', x: 45, y: 58, w: 38, h: 22 },
    { type: 'coffee-table', x: 47, y: 79, w: 22, h: 8 },
    { type: 'plant', x: 86, y: 48, w: 7, h: 24 },
  ],
  bath: [
    { type: 'vent', x: 13, y: 14, w: 16, h: 10 },
    { type: 'geyser-tank', x: 50, y: 24, w: 22, h: 22 },
    { type: 'sink-basin', x: 16, y: 69, w: 18, h: 17 },
    { type: 'shower', x: 69, y: 57, w: 15, h: 30 },
  ],
  kids_room: [
    { type: 'window', x: 10, y: 13, w: 18, h: 17 },
    { type: 'bunk-bed', x: 9, y: 51, w: 32, h: 32 },
    { type: 'toy-shelf', x: 58, y: 44, w: 27, h: 24 },
    { type: 'rug', x: 45, y: 78, w: 35, h: 12 },
  ],
  balcony: [
    { type: 'railing', x: 8, y: 18, w: 84, h: 14 },
    { type: 'water-tank', x: 20, y: 42, w: 54, h: 27 },
    { type: 'plant', x: 73, y: 66, w: 12, h: 22 },
  ],
};

// Alias canonical IDs
const DEVICE_ALIASES = {
  echo_devices: 'echo_living',
  smart_lights: 'smart_lights_living_room',
};

// ─── Family avatar colors (muted, flat) ──────────────────────────
const AVATAR_COLORS = {
  rajesh: '#E07A5F',
  priya: '#3D9A8B',
  arjun: '#5B8DEF',
  ananya: '#E9B44C',
  dadaji: '#9B7EBD',
  dadiji: '#7FB069',
};

/**
 * FloorPlan2D renders an interactive 2D floor plan.
 */
export class FloorPlan2D {
  constructor(containerEl) {
    this.container = containerEl;
    this.container.innerHTML = '';

    /** @type {Map<string, HTMLElement>} roomId → room div */
    this.roomEls = new Map();
    /** @type {Map<string, HTMLElement>} deviceId → device div */
    this.deviceEls = new Map();
    /** @type {Map<string, HTMLElement>} memberId → avatar dot */
    this.avatarEls = new Map();
    /** @type {Map<string, HTMLElement>} active speech bubble elements */
    this.speechBubbles = new Map();
    /** @type {Map<string, { active: boolean }>} deviceId → local interactive state */
    this.deviceStates = new Map();
    /** @type {string|null} */
    this.selectedDeviceId = null;
    /** @type {HTMLElement|null} */
    this.roomLayer = null;

    this._injectStyles();
    this._initializeDeviceStates();
    this._buildFloorPlan();
    this._buildDevices();
    this._buildAvatars();
    this.updateAvatars(0);
    this.updateLighting(0);
  }

  // ═══════════════════════════════════════════════════════════════
  // Public API
  // ═══════════════════════════════════════════════════════════════

  /**
   * Update avatar positions based on simulation time.
   * @param {number} timeMinutes - Current time in minutes (0-1439)
   */
  updateAvatars(timeMinutes) {
    for (const [memberId, schedule] of Object.entries(FAMILY_SCHEDULE)) {
      const dot = this.avatarEls.get(memberId);
      if (!dot) continue;

      const entry = schedule.find(s => timeMinutes >= s.start && timeMinutes < s.end);
      const roomId = entry ? entry.room : null;

      if (!roomId) {
        dot.style.display = 'none';
      } else {
        dot.style.display = 'flex';
        const roomEl = this.roomEls.get(roomId);
        if (roomEl) {
          // Position avatar within the room
          this._positionAvatarInRoom(dot, memberId, roomId, timeMinutes);
        }
      }
    }
  }

  /**
   * Update lighting (day/night visual). Flat style — only a whisper of a
   * shift at night, never dark ambient rendering.
   * @param {number} timeMinutes - Current time in minutes (0-1439)
   */
  updateLighting(timeMinutes) {
    const planEl = this.container.querySelector('.floor-plan-wrapper');
    if (!planEl) return;

    let warmth = 0;
    if (timeMinutes < 360) {
      warmth = 0; // night
    } else if (timeMinutes < 420) {
      warmth = (timeMinutes - 360) / 60; // sunrise transition
    } else if (timeMinutes < 1020) {
      warmth = 1; // day
    } else if (timeMinutes < 1080) {
      warmth = 1 - (timeMinutes - 1020) / 60; // sunset transition
    } else {
      warmth = 0; // night
    }

    // Subtle: night desaturates a touch, nothing more
    const saturation = 0.92 + warmth * 0.08;
    const brightness = 0.975 + warmth * 0.025;
    planEl.style.filter = `saturate(${saturation}) brightness(${brightness})`;
    planEl.classList.toggle('is-night', warmth < 0.4);
  }

  /**
   * Highlight a device — Alexa is making a decision here. Amber pulse
   * (no glow) plus a small "thinking" chip that floats up and fades.
   * @param {string} deviceId - Device identifier
   * @param {number} [duration=2000] - Duration in ms
   */
  highlightDevice(deviceId, duration = 2000) {
    const resolvedId = DEVICE_ALIASES[deviceId] || deviceId;
    const el = this.deviceEls.get(resolvedId);
    if (!el) return;

    el.classList.add('device-highlight');
    this._spawnThinkChip(el);

    // Softly outline the room too
    const placement = DEVICE_PLACEMENTS[resolvedId];
    if (placement) {
      const roomEl = this.roomEls.get(placement.room);
      if (roomEl) {
        roomEl.classList.add('room-highlight');
        setTimeout(() => roomEl.classList.remove('room-highlight'), duration);
      }
    }
    setTimeout(() => el.classList.remove('device-highlight'), duration);
  }

  /**
   * Show a speech bubble near a device.
   * @param {string} deviceId - Device identifier
   * @param {string} text - Message text
   * @param {number} [duration=5000] - Duration in ms
   */
  showSpeechBubble(deviceId, text, duration = 5000) {
    const resolvedId = DEVICE_ALIASES[deviceId] || deviceId;
    const el = this.deviceEls.get(resolvedId);
    if (!el) return;

    // Remove existing bubble for this device
    const existingBubble = this.speechBubbles.get(resolvedId);
    if (existingBubble) existingBubble.remove();

    const bubble = document.createElement('div');
    bubble.className = 'fp-speech-bubble';
    bubble.textContent = text;
    el.appendChild(bubble);
    this.speechBubbles.set(resolvedId, bubble);

    // Animate in
    requestAnimationFrame(() => bubble.classList.add('visible'));

    setTimeout(() => {
      bubble.classList.remove('visible');
      setTimeout(() => {
        bubble.remove();
        this.speechBubbles.delete(resolvedId);
      }, 300);
    }, duration);
  }

  /**
   * Compatibility wrapper for callers that expect SpeechBubbleManager.show().
   * @param {string|object} target - Device ID or ignored position object
   * @param {string} text - Message text
   * @param {number} [duration=5000] - Duration in ms
   */
  show(target, text, duration = 5000) {
    const deviceId = typeof target === 'string' ? target : 'echo_living';
    this.showSpeechBubble(deviceId, text, duration);
  }

  /**
   * Dim rooms for power cut. Keep specified rooms lit.
   * @param {string[]} roomsToKeepLit - Room IDs to keep lit
   */
  dimRooms(roomsToKeepLit) {
    for (const [roomId, roomEl] of this.roomEls) {
      if (roomsToKeepLit.includes(roomId)) {
        roomEl.classList.add('room-powered');
      } else {
        roomEl.classList.add('room-dimmed');
      }
    }
  }

  /**
   * Restore all rooms from power cut.
   */
  restoreAll() {
    for (const [, roomEl] of this.roomEls) {
      roomEl.classList.remove('room-dimmed', 'room-powered', 'room-highlight');
    }
    for (const [, deviceEl] of this.deviceEls) {
      deviceEl.classList.remove('device-highlight', 'inverter-active');
    }
  }

  /**
   * Alias for restoreAll (used by Effects interface).
   */
  restoreRooms() {
    this.restoreAll();
  }

  /**
   * Flash effect for power cut (flicker overlay).
   */
  powerCutFlicker() {
    const overlay = document.getElementById('flicker-overlay');
    if (!overlay) return;

    overlay.style.display = 'block';
    overlay.style.opacity = '0';

    const duration = 800;
    const flickerCount = 4;
    const cycleTime = duration / flickerCount;
    const startTime = performance.now();

    const animate = () => {
      const elapsed = performance.now() - startTime;
      if (elapsed >= duration) {
        overlay.style.display = 'none';
        overlay.style.opacity = '0';
        return;
      }
      const flickerIndex = Math.floor(elapsed / cycleTime);
      overlay.style.opacity = flickerIndex % 2 === 0 ? '0.35' : '0';
      requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }

  /**
   * Backup glow on inverter (used by PowerCutScenario). Flat blue state.
   * @param {string} deviceId
   */
  inverterGlow(deviceId) {
    const resolvedId = DEVICE_ALIASES[deviceId] || deviceId;
    const el = this.deviceEls.get(resolvedId);
    if (!el) return;
    el.classList.add('inverter-active');
  }

  /**
   * Get device position for external use (returns { x, y } in pixels relative to container).
   * @param {string} deviceId
   * @returns {{ x: number, y: number, clone: Function }|undefined}
   */
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

  /**
   * Get mesh-like interface for PowerCutScenario compatibility.
   * @param {string} deviceId
   * @returns {{ position: { x: number, y: number, clone: Function }}|undefined}
   */
  getMesh(deviceId) {
    const pos = this.getDevicePosition(deviceId);
    if (!pos) return undefined;
    return { position: pos };
  }

  /**
   * Get all room lights (compatibility with DeviceIndicators interface).
   * @returns {Array<{ roomId: string, lightMesh: object }>}
   */
  getAllRoomLights() {
    const lights = [];
    for (const [roomId] of this.roomEls) {
      lights.push({ roomId, lightMesh: { material: {} } });
    }
    return lights;
  }

  // ═══════════════════════════════════════════════════════════════
  // Private: Build DOM
  // ═══════════════════════════════════════════════════════════════

  _initializeDeviceStates() {
    for (const deviceId of Object.keys(DEVICE_PLACEMENTS)) {
      const defaults = DEVICE_DEFAULT_STATES[deviceId];
      const isSmartLight = deviceId.startsWith('smart_lights_');
      this.deviceStates.set(deviceId, {
        active: defaults ? defaults.active : isSmartLight,
      });
    }
  }

  _buildFloorPlan() {
    const wrapper = document.createElement('div');
    wrapper.className = 'floor-plan-wrapper';

    const title = document.createElement('div');
    title.className = 'fp-house-title';
    title.innerHTML = `
      <span class="fp-title-small">Sharma Smart Home</span>
      <strong>Alexa Thinks Ahead</strong>
    `;

    const roof = document.createElement('div');
    roof.className = 'fp-roof';
    roof.innerHTML = `<span class="fp-chimney"></span>`;

    const shell = document.createElement('div');
    shell.className = 'fp-house-shell';

    const roomLayer = document.createElement('div');
    roomLayer.className = 'fp-room-layer';
    this.roomLayer = roomLayer;

    for (const [roomId, layout] of Object.entries(ROOM_LAYOUT)) {
      const roomEl = document.createElement('div');
      roomEl.className = `fp-room fp-room-${roomId}`;
      roomEl.dataset.roomId = roomId;
      roomEl.style.top = `${layout.top}%`;
      roomEl.style.left = `${layout.left}%`;
      roomEl.style.width = `${layout.width}%`;
      roomEl.style.height = `${layout.height}%`;
      roomEl.style.setProperty('--room-base', layout.color);

      const decorLayer = document.createElement('div');
      decorLayer.className = 'fp-room-decor';
      this._buildRoomDecor(roomId, decorLayer);
      roomEl.appendChild(decorLayer);

      const label = document.createElement('span');
      label.className = 'fp-room-label';
      label.textContent = layout.name;
      roomEl.appendChild(label);

      roomEl.addEventListener('click', (event) => this._onRoomClick(roomId, event));

      roomLayer.appendChild(roomEl);
      this.roomEls.set(roomId, roomEl);
    }

    shell.appendChild(roomLayer);

    const foundation = document.createElement('div');
    foundation.className = 'fp-foundation';

    // Family legend — explains the colored dots moving between rooms
    const legend = document.createElement('div');
    legend.className = 'fp-legend';
    legend.innerHTML = `
      <span class="fp-legend-title">Family</span>
      ${Object.entries(AVATAR_COLORS).map(([id, color]) => {
        const name = id.charAt(0).toUpperCase() + id.slice(1);
        return `<span class="fp-legend-item"><span class="fp-legend-dot" style="background:${color}">${name.charAt(0)}</span>${name}</span>`;
      }).join('')}
    `;

    wrapper.appendChild(title);
    wrapper.appendChild(roof);
    wrapper.appendChild(shell);
    wrapper.appendChild(foundation);
    wrapper.appendChild(legend);
    this.container.appendChild(wrapper);
  }

  _buildRoomDecor(roomId, decorLayer) {
    const decorItems = ROOM_DECOR[roomId] || [];
    for (const item of decorItems) {
      const decorEl = document.createElement('span');
      decorEl.className = `fp-prop fp-prop-${item.type}`;
      decorEl.setAttribute('aria-hidden', 'true');
      decorEl.style.left = `${item.x}%`;
      decorEl.style.top = `${item.y}%`;
      decorEl.style.width = `${item.w}%`;
      decorEl.style.height = `${item.h}%`;
      decorLayer.appendChild(decorEl);
    }
  }

  _buildDevices() {
    for (const [deviceId, placement] of Object.entries(DEVICE_PLACEMENTS)) {
      const roomEl = this.roomEls.get(placement.room);
      if (!roomEl) continue;

      const roomName = ROOM_LAYOUT[placement.room]?.name || placement.room;
      const deviceEl = document.createElement('button');
      deviceEl.type = 'button';
      deviceEl.className = 'fp-device';
      deviceEl.dataset.deviceId = deviceId;
      deviceEl.style.left = `${placement.x}%`;
      deviceEl.style.top = `${placement.y}%`;
      deviceEl.title = `${placement.label} in ${roomName}`;
      deviceEl.setAttribute('aria-label', `${placement.label} in ${roomName}`);

      const iconSpan = document.createElement('span');
      iconSpan.className = 'fp-device-icon';
      iconSpan.setAttribute('aria-hidden', 'true');
      iconSpan.innerHTML = iconSvg(placement.icon);
      deviceEl.appendChild(iconSpan);

      const labelSpan = document.createElement('span');
      labelSpan.className = 'fp-device-label';
      labelSpan.textContent = placement.label;
      deviceEl.appendChild(labelSpan);

      deviceEl.addEventListener('click', (event) => this._onDeviceClick(deviceId, event));

      roomEl.appendChild(deviceEl);
      this.deviceEls.set(deviceId, deviceEl);
      this._applyDeviceState(deviceId);
    }
  }

  _buildAvatars() {
    for (const [memberId, color] of Object.entries(AVATAR_COLORS)) {
      const dot = document.createElement('div');
      dot.className = 'fp-avatar';
      dot.dataset.memberId = memberId;
      dot.style.backgroundColor = color;
      dot.style.display = 'none';
      const displayName = memberId.charAt(0).toUpperCase() + memberId.slice(1);
      dot.title = displayName;
      // Show the member's first initial inside the dot for clarity
      dot.textContent = displayName.charAt(0);

      // Append to the same percentage coordinate layer as rooms.
      const layer = this.roomLayer || this.container.querySelector('.fp-room-layer');
      if (layer) layer.appendChild(dot);
      this.avatarEls.set(memberId, dot);
    }
  }

  _positionAvatarInRoom(dot, memberId, roomId, _timeMinutes) {
    const layout = ROOM_LAYOUT[roomId];
    if (!layout) return;

    // Deterministic offset based on member name
    let hash = 0;
    for (let i = 0; i < memberId.length; i++) {
      hash = (hash * 31 + memberId.charCodeAt(i)) | 0;
    }
    const offsetX = 20 + (((hash & 0xff) / 255) * 60); // 20%-80% within room
    const offsetY = 25 + ((((hash >>> 8) & 0xff) / 255) * 50); // 25%-75% within room

    // Calculate absolute position within the plan
    const absX = layout.left + (layout.width * offsetX) / 100;
    const absY = layout.top + (layout.height * offsetY) / 100;

    dot.style.left = `${absX}%`;
    dot.style.top = `${absY}%`;
  }

  /**
   * Small amber chip that floats up from a device while Alexa decides.
   * @param {HTMLElement} deviceEl
   */
  _spawnThinkChip(deviceEl) {
    const existing = deviceEl.querySelector('.fp-think-chip');
    if (existing) existing.remove();

    const chip = document.createElement('span');
    chip.className = 'fp-think-chip';
    chip.innerHTML = `<i></i>Thinking…`;
    deviceEl.appendChild(chip);
    setTimeout(() => chip.remove(), 2400);
  }

  _onRoomClick(roomId, event) {
    if (event?.target?.closest?.('.fp-device')) return;

    const layout = ROOM_LAYOUT[roomId];
    if (!layout) return;

    // Gather devices in room
    const devices = Object.entries(DEVICE_PLACEMENTS)
      .filter(([, p]) => p.room === roomId)
      .map(([id, p]) => ({
        id,
        icon: p.icon,
        label: p.label,
        status: this._getDeviceStateLabel(id),
      }));

    // Gather people in room (check current avatars)
    const people = [];
    for (const [memberId, dot] of this.avatarEls) {
      if (dot.style.display !== 'none') {
        // Check if avatar is positioned in this room
        const avatarLeft = parseFloat(dot.style.left);
        const avatarTop = parseFloat(dot.style.top);
        if (
          avatarLeft >= layout.left &&
          avatarLeft <= layout.left + layout.width &&
          avatarTop >= layout.top &&
          avatarTop <= layout.top + layout.height
        ) {
          people.push(memberId.charAt(0).toUpperCase() + memberId.slice(1));
        }
      }
    }

    // Show info tooltip
    this._showRoomInfo(roomId, layout.name, devices, people);
  }

  _showRoomInfo(roomId, roomName, devices, people) {
    this._removeInfoPanels();
    if (this.selectedDeviceId) {
      this.deviceEls.get(this.selectedDeviceId)?.classList.remove('selected');
      this.selectedDeviceId = null;
    }

    const info = document.createElement('div');
    info.className = 'fp-room-info glass-panel';
    info.innerHTML = `
      <h3>${roomName}</h3>
      <div class="fp-room-info-section">
        <strong>Components</strong>
        <div class="fp-room-info-devices">
          ${devices.length ? devices.map(device => `
            <button type="button" class="fp-component-row" data-device-id="${device.id}">
              <span class="fp-component-row-icon" aria-hidden="true">${iconSvg(device.icon, 14)}</span>
              <span class="fp-component-row-label">${device.label}</span>
              <span class="fp-component-row-status">${device.status}</span>
            </button>
          `).join('') : '<span class="fp-empty">None</span>'}
        </div>
      </div>
      <div class="fp-room-info-section">
        <strong>People</strong>
        <div>${people.length ? people.join(', ') : 'None'}</div>
      </div>
      <button class="fp-room-info-close">✕</button>
    `;

    info.querySelector('.fp-room-info-close').addEventListener('click', () => info.remove());
    info.addEventListener('click', (event) => {
      const componentButton = event.target.closest('[data-device-id]');
      if (!componentButton) return;
      this._onDeviceClick(componentButton.dataset.deviceId, event);
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
    const room = ROOM_LAYOUT[placement.room];
    const stateLabel = this._getDeviceStateLabel(deviceId);

    const info = document.createElement('div');
    info.className = 'fp-component-info glass-panel';
    info.innerHTML = `
      <button class="fp-room-info-close" type="button" aria-label="Close">✕</button>
      <div class="fp-component-info-heading">
        <span class="fp-component-info-icon" aria-hidden="true">${iconSvg(placement.icon, 17)}</span>
        <div>
          <h3>${placement.label}</h3>
          <p>${room?.name || placement.room}</p>
        </div>
      </div>
      <div class="fp-component-status">
        <span>Status</span>
        <strong>${stateLabel}</strong>
      </div>
      <div class="fp-component-actions">
        <button type="button" class="fp-component-action" data-action="toggle">Toggle</button>
        <button type="button" class="fp-component-action" data-action="announce">Announce</button>
      </div>
    `;

    info.querySelector('.fp-room-info-close').addEventListener('click', () => {
      info.remove();
      this.deviceEls.get(deviceId)?.classList.remove('selected');
      if (this.selectedDeviceId === deviceId) this.selectedDeviceId = null;
    });

    info.addEventListener('click', (event) => {
      const actionButton = event.target.closest('[data-action]');
      if (!actionButton) return;
      const action = actionButton.dataset.action;
      if (action === 'toggle') {
        this._toggleDeviceState(deviceId);
      } else if (action === 'announce') {
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
    const deviceEl = this.deviceEls.get(deviceId);
    if (!deviceEl) return;

    const state = this.deviceStates.get(deviceId) || { active: true };
    deviceEl.dataset.state = state.active ? 'on' : 'off';
    deviceEl.classList.toggle('is-off', !state.active);
  }

  _getDeviceStateLabel(deviceId) {
    const state = this.deviceStates.get(deviceId) || { active: true };
    const defaults = DEVICE_DEFAULT_STATES[deviceId] || {};
    const isSmartLight = deviceId.startsWith('smart_lights_');
    if (state.active) return defaults.onLabel || (isSmartLight ? 'On' : 'Active');
    return defaults.offLabel || 'Off';
  }

  _removeInfoPanels() {
    this.container.querySelectorAll('.fp-room-info, .fp-component-info').forEach((el) => el.remove());
  }

  // ═══════════════════════════════════════════════════════════════
  // Private: Inject CSS
  // ═══════════════════════════════════════════════════════════════

  _injectStyles() {
    if (document.getElementById('floor-plan-2d-styles')) return;

    const style = document.createElement('style');
    style.id = 'floor-plan-2d-styles';
    style.textContent = `
      .floor-plan-wrapper {
        position: relative;
        width: min(100%, 1120px);
        height: min(100%, 740px);
        min-height: 420px;
        background: transparent;
        transition: filter 0.5s ease;
      }

      /* ── Header ─────────────────────────────────────────────── */
      .fp-house-title {
        position: absolute;
        top: 1%;
        left: 50%;
        z-index: 4;
        transform: translateX(-50%);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        text-align: center;
        pointer-events: none;
      }

      .fp-title-small {
        color: #7B8794;
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.14em;
      }

      .fp-house-title strong {
        font-size: 28px;
        font-weight: 600;
        color: #1F2933;
        letter-spacing: -0.01em;
      }

      /* ── Roof — flat triangle outline ───────────────────────── */
      .fp-roof {
        position: absolute;
        top: 14%;
        left: 6%;
        right: 6%;
        height: 11%;
        z-index: 3;
        pointer-events: none;
        background: #DAD7D0;
        clip-path: polygon(50% 0, 100% 100%, 0 100%);
      }

      .fp-chimney {
        position: absolute;
        left: 20%;
        top: 22%;
        width: 26px;
        height: 46px;
        border-radius: 4px 4px 0 0;
        background: #C9C4BA;
      }

      /* ── House shell — grey wall frame around room cells ────── */
      .fp-house-shell {
        position: absolute;
        left: 8%;
        right: 8%;
        top: 25%;
        bottom: 10%;
        z-index: 5;
        background: #E3E1DC;
        border-radius: 6px;
        padding: 5px;
        box-shadow: 0 1px 2px rgba(31, 41, 51, 0.08);
        pointer-events: none;
      }

      .fp-room-layer {
        position: absolute;
        inset: 5px;
        pointer-events: none;
      }

      .fp-foundation {
        position: absolute;
        left: 7%;
        right: 7%;
        bottom: 8.2%;
        height: 1.8%;
        z-index: 4;
        border-radius: 0 0 6px 6px;
        background: #C9C4BA;
        pointer-events: none;
      }

      /* ── Rooms — flat rounded-rect cells ────────────────────── */
      .fp-room {
        position: absolute;
        border: 3px solid #E3E1DC;
        border-radius: 12px;
        background: var(--room-base);
        background-clip: padding-box;
        cursor: pointer;
        transition: box-shadow 0.25s ease, opacity 0.3s ease, filter 0.3s ease;
        overflow: visible;
        pointer-events: auto;
      }

      .fp-room:hover {
        box-shadow: inset 0 0 0 1.5px rgba(46, 124, 246, 0.45);
      }

      .fp-room-decor {
        position: absolute;
        inset: 0;
        z-index: 1;
        pointer-events: none;
        overflow: hidden;
        border-radius: 9px;
      }

      /* ── Furniture — flat 2-color vector shapes ─────────────── */
      .fp-prop {
        position: absolute;
        display: block;
        border-radius: 4px;
        --line: #B9B3A7;
        --wood: #E3D2B3;
        --fill: #FFFFFF;
      }

      .fp-prop-window {
        background:
          linear-gradient(90deg, transparent calc(50% - 0.75px), var(--line) calc(50% - 0.75px) calc(50% + 0.75px), transparent calc(50% + 0.75px)),
          linear-gradient(0deg, transparent calc(50% - 0.75px), var(--line) calc(50% - 0.75px) calc(50% + 0.75px), transparent calc(50% + 0.75px)),
          #FDFDFB;
        border: 1.5px solid var(--line);
        border-radius: 4px;
      }

      .fp-prop-bed {
        border-radius: 6px 6px 3px 3px;
        background:
          linear-gradient(90deg, #F4EFE6 0 28%, transparent 28%),
          var(--fill);
        border: 1.5px solid var(--line);
      }

      .fp-prop-bed::after,
      .fp-prop-bunk-bed::after {
        content: '';
        position: absolute;
        left: 6%;
        right: 6%;
        bottom: -16%;
        height: 18%;
        border-radius: 0 0 3px 3px;
        background: var(--wood);
      }

      .fp-prop-side-table,
      .fp-prop-coffee-table {
        background: var(--wood);
        border: 1.5px solid var(--line);
        border-radius: 3px;
      }

      .fp-prop-lamp {
        border-radius: 40% 40% 3px 3px;
        background:
          linear-gradient(180deg, #F6E8C8 0 42%, transparent 42%),
          linear-gradient(90deg, transparent calc(50% - 1px), var(--line) calc(50% - 1px) calc(50% + 1px), transparent calc(50% + 1px));
      }

      .fp-prop-picture {
        background: #FDFDFB;
        border: 2px solid var(--wood);
        border-radius: 2px;
        box-shadow: inset 0 0 0 1.5px #EAF0F7;
      }

      .fp-prop-bookshelf,
      .fp-prop-toy-shelf,
      .fp-prop-cabinet {
        background:
          repeating-linear-gradient(0deg, transparent 0 26%, var(--line) 26% calc(26% + 1.5px), transparent calc(26% + 1.5px) 52%),
          #F1E9D9;
        border: 1.5px solid var(--line);
        border-radius: 3px;
      }

      .fp-prop-desk,
      .fp-prop-counter {
        background: linear-gradient(180deg, var(--wood) 0 34%, #F4EFE6 34%);
        border: 1.5px solid var(--line);
        border-radius: 3px;
      }

      .fp-prop-chair {
        border-radius: 5px 5px 2px 2px;
        background: #DCE4EE;
        border: 1.5px solid var(--line);
      }

      .fp-prop-plant {
        border-radius: 0;
        background:
          radial-gradient(circle at 30% 24%, #9CC69B 0 19%, transparent 20%),
          radial-gradient(circle at 68% 26%, #8BBB8A 0 21%, transparent 22%),
          radial-gradient(circle at 50% 12%, #ABD1AA 0 18%, transparent 19%),
          linear-gradient(180deg, transparent 0 56%, #D8B48F 56%);
      }

      .fp-prop-stove {
        background:
          radial-gradient(circle at 30% 40%, transparent 0 8%, #7B8794 8% 12%, transparent 12%),
          radial-gradient(circle at 70% 40%, transparent 0 8%, #7B8794 8% 12%, transparent 12%),
          var(--fill);
        border: 1.5px solid var(--line);
        border-radius: 3px;
      }

      .fp-prop-sink,
      .fp-prop-sink-basin {
        border-radius: 999px;
        background: var(--fill);
        border: 1.5px solid var(--line);
      }

      .fp-prop-tv-unit {
        background: linear-gradient(180deg, #33404E 0 62%, var(--wood) 62%);
        border: 1.5px solid var(--line);
        border-radius: 3px;
      }

      .fp-prop-sofa {
        border-radius: 8px 8px 3px 3px;
        background:
          linear-gradient(90deg, transparent calc(33% - 0.75px), var(--line) calc(33% - 0.75px) calc(33% + 0.75px), transparent calc(33% + 0.75px) calc(66% - 0.75px), var(--line) calc(66% - 0.75px) calc(66% + 0.75px), transparent calc(66% + 0.75px)),
          #D5DEEA;
        border: 1.5px solid var(--line);
      }

      .fp-prop-vent {
        background:
          repeating-linear-gradient(90deg, var(--line) 0 1.5px, transparent 1.5px 6px),
          #FDFDFB;
        border: 1.5px solid var(--line);
        border-radius: 3px;
      }

      .fp-prop-geyser-tank {
        border-radius: 10px;
        background: var(--fill);
        border: 1.5px solid var(--line);
      }

      .fp-prop-shower {
        background:
          linear-gradient(90deg, transparent calc(50% - 1px), var(--line) calc(50% - 1px) calc(50% + 1px), transparent calc(50% + 1px)),
          radial-gradient(ellipse at 50% 6%, #C4CDD5 0 20%, transparent 21%);
      }

      .fp-prop-bunk-bed {
        border-radius: 4px;
        background:
          linear-gradient(180deg, var(--fill) 0 16%, transparent 16% 47%, var(--fill) 47% 63%, transparent 63%),
          linear-gradient(90deg, var(--wood) 0 9%, transparent 9% 91%, var(--wood) 91%);
        border: 1.5px solid var(--line);
      }

      .fp-prop-rug {
        border-radius: 50%;
        background: #F0E4D2;
        border: 1.5px solid #E2D4BE;
      }

      .fp-prop-railing {
        background:
          repeating-linear-gradient(90deg, var(--line) 0 2px, transparent 2px 12px),
          linear-gradient(180deg, var(--line) 0 2px, transparent 2px);
        border-radius: 0;
      }

      .fp-prop-water-tank {
        border-radius: 999px 999px 6px 6px;
        background: #E7EEEC;
        border: 1.5px solid var(--line);
      }

      /* ── Room label chip ────────────────────────────────────── */
      .fp-room-label {
        position: absolute;
        bottom: 7px;
        left: 8px;
        z-index: 6;
        max-width: calc(100% - 16px);
        padding: 3px 8px;
        border-radius: 6px;
        background: #FFFFFF;
        border: 1px solid #E3E1DC;
        color: #1F2933;
        font-size: 11px;
        font-weight: 500;
        pointer-events: none;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        box-shadow: 0 1px 2px rgba(31, 41, 51, 0.06);
      }

      /* ── Devices — flat 24px circle badges ──────────────────── */
      .fp-device {
        position: absolute;
        transform: translate(-50%, -50%);
        z-index: 9;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
        width: 26px;
        height: 26px;
        padding: 0;
        border: 1.5px solid #C5C1B8;
        border-radius: 50%;
        background: #FFFFFF;
        color: #7B8794;
        font: inherit;
        cursor: pointer;
        box-shadow: 0 1px 2px rgba(31, 41, 51, 0.08);
        transition: border-color 0.2s ease, background 0.2s ease, color 0.2s ease, transform 0.2s ease;
      }

      .fp-device-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
      }

      .fp-device-label {
        position: absolute;
        top: calc(100% + 3px);
        left: 50%;
        transform: translateX(-50%);
        padding: 1px 6px;
        border-radius: 4px;
        background: #FFFFFF;
        border: 1px solid #E3E1DC;
        color: #1F2933;
        font-size: 10px;
        font-weight: 500;
        line-height: 1.4;
        white-space: nowrap;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.2s ease;
      }

      .fp-device:hover .fp-device-label,
      .fp-device:focus-visible .fp-device-label,
      .fp-device.selected .fp-device-label {
        opacity: 1;
      }

      /* Active state — blue fill */
      .fp-device[data-state="on"] {
        background: #2E7CF6;
        border-color: #2E7CF6;
        color: #FFFFFF;
      }

      .fp-device:hover,
      .fp-device:focus-visible,
      .fp-device.selected {
        border-color: #2E7CF6;
        outline: none;
        transform: translate(-50%, -50%) scale(1.12);
      }

      .fp-device.is-off {
        background: #FFFFFF;
        border-color: #C5C1B8;
        color: #A5AEB8;
      }

      /* Decision state — subtle amber pulse, no glow */
      .fp-device.device-highlight {
        background: #F5A623 !important;
        border-color: #F5A623 !important;
        color: #FFFFFF !important;
        animation: device-pulse 1.5s ease-in-out infinite;
      }

      @keyframes device-pulse {
        0%, 100% { transform: translate(-50%, -50%) scale(1); }
        50% { transform: translate(-50%, -50%) scale(1.14); }
      }

      /* Inverter on backup — blue fill + gentle pulse */
      .fp-device.inverter-active {
        background: #2E7CF6;
        border-color: #2E7CF6;
        color: #FFFFFF;
        animation: device-pulse 1.5s ease-in-out infinite;
      }

      /* Amber "thinking" chip — floats up from the device and fades */
      .fp-think-chip {
        position: absolute;
        bottom: calc(100% + 6px);
        left: 50%;
        transform: translate(-50%, 6px);
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 3px 9px;
        border-radius: 999px;
        background: #FFFFFF;
        border: 1px solid #F5A623;
        color: #9A6A14;
        font-size: 11px;
        font-weight: 500;
        white-space: nowrap;
        pointer-events: none;
        z-index: 12;
        animation: think-float 2.4s ease-out forwards;
      }

      .fp-think-chip i {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #F5A623;
      }

      @keyframes think-float {
        0% { opacity: 0; transform: translate(-50%, 8px); }
        14% { opacity: 1; transform: translate(-50%, 0); }
        72% { opacity: 1; transform: translate(-50%, -14px); }
        100% { opacity: 0; transform: translate(-50%, -24px); }
      }

      /* ── People — flat dots, smooth room-to-room motion ─────── */
      .fp-avatar {
        position: absolute;
        width: 19px;
        height: 19px;
        border-radius: 50%;
        transform: translate(-50%, -50%);
        z-index: 6;
        border: 2px solid #FFFFFF;
        transition: left 0.8s ease-in-out, top 0.8s ease-in-out;
        pointer-events: auto;
        cursor: pointer;
        box-shadow: 0 1px 2px rgba(31, 41, 51, 0.18);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 9px;
        font-weight: 700;
        color: #FFFFFF;
        font-family: var(--font-family, 'Inter', sans-serif);
        user-select: none;
      }

      .fp-avatar:hover {
        z-index: 12;
      }

      .fp-avatar:hover::after {
        content: attr(title);
        position: absolute;
        bottom: 24px;
        left: 50%;
        transform: translateX(-50%);
        background: #FFFFFF;
        color: #1F2933;
        padding: 2px 8px;
        border-radius: 5px;
        font-size: 11px;
        font-weight: 500;
        white-space: nowrap;
        pointer-events: none;
        border: 1px solid #E3E1DC;
        box-shadow: 0 1px 2px rgba(31, 41, 51, 0.08);
        z-index: 12;
      }

      /* ── Legend ─────────────────────────────────────────────── */
      .fp-legend {
        position: absolute;
        left: 50%;
        bottom: 0.6%;
        transform: translateX(-50%);
        z-index: 9;
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 5px 14px;
        background: #FFFFFF;
        border: 1px solid #E3E1DC;
        border-radius: 999px;
        box-shadow: 0 1px 2px rgba(31, 41, 51, 0.06);
        flex-wrap: wrap;
        justify-content: center;
        max-width: 90%;
      }

      .fp-legend-title {
        font-size: 11px;
        font-weight: 600;
        color: #7B8794;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }

      .fp-legend-item {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-size: 11px;
        color: #1F2933;
      }

      .fp-legend-dot {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 15px;
        height: 15px;
        border-radius: 50%;
        font-size: 8px;
        font-weight: 700;
        color: #FFFFFF;
        border: 1.5px solid #FFFFFF;
        box-shadow: 0 0 0 1px #E3E1DC;
      }

      /* ── Speech bubbles ─────────────────────────────────────── */
      .fp-speech-bubble {
        position: absolute;
        bottom: calc(100% + 10px);
        left: 50%;
        transform: translateX(-50%) translateY(8px);
        background: #FFFFFF;
        border: 1px solid #E3E1DC;
        border-radius: 10px;
        padding: 7px 11px;
        font-size: 12px;
        color: #1F2933;
        max-width: 230px;
        width: max-content;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.25s ease-out, transform 0.25s ease-out;
        z-index: 14;
        box-shadow: 0 1px 2px rgba(31, 41, 51, 0.1);
        line-height: 1.45;
      }

      .fp-speech-bubble.visible {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }

      .fp-speech-bubble::after {
        content: '';
        position: absolute;
        top: 100%;
        left: 50%;
        transform: translateX(-50%);
        border: 6px solid transparent;
        border-top-color: #FFFFFF;
      }

      /* ── Room states ────────────────────────────────────────── */
      .room-highlight {
        box-shadow: inset 0 0 0 1.5px rgba(245, 166, 35, 0.7) !important;
      }

      .room-dimmed {
        filter: grayscale(0.9);
        opacity: 0.45;
      }

      .room-powered {
        box-shadow: inset 0 0 0 1.5px #2E7CF6 !important;
      }

      /* ── Info cards ─────────────────────────────────────────── */
      .fp-room-info {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        padding: 16px 20px;
        border-radius: 12px;
        z-index: 40;
        width: min(320px, calc(100% - 32px));
        background: #FFFFFF;
        border: 1px solid #E3E1DC;
        box-shadow: 0 2px 2px rgba(31, 41, 51, 0.06);
        animation: fadeIn 0.2s ease-out;
      }

      .fp-room-info h3 {
        margin: 0 0 8px 0;
        font-size: 16px;
        font-weight: 600;
        color: #1F2933;
      }

      .fp-room-info-section {
        margin-bottom: 6px;
        font-size: 13px;
        color: #7B8794;
      }

      .fp-room-info-section strong {
        display: block;
        margin-bottom: 6px;
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: #7B8794;
      }

      .fp-room-info-devices {
        display: grid;
        gap: 6px;
      }

      .fp-component-row {
        display: grid;
        grid-template-columns: 1.4rem minmax(0, 1fr) auto;
        align-items: center;
        gap: 0.45rem;
        width: 100%;
        min-height: 32px;
        padding: 0.35rem 0.45rem;
        border: 1px solid #E3E1DC;
        border-radius: 8px;
        background: #F7F6F3;
        color: #1F2933;
        font: inherit;
        text-align: left;
        cursor: pointer;
        transition: border-color 0.2s ease, background 0.2s ease;
      }

      .fp-component-row:hover,
      .fp-component-row:focus-visible {
        border-color: #2E7CF6;
        background: #FFFFFF;
        outline: none;
      }

      .fp-component-row-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: #7B8794;
      }

      .fp-component-row-label {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 13px;
        font-weight: 500;
      }

      .fp-component-row-status,
      .fp-empty {
        font-size: 11px;
        color: #7B8794;
      }

      .fp-component-info {
        position: absolute;
        top: 16px;
        right: 16px;
      }

      /* In deployment the event log owns the right edge — clear it */
      [id="3d-container"].fullscreen .fp-component-info {
        right: 356px;
      }

      .fp-component-info {
        width: min(280px, calc(100% - 32px));
        padding: 16px;
        border-radius: 12px;
        z-index: 40;
        background: #FFFFFF;
        border: 1px solid #E3E1DC;
        box-shadow: 0 2px 2px rgba(31, 41, 51, 0.06);
        animation: fadeInSide 0.2s ease-out;
      }

      .fp-component-info-heading {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin-bottom: 12px;
      }

      .fp-component-info-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: #F7F6F3;
        border: 1.5px solid #E3E1DC;
        color: #2E7CF6;
      }

      .fp-component-info h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
        color: #1F2933;
      }

      .fp-component-info p {
        margin: 2px 0 0;
        font-size: 11px;
        color: #7B8794;
        line-height: 1.3;
      }

      .fp-component-status {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        padding: 0.55rem 0.65rem;
        margin-bottom: 12px;
        border-radius: 8px;
        background: #F7F6F3;
        color: #7B8794;
        font-size: 13px;
      }

      .fp-component-status strong {
        color: #1F2933;
        font-weight: 600;
      }

      .fp-component-actions {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
      }

      .fp-component-action {
        min-height: 34px;
        border: 1px solid #E3E1DC;
        border-radius: 8px;
        background: #FFFFFF;
        color: #1F2933;
        font: inherit;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: border-color 0.2s ease, background 0.2s ease, color 0.2s ease;
      }

      .fp-component-action:hover,
      .fp-component-action:focus-visible {
        border-color: #2E7CF6;
        color: #2E7CF6;
        outline: none;
      }

      .fp-room-info-close {
        position: absolute;
        top: 8px;
        right: 10px;
        background: none;
        border: none;
        color: #7B8794;
        cursor: pointer;
        font-size: 13px;
        padding: 2px;
        line-height: 1;
        transition: color 0.2s ease;
      }

      .fp-room-info-close:hover {
        color: #1F2933;
      }

      @keyframes fadeIn {
        from { opacity: 0; transform: translate(-50%, -50%) scale(0.97); }
        to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
      }

      @keyframes fadeInSide {
        from { opacity: 0; transform: translateY(-6px); }
        to { opacity: 1; transform: translateY(0); }
      }
    `;
    document.head.appendChild(style);
  }
}
