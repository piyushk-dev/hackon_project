/**
 * IsoHouse — game-style isometric cutaway dollhouse of the Sharma family home.
 *
 * Look & feel: Playrix / Manor-Cafe style stage — locked orthographic
 * isometric camera, two-storey cutaway with colored back walls, wooden
 * floors, dense CC0 Kenney furniture, and a garden ring with trees,
 * flowers, a picket fence and a path to the front door.
 *
 * Drop-in replacement for FloorPlan2D: exposes the exact same public API
 * (updateAvatars, updateLighting, highlightDevice, showSpeechBubble, show,
 * dimRooms, restoreAll, restoreRooms, powerCutFlicker, inverterGlow,
 * getDevicePosition, getMesh, getAllRoomLights) so all simulation logic,
 * panels and the PowerCutScenario stay untouched.
 *
 * Assets: Kenney Furniture Kit + Nature Kit (CC0) in /models/kenney/.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { FAMILY_SCHEDULE } from '../data/FamilySchedule.js';

// ═════════════════════════════════════════════════════════════════
// Palette & layout data
// ═════════════════════════════════════════════════════════════════

const P = {
  // wall colors per room (saturated but cozy)
  living: 0x3a93a1,      // teal
  kitchen: 0x9bb068,     // sage green
  porch: 0xe7d3ae,       // cream plaster
  master: 0xd08a90,      // dusty rose
  kids: 0x6c8fd8,        // periwinkle
  study: 0xc99a3f,       // mustard
  bath: 0x7fb5b0,        // aqua
  partition: 0xefe6d8,   // warm white
  brick: 0xc1705c,       // exterior brick
  plinth: 0x9c5a49,
  slabEdge: 0xe9dfcd,
  grass: 0x8fbf6b,
  soil: 0xa9825f,
  pathTan: 0xd9c49a,
};

const G = 0;       // ground floor Y
const U = 2.7;     // upper floor Y
const WALL_H = 2.5;
const WALL_T = 0.18;
const STUB_H = 0.34;

// Room bounds { x0,x1,z0,z1, floorY, wall color, floor plank tint }
const ROOMS = {
  living_room:    { x0: -6,   x1: 0.5, z0: -4,  z1: 4,   y: G, color: P.living,  floor: '#b98a5f', name: 'Living Room' },
  kitchen:        { x0: 0.5,  x1: 6,   z0: -4,  z1: 0.3, y: G, color: P.kitchen, floor: '#d8c49c', name: 'Kitchen' },
  porch:          { x0: 0.5,  x1: 6,   z0: 0.3, z1: 4,   y: G, color: P.porch,   floor: '#cfa878', name: 'Veranda' },
  master_bedroom: { x0: -6,   x1: -0.5,z0: -4,  z1: 0.3, y: U, color: P.master,  floor: '#c1936a', name: 'Master Bedroom' },
  kids_room:      { x0: -0.5, x1: 6,   z0: -4,  z1: 0.3, y: U, color: P.kids,    floor: '#c9a072', name: 'Kids Room' },
  study_room:     { x0: -6,   x1: -1.5,z0: 0.3, z1: 4,   y: U, color: P.study,   floor: '#a97e58', name: 'Study Room' },
  bath:           { x0: -1.5, x1: 1.5, z0: 0.3, z1: 4,   y: U, color: P.bath,    floor: '#dfe8e4', name: 'Bath' },
  balcony:        { x0: 1.5,  x1: 6,   z0: 0.3, z1: 4,   y: U, color: P.porch,   floor: '#d8cdb8', name: 'Terrace' },
};

// Simulation room ids (porch is decorative — clicks map to living_room)
const SIM_ROOMS = ['living_room', 'kitchen', 'master_bedroom', 'kids_room', 'study_room', 'bath', 'balcony'];

// Furniture manifest: [kit, model, x, z, floorY, rotDeg, scale, roomId]
const F = 'furniture';
const N = 'nature';
const FURNITURE = [
  // ── Living room (arranged toward the open camera side) ───────
  [F, 'rugRound',           -3.7,  1.3, G,   0, 2.4, 'living_room'],
  [F, 'loungeSofa',         -2.35, 1.3, G, -90, 1.5, 'living_room'],
  [F, 'loungeChair',        -3.7, -0.4, G, 180, 1.5, 'living_room'],
  [F, 'tableCoffee',        -3.7,  1.3, G,  90, 1.5, 'living_room'],
  [F, 'cabinetTelevision',  -5.6,  1.3, G,  90, 1.5, 'living_room'],
  [F, 'televisionModern',   -5.6,  1.3, G,  90, 1.5, 'living_room', 0.5],
  [F, 'bookcaseOpenLow',    -5.0, -3.6, G,   0, 1.5, 'living_room'],
  [F, 'pottedPlant',        -0.9,  0.5, G,   0, 1.5, 'living_room'],
  [F, 'lampRoundFloor',     -5.6,  3.4, G,   0, 1.5, 'living_room'],
  [F, 'sideTable',          -0.7,  3.2, G, -90, 1.5, 'living_room'],
  [F, 'speakerSmall',       -0.7,  3.2, G, -35, 1.5, 'living_room', 0.5],
  [F, 'stairsOpen',          0.0, -1.6, G,  90, 1.35, 'living_room'],
  // ── Kitchen ──────────────────────────────────────────────────
  [F, 'kitchenFridgeLarge',  5.45, -3.5, G,   0, 1.5, 'kitchen'],
  [F, 'kitchenCabinetDrawer',1.35, -3.55, G,  0, 1.5, 'kitchen'],
  [F, 'kitchenSink',         2.35, -3.55, G,  0, 1.5, 'kitchen'],
  [F, 'kitchenStove',        3.35, -3.55, G,  0, 1.5, 'kitchen'],
  [F, 'kitchenCabinet',      4.35, -3.55, G,  0, 1.5, 'kitchen'],
  [F, 'kitchenCabinetUpperDouble', 2.35, -3.82, G, 0, 1.5, 'kitchen', 1.5],
  [F, 'kitchenCabinetUpperDouble', 3.85, -3.82, G, 0, 1.5, 'kitchen', 1.5],
  [F, 'kitchenMicrowave',    1.35, -3.5, G,   0, 1.5, 'kitchen', 0.95],
  [F, 'tableCross',          3.4, -1.4, G,  90, 1.5, 'kitchen'],
  [F, 'chairCushion',        2.6, -1.4, G,  90, 1.5, 'kitchen'],
  [F, 'chairCushion',        4.2, -1.4, G, -90, 1.5, 'kitchen'],
  [F, 'kitchenBar',          2.4,  0.3, G,  180, 1.5, 'kitchen'],
  [F, 'kitchenBarEnd',       4.65, 0.3, G, 180, 1.5, 'kitchen'],
  // ── Veranda / entrance ───────────────────────────────────────
  [F, 'doorwayFront',        3.3,  3.95, G, 180, 1.5, 'porch'],
  [F, 'rugDoormat',          3.3,  3.1, G,   0, 1.5, 'porch'],
  [F, 'benchCushionLow',     5.5,  1.2, G, -90, 1.5, 'porch'],
  [F, 'pottedPlant',         0.95, 3.5, G,   0, 1.5, 'porch'],
  [F, 'coatRackStanding',    0.95, 0.8, G,   0, 1.5, 'porch'],
  // ── Master bedroom ───────────────────────────────────────────
  [F, 'bedDouble',          -4.5, -1.7, U,  90, 1.5, 'master_bedroom'],
  [F, 'cabinetBedDrawerTable', -2.2, -3.6, U, 0, 1.5, 'master_bedroom'],
  [F, 'lampSquareTable',    -2.2, -3.55, U,  0, 1.5, 'master_bedroom', 0.62],
  [F, 'rugRectangle',       -2.9, -0.9, U,  90, 1.8, 'master_bedroom'],
  [F, 'bookcaseClosed',     -1.0, -3.6, U,   0, 1.5, 'master_bedroom'],
  [F, 'plantSmall3',        -0.95, -0.3, U,  0, 1.5, 'master_bedroom'],
  // ── Kids room ────────────────────────────────────────────────
  [F, 'bedBunk',             5.0, -2.3, U,  90, 1.5, 'kids_room'],
  [F, 'bear',                2.3, -0.9, U, -30, 1.5, 'kids_room'],
  [F, 'cardboardBoxOpen',    0.35, -3.4, U,  15, 1.5, 'kids_room'],
  [F, 'rugRound',            2.4, -1.6, U,   0, 1.6, 'kids_room'],
  [F, 'bookcaseOpenLow',     1.6, -3.6, U,   0, 1.5, 'kids_room'],
  [F, 'speakerSmall',        1.6, -3.55, U,  0, 1.5, 'kids_room', 0.62],
  [F, 'tableRound',          3.4, -0.8, U,   0, 1.1, 'kids_room'],
  // ── Study ────────────────────────────────────────────────────
  [F, 'desk',               -5.45, 2.0, U,  90, 1.5, 'study_room'],
  [F, 'chairDesk',          -4.65, 2.0, U, -90, 1.5, 'study_room'],
  [F, 'computerScreen',     -5.5,  2.25, U, 90, 1.5, 'study_room', 0.74],
  [F, 'computerKeyboard',   -5.3,  1.9, U,  90, 1.5, 'study_room', 0.74],
  [F, 'speakerSmall',       -5.5,  1.35, U, 60, 1.5, 'study_room', 0.74],
  [F, 'bookcaseOpen',       -2.4,  0.75, U,  0, 1.5, 'study_room'],
  [F, 'books',              -2.4,  0.7, U,   0, 1.5, 'study_room', 1.15],
  [F, 'rugSquare',          -3.9,  2.4, U,   0, 1.7, 'study_room'],
  [F, 'plantSmall1',        -1.95, 3.5, U,   0, 1.5, 'study_room'],
  [F, 'lampSquareFloor',    -5.5,  3.5, U,   0, 1.5, 'study_room'],
  // ── Bath (fixtures against the full back wall) ───────────────
  [F, 'bathtub',             0.25, 2.8, U,  -90, 1.35, 'bath'],
  [F, 'toilet',             -1.15, 1.7, U,  90, 1.4, 'bath'],
  [F, 'bathroomSink',       -0.55, 0.62, U, 180, 1.4, 'bath'],
  [F, 'bathroomMirror',     -0.55, 0.42, U, 180, 1.4, 'bath', 1.35],
  // ── Terrace ──────────────────────────────────────────────────
  [F, 'pottedPlant',         2.0,  0.85, U,  0, 1.5, 'balcony'],
  [F, 'plantSmall2',         5.5,  3.45, U,  0, 1.5, 'balcony'],
  [F, 'benchCushionLow',     5.35, 2.0, U, -90, 1.3, 'balcony'],
];

// Garden manifest: [model, x, z, rotDeg, scale]
const GARDEN = [
  ['tree_default',    -12.3, -2.5,  10, 2.4],
  ['tree_oak',          9.8, -7.0,   0, 2.4],
  ['tree_fat',         11.2,  4.5,  40, 2.2],
  ['tree_default_fall',-10.8,  6.8, 70, 2.3],
  ['tree_detailed',    -5.5, -9.6, 120, 1.9],
  ['tree_oak',         -12.2,  0.5, 200, 2.0],
  ['tree_default',     10.6,  9.0, 160, 2.2],
  ['plant_bushDetailed', -8.6,  5.2, 0, 2.0],
  ['plant_bushLarge',    8.4, -4.6,  0, 1.8],
  ['plant_bush',         7.6,  5.6,  0, 1.8],
  ['plant_bushSmall',   -8.3, -4.8,  0, 1.8],
  ['plant_bushDetailed', -3.0,  9.4, 0, 1.7],
  ['plant_bushSmall',    8.9,  8.8,  0, 1.6],
  ['flower_redA',       -7.9,  4.0,  0, 1.7],
  ['flower_yellowA',    -7.4,  4.6,  0, 1.7],
  ['flower_purpleA',    -7.9,  5.6,  0, 1.7],
  ['flower_redB',        7.4, -3.6,  0, 1.7],
  ['flower_yellowB',     8.0, -3.1,  0, 1.7],
  ['flower_purpleB',     7.2,  4.3,  0, 1.7],
  ['flower_redC',        1.6,  9.6,  0, 1.7],
  ['flower_yellowC',     5.0,  9.8,  0, 1.7],
  ['flower_purpleC',    -1.4,  9.8,  0, 1.7],
  ['stone_smallA',      -9.6,  9.0,  20, 1.6],
  ['stone_smallD',      -9.0,  9.5,  70, 1.6],
  ['grass_leafsLarge',  -7.0,  8.0,   0, 1.8],
  ['grass_leafs',        6.8,  7.6,   0, 1.8],
  ['grass_large',        9.4,  1.8,   0, 1.8],
];

// Device anchors: world position + which room they belong to.
// Some sit on furniture, some are small primitive props built in code.
const DEVICE_ANCHORS = {
  living_room_ac:   { room: 'living_room',  pos: [-5.85, G + 2.1, 1.8],  prop: 'ac' },
  smart_tv:         { room: 'living_room',  pos: [-2.9,  G + 1.15, -3.5] },
  echo_living:      { room: 'living_room',  pos: [-0.15, G + 0.85, 3.1] },
  kitchen_hub:      { room: 'kitchen',      pos: [1.35,  G + 1.5, -3.5] },
  water_purifier:   { room: 'kitchen',      pos: [5.0,   G + 1.7, -3.78], prop: 'purifier' },
  inverter_ups:     { room: 'kitchen',      pos: [5.65,  G + 0.5, 0.05],  prop: 'inverter' },
  smart_lock:       { room: 'balcony',      pos: [3.75,  G + 1.0, 3.95] },
  security_camera:  { room: 'balcony',      pos: [2.0,   U + 1.9, 3.7],  prop: 'camera' },
  smart_geyser:     { room: 'bath',         pos: [0.45,  U + 1.95, 0.55], prop: 'geyser' },
  echo_study:       { room: 'study_room',   pos: [-5.5,  U + 1.15, 1.35] },
  echo_kids:        { room: 'kids_room',    pos: [1.6,   U + 0.95, -3.55] },
  smart_lights_living_room:    { room: 'living_room',    pos: [-2.9, G + 2.35, 0.4] },
  smart_lights_kitchen:        { room: 'kitchen',        pos: [3.4,  G + 2.35, -1.6] },
  smart_lights_master_bedroom: { room: 'master_bedroom', pos: [-3.2, U + 2.35, -1.6] },
  smart_lights_kids_room:      { room: 'kids_room',      pos: [2.7,  U + 2.35, -1.6] },
  smart_lights_study_room:     { room: 'study_room',     pos: [-3.7, U + 2.35, 2.1] },
  smart_lights_bath:           { room: 'bath',           pos: [0.0,  U + 2.35, 2.1] },
  smart_lights_balcony:        { room: 'balcony',        pos: [3.7,  U + 1.6, 2.0] },
};

const DEVICE_META = {
  living_room_ac: { icon: 'ac', label: 'AC' },
  smart_tv: { icon: 'tv', label: 'TV' },
  echo_living: { icon: 'speaker', label: 'Echo' },
  kitchen_hub: { icon: 'stove', label: 'Hub' },
  water_purifier: { icon: 'droplet', label: 'Purifier' },
  security_camera: { icon: 'camera', label: 'Camera' },
  smart_lock: { icon: 'lock', label: 'Lock' },
  smart_geyser: { icon: 'heater', label: 'Geyser' },
  inverter_ups: { icon: 'battery', label: 'Inverter' },
  echo_study: { icon: 'speaker', label: 'Echo' },
  echo_kids: { icon: 'speaker', label: 'Echo' },
};

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

const DEVICE_ALIASES = {
  echo_devices: 'echo_living',
  smart_lights: 'smart_lights_living_room',
};

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

const AVATAR_COLORS = {
  rajesh: 0xe07a5f,
  priya: 0x3d9a8b,
  arjun: 0x5b8def,
  ananya: 0xe9b44c,
  dadaji: 0x9b7ebd,
  dadiji: 0x7fb069,
};

// Free-floor spots per room where avatars can stand
const AVATAR_SPOTS = {
  living_room: [[-4.0, 1.9], [-1.6, -1.6], [-4.4, -1.2], [-0.9, 1.6]],
  kitchen: [[2.0, -2.4], [4.6, -2.3], [3.4, -0.4]],
  porch: [[2.0, 2.2], [4.6, 2.4]],
  master_bedroom: [[-2.6, -1.9], [-4.4, 0.0], [-1.4, -1.2]],
  kids_room: [[1.2, -2.3], [3.6, -2.0], [2.6, 0.0]],
  study_room: [[-3.4, 1.4], [-2.4, 2.9], [-4.6, 3.2]],
  bath: [[0.0, 1.5], [-0.6, 3.0]],
  balcony: [[3.2, 1.4], [4.4, 3.0], [2.4, 2.7]],
};

// ═════════════════════════════════════════════════════════════════

export class IsoHouse {
  constructor(containerEl) {
    this.container = containerEl;
    this.container.innerHTML = '';
    this.container.style.padding = '0';

    this.deviceEls = new Map();       // deviceId → badge DOM button
    this.deviceAnchors = new Map();   // deviceId → CSS2DObject
    this.speechBubbles = new Map();
    this.deviceStates = new Map();
    this.selectedDeviceId = null;
    this.roomGroups = new Map();      // roomId → THREE.Group (furniture)
    this.roomLights = new Map();      // roomId → PointLight
    this.roomDimmers = new Map();     // roomId → dim overlay mesh
    this.roomFloors = new Map();      // roomId → floor mesh (for picking)
    this.avatars = new Map();         // memberId → { group, target, room }
    this._warmth = 1;
    this._clock = new THREE.Clock();
    this._modelCache = new Map();

    this._injectStyles();
    this._initializeDeviceStates();
    this._initScene();
    this._buildShell();
    this._buildGarden();
    this._buildDeviceProps();
    this._buildDeviceBadges();
    this._buildRoomLabels();
    this._buildAvatars();
    this._buildChrome();
    this._loadFurniture();
    this._loadGarden();
    this._bindPicking();
    this._animate();

    this.updateAvatars(0);
    this.updateLighting(0);
  }

  // ═══════════════════════════════════════════════════════════════
  // Scene setup
  // ═══════════════════════════════════════════════════════════════

  _initScene() {
    this.scene = new THREE.Scene();

    // Orthographic isometric camera, locked like a mobile game
    this.viewSize = 17.2;
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
    this.camera.position.set(19, 15.5, 19);
    this.cameraTarget = new THREE.Vector3(0.4, 1.2, 0.2);
    this.camera.lookAt(this.cameraTarget);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.22;
    this.renderer.domElement.style.display = 'block';

    this.labelRenderer = new CSS2DRenderer();
    Object.assign(this.labelRenderer.domElement.style, {
      position: 'absolute', top: '0', left: '0', pointerEvents: 'none',
    });

    const wrap = document.createElement('div');
    wrap.className = 'iso-wrap';
    wrap.appendChild(this.renderer.domElement);
    wrap.appendChild(this.labelRenderer.domElement);
    this.container.appendChild(wrap);
    this.wrap = wrap;

    // Lights
    this.hemi = new THREE.HemisphereLight(0xdfeeff, 0xe8d9c0, 0.85);
    this.scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight(0xfff2dc, 1.5);
    this.sun.position.set(16, 26, 8);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -20; sc.right = 20; sc.top = 20; sc.bottom = -20;
    sc.near = 1; sc.far = 80;
    this.sun.shadow.bias = -0.0004;
    this.scene.add(this.sun);

    this.fill = new THREE.DirectionalLight(0xd8e8f8, 0.55);
    this.fill.position.set(-14, 12, -10);
    this.scene.add(this.fill);

    // Per-room warm lights
    for (const roomId of SIM_ROOMS.concat(['porch'])) {
      const r = ROOMS[roomId];
      const light = new THREE.PointLight(0xffd9a0, 0, 7, 2);
      light.position.set((r.x0 + r.x1) / 2, r.y + 2.1, (r.z0 + r.z1) / 2);
      this.scene.add(light);
      this.roomLights.set(roomId, light);
      const group = new THREE.Group();
      this.scene.add(group);
      this.roomGroups.set(roomId, group);
    }

    this._onResize = this._onResize.bind(this);
    window.addEventListener('resize', this._onResize);
    this._resizeObserver = new ResizeObserver(this._onResize);
    this._resizeObserver.observe(this.container);
    this._onResize();
  }

  _onResize() {
    const w = this.container.clientWidth || 800;
    const h = this.container.clientHeight || 600;
    const aspect = w / h;
    const v = this.viewSize;
    this.camera.left = -v * aspect / 2;
    this.camera.right = v * aspect / 2;
    this.camera.top = v / 2;
    this.camera.bottom = -v / 2;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.labelRenderer.setSize(w, h);
  }

  // ═══════════════════════════════════════════════════════════════
  // House shell (procedural walls / floors / slabs)
  // ═══════════════════════════════════════════════════════════════

  _mat(color, opts = {}) {
    return new THREE.MeshStandardMaterial({ color, roughness: 0.92, metalness: 0, ...opts });
  }

  _box(w, h, d, x, y, z, material, { room = null, shadow = true, receive = true } = {}) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = shadow;
    mesh.receiveShadow = receive;
    if (room && this.roomGroups.has(room)) this.roomGroups.get(room).add(mesh);
    else this.scene.add(mesh);
    return mesh;
  }

  /** Wood plank texture per room */
  _plankTexture(hex, tile = false) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = hex;
    ctx.fillRect(0, 0, 256, 256);
    if (tile) {
      ctx.strokeStyle = 'rgba(120,140,135,0.35)';
      ctx.lineWidth = 3;
      for (let i = 0; i <= 256; i += 64) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 256); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(256, i); ctx.stroke();
      }
    } else {
      ctx.strokeStyle = 'rgba(70,40,20,0.28)';
      ctx.lineWidth = 3;
      for (let i = 0; i <= 256; i += 42) {
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(256, i); ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(70,40,20,0.16)';
      for (let row = 0; row < 7; row++) {
        const off = (row % 2) * 128 + 40;
        ctx.beginPath(); ctx.moveTo(off, row * 42); ctx.lineTo(off, row * 42 + 42); ctx.stroke();
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  _buildShell() {
    // Ground slab + brick plinth
    this._box(12.6, 0.3, 8.6, 0, -0.15, 0, this._mat(P.slabEdge));
    this._box(12.9, 0.45, 8.9, 0, -0.5, 0, this._mat(P.brick));

    // Upper slab (ceiling of ground floor / floor of upper).
    // Must not cast shadow or the whole ground floor goes dark.
    this._box(12.6, 0.24, 8.6, 0, U - 0.13, 0, this._mat(0xf2ead9), { shadow: false });

    // Room floors
    for (const [roomId, r] of Object.entries(ROOMS)) {
      const w = r.x1 - r.x0, d = r.z1 - r.z0;
      const tex = this._plankTexture(r.floor, roomId === 'bath');
      tex.repeat.set(w / 2.2, d / 2.2);
      const floor = new THREE.Mesh(
        new THREE.BoxGeometry(w, 0.07, d),
        new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 })
      );
      floor.position.set((r.x0 + r.x1) / 2, r.y + 0.035, (r.z0 + r.z1) / 2);
      floor.receiveShadow = true;
      floor.userData.roomId = roomId === 'porch' ? 'living_room' : roomId;
      this.scene.add(floor);
      this.roomFloors.set(roomId, floor);
    }

    const wallY = (fy) => fy + WALL_H / 2;

    // ── Ground outer walls (north + west are the cutaway back) ──
    // North: living segment + kitchen segment
    this._box(6.9, WALL_H, WALL_T, -2.85, wallY(G), -4.09, this._mat(P.living), { room: 'living_room' });
    this._box(5.9, WALL_H, WALL_T, 3.35, wallY(G), -4.09, this._mat(P.kitchen), { room: 'kitchen' });
    // West: living full depth
    this._box(WALL_T, WALL_H, 8.4, -6.09, wallY(G), 0, this._mat(P.living), { room: 'living_room' });
    // Partition living|kitchen — half wall so both interiors stay readable
    this._box(WALL_T, 0.95, 4.5, 0.5, G + 0.475, -1.75, this._mat(P.partition), { room: 'living_room' });
    // Ground open-edge stubs (south + east)
    this._box(6.7, STUB_H, WALL_T, -2.75, G + STUB_H / 2, 4.05, this._mat(P.living));
    this._box(WALL_T, STUB_H, 8.3, 6.05, G + STUB_H / 2, 0, this._mat(P.kitchen));
    this._box(2.2, STUB_H, WALL_T, 1.6, G + STUB_H / 2, 4.05, this._mat(P.porch));
    this._box(2.2, STUB_H, WALL_T, 5.1, G + STUB_H / 2, 4.05, this._mat(P.porch));

    // ── Upper outer walls ──
    this._box(5.9, WALL_H, WALL_T, -3.15, wallY(U), -4.09, this._mat(P.master), { room: 'master_bedroom' });
    this._box(6.9, WALL_H, WALL_T, 2.75, wallY(U), -4.09, this._mat(P.kids), { room: 'kids_room' });
    this._box(WALL_T, WALL_H, 4.4, -6.09, wallY(U), -1.9, this._mat(P.master), { room: 'master_bedroom' });
    this._box(WALL_T, WALL_H, 3.9, -6.09, wallY(U), 2.15, this._mat(P.study), { room: 'study_room' });
    // Partition master|kids — half wall (game-cutaway style)
    this._box(WALL_T, 1.0, 4.3, -0.5, U + 0.5, -1.85, this._mat(P.partition), { room: 'master_bedroom' });
    // Long partition between bedrooms row and study/bath/terrace row
    this._box(7.7, WALL_H, WALL_T, -2.35, wallY(U), 0.3, this._mat(P.partition), { room: 'study_room' });
    this._box(4.7, WALL_H, WALL_T, 3.85, wallY(U), 0.3, this._mat(P.porch), { room: 'balcony' });
    // Partition study|bath — half wall
    this._box(WALL_T, 1.0, 3.7, -1.5, U + 0.5, 2.15, this._mat(P.partition), { room: 'study_room' });
    // Partition bath|terrace — low tiled wall so the tub stays visible
    this._box(WALL_T, 0.6, 3.7, 1.5, U + 0.3, 2.15, this._mat(P.bath), { room: 'bath' });
    // Upper open-edge stubs
    this._box(4.5, STUB_H, WALL_T, -3.75, U + STUB_H / 2, 4.05, this._mat(P.study));
    this._box(3.0, STUB_H, WALL_T, 0.0, U + STUB_H / 2, 4.05, this._mat(P.bath));
    this._box(WALL_T, STUB_H, 4.3, 6.05, U + STUB_H / 2, -1.85, this._mat(P.kids));
    // Terrace railing (cream posts + top rail)
    const railMat = this._mat(0xf5ecd9);
    this._box(4.7, 0.08, 0.08, 3.8, U + 0.72, 4.02, railMat);
    this._box(0.08, 0.08, 3.8, 6.02, U + 0.72, 2.15, railMat);
    for (let x = 1.7; x <= 5.9; x += 0.6) this._box(0.07, 0.72, 0.07, x, U + 0.36, 4.02, railMat);
    for (let z = 0.5; z <= 3.9; z += 0.6) this._box(0.07, 0.72, 0.07, 6.02, U + 0.36, z, railMat);

    // Wall-top cornice trim on back walls
    const trim = this._mat(0xf5ecd9);
    this._box(12.8, 0.14, 0.3, 0, U + WALL_H + 0.07, -4.09, trim);
    this._box(0.3, 0.14, 8.8, -6.09, U + WALL_H + 0.07, 0, trim);

    // Windows on back walls (flat frames + sky-blue glass, game style)
    const frameMat = this._mat(0xf7f2e6);
    const glassMat = new THREE.MeshStandardMaterial({ color: 0xa8d8e8, roughness: 0.4, metalness: 0.1 });
    const addWindow = (x, y, z, rotY = 0, w = 1.3, h = 1.15) => {
      const g = new THREE.Group();
      const frame = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.1), frameMat);
      const glass = new THREE.Mesh(new THREE.BoxGeometry(w - 0.18, h - 0.18, 0.11), glassMat);
      const barV = new THREE.Mesh(new THREE.BoxGeometry(0.06, h - 0.18, 0.12), frameMat);
      const barH = new THREE.Mesh(new THREE.BoxGeometry(w - 0.18, 0.06, 0.12), frameMat);
      g.add(frame, glass, barV, barH);
      g.position.set(x, y, z);
      g.rotation.y = rotY;
      g.traverse((m) => { m.castShadow = false; m.receiveShadow = false; });
      this.scene.add(g);
    };
    // Ground north (living, kitchen)
    addWindow(-4.4, G + 1.5, -4.0);
    addWindow(2.6, G + 1.6, -4.0, 0, 1.1, 0.9);
    // Ground west (living)
    addWindow(-6.0, G + 1.5, 1.6, Math.PI / 2);
    // Upper north (master, kids)
    addWindow(-4.4, U + 1.5, -4.0);
    addWindow(3.9, U + 1.5, -4.0);
    // Upper west (study)
    addWindow(-6.0, U + 1.5, 2.6, Math.PI / 2);

    // Picture frames (flat color blocks) for coziness
    const addFrame = (x, y, z, rotY, w, h, canvasColor) => {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.06), this._mat(0x9c6b3f)));
      const art = new THREE.Mesh(new THREE.BoxGeometry(w - 0.12, h - 0.12, 0.07), this._mat(canvasColor));
      g.add(art);
      g.position.set(x, y, z); g.rotation.y = rotY;
      this.scene.add(g);
    };
    addFrame(-1.4, G + 1.7, -3.98, 0, 0.7, 0.55, 0xe8b84b);
    addFrame(-6.0, G + 1.8, -1.2, Math.PI / 2, 0.6, 0.75, 0x7fb069);
    addFrame(-1.9, U + 1.7, -3.98, 0, 0.65, 0.5, 0x5d7fc4);

    // Dim overlays per room (theatrical light-off for power cut)
    for (const roomId of SIM_ROOMS) {
      const r = ROOMS[roomId];
      const w = r.x1 - r.x0 - 0.1, d = r.z1 - r.z0 - 0.1;
      const dim = new THREE.Mesh(
        new THREE.BoxGeometry(w, WALL_H - 0.05, d),
        new THREE.MeshBasicMaterial({ color: 0x101822, transparent: true, opacity: 0, depthWrite: false })
      );
      dim.position.set((r.x0 + r.x1) / 2, r.y + WALL_H / 2, (r.z0 + r.z1) / 2);
      dim.visible = false;
      dim.raycast = () => {};
      this.scene.add(dim);
      this.roomDimmers.set(roomId, dim);
    }
  }

  _buildGarden() {
    // Grass platform + soil base
    const grass = this._box(28, 0.5, 22, 0, -0.98, 0.6, this._mat(P.grass), { shadow: false });
    grass.receiveShadow = true;
    this._box(28.4, 0.5, 22.4, 0, -1.48, 0.6, this._mat(P.soil), { shadow: false });

    // Path from front door to garden edge
    const pathMat = this._mat(P.pathTan);
    for (let i = 0; i < 5; i++) {
      this._box(1.5, 0.08, 1.15, 3.3, -0.7, 4.7 + i * 1.3, pathMat, { shadow: false });
    }

    // Picket fence ring (simple posts + rails, warm white)
    const fenceMat = this._mat(0xf7f0e0);
    const fy = -0.73 + 0.36;
    const ring = [
      { x0: -13.6, x1: 2.4, z: 11.2, axis: 'x' },  // front-left of gate
      { x0: 4.2, x1: 13.6, z: 11.2, axis: 'x' },   // front-right of gate
      { x0: -13.6, x1: 13.6, z: -10.0, axis: 'x' },
      { z0: -10.0, z1: 11.2, x: -13.6, axis: 'z' },
      { z0: -10.0, z1: 11.2, x: 13.6, axis: 'z' },
    ];
    for (const seg of ring) {
      if (seg.axis === 'x') {
        const len = seg.x1 - seg.x0;
        this._box(len, 0.07, 0.07, seg.x0 + len / 2, fy + 0.22, seg.z, fenceMat, { shadow: false });
        this._box(len, 0.07, 0.07, seg.x0 + len / 2, fy - 0.08, seg.z, fenceMat, { shadow: false });
        for (let x = seg.x0; x <= seg.x1; x += 0.85) {
          this._box(0.09, 0.75, 0.09, x, fy, seg.z, fenceMat, { shadow: false });
        }
      } else {
        const len = seg.z1 - seg.z0;
        this._box(0.07, 0.07, len, seg.x, fy + 0.22, seg.z0 + len / 2, fenceMat, { shadow: false });
        this._box(0.07, 0.07, len, seg.x, fy - 0.08, seg.z0 + len / 2, fenceMat, { shadow: false });
        for (let z = seg.z0; z <= seg.z1; z += 0.85) {
          this._box(0.09, 0.75, 0.09, seg.x, fy, z, fenceMat, { shadow: false });
        }
      }
    }
  }

  /** Small primitive props for devices without a kit model */
  _buildDeviceProps() {
    const white = this._mat(0xf5f2ea);
    const dark = this._mat(0x3a4450);

    // AC unit on living west wall
    this._box(0.24, 0.42, 1.3, -5.88, G + 2.1, 1.8, white, { room: 'living_room' });
    // Water purifier on kitchen north wall
    this._box(0.5, 0.62, 0.24, 5.0, G + 1.7, -3.82, white, { room: 'kitchen' });
    // Inverter box in kitchen corner
    this._box(0.7, 0.85, 0.45, 5.6, G + 0.43, 0.05, dark, { room: 'kitchen' });
    // Geyser cylinder in bath
    const geyser = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.62, 20), white);
    geyser.rotation.z = Math.PI / 2;
    geyser.position.set(0.45, U + 1.95, 0.62);
    geyser.castShadow = true;
    this.roomGroups.get('bath').add(geyser);
    // Camera on terrace pole
    this._box(0.08, 1.9, 0.08, 2.0, U + 0.95, 3.7, this._mat(0x8a94a0), { room: 'balcony' });
    this._box(0.34, 0.2, 0.2, 2.0, U + 1.95, 3.62, dark, { room: 'balcony' });
    // Water tank on terrace (the classic Indian rooftop Sintex)
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.95, 24), this._mat(0x39424e));
    tank.position.set(5.5, U + 0.75, 0.62);
    tank.castShadow = true;
    this.roomGroups.get('balcony').add(tank);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.14, 20), this._mat(0x525f6e));
    lid.position.set(5.5, U + 1.28, 0.62);
    this.roomGroups.get('balcony').add(lid);
  }

  // ═══════════════════════════════════════════════════════════════
  // Model loading
  // ═══════════════════════════════════════════════════════════════

  _loadModel(kit, name) {
    const path = `/models/kenney/${kit}/${name}.glb`;
    if (!this._modelCache.has(path)) {
      const loader = new GLTFLoader();
      this._modelCache.set(path, new Promise((resolve, reject) => {
        loader.load(path, (gltf) => resolve(gltf.scene), undefined, reject);
      }));
    }
    return this._modelCache.get(path).then((scene) => {
      const clone = scene.clone(true);
      clone.traverse((o) => {
        if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
      });
      // Kenney models have corner origins — recenter to XZ center, feet at y=0,
      // wrapped in a holder so position/rotation in the manifest behave naturally.
      const box = new THREE.Box3().setFromObject(clone);
      const center = box.getCenter(new THREE.Vector3());
      clone.position.x -= center.x;
      clone.position.z -= center.z;
      clone.position.y -= box.min.y;
      const holder = new THREE.Group();
      holder.add(clone);
      return holder;
    });
  }

  _loadFurniture() {
    for (const item of FURNITURE) {
      const [kit, name, x, z, fy, rot, scale, roomId, yOff = 0] = item;
      this._loadModel(kit, name).then((model) => {
        model.position.set(x, fy + 0.07 + yOff, z);
        model.rotation.y = THREE.MathUtils.degToRad(rot);
        model.scale.setScalar(scale);
        const group = this.roomGroups.get(roomId) || this.roomGroups.get('living_room');
        group.add(model);
      }).catch(() => {});
    }
  }

  _loadGarden() {
    const brightGreen = new THREE.Color(0x6fbf63);
    for (const [name, x, z, rot, scale] of GARDEN) {
      this._loadModel('nature', name).then((model) => {
        model.position.set(x, -0.73, z);
        model.rotation.y = THREE.MathUtils.degToRad(rot);
        model.scale.setScalar(scale);
        // Kenney foliage greens read dark under ACES — juice them up
        const seen = new Set();
        model.traverse((o) => {
          if (!o.isMesh || !o.material) return;
          if (!seen.has(o.material.uuid)) {
            o.material = o.material.clone();
            seen.add(o.material.uuid);
          }
          const c = o.material.color;
          if (c && c.g > c.r && c.g > c.b) c.lerp(brightGreen, 0.45);
        });
        this.scene.add(model);
      }).catch(() => {});
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // DOM overlays: badges, labels, chrome
  // ═══════════════════════════════════════════════════════════════

  _initializeDeviceStates() {
    for (const deviceId of Object.keys(DEVICE_ANCHORS)) {
      const defaults = DEVICE_DEFAULT_STATES[deviceId];
      const isSmartLight = deviceId.startsWith('smart_lights_');
      this.deviceStates.set(deviceId, { active: defaults ? defaults.active : isSmartLight });
    }
  }

  _buildDeviceBadges() {
    for (const [deviceId, anchor] of Object.entries(DEVICE_ANCHORS)) {
      const meta = DEVICE_META[deviceId] ||
        { icon: 'bulb', label: 'Light' };
      const roomName = ROOMS[anchor.room]?.name || anchor.room;

      const holder = document.createElement('div');
      holder.className = 'iso-anchor';

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'fp-device';
      btn.dataset.deviceId = deviceId;
      btn.title = `${meta.label} in ${roomName}`;
      btn.setAttribute('aria-label', `${meta.label} in ${roomName}`);
      btn.innerHTML = `
        <span class="fp-device-icon" aria-hidden="true">${iconSvg(meta.icon)}</span>
        <span class="fp-device-label">${meta.label}</span>
      `;
      btn.addEventListener('click', (e) => this._onDeviceClick(deviceId, e));
      holder.appendChild(btn);

      const obj = new CSS2DObject(holder);
      obj.position.set(...anchor.pos);
      this.scene.add(obj);

      this.deviceEls.set(deviceId, btn);
      this.deviceAnchors.set(deviceId, obj);
      this._applyDeviceState(deviceId);
    }
  }

  _buildRoomLabels() {
    for (const roomId of SIM_ROOMS) {
      const r = ROOMS[roomId];
      const el = document.createElement('span');
      el.className = 'iso-room-label';
      el.textContent = r.name;
      const obj = new CSS2DObject(el);
      obj.position.set(r.x0 + 0.95, r.y + 0.16, r.z1 - 0.35);
      this.scene.add(obj);
    }
  }

  /** Header title + family legend as DOM overlays on the container */
  _buildChrome() {
    const title = document.createElement('div');
    title.className = 'fp-house-title';
    title.innerHTML = `
      <span class="fp-title-small">Sharma Smart Home</span>
      <strong>Alexa Thinks Ahead</strong>
    `;
    this.container.appendChild(title);

    const legend = document.createElement('div');
    legend.className = 'fp-legend';
    legend.innerHTML = `
      <span class="fp-legend-title">Family</span>
      ${Object.entries(AVATAR_COLORS).map(([id, color]) => {
        const name = id.charAt(0).toUpperCase() + id.slice(1);
        const hex = `#${color.toString(16).padStart(6, '0')}`;
        return `<span class="fp-legend-item"><span class="fp-legend-dot" style="background:${hex}">${name.charAt(0)}</span>${name}</span>`;
      }).join('')}
    `;
    this.container.appendChild(legend);
  }

  _buildAvatars() {
    for (const [memberId, color] of Object.entries(AVATAR_COLORS)) {
      const group = new THREE.Group();
      const mat = this._mat(color, { roughness: 0.7 });
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.155, 0.3, 6, 14), mat);
      body.position.y = 0.42;
      body.castShadow = true;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.145, 16, 14), this._mat(0xf0c8a0, { roughness: 0.7 }));
      head.position.y = 0.82;
      head.castShadow = true;
      group.add(body, head);
      if (memberId === 'dadaji' || memberId === 'dadiji') {
        const hair = new THREE.Mesh(
          new THREE.SphereGeometry(0.15, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.45),
          this._mat(0xeeeeee, { roughness: 0.8 })
        );
        hair.position.y = 0.86;
        group.add(hair);
      }
      const displayName = memberId.charAt(0).toUpperCase() + memberId.slice(1);
      const tag = document.createElement('span');
      tag.className = 'iso-avatar-tag';
      tag.textContent = displayName;
      const tagObj = new CSS2DObject(tag);
      tagObj.position.set(0, 1.12, 0);
      group.add(tagObj);

      group.visible = false;
      this.scene.add(group);
      this.avatars.set(memberId, { group, target: new THREE.Vector3(), room: null, tag });
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Public API (FloorPlan2D-compatible)
  // ═══════════════════════════════════════════════════════════════

  updateAvatars(timeMinutes) {
    for (const [memberId, schedule] of Object.entries(FAMILY_SCHEDULE)) {
      const av = this.avatars.get(memberId);
      if (!av) continue;
      const entry = schedule.find((s) => timeMinutes >= s.start && timeMinutes < s.end);
      const roomId = entry ? entry.room : null;

      if (!roomId || !ROOMS[roomId]) {
        av.room = null;
        av.group.visible = false;
        continue;
      }
      if (av.room !== roomId) {
        av.room = roomId;
        const r = ROOMS[roomId];
        const spots = AVATAR_SPOTS[roomId] || [[(r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2]];
        let hash = 0;
        for (let i = 0; i < memberId.length; i++) hash = (hash * 31 + memberId.charCodeAt(i)) | 0;
        const spot = spots[Math.abs(hash) % spots.length];
        const jx = ((Math.abs(hash >> 8) % 40) - 20) / 100;
        const jz = ((Math.abs(hash >> 16) % 40) - 20) / 100;
        av.target.set(spot[0] + jx, r.y + 0.07, spot[1] + jz);
        if (!av.group.visible) {
          av.group.position.copy(av.target);
          av.group.visible = true;
        }
      }
    }
  }

  updateLighting(timeMinutes) {
    this._lastTime = timeMinutes;
    let warmth = 0;
    if (timeMinutes < 360) warmth = 0;
    else if (timeMinutes < 420) warmth = (timeMinutes - 360) / 60;
    else if (timeMinutes < 1020) warmth = 1;
    else if (timeMinutes < 1080) warmth = 1 - (timeMinutes - 1020) / 60;
    else warmth = 0;
    this._warmth = warmth;

    // Day: bright warm sun. Night: cozy dusk with lamps on (never gloomy).
    this.sun.intensity = 0.95 + warmth * 0.55;
    this.sun.color.setHex(warmth > 0.5 ? 0xfff2dc : 0xe8ecf5);
    this.hemi.intensity = 0.8 + warmth * 0.16;
    const lampGlow = (1 - warmth) * 0.45 + 0.5;
    for (const [roomId, light] of this.roomLights) {
      if (!this._powerCutRooms || this._powerCutRooms.has(roomId)) {
        light.intensity = lampGlow;
      }
    }
  }

  highlightDevice(deviceId, duration = 2000) {
    const resolvedId = DEVICE_ALIASES[deviceId] || deviceId;
    const el = this.deviceEls.get(resolvedId);
    if (!el) return;
    el.classList.add('device-highlight');
    this._spawnThinkChip(el.parentElement);
    // warm flash of the room light
    const anchor = DEVICE_ANCHORS[resolvedId];
    if (anchor) {
      const light = this.roomLights.get(anchor.room);
      if (light) {
        const base = light.intensity;
        light.intensity = Math.max(base, 1.15);
        setTimeout(() => { light.intensity = base; }, duration);
      }
    }
    setTimeout(() => el.classList.remove('device-highlight'), duration);
  }

  showSpeechBubble(deviceId, text, duration = 5000) {
    const resolvedId = DEVICE_ALIASES[deviceId] || deviceId;
    const el = this.deviceEls.get(resolvedId);
    if (!el) return;
    const holder = el.parentElement;

    const existing = this.speechBubbles.get(resolvedId);
    if (existing) existing.remove();

    const bubble = document.createElement('div');
    bubble.className = 'fp-speech-bubble';
    bubble.textContent = text;
    holder.appendChild(bubble);
    this.speechBubbles.set(resolvedId, bubble);

    requestAnimationFrame(() => bubble.classList.add('visible'));
    setTimeout(() => {
      bubble.classList.remove('visible');
      setTimeout(() => {
        bubble.remove();
        this.speechBubbles.delete(resolvedId);
      }, 300);
    }, duration);
  }

  show(target, text, duration = 5000) {
    const deviceId = typeof target === 'string' ? target : 'echo_living';
    this.showSpeechBubble(deviceId, text, duration);
  }

  dimRooms(roomsToKeepLit) {
    this._powerCutRooms = new Set(roomsToKeepLit);
    for (const roomId of SIM_ROOMS) {
      const dim = this.roomDimmers.get(roomId);
      const light = this.roomLights.get(roomId);
      if (roomsToKeepLit.includes(roomId)) {
        if (light) light.intensity = 1.0;
      } else {
        if (dim) { dim.visible = true; dim.material.opacity = 0.5; }
        if (light) light.intensity = 0;
      }
    }
  }

  restoreAll() {
    this._powerCutRooms = null;
    for (const roomId of SIM_ROOMS) {
      const dim = this.roomDimmers.get(roomId);
      if (dim) { dim.visible = false; dim.material.opacity = 0; }
    }
    this.updateLighting(this._lastTime ?? 720);
    for (const [, el] of this.deviceEls) {
      el.classList.remove('device-highlight', 'inverter-active');
    }
  }

  restoreRooms() { this.restoreAll(); }

  powerCutFlicker() {
    const overlay = document.getElementById('flicker-overlay');
    if (!overlay) return;
    overlay.style.display = 'block';
    overlay.style.opacity = '0';
    const duration = 800, flickerCount = 4;
    const cycleTime = duration / flickerCount;
    const startTime = performance.now();
    const animate = () => {
      const elapsed = performance.now() - startTime;
      if (elapsed >= duration) {
        overlay.style.display = 'none';
        overlay.style.opacity = '0';
        return;
      }
      const idx = Math.floor(elapsed / cycleTime);
      overlay.style.opacity = idx % 2 === 0 ? '0.35' : '0';
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
    const anchor = DEVICE_ANCHORS[resolvedId];
    if (!anchor) return undefined;
    const v = new THREE.Vector3(...anchor.pos).project(this.camera);
    const w = this.container.clientWidth, h = this.container.clientHeight;
    const pos = { x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h };
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
    for (const roomId of SIM_ROOMS) lights.push({ roomId, lightMesh: { material: {} } });
    return lights;
  }

  // ═══════════════════════════════════════════════════════════════
  // Interaction
  // ═══════════════════════════════════════════════════════════════

  _bindPicking() {
    this._raycaster = new THREE.Raycaster();
    this._pointer = new THREE.Vector2();
    const canvas = this.renderer.domElement;

    const pick = (e) => {
      const rect = canvas.getBoundingClientRect();
      this._pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this._pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this._raycaster.setFromCamera(this._pointer, this.camera);
      const floors = Array.from(this.roomFloors.values());
      const hits = this._raycaster.intersectObjects(floors, false);
      return hits.length ? hits[0].object.userData.roomId : null;
    };

    canvas.addEventListener('pointermove', (e) => {
      canvas.style.cursor = pick(e) ? 'pointer' : 'default';
    });
    canvas.addEventListener('click', (e) => {
      const roomId = pick(e);
      if (roomId) this._onRoomClick(roomId);
    });
  }

  _onRoomClick(roomId) {
    const r = ROOMS[roomId];
    if (!r) return;
    const devices = Object.entries(DEVICE_ANCHORS)
      .filter(([, a]) => a.room === roomId)
      .map(([id]) => ({
        id,
        icon: (DEVICE_META[id] || { icon: 'bulb' }).icon,
        label: (DEVICE_META[id] || { label: 'Light' }).label,
        status: this._getDeviceStateLabel(id),
      }));
    const people = [];
    for (const [memberId, av] of this.avatars) {
      if (av.room === roomId) people.push(memberId.charAt(0).toUpperCase() + memberId.slice(1));
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
    info.className = 'fp-room-info glass-panel';
    info.innerHTML = `
      <h3>${roomName}</h3>
      <div class="fp-room-info-section">
        <strong>Components</strong>
        <div class="fp-room-info-devices">
          ${devices.length ? devices.map((d) => `
            <button type="button" class="fp-component-row" data-device-id="${d.id}">
              <span class="fp-component-row-icon" aria-hidden="true">${iconSvg(d.icon, 14)}</span>
              <span class="fp-component-row-label">${d.label}</span>
              <span class="fp-component-row-status">${d.status}</span>
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
    info.addEventListener('click', (e) => {
      const row = e.target.closest('[data-device-id]');
      if (row) this._onDeviceClick(row.dataset.deviceId, e);
    });
    this.container.appendChild(info);
  }

  _onDeviceClick(deviceId, event) {
    event?.stopPropagation();
    const resolvedId = DEVICE_ALIASES[deviceId] || deviceId;
    if (!DEVICE_ANCHORS[resolvedId]) return;
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
    const anchor = DEVICE_ANCHORS[deviceId];
    const meta = DEVICE_META[deviceId] || { icon: 'bulb', label: 'Light' };
    const room = ROOMS[anchor.room];
    const stateLabel = this._getDeviceStateLabel(deviceId);

    const info = document.createElement('div');
    info.className = 'fp-component-info glass-panel';
    info.innerHTML = `
      <button class="fp-room-info-close" type="button" aria-label="Close">✕</button>
      <div class="fp-component-info-heading">
        <span class="fp-component-info-icon" aria-hidden="true">${iconSvg(meta.icon, 17)}</span>
        <div>
          <h3>${meta.label}</h3>
          <p>${room?.name || anchor.room}</p>
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
    info.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      if (btn.dataset.action === 'toggle') this._toggleDeviceState(deviceId);
      else this.showSpeechBubble(deviceId, `${meta.label} is ${this._getDeviceStateLabel(deviceId)}.`, 3000);
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

  _spawnThinkChip(holder) {
    if (!holder) return;
    const existing = holder.querySelector('.fp-think-chip');
    if (existing) existing.remove();
    const chip = document.createElement('span');
    chip.className = 'fp-think-chip';
    chip.innerHTML = `<i></i>Thinking…`;
    holder.appendChild(chip);
    setTimeout(() => chip.remove(), 2400);
  }

  // ═══════════════════════════════════════════════════════════════
  // Animation loop
  // ═══════════════════════════════════════════════════════════════

  _animate() {
    requestAnimationFrame(() => this._animate());
    const dt = Math.min(this._clock.getDelta(), 0.1);
    const t = this._clock.elapsedTime;

    // Avatars glide toward their targets with a tiny walk-bob
    for (const [, av] of this.avatars) {
      if (!av.group.visible) continue;
      const dist = av.group.position.distanceTo(av.target);
      if (dist > 0.02) {
        av.group.position.lerp(av.target, Math.min(1, dt * 3.2));
        av.group.position.y = av.target.y + Math.abs(Math.sin(t * 9)) * Math.min(0.05, dist * 0.05);
      } else {
        av.group.position.y = av.target.y;
      }
    }

    this.renderer.render(this.scene, this.camera);
    this.labelRenderer.render(this.scene, this.camera);
  }

  // ═══════════════════════════════════════════════════════════════
  // Styles
  // ═══════════════════════════════════════════════════════════════

  _injectStyles() {
    if (document.getElementById('iso-house-styles')) return;
    const style = document.createElement('style');
    style.id = 'iso-house-styles';
    style.textContent = `
      .iso-wrap {
        position: relative;
        width: 100%;
        height: 100%;
        overflow: hidden;
      }

      .iso-wrap canvas { display: block; }

      .iso-anchor {
        position: relative;
        pointer-events: none;
      }

      /* ── Header ─────────────────────────────────────────────── */
      .fp-house-title {
        position: absolute;
        top: 14px;
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
        color: #5f6b78;
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.14em;
        text-shadow: 0 0 6px rgba(247, 246, 243, 0.95), 0 0 14px rgba(247, 246, 243, 0.9);
      }

      .fp-house-title strong {
        font-size: 28px;
        font-weight: 600;
        color: #1F2933;
        letter-spacing: -0.01em;
        text-shadow: 0 0 8px rgba(247, 246, 243, 0.95), 0 0 18px rgba(247, 246, 243, 0.9), 0 0 28px rgba(247, 246, 243, 0.8);
      }

      /* ── Device badges (CSS2D anchored) ─────────────────────── */
      .fp-device {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 26px;
        height: 26px;
        padding: 0;
        border: 1.5px solid #C5C1B8;
        border-radius: 50%;
        background: #FFFFFF;
        color: #7B8794;
        font: inherit;
        font-family: 'Inter', system-ui, sans-serif;
        cursor: pointer;
        pointer-events: auto;
        box-shadow: 0 1px 2px rgba(31, 41, 51, 0.14);
        transition: border-color 0.2s ease, background 0.2s ease, color 0.2s ease, transform 0.2s ease;
      }

      .fp-device-icon {
        display: flex;
        align-items: center;
        justify-content: center;
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
        transform: scale(1.14);
      }

      .fp-device.is-off {
        background: #FFFFFF;
        border-color: #C5C1B8;
        color: #A5AEB8;
      }

      .fp-device.device-highlight {
        background: #F5A623 !important;
        border-color: #F5A623 !important;
        color: #FFFFFF !important;
        animation: iso-device-pulse 1.5s ease-in-out infinite;
      }

      @keyframes iso-device-pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.16); }
      }

      .fp-device.inverter-active {
        background: #2E7CF6;
        border-color: #2E7CF6;
        color: #FFFFFF;
        animation: iso-device-pulse 1.5s ease-in-out infinite;
      }

      .fp-think-chip {
        position: absolute;
        bottom: calc(100% + 20px);
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
        font-family: 'Inter', system-ui, sans-serif;
        white-space: nowrap;
        pointer-events: none;
        z-index: 12;
        animation: iso-think-float 2.4s ease-out forwards;
      }

      .fp-think-chip i {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #F5A623;
      }

      @keyframes iso-think-float {
        0% { opacity: 0; transform: translate(-50%, 8px); }
        14% { opacity: 1; transform: translate(-50%, 0); }
        72% { opacity: 1; transform: translate(-50%, -14px); }
        100% { opacity: 0; transform: translate(-50%, -24px); }
      }

      .fp-speech-bubble {
        position: absolute;
        bottom: calc(100% + 16px);
        left: 50%;
        transform: translateX(-50%) translateY(8px);
        background: #FFFFFF;
        border: 1px solid #E3E1DC;
        border-radius: 10px;
        padding: 7px 11px;
        font-size: 12px;
        font-family: 'Inter', system-ui, sans-serif;
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

      /* ── Room labels + avatar tags ──────────────────────────── */
      .iso-room-label {
        padding: 3px 8px;
        border-radius: 6px;
        background: rgba(255, 255, 255, 0.92);
        border: 1px solid #E3E1DC;
        color: #1F2933;
        font-size: 11px;
        font-weight: 500;
        font-family: 'Inter', system-ui, sans-serif;
        pointer-events: none;
        white-space: nowrap;
        box-shadow: 0 1px 2px rgba(31, 41, 51, 0.08);
      }

      .iso-avatar-tag {
        padding: 1px 7px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.94);
        border: 1px solid #E3E1DC;
        color: #1F2933;
        font-size: 10px;
        font-weight: 600;
        font-family: 'Inter', system-ui, sans-serif;
        pointer-events: none;
        white-space: nowrap;
      }

      /* ── Legend ─────────────────────────────────────────────── */
      .fp-legend {
        position: absolute;
        left: 16px;
        bottom: 12px;
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
        max-width: 300px;
        font-family: 'Inter', system-ui, sans-serif;
      }

      /* Clear the fixed timeline bar during deployment */
      [id="3d-container"].fullscreen .fp-legend {
        bottom: 150px;
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
        animation: iso-fade-in 0.2s ease-out;
        font-family: 'Inter', system-ui, sans-serif;
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
        width: min(280px, calc(100% - 32px));
        padding: 16px;
        border-radius: 12px;
        z-index: 40;
        background: #FFFFFF;
        border: 1px solid #E3E1DC;
        box-shadow: 0 2px 2px rgba(31, 41, 51, 0.06);
        animation: iso-fade-side 0.2s ease-out;
        font-family: 'Inter', system-ui, sans-serif;
      }

      [id="3d-container"].fullscreen .fp-component-info {
        right: 356px;
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

      @keyframes iso-fade-in {
        from { opacity: 0; transform: translate(-50%, -50%) scale(0.97); }
        to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
      }

      @keyframes iso-fade-side {
        from { opacity: 0; transform: translateY(-6px); }
        to { opacity: 1; transform: translateY(0); }
      }
    `;
    document.head.appendChild(style);
  }
}
