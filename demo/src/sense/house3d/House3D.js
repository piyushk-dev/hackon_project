/**
 * House3D — "Sharma Niwas" as an architectural studio model.
 *
 * A cutaway dollhouse on a clean pedestal, lit softly against a neutral
 * gradient backdrop — muted materials, one warm accent language, no toy
 * clutter. The day/night cycle plays out in the backdrop and lighting.
 *
 * Interactive: devices and people are pickable (hover + click → onPick).
 *
 * Effects API driven by the sense engine:
 *   setTimeOfDay, setPowerCut, deviceHalo, soundRipple, setTankLevel,
 *   setMotor, setAQI, poojaGlow, spawnGuests, setFan, echoPulse,
 *   registerPickable, startIntro
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { AlexaPresence } from './AlexaPresence.js';

// ─── Floor plan (world units ~ metres, origin at house centre) ──────
export const ROOMS3D = {
  living_room:    { x: [-6, -0.5], z: [0.5, 4.5],  wall: 0x86aca8, floor: 0xefe7d5, name: 'Living Room' },
  kitchen:        { x: [0.5, 6],   z: [0.5, 4.5],  wall: 0xd6b56a, floor: 0xe8ddc6, name: 'Kitchen' },
  master_bedroom: { x: [-6, -2.5], z: [-4.5, -0.5], wall: 0xcfa0a4, floor: 0xefe7d5, name: 'Master Bedroom' },
  dadaji_room:    { x: [-2, 1.5],  z: [-4.5, -0.5], wall: 0xa8b98f, floor: 0xe8ddc6, name: "Dadaji's Room" },
  study_room:     { x: [2, 6],     z: [-4.5, -0.5], wall: 0x94aec9, floor: 0xefe7d5, name: 'Study' },
};

export function roomCenter(roomId) {
  const r = ROOMS3D[roomId];
  if (!r) return new THREE.Vector3(0, 0, 7); // porch / forecourt default
  return new THREE.Vector3((r.x[0] + r.x[1]) / 2, 0, (r.z[0] + r.z[1]) / 2);
}

// Device anchor points inside the house.
export const DEVICES3D = {
  living_room_ac: { pos: [-3.2, 1.45, 0.75], room: 'living_room' },
  smart_tv:       { pos: [-5.75, 1.1, 2.5],  room: 'living_room' },
  echo_living:    { pos: [-1.1, 0.62, 3.9],  room: 'living_room' },
  kitchen_hub:    { pos: [4.1, 0.95, 0.95],  room: 'kitchen' },
  fridge:         { pos: [5.45, 1.02, 1.35], room: 'kitchen' },
  cooker:         { pos: [2.0, 1.34, 0.95],  room: 'kitchen' },
  geyser:         { pos: [-5.55, 1.5, -4.1], room: 'master_bedroom' },
  iron:           { pos: [-4.2, 0.55, -2.5], room: 'master_bedroom' },
  echo_dadaji:    { pos: [1.1, 0.62, -4.1],  room: 'dadaji_room' },
  echo_study:     { pos: [5.6, 0.85, -4.1],  room: 'study_room' },
  inverter:       { pos: [0.05, 0.5, 1.0],   room: 'kitchen' },
  water_motor:    { pos: [7.6, 0.38, -1.9],  room: null },
  water_tank:     { pos: [7.6, 4.1, -3.0],   room: null },
  purifier:       { pos: [-0.9, 0.6, -4.0],  room: 'dadaji_room' },
};

// Backdrop gradient key stops through the day (hour → top/bottom, night 0..1)
const SKY_STOPS = [
  { h: 0.0,  top: 0x252932, bot: 0x3a3f4b, night: 1 },
  { h: 5.0,  top: 0x252932, bot: 0x3a3f4b, night: 1 },
  { h: 5.9,  top: 0x3b4668, bot: 0x64749c, night: 0.8 },
  { h: 6.4,  top: 0x93a9d4, bot: 0xf4c79a, night: 0.25 },
  { h: 8.5,  top: 0xece8df, bot: 0xd9d2c2, night: 0 },
  { h: 16.5, top: 0xece8df, bot: 0xd9d2c2, night: 0 },
  { h: 18.6, top: 0x8d92c4, bot: 0xe8b088, night: 0.2 },
  { h: 20.2, top: 0x252932, bot: 0x3a3f4b, night: 1 },
  { h: 24.0, top: 0x252932, bot: 0x3a3f4b, night: 1 },
];

const CAM_FAR = new THREE.Vector3(24, 15, 29);
const CAM_HOME = new THREE.Vector3(10.4, 7.9, 12.9);

// Named camera shots for cinema mode: [position, look-at target]
export const CAMERA_SHOTS = {
  overview:  { pos: [10.4, 7.9, 12.9], target: [0, 0.7, 0] },
  overview_high: { pos: [13, 12, 15],  target: [0, 1.4, 0] },
  alexa:     { pos: [3.2, 6.4, 7.4],   target: [0, 5.2, 0] },
  tank:      { pos: [11.5, 4.6, 2.8],  target: [7.6, 2.6, -2.6] },
  bath:      { pos: [-1.6, 4.2, 1.8],  target: [-5.2, 1.1, -3.6] },
  dadaji:    { pos: [2.4, 4.6, 2.6],   target: [-0.4, 0.7, -2.6] },
  kitchen:   { pos: [6.8, 4.4, 7.2],   target: [3.2, 0.9, 1.6] },
  mandir:    { pos: [1.6, 3.4, 8.2],   target: [-1.0, 0.9, 3.8] },
  living:    { pos: [-0.6, 4.6, 9.4],  target: [-3.2, 0.7, 2.8] },
  study:     { pos: [8.4, 4.4, 2.4],   target: [4.4, 0.8, -2.8] },
};

const WALL_H_LOW = 1.15;
const WALL_H_BACK = 2.5;
const WALL_T = 0.14;

// Studio material palette
const P = {
  exterior: 0xf1eadb,
  partition: 0xf6f0e2,
  woodDark: 0x6e523a,
  wood: 0x8b6b4a,
  charcoal: 0x35332e,
  metal: 0x5a6470,
  cream: 0xf6f1e4,
  brass: 0xc9a24a,
};

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.88, metalness: 0.02, ...opts });
}

function box(w, h, d, color, opts) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, opts));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export class House3D {
  constructor(container) {
    this.container = container;
    this._halos = [];
    this._sprites = [];
    this._fans = {};
    this._roomLights = {};
    this._guests = [];
    this._powerCut = false;
    this._aqi = 120;
    this._simMinutes = 6 * 60;
    this._clock = new THREE.Clock();
    this._skyBucket = -1;
    this._echoRings = [];
    this._intro = null;
    this.avatars = null;
    this.pickables = [];
    this.onPick = null;

    this._flight = null;

    this._initRenderer();
    this._initBackdrop();
    this._initLights();
    this._buildPedestal();
    this._buildHouse();
    this._buildFurniture();
    this._buildDevices();
    this._initPicking();

    // Alexa, visibly present above the home
    this.presence = new AlexaPresence(this.scene);

    this._animate();
  }

  /** Beam from the Alexa orb to a device (the "Alexa did this" visual). */
  alexaBeam(deviceId, colorHex) {
    const def = DEVICES3D[deviceId];
    if (!def) return;
    this.presence.beamTo(new THREE.Vector3(...def.pos), colorHex);
  }

  /** Smooth camera flight to a named shot (see CAMERA_SHOTS). */
  flyTo(shotName, durationSec = 2.2) {
    const shot = CAMERA_SHOTS[shotName];
    if (!shot) return;
    this.controls.enabled = false;
    this.controls.autoRotate = false;
    this._flight = {
      fromPos: this.camera.position.clone(),
      fromTarget: this.controls.target.clone(),
      toPos: new THREE.Vector3(...shot.pos),
      toTarget: new THREE.Vector3(...shot.target),
      start: this._clock.elapsedTime,
      dur: durationSec,
    };
  }

  /** Hand camera control back to the user (after cinema). */
  releaseCamera() {
    this._flight = null;
    this.controls.enabled = true;
    this.controls.autoRotate = true;
  }

  // ─── Renderer / camera ──────────────────────────────────────────
  _initRenderer() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(38, w / h, 0.1, 300);
    this.camera.position.copy(CAM_FAR);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 0.7, 0);
    this.controls.maxPolarAngle = Math.PI / 2.12;
    this.controls.minDistance = 7;
    this.controls.maxDistance = 36;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.autoRotate = false;
    this.controls.autoRotateSpeed = 0.22;
    this.controls.enabled = false;

    this.controls.addEventListener('start', () => { this.controls.autoRotate = false; });
    let idleTimer = null;
    this.controls.addEventListener('end', () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => { this.controls.autoRotate = true; }, 8000);
    });

    new ResizeObserver(() => {
      const cw = this.container.clientWidth, ch = this.container.clientHeight;
      if (!cw || !ch) return;
      this.camera.aspect = cw / ch;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(cw, ch);
    }).observe(this.container);
  }

  startIntro() {
    this._intro = { start: this._clock.elapsedTime };
  }

  // ─── Backdrop dome + stars ──────────────────────────────────────
  _initBackdrop() {
    this._skyCanvas = document.createElement('canvas');
    this._skyCanvas.width = 2;
    this._skyCanvas.height = 256;
    this._skyTex = new THREE.CanvasTexture(this._skyCanvas);
    const skyMat = new THREE.MeshBasicMaterial({ map: this._skyTex, side: THREE.BackSide, fog: false });
    this.skyDome = new THREE.Mesh(new THREE.SphereGeometry(120, 24, 16), skyMat);
    this.scene.add(this.skyDome);

    this.scene.fog = new THREE.Fog(0xd9d2c2, 55, 130);

    const starGeo = new THREE.BufferGeometry();
    const pts = [];
    for (let i = 0; i < 300; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(0.2 + Math.random() * 0.75);
      const r = 100;
      pts.push(r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi) + 5, r * Math.sin(phi) * Math.sin(theta));
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    this._starMat = new THREE.PointsMaterial({ color: 0xf5f0e6, size: 0.45, transparent: true, opacity: 0, fog: false });
    this.stars = new THREE.Points(starGeo, this._starMat);
    this.scene.add(this.stars);
  }

  _paintSky(topColor, botColor) {
    const ctx = this._skyCanvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#' + topColor.getHexString());
    grad.addColorStop(0.62, '#' + botColor.getHexString());
    grad.addColorStop(1, '#' + botColor.clone().lerp(topColor, 0.12).getHexString());
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 2, 256);
    this._skyTex.needsUpdate = true;
  }

  _initLights() {
    this.hemi = new THREE.HemisphereLight(0xe8e2d4, 0x8f8571, 1.0);
    this.scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight(0xfff4e0, 1.55);
    this.sun.position.set(14, 18, 8);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.left = -16;
    this.sun.shadow.camera.right = 16;
    this.sun.shadow.camera.top = 16;
    this.sun.shadow.camera.bottom = -16;
    this.sun.shadow.bias = -0.0004;
    this.scene.add(this.sun);

    // Cool fill from the opposite side keeps shadows readable
    this.fill = new THREE.DirectionalLight(0xdfe6ec, 0.35);
    this.fill.position.set(-12, 9, -10);
    this.scene.add(this.fill);

    for (const [id] of Object.entries(ROOMS3D)) {
      const light = new THREE.PointLight(0xffd9a0, 0, 7, 1.8);
      const c = roomCenter(id);
      light.position.set(c.x, 2.1, c.z);
      this.scene.add(light);
      this._roomLights[id] = light;
    }
  }

  // ─── Pedestal + floors ──────────────────────────────────────────
  _buildPedestal() {
    // Studio floor — large soft disc that fades into the backdrop
    this._studioFloor = new THREE.Mesh(
      new THREE.CircleGeometry(60, 48),
      mat(0xd9d2c2, { roughness: 1 })
    );
    this._studioFloor.rotation.x = -Math.PI / 2;
    this._studioFloor.position.y = -0.42;
    this._studioFloor.receiveShadow = true;
    this.scene.add(this._studioFloor);

    // Two-step pedestal
    const base = box(16.2, 0.3, 13.0, 0xe4dccb);
    base.position.set(0, -0.26, 0);
    base.receiveShadow = true;
    this.scene.add(base);
    const plinth = box(13.6, 0.32, 10.6, 0xd9cfb8);
    plinth.position.set(0, 0.02, 0);
    plinth.receiveShadow = true;
    this.scene.add(plinth);

    // Room floors
    for (const r of Object.values(ROOMS3D)) {
      const fw = r.x[1] - r.x[0], fd = r.z[1] - r.z[0];
      const f = new THREE.Mesh(new THREE.BoxGeometry(fw, 0.08, fd), mat(r.floor, { roughness: 0.72 }));
      f.position.set((r.x[0] + r.x[1]) / 2, 0.2, (r.z[0] + r.z[1]) / 2);
      f.receiveShadow = true;
      this.scene.add(f);
    }
    const corridor = new THREE.Mesh(new THREE.BoxGeometry(12, 0.08, 1), mat(0xf2ead8, { roughness: 0.72 }));
    corridor.position.set(0, 0.2, 0);
    corridor.receiveShadow = true;
    this.scene.add(corridor);
    const porch = new THREE.Mesh(new THREE.BoxGeometry(12, 0.12, 1.6), mat(0xdfd4bc));
    porch.position.set(0, 0.2, 5.4);
    porch.receiveShadow = true;
    this.scene.add(porch);
  }

  _wall(x, y, z, w, h, d, color) {
    const m = box(w, h, d, color);
    m.position.set(x, y + h / 2, z);
    this.scene.add(m);
    return m;
  }

  _buildHouse() {
    const Y = 0.24;

    // Back exterior wall — full height, with muted room-colour strips inside
    this._wall(0, Y, -4.5 - WALL_T / 2, 12 + WALL_T * 2, WALL_H_BACK, WALL_T, P.exterior);
    for (const id of ['master_bedroom', 'dadaji_room', 'study_room']) {
      const r = ROOMS3D[id];
      const w = r.x[1] - r.x[0] - 0.1;
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(w, WALL_H_BACK - 0.1), mat(r.wall, { roughness: 0.95 }));
      strip.position.set((r.x[0] + r.x[1]) / 2, Y + WALL_H_BACK / 2, -4.5 + 0.01);
      this.scene.add(strip);
    }
    for (const wx of [-4.2, -0.2, 4]) {
      const win = new THREE.Mesh(
        new THREE.PlaneGeometry(1.3, 0.9),
        new THREE.MeshBasicMaterial({ color: 0xcfe6ee }) // always reads as daylight glass
      );
      win.position.set(wx, Y + 1.5, -4.5 + 0.02);
      this.scene.add(win);
      const frame = box(1.45, 1.05, 0.04, P.woodDark);
      frame.position.set(wx, Y + 1.5, -4.5 + 0.005);
      this.scene.add(frame);
    }

    // Side + front walls — low (cutaway)
    this._wall(-6 - WALL_T / 2, Y, 0, WALL_T, WALL_H_LOW, 9 + WALL_T, P.exterior);
    this._wall(6 + WALL_T / 2, Y, 0, WALL_T, WALL_H_LOW, 9 + WALL_T, P.exterior);
    this._wall(-3.45, Y, 4.5 + WALL_T / 2, 5.1, WALL_H_LOW, WALL_T, P.exterior);
    this._wall(3.45, Y, 4.5 + WALL_T / 2, 5.1, WALL_H_LOW, WALL_T, P.exterior);

    // Main door with a restrained marigold garland — the one festive accent
    const frameL = box(0.12, 2.1, 0.2, P.woodDark); frameL.position.set(-0.95, Y + 1.05, 4.55); this.scene.add(frameL);
    const frameR = box(0.12, 2.1, 0.2, P.woodDark); frameR.position.set(0.95, Y + 1.05, 4.55); this.scene.add(frameR);
    const lintel = box(2.0, 0.14, 0.2, P.woodDark); lintel.position.set(0, Y + 2.12, 4.55); this.scene.add(lintel);
    const door = box(0.9, 1.95, 0.06, 0x96683f);
    door.position.set(-0.5, Y + 0.98, 4.9);
    door.rotation.y = -Math.PI / 3;
    this.scene.add(door);
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      const gx = -0.9 + t * 1.8;
      const gy = Y + 2.05 - Math.sin(t * Math.PI) * 0.2;
      const flower = new THREE.Mesh(new THREE.SphereGeometry(0.048, 8, 8), mat(i % 2 ? 0xd9912b : 0xc06a1d, { roughness: 0.6 }));
      flower.position.set(gx, gy, 4.62);
      this.scene.add(flower);
    }

    // Tulsi pot on the porch — the second and last accent
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.32, 12), mat(0xa9603f));
    pot.position.set(1.8, Y + 0.2, 5.4);
    pot.castShadow = true;
    this.scene.add(pot);
    const tulsi = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 10), mat(0x5c7748));
    tulsi.position.set(1.8, Y + 0.5, 5.4);
    this.scene.add(tulsi);

    // Partition walls
    this._wall(0, Y, 2.9, WALL_T, WALL_H_LOW, 3.2, P.partition);
    this._wall(-4.4, Y, 0.5, 3.2, WALL_H_LOW, WALL_T, P.partition);
    this._wall(3.9, Y, 0.5, 4.2, WALL_H_LOW, WALL_T, P.partition);
    this._wall(-4.9, Y, -0.5, 2.2, WALL_H_LOW, WALL_T, P.partition);
    this._wall(-0.2, Y, -0.5, 2.4, WALL_H_LOW, WALL_T, P.partition);
    this._wall(4.6, Y, -0.5, 2.8, WALL_H_LOW, WALL_T, P.partition);
    this._wall(-2.25, Y, -2.5, WALL_T, WALL_H_LOW, 4, P.partition);
    this._wall(1.75, Y, -2.5, WALL_T, WALL_H_LOW, 4, P.partition);

    // Name board — quiet, engraved look
    const boardCanvas = document.createElement('canvas');
    boardCanvas.width = 512; boardCanvas.height = 128;
    const bctx = boardCanvas.getContext('2d');
    bctx.fillStyle = '#155450';
    bctx.fillRect(0, 0, 512, 128);
    bctx.strokeStyle = 'rgba(246,241,228,0.55)'; bctx.lineWidth = 4; bctx.strokeRect(10, 10, 492, 108);
    bctx.fillStyle = '#f2ecdc';
    bctx.font = '600 52px Georgia';
    bctx.textAlign = 'center'; bctx.textBaseline = 'middle';
    bctx.fillText('SHARMA NIWAS', 256, 68);
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(2.2, 0.55),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(boardCanvas) })
    );
    board.position.set(2.6, Y + 1.72, 4.6);
    this.scene.add(board);
  }

  _buildFurniture() {
    const Y = 0.24;
    const add = (m, x, z, ry = 0) => { m.position.x = x; m.position.z = z; m.position.y += Y; m.rotation.y = ry; this.scene.add(m); return m; };

    // Living room
    const sofaSeat = box(2.4, 0.45, 0.9, 0x256e67); add(sofaSeat, -3.4, 3.6); sofaSeat.position.y = Y + 0.28;
    const sofaBack = box(2.4, 0.6, 0.22, 0x1d5a55); add(sofaBack, -3.4, 3.98); sofaBack.position.y = Y + 0.75;
    for (const cx of [-4.1, -3.4, -2.7]) {
      const cushion = box(0.55, 0.14, 0.6, 0xd9a441); add(cushion, cx, 3.55); cushion.position.y = Y + 0.56;
    }
    const rug = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 0.05, 24), mat(0xb0684a, { roughness: 0.95 }));
    add(rug, -3.3, 2.3); rug.position.y = Y + 0.07; rug.receiveShadow = true;
    const tvStand = box(0.35, 0.4, 1.7, P.wood); add(tvStand, -5.75, 2.5); tvStand.position.y = Y + 0.2;
    // Mandir — quiet brass-and-wood
    const mandirBase = box(0.7, 0.55, 0.5, P.wood); add(mandirBase, -0.95, 3.95); mandirBase.position.y = Y + 0.28;
    const mandirArch = box(0.6, 0.5, 0.4, 0xb4763f); add(mandirArch, -0.95, 3.95); mandirArch.position.y = Y + 0.8;
    const mandirTop = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.32, 4), mat(P.brass, { metalness: 0.45, roughness: 0.4 }));
    add(mandirTop, -0.95, 3.95); mandirTop.position.y = Y + 1.2; mandirTop.rotation.y = Math.PI / 4;
    this.diyaLight = new THREE.PointLight(0xffb347, 0, 2.4, 2);
    this.diyaLight.position.set(-0.95, Y + 0.9, 3.7);
    this.scene.add(this.diyaLight);

    // Kitchen
    const counterBack = box(5.2, 0.85, 0.65, 0xbf8f68); add(counterBack, 3.4, 0.95); counterBack.position.y = Y + 0.43;
    const counterSide = box(0.65, 0.85, 2.6, 0xbf8f68); add(counterSide, 5.6, 2.4); counterSide.position.y = Y + 0.43;
    const counterTopA = box(5.3, 0.05, 0.72, P.cream); add(counterTopA, 3.4, 0.95); counterTopA.position.y = Y + 0.88;
    const counterTopB = box(0.72, 0.05, 2.68, P.cream); add(counterTopB, 5.6, 2.4); counterTopB.position.y = Y + 0.88;
    const stove = box(0.8, 0.08, 0.5, P.charcoal); add(stove, 2.0, 0.95); stove.position.y = Y + 0.93;

    // Master bedroom
    const bed = box(1.7, 0.4, 2.2, 0x8fa9c4); add(bed, -4.4, -2.6); bed.position.y = Y + 0.25;
    const bedHead = box(1.7, 0.7, 0.15, P.wood); add(bedHead, -4.4, -3.75); bedHead.position.y = Y + 0.55;
    const pillowA = box(0.6, 0.12, 0.4, P.cream); add(pillowA, -4.75, -3.4); pillowA.position.y = Y + 0.52;
    const pillowB = box(0.6, 0.12, 0.4, P.cream); add(pillowB, -4.05, -3.4); pillowB.position.y = Y + 0.52;

    // Dadaji's room
    const dbed = box(1.1, 0.4, 2.1, 0xb0684a); add(dbed, -1.35, -2.9); dbed.position.y = Y + 0.25;
    const dpillow = box(0.5, 0.12, 0.35, P.cream); add(dpillow, -1.35, -3.7); dpillow.position.y = Y + 0.52;
    const chairSeat = box(0.65, 0.4, 0.65, 0x5c7748); add(chairSeat, 0.8, -1.6); chairSeat.position.y = Y + 0.25;
    const chairBack = box(0.65, 0.6, 0.14, 0x4c6339); add(chairBack, 0.8, -1.9); chairBack.position.y = Y + 0.75;

    // Study
    const desk = box(1.6, 0.08, 0.7, P.wood); add(desk, 4.9, -3.9); desk.position.y = Y + 0.78;
    const deskLegL = box(0.08, 0.78, 0.6, P.woodDark); add(deskLegL, 4.2, -3.9); deskLegL.position.y = Y + 0.39;
    const deskLegR = box(0.08, 0.78, 0.6, P.woodDark); add(deskLegR, 5.6, -3.9); deskLegR.position.y = Y + 0.39;
    const laptop = box(0.42, 0.28, 0.03, P.charcoal); add(laptop, 4.9, -4.05); laptop.position.y = Y + 0.97;
    const bunkLow = box(1.9, 0.28, 0.9, 0xc492a4); add(bunkLow, 2.9, -1.2, Math.PI / 2); bunkLow.position.y = Y + 0.3;
    const bunkHigh = box(1.9, 0.28, 0.9, 0x8fa9c4); add(bunkHigh, 2.9, -1.2, Math.PI / 2); bunkHigh.position.y = Y + 1.1;

    // Pedestal fans
    this._fans.living_room = this._makeFan(-1.6, 1.3);
    this._fans.dadaji_room = this._makeFan(0.9, -3.9);
  }

  _makeFan(x, z) {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 1.1, 8), mat(P.metal, { metalness: 0.5 }));
    pole.position.y = 0.55;
    g.add(pole);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.06, 16), mat(P.metal, { metalness: 0.5 }));
    base.position.y = 0.03;
    g.add(base);
    const head = new THREE.Group();
    head.position.y = 1.18;
    const cage = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.02, 8, 24), mat(0x8a919b, { metalness: 0.6 }));
    head.add(cage);
    const rotor = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.24, 0.015), mat(0x7fa9b4));
      blade.position.y = 0.14;
      const holder = new THREE.Group();
      holder.rotation.z = (i * Math.PI * 2) / 3;
      holder.add(blade);
      rotor.add(holder);
    }
    const hub = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 10), mat(P.metal));
    rotor.add(hub);
    head.add(rotor);
    g.add(head);
    g.position.set(x, 0.24, z);
    g.rotation.y = Math.PI / 6;
    this.scene.add(g);
    return { group: g, rotor, speed: 2.5 };
  }

  _buildDevices() {
    const Y = 0.24;
    this._deviceMeshes = {};
    const dm = (id, mesh) => {
      this.scene.add(mesh);
      this._deviceMeshes[id] = mesh;
      this.registerPickable(mesh, 'device', id);
    };

    const ac = box(1.1, 0.32, 0.24, 0xfbfaf6, { roughness: 0.35 });
    ac.position.set(...DEVICES3D.living_room_ac.pos);
    dm('living_room_ac', ac);

    const tv = box(0.08, 0.85, 1.5, P.charcoal);
    tv.position.set(...DEVICES3D.smart_tv.pos);
    dm('smart_tv', tv);

    for (const id of ['echo_living', 'echo_dadaji', 'echo_study']) {
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.2, 16), mat(0x3b4249, { roughness: 0.5 }));
      body.position.set(...DEVICES3D[id].pos);
      const ringMat = mat(0x2aa8b8, { emissive: 0x2aa8b8, emissiveIntensity: 0.7 });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.016, 8, 20), ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(0, 0.1, 0);
      body.add(ring);
      this._echoRings.push(ringMat);
      dm(id, body);
    }

    const geyser = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.5, 14), mat(0xfbfaf6, { roughness: 0.35 }));
    geyser.rotation.z = Math.PI / 2;
    geyser.position.set(...DEVICES3D.geyser.pos);
    dm('geyser', geyser);

    const inverter = box(0.55, 0.45, 0.3, 0x3f6b52);
    inverter.position.set(DEVICES3D.inverter.pos[0], Y + 0.24, DEVICES3D.inverter.pos[2]);
    dm('inverter', inverter);

    const hub = box(0.34, 0.24, 0.05, P.charcoal);
    hub.position.set(...DEVICES3D.kitchen_hub.pos);
    dm('kitchen_hub', hub);

    const fridge = box(0.75, 1.55, 0.7, 0x9c5460);
    fridge.position.set(DEVICES3D.fridge.pos[0], Y + 0.78, DEVICES3D.fridge.pos[2]);
    dm('fridge', fridge);

    const cookerBody = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.22, 0.3, 16), mat(0xb9bec2, { metalness: 0.65, roughness: 0.35 }));
    cookerBody.position.set(...DEVICES3D.cooker.pos);
    dm('cooker', cookerBody);

    const purifier = box(0.3, 0.7, 0.3, 0xf3f1ea, { roughness: 0.4 });
    purifier.position.set(DEVICES3D.purifier.pos[0], Y + 0.36, DEVICES3D.purifier.pos[2]);
    dm('purifier', purifier);

    // Water tank tower — the skyline signature, kept but quiet
    const towerLegs = new THREE.Group();
    for (const [lx, lz] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) {
      const leg = box(0.18, 3.4, 0.18, 0xc4b89e);
      leg.position.set(lx, 1.7, lz);
      towerLegs.add(leg);
    }
    const slab = box(1.9, 0.16, 1.9, 0xd0c5ab);
    slab.position.y = 3.45;
    towerLegs.add(slab);
    towerLegs.position.set(7.6, 0, -3.0);
    this.scene.add(towerLegs);

    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 1.25, 20), mat(0x3572a5, { roughness: 0.45, emissive: 0x16324a, emissiveIntensity: 0.4 }));
    tank.position.set(7.6, 4.2, -3.0);
    tank.castShadow = true;
    this.scene.add(tank);
    this.registerPickable(tank, 'device', 'water_tank');
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.42, 0.16, 14), mat(0x3a3f45));
    lid.position.set(7.6, 4.9, -3.0);
    this.scene.add(lid);
    this._tube = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.2, 10), mat(0xe3ecef, { transparent: true, opacity: 0.5, roughness: 0.2 }));
    this._tube.position.set(8.5, 4.2, -3.0);
    this.scene.add(this._tube);
    this._tubeWater = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1, 10), mat(0x3b98bf, { emissive: 0x1c6f94, emissiveIntensity: 0.3 }));
    this._tubeWater.position.set(8.5, 3.65, -3.0);
    this.scene.add(this._tubeWater);

    const motor = box(0.5, 0.35, 0.35, 0x84474a);
    motor.position.set(7.6, 0.2, -1.9);
    dm('water_motor', motor);
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.9, 8), mat(0x8a919b, { metalness: 0.5 }));
    pipe.position.set(7.0, 2.0, -2.4);
    this.scene.add(pipe);
  }

  // ─── Picking (hover + click) ────────────────────────────────────
  registerPickable(object3d, type, id) {
    object3d.traverse((o) => { o.userData.pickType = type; o.userData.pickId = id; });
    object3d.userData.pickType = type;
    object3d.userData.pickId = id;
    this.pickables.push(object3d);
  }

  _initPicking() {
    this._raycaster = new THREE.Raycaster();
    this._pointer = new THREE.Vector2();
    const el = this.renderer.domElement;
    let lastMove = 0;
    let downPos = null;

    const cast = (ev) => {
      const rect = el.getBoundingClientRect();
      this._pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      this._pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      this._raycaster.setFromCamera(this._pointer, this.camera);
      const hits = this._raycaster.intersectObjects(this.pickables, true);
      for (const hit of hits) {
        let o = hit.object;
        while (o && !o.userData.pickType) o = o.parent;
        if (o) return { type: o.userData.pickType, id: o.userData.pickId };
      }
      return null;
    };

    el.addEventListener('pointermove', (ev) => {
      const now = performance.now();
      if (now - lastMove < 70) return;
      lastMove = now;
      const hit = cast(ev);
      el.style.cursor = hit ? 'pointer' : 'grab';
    });
    el.addEventListener('pointerdown', (ev) => { downPos = [ev.clientX, ev.clientY]; });
    el.addEventListener('pointerup', (ev) => {
      if (!downPos) return;
      const moved = Math.hypot(ev.clientX - downPos[0], ev.clientY - downPos[1]);
      downPos = null;
      if (moved > 6) return;
      const hit = cast(ev);
      if (hit && this.onPick) this.onPick({ ...hit, x: ev.clientX, y: ev.clientY });
    });
  }

  // ─── Effects API ────────────────────────────────────────────────
  setTimeOfDay(simMinutes) {
    this._simMinutes = simMinutes;
    const h = (simMinutes / 60) % 24;

    const bucket = Math.round(h * 30);
    if (bucket !== this._skyBucket) {
      this._skyBucket = bucket;
      let a = SKY_STOPS[0], b = SKY_STOPS[SKY_STOPS.length - 1];
      for (let i = 0; i < SKY_STOPS.length - 1; i++) {
        if (h >= SKY_STOPS[i].h && h <= SKY_STOPS[i + 1].h) { a = SKY_STOPS[i]; b = SKY_STOPS[i + 1]; break; }
      }
      const t = b.h === a.h ? 0 : (h - a.h) / (b.h - a.h);
      const top = new THREE.Color(a.top).lerp(new THREE.Color(b.top), t);
      const bot = new THREE.Color(a.bot).lerp(new THREE.Color(b.bot), t);
      const night = a.night + (b.night - a.night) * t;

      if (this._aqi > 200 && night < 0.5) {
        bot.lerp(new THREE.Color(0xbfb28f), Math.min(1, (this._aqi - 200) / 150));
      }
      this._paintSky(top, bot);
      this.scene.fog.color.copy(bot);
      this.scene.fog.near = this._aqi > 200 ? 28 : 55;
      this.scene.fog.far = this._aqi > 200 ? 75 : 130;
      // Floor takes the backdrop tone, blended back toward neutral sand
      this._studioFloor.material.color.copy(bot).lerp(new THREE.Color(0xd9d2c2), 0.55);
      this._starMat.opacity = night * 0.55;
      this._night = night;
    }

    const dayT = Math.max(0, Math.min(1, (h - 6) / 12.5));
    const elev = Math.sin(dayT * Math.PI);
    const isDay = h >= 6 && h <= 18.5;
    const dusk = (h > 17 && h <= 19.5) || (h >= 5 && h < 7);
    const angle = (dayT - 0.5) * Math.PI * 0.9;
    this.sun.position.set(Math.sin(angle) * 18, 6 + elev * 14, 8);
    this.sun.intensity = isDay ? Math.max(0.75, 0.5 + elev * 1.25) : 0.07;
    this.sun.color.setHex(dusk ? 0xffc290 : 0xfff4e0);
    this.hemi.intensity = isDay ? Math.max(0.8, 0.62 + elev * 0.45) : 0.32;
    this.fill.intensity = isDay ? 0.35 : 0.15;

    const wantLights = !isDay || h < 7.0;
    for (const [room, light] of Object.entries(this._roomLights)) {
      if (this._powerCut) {
        light.intensity = (room === 'study_room' || room === 'living_room') ? 0.55 : 0;
      } else {
        light.intensity = wantLights ? 1.15 : 0;
      }
    }
  }

  setPowerCut(on) {
    this._powerCut = on;
    this._skyBucket = -1;
    this.setTimeOfDay(this._simMinutes);
  }

  setAQI(aqi) {
    if (Math.abs(aqi - this._aqi) > 2) this._skyBucket = -1;
    this._aqi = aqi;
  }

  setTankLevel(pct) {
    const h = Math.max(0.04, (pct / 100) * 1.1);
    this._tubeWater.scale.y = h;
    this._tubeWater.position.y = 3.62 + (h * 1.0) / 2;
  }

  setMotor(on) {
    const motor = this._deviceMeshes.water_motor;
    if (motor) motor.material.emissive = new THREE.Color(on ? 0x4a1010 : 0x000000);
    this._motorOn = on;
  }

  setFan(room, speed) {
    if (this._fans[room]) this._fans[room].speed = speed;
  }

  poojaGlow(on) {
    this.diyaLight.intensity = on ? 1.5 : 0;
  }

  deviceHalo(deviceId, colorHex = 0xd97706, ttl = 3.2) {
    const def = DEVICES3D[deviceId];
    if (!def) return;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.32, 0.032, 8, 28),
      new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.9 })
    );
    ring.position.set(def.pos[0], def.pos[1], def.pos[2]);
    ring.lookAt(this.camera.position);
    this.scene.add(ring);
    this._halos.push({ mesh: ring, born: this._clock.elapsedTime, ttl, grow: 0.6, billboard: true });
  }

  soundRipple(roomId, emoji = '', colorHex = 0x155450) {
    const c = roomCenter(roomId);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.25, 0.33, 32),
      new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.8, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(c.x, 0.33, c.z);
    this.scene.add(ring);
    this._halos.push({ mesh: ring, born: this._clock.elapsedTime, ttl: 1.8, grow: 2.4 });
    // Second, delayed ring — reads as sound, not a glitch
    setTimeout(() => {
      const ring2 = ring.clone();
      ring2.material = ring.material.clone();
      this.scene.add(ring2);
      this._halos.push({ mesh: ring2, born: this._clock.elapsedTime, ttl: 1.8, grow: 2.4 });
    }, 350);
  }

  echoPulse(deviceId = 'echo_living') {
    this.deviceHalo(deviceId, 0x2aa8b8, 2.6);
    const def = DEVICES3D[deviceId];
    if (def) {
      const flash = new THREE.PointLight(0x2aa8b8, 2.0, 4, 2);
      flash.position.set(def.pos[0], def.pos[1] + 0.3, def.pos[2]);
      this.scene.add(flash);
      this._halos.push({ mesh: flash, born: this._clock.elapsedTime, ttl: 1.6, grow: 0, isLight: true });
    }
  }

  spawnGuests() {
    if (this._guests.length) return;
    const cols = [0x76608f, 0xa85575];
    cols.forEach((col, i) => {
      const g = this._makeSimplePerson(col);
      g.position.set(0.4 + i * 0.7, 0, 9.5);
      this.scene.add(g);
      this._guests.push({ group: g, target: new THREE.Vector3(-2.2 + i * 1.0, 0, 2.0) });
    });
    setTimeout(() => {
      this._guests.forEach((gu) => { gu.target = new THREE.Vector3(0.5, 0, 10.5); gu.leaving = true; });
      setTimeout(() => {
        this._guests.forEach((gu) => this.scene.remove(gu.group));
        this._guests = [];
      }, 9000);
    }, 25000);
  }

  _makeSimplePerson(colorHex) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.42, 6, 12), mat(colorHex, { roughness: 0.8 }));
    body.position.y = 0.62;
    body.castShadow = true;
    g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 12), mat(0xd9a377));
    head.position.y = 1.08;
    head.castShadow = true;
    g.add(head);
    return g;
  }

  // ─── Render loop ────────────────────────────────────────────────
  _animate() {
    const loop = () => {
      requestAnimationFrame(loop);
      const dt = this._clock.getDelta();
      const t = this._clock.elapsedTime;

      if (this._intro) {
        const k = Math.min(1, (t - this._intro.start) / 2.8);
        const ease = 1 - Math.pow(1 - k, 3);
        this.camera.position.lerpVectors(CAM_FAR, CAM_HOME, ease);
        if (k >= 1) {
          this._intro = null;
          this.controls.enabled = true;
          this.controls.autoRotate = true;
        }
      }

      // Cinema camera flight
      if (this._flight) {
        const f = this._flight;
        const k = Math.min(1, (t - f.start) / f.dur);
        const ease = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
        this.camera.position.lerpVectors(f.fromPos, f.toPos, ease);
        this.controls.target.lerpVectors(f.fromTarget, f.toTarget, ease);
        if (k >= 1) this._flight = null;
      }

      // Alexa's presence
      this.presence.update(dt, t);

      // Whole-frame dim while the grid is down — the cut reads on camera
      const wantExposure = this._powerCut ? 0.66 : 1.12;
      this.renderer.toneMappingExposure += (wantExposure - this.renderer.toneMappingExposure) * Math.min(1, dt * 3.5);

      for (const fan of Object.values(this._fans)) {
        fan.rotor.rotation.z += dt * fan.speed * (this._powerCut ? 0.3 : 1) * 4;
      }

      const breathe = 0.45 + (Math.sin(t * 2.2) + 1) * 0.3;
      for (const rm of this._echoRings) rm.emissiveIntensity = breathe;

      for (let i = this._halos.length - 1; i >= 0; i--) {
        const hl = this._halos[i];
        const age = t - hl.born;
        if (age > hl.ttl) { this.scene.remove(hl.mesh); this._halos.splice(i, 1); continue; }
        const k = age / hl.ttl;
        if (hl.isLight) {
          hl.mesh.intensity = 2.0 * (1 - k);
        } else {
          hl.mesh.scale.setScalar(1 + k * hl.grow);
          hl.mesh.material.opacity = 0.9 * (1 - k);
          if (hl.billboard) hl.mesh.lookAt(this.camera.position);
        }
      }
      for (let i = this._sprites.length - 1; i >= 0; i--) {
        const sp = this._sprites[i];
        const age = t - sp.born;
        if (age > sp.ttl) { this.scene.remove(sp.sprite); this._sprites.splice(i, 1); continue; }
        sp.sprite.position.y += dt * 0.35;
        sp.sprite.material.opacity = 1 - age / sp.ttl;
      }

      for (const gu of this._guests) {
        const pos = gu.group.position;
        const dir = gu.target.clone().sub(pos);
        dir.y = 0;
        if (dir.length() > 0.1) {
          dir.normalize().multiplyScalar(dt * 1.6);
          pos.add(dir);
          gu.group.position.y = Math.abs(Math.sin(t * 8)) * 0.04;
        }
      }

      if (this._motorOn && this._deviceMeshes.water_motor) {
        this._deviceMeshes.water_motor.position.y = 0.2 + Math.sin(t * 40) * 0.008;
      }

      if (this.avatars) this.avatars.update(dt, t);
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };
    loop();
  }
}
