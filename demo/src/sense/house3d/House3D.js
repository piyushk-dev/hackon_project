/**
 * House3D — "Sharma Niwas", a low-poly 3D Indian home.
 *
 * Cutaway dollhouse: full back wall, low front/side/partition walls so the
 * camera sees inside. Colored room walls, furniture, pedestal fans, mandir
 * with diya, rooftop water tank on a tower, tulsi pot, scooter, clothesline.
 *
 * Exposes an effects API the sense engine drives:
 *   setTimeOfDay, setPowerCut, deviceHalo, soundRipple, setTankLevel,
 *   setMotor, setAQI, poojaGlow, spawnGuests, setFan, echoPulse
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// ─── Floor plan (world units ~ metres, origin at house centre) ──────
export const ROOMS3D = {
  living_room:    { x: [-6, -0.5], z: [0.5, 4.5],  wall: 0x8fc1bf, floor: 0xefe0c9, name: 'Living Room' },
  kitchen:        { x: [0.5, 6],   z: [0.5, 4.5],  wall: 0xf4d06f, floor: 0xe7d3b3, name: 'Kitchen' },
  master_bedroom: { x: [-6, -2.5], z: [-4.5, -0.5], wall: 0xe8a2a8, floor: 0xefe0c9, name: 'Master Bedroom' },
  dadaji_room:    { x: [-2, 1.5],  z: [-4.5, -0.5], wall: 0xb5c99a, floor: 0xe7d3b3, name: "Dadaji's Room" },
  study_room:     { x: [2, 6],     z: [-4.5, -0.5], wall: 0x9dc3e6, floor: 0xefe0c9, name: 'Study' },
};

export function roomCenter(roomId) {
  const r = ROOMS3D[roomId];
  if (!r) return new THREE.Vector3(0, 0, 7); // yard / porch default
  return new THREE.Vector3((r.x[0] + r.x[1]) / 2, 0, (r.z[0] + r.z[1]) / 2);
}

// Device anchor points inside the house.
export const DEVICES3D = {
  living_room_ac: { pos: [-3.2, 1.45, 0.75], room: 'living_room' },
  smart_tv:       { pos: [-5.75, 1.1, 2.5],  room: 'living_room' },
  echo_living:    { pos: [-1.1, 0.62, 3.9],  room: 'living_room' },
  kitchen_hub:    { pos: [4.1, 0.95, 0.95],  room: 'kitchen' },
  fridge:         { pos: [5.4, 0, 1.2],      room: 'kitchen' },
  cooker:         { pos: [2.0, 0.98, 0.95],  room: 'kitchen' },
  geyser:         { pos: [-5.55, 1.5, -4.1], room: 'master_bedroom' },
  iron:           { pos: [-4.2, 0.55, -2.5], room: 'master_bedroom' },
  echo_dadaji:    { pos: [1.1, 0.62, -4.1],  room: 'dadaji_room' },
  echo_study:     { pos: [5.6, 0.85, -4.1],  room: 'study_room' },
  inverter:       { pos: [0.05, 0.3, 1.0],   room: 'kitchen' },
  water_motor:    { pos: [7.6, 0.25, -3.0],  room: null },
  water_tank:     { pos: [7.6, 4.1, -3.0],   room: null },
  purifier:       { pos: [-0.9, 0.4, -4.0],  room: 'dadaji_room' },
};

const WALL_H_LOW = 1.15;
const WALL_H_BACK = 2.5;
const WALL_T = 0.14;

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.02, ...opts });
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
    this._halos = [];      // transient effect meshes { mesh, born, ttl, grow }
    this._sprites = [];
    this._fans = {};       // room → rotor group
    this._roomLights = {}; // room → PointLight
    this._guests = [];
    this._powerCut = false;
    this._aqi = 120;
    this._simMinutes = 6 * 60;
    this._clock = new THREE.Clock();
    this.avatars = null;   // set by Family3D

    this._initRenderer();
    this._initLights();
    this._buildGround();
    this._buildHouse();
    this._buildFurniture();
    this._buildDevices();
    this._buildYard();
    this._animate();
  }

  // ─── Setup ──────────────────────────────────────────────────────
  _initRenderer() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xbfe3f2);
    this.scene.fog = new THREE.Fog(0xbfe3f2, 40, 90);

    this.camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 200);
    this.camera.position.set(11.5, 11, 14.5);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 0.6, 0);
    this.controls.maxPolarAngle = Math.PI / 2.15;
    this.controls.minDistance = 8;
    this.controls.maxDistance = 34;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 0.35;
    // Pause auto-rotate while the user is exploring.
    this.controls.addEventListener('start', () => { this.controls.autoRotate = false; });
    let idleTimer = null;
    this.controls.addEventListener('end', () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => { this.controls.autoRotate = true; }, 6000);
    });

    new ResizeObserver(() => {
      const cw = this.container.clientWidth, ch = this.container.clientHeight;
      if (!cw || !ch) return;
      this.camera.aspect = cw / ch;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(cw, ch);
    }).observe(this.container);
  }

  _initLights() {
    this.hemi = new THREE.HemisphereLight(0xcfe8ff, 0x8a6f4d, 0.9);
    this.scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight(0xfff2d9, 1.6);
    this.sun.position.set(14, 18, 8);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.left = -16;
    this.sun.shadow.camera.right = 16;
    this.sun.shadow.camera.top = 16;
    this.sun.shadow.camera.bottom = -16;
    this.sun.shadow.bias = -0.0004;
    this.scene.add(this.sun);

    // Warm interior lights, one per room (on at night, off in power cut).
    for (const [id, r] of Object.entries(ROOMS3D)) {
      const light = new THREE.PointLight(0xffd9a0, 0, 7, 1.8);
      const c = roomCenter(id);
      light.position.set(c.x, 2.1, c.z);
      this.scene.add(light);
      this._roomLights[id] = light;
    }
  }

  _buildGround() {
    // Lawn
    const lawn = new THREE.Mesh(new THREE.CylinderGeometry(17, 17, 0.3, 48), mat(0x9dbf6e));
    lawn.position.y = -0.15;
    lawn.receiveShadow = true;
    this.scene.add(lawn);

    // House plinth
    const plinth = box(13.4, 0.3, 10.4, 0xcbb99a);
    plinth.position.set(0, 0.02, 0);
    plinth.receiveShadow = true;
    this.scene.add(plinth);

    // Front path to the gate
    const path = box(2.4, 0.06, 6, 0xd9c6a5);
    path.position.set(0, 0.03, 8);
    this.scene.add(path);

    // Room floors
    for (const r of Object.values(ROOMS3D)) {
      const fw = r.x[1] - r.x[0], fd = r.z[1] - r.z[0];
      const f = new THREE.Mesh(new THREE.BoxGeometry(fw, 0.08, fd), mat(r.floor, { roughness: 0.7 }));
      f.position.set((r.x[0] + r.x[1]) / 2, 0.2, (r.z[0] + r.z[1]) / 2);
      f.receiveShadow = true;
      this.scene.add(f);
    }
    // Corridor floor
    const corridor = new THREE.Mesh(new THREE.BoxGeometry(12, 0.08, 1), mat(0xf3e6cf, { roughness: 0.7 }));
    corridor.position.set(0, 0.2, 0);
    corridor.receiveShadow = true;
    this.scene.add(corridor);
    // Porch / veranda
    const porch = new THREE.Mesh(new THREE.BoxGeometry(12, 0.12, 1.6), mat(0xdec9a3));
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
    const Y = 0.24; // top of floor slabs

    // Back exterior wall — full height, cream outside / per-room colour inside.
    this._wall(0, Y, -4.5 - WALL_T / 2, 12 + WALL_T * 2, WALL_H_BACK, WALL_T, 0xf1e3cd);
    // Colour strips on the inside of the back wall (one per back room).
    for (const id of ['master_bedroom', 'dadaji_room', 'study_room']) {
      const r = ROOMS3D[id];
      const w = r.x[1] - r.x[0] - 0.1;
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(w, WALL_H_BACK - 0.1), mat(r.wall, { roughness: 0.95 }));
      strip.position.set((r.x[0] + r.x[1]) / 2, Y + WALL_H_BACK / 2, -4.5 + 0.01);
      this.scene.add(strip);
    }
    // Windows on the back wall
    for (const wx of [-4.2, -0.2, 4]) {
      const win = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.9), mat(0xa8d8e8, { roughness: 0.2, metalness: 0.3 }));
      win.position.set(wx, Y + 1.5, -4.5 + 0.02);
      this.scene.add(win);
      const frame = box(1.45, 1.05, 0.04, 0x8b5e3c);
      frame.position.set(wx, Y + 1.5, -4.5 + 0.005);
      this.scene.add(frame);
    }

    // Side walls — low (cutaway)
    this._wall(-6 - WALL_T / 2, Y, 0, WALL_T, WALL_H_LOW, 9 + WALL_T, 0xf1e3cd);
    this._wall(6 + WALL_T / 2, Y, 0, WALL_T, WALL_H_LOW, 9 + WALL_T, 0xf1e3cd);

    // Front wall — low, with a gap for the main door (x −0.9 … 0.9)
    this._wall(-3.45, Y, 4.5 + WALL_T / 2, 5.1, WALL_H_LOW, WALL_T, 0xf1e3cd);
    this._wall(3.45, Y, 4.5 + WALL_T / 2, 5.1, WALL_H_LOW, WALL_T, 0xf1e3cd);
    // Door frame + open door leaf
    const frameL = box(0.12, 2.1, 0.2, 0x8b5e3c); frameL.position.set(-0.95, Y + 1.05, 4.55); this.scene.add(frameL);
    const frameR = box(0.12, 2.1, 0.2, 0x8b5e3c); frameR.position.set(0.95, Y + 1.05, 4.55); this.scene.add(frameR);
    const lintel = box(2.0, 0.14, 0.2, 0x8b5e3c); lintel.position.set(0, Y + 2.12, 4.55); this.scene.add(lintel);
    const door = box(0.9, 1.95, 0.06, 0xa9683f);
    door.position.set(-0.5, Y + 0.98, 4.9);
    door.rotation.y = -Math.PI / 3;
    this.scene.add(door);
    // Marigold garland over the door 🧡
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      const gx = -0.9 + t * 1.8;
      const gy = Y + 2.05 - Math.sin(t * Math.PI) * 0.22;
      const flower = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), mat(i % 2 ? 0xf59e0b : 0xe86a10, { roughness: 0.6 }));
      flower.position.set(gx, gy, 4.62);
      this.scene.add(flower);
    }

    // Partition walls — low
    // Front row split (living | kitchen) at x = 0, from z 0.5→4.5 minus door gap near corridor
    this._wall(0, Y, 2.9, WALL_T, WALL_H_LOW, 3.2, 0xf7ecd9);
    // Corridor walls (front row bottom edge z=0.5, back row top edge z=−0.5) with door gaps
    this._wall(-4.4, Y, 0.5, 3.2, WALL_H_LOW, WALL_T, 0xf7ecd9);
    this._wall(3.9, Y, 0.5, 4.2, WALL_H_LOW, WALL_T, 0xf7ecd9);
    this._wall(-4.9, Y, -0.5, 2.2, WALL_H_LOW, WALL_T, 0xf7ecd9);
    this._wall(-0.2, Y, -0.5, 2.4, WALL_H_LOW, WALL_T, 0xf7ecd9);
    this._wall(4.6, Y, -0.5, 2.8, WALL_H_LOW, WALL_T, 0xf7ecd9);
    // Back row splits
    this._wall(-2.25, Y, -2.5, WALL_T, WALL_H_LOW, 4, 0xf7ecd9);
    this._wall(1.75, Y, -2.5, WALL_T, WALL_H_LOW, 4, 0xf7ecd9);

    // Name board: "SHARMA NIWAS"
    const boardCanvas = document.createElement('canvas');
    boardCanvas.width = 512; boardCanvas.height = 128;
    const bctx = boardCanvas.getContext('2d');
    bctx.fillStyle = '#1f6f6e';
    bctx.fillRect(0, 0, 512, 128);
    bctx.strokeStyle = '#f2c14e'; bctx.lineWidth = 10; bctx.strokeRect(8, 8, 496, 112);
    bctx.fillStyle = '#fdf6e3';
    bctx.font = 'bold 58px Georgia';
    bctx.textAlign = 'center'; bctx.textBaseline = 'middle';
    bctx.fillText('SHARMA NIWAS', 256, 68);
    const boardTex = new THREE.CanvasTexture(boardCanvas);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.6), new THREE.MeshBasicMaterial({ map: boardTex }));
    board.position.set(2.6, Y + 1.75, 4.6);
    this.scene.add(board);
  }

  _buildFurniture() {
    const Y = 0.24;
    const add = (m, x, z, ry = 0) => { m.position.x = x; m.position.z = z; m.position.y += Y; m.rotation.y = ry; this.scene.add(m); return m; };

    // Living room — sofa, rug, TV, mandir
    const sofaSeat = box(2.4, 0.45, 0.9, 0x1f6f6e); add(sofaSeat, -3.4, 3.6); sofaSeat.position.y = Y + 0.28;
    const sofaBack = box(2.4, 0.6, 0.22, 0x18595a); add(sofaBack, -3.4, 3.98); sofaBack.position.y = Y + 0.75;
    for (const cx of [-4.1, -3.4, -2.7]) {
      const cushion = box(0.55, 0.14, 0.6, 0xf2c14e); add(cushion, cx, 3.55); cushion.position.y = Y + 0.56;
    }
    const rug = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 0.05, 24), mat(0xc75b39, { roughness: 0.95 }));
    add(rug, -3.3, 2.3); rug.position.y = Y + 0.07; rug.receiveShadow = true;
    const tv = box(0.08, 0.85, 1.5, 0x2d2a26); add(tv, -5.85, 2.5); tv.position.y = Y + 1.1;
    const tvStand = box(0.35, 0.4, 1.7, 0x8b5e3c); add(tvStand, -5.75, 2.5); tvStand.position.y = Y + 0.2;
    // Mandir (little orange shrine, front-right corner of living room)
    const mandirBase = box(0.7, 0.55, 0.5, 0xa9683f); add(mandirBase, -0.95, 3.95); mandirBase.position.y = Y + 0.28;
    const mandirArch = box(0.6, 0.5, 0.4, 0xe86a10); add(mandirArch, -0.95, 3.95); mandirArch.position.y = Y + 0.8;
    const mandirTop = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.35, 4), mat(0xf2c14e)); add(mandirTop, -0.95, 3.95); mandirTop.position.y = Y + 1.22; mandirTop.rotation.y = Math.PI / 4;
    this.diyaLight = new THREE.PointLight(0xffb347, 0, 2.4, 2);
    this.diyaLight.position.set(-0.95, Y + 0.9, 3.7);
    this.scene.add(this.diyaLight);

    // Kitchen — counters, stove, fridge
    const counterBack = box(5.2, 0.85, 0.65, 0xd9986b); add(counterBack, 3.4, 0.95); counterBack.position.y = Y + 0.43;
    const counterSide = box(0.65, 0.85, 2.6, 0xd9986b); add(counterSide, 5.6, 2.4); counterSide.position.y = Y + 0.43;
    const stove = box(0.8, 0.1, 0.5, 0x3b3a38); add(stove, 2.0, 0.95); stove.position.y = Y + 0.9;
    const cookerBody = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.22, 0.3, 16), mat(0xc0c5c9, { metalness: 0.7, roughness: 0.35 }));
    add(cookerBody, 2.0, 0.95); cookerBody.position.y = Y + 1.1;
    const fridge = box(0.75, 1.55, 0.7, 0xb84a62); add(fridge, 5.45, 1.35); fridge.position.y = Y + 0.78;

    // Master bedroom — bed + side table
    const bed = box(1.7, 0.4, 2.2, 0x9dc3e6); add(bed, -4.4, -2.6); bed.position.y = Y + 0.25;
    const bedHead = box(1.7, 0.7, 0.15, 0x8b5e3c); add(bedHead, -4.4, -3.75); bedHead.position.y = Y + 0.55;
    const pillowA = box(0.6, 0.12, 0.4, 0xfdf6e3); add(pillowA, -4.75, -3.4); pillowA.position.y = Y + 0.52;
    const pillowB = box(0.6, 0.12, 0.4, 0xfdf6e3); add(pillowB, -4.05, -3.4); pillowB.position.y = Y + 0.52;

    // Dadaji's room — bed + armchair
    const dbed = box(1.1, 0.4, 2.1, 0xc75b39); add(dbed, -1.35, -2.9); dbed.position.y = Y + 0.25;
    const dpillow = box(0.5, 0.12, 0.35, 0xfdf6e3); add(dpillow, -1.35, -3.7); dpillow.position.y = Y + 0.52;
    const chairSeat = box(0.65, 0.4, 0.65, 0x6a994e); add(chairSeat, 0.8, -1.6); chairSeat.position.y = Y + 0.25;
    const chairBack = box(0.65, 0.6, 0.14, 0x557b3e); add(chairBack, 0.8, -1.9); chairBack.position.y = Y + 0.75;

    // Study — desk, chair, bunk bed
    const desk = box(1.6, 0.08, 0.7, 0x8b5e3c); add(desk, 4.9, -3.9); desk.position.y = Y + 0.78;
    const deskLegL = box(0.08, 0.78, 0.6, 0x744c31); add(deskLegL, 4.2, -3.9); deskLegL.position.y = Y + 0.39;
    const deskLegR = box(0.08, 0.78, 0.6, 0x744c31); add(deskLegR, 5.6, -3.9); deskLegR.position.y = Y + 0.39;
    const laptop = box(0.42, 0.28, 0.03, 0x3b3a38); add(laptop, 4.9, -4.05); laptop.position.y = Y + 0.97;
    const bunkLow = box(1.9, 0.28, 0.9, 0xf2a2b8); add(bunkLow, 2.9, -1.2, Math.PI / 2); bunkLow.position.y = Y + 0.3;
    const bunkHigh = box(1.9, 0.28, 0.9, 0x9dc3e6); add(bunkHigh, 2.9, -1.2, Math.PI / 2); bunkHigh.position.y = Y + 1.1;

    // Pedestal fans — living room + Dadaji's room (rotors animate)
    this._fans.living_room = this._makeFan(-1.6, 1.3, 0.6);
    this._fans.dadaji_room = this._makeFan(0.9, -3.9, 0.6);
  }

  _makeFan(x, z, baseY) {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 1.1, 8), mat(0x4a5568, { metalness: 0.5 }));
    pole.position.y = 0.55;
    g.add(pole);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.06, 16), mat(0x4a5568, { metalness: 0.5 }));
    base.position.y = 0.03;
    g.add(base);
    const head = new THREE.Group();
    head.position.y = 1.18;
    const cage = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.02, 8, 24), mat(0x8a919b, { metalness: 0.6 }));
    head.add(cage);
    const rotor = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.24, 0.015), mat(0x77c2d2));
      blade.position.y = 0.14;
      const holder = new THREE.Group();
      holder.rotation.z = (i * Math.PI * 2) / 3;
      holder.add(blade);
      rotor.add(holder);
    }
    const hub = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 10), mat(0x4a5568));
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
    const dm = (id, mesh) => { this.scene.add(mesh); this._deviceMeshes[id] = mesh; };

    // AC — white split unit on the living room partition wall
    const ac = box(1.1, 0.32, 0.24, 0xfdfdfb, { roughness: 0.4 });
    ac.position.set(...DEVICES3D.living_room_ac.pos);
    dm('living_room_ac', ac);

    // Echo devices — little blue-ringed cylinders
    for (const id of ['echo_living', 'echo_dadaji', 'echo_study']) {
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.2, 16), mat(0x3b4a54, { roughness: 0.5 }));
      body.position.set(...DEVICES3D[id].pos);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.014, 8, 20), mat(0x35b8c8, { emissive: 0x35b8c8, emissiveIntensity: 0.8 }));
      ring.rotation.x = Math.PI / 2;
      ring.position.set(0, 0.1, 0);
      body.add(ring);
      dm(id, body);
    }

    // Geyser — white cylinder high on the bathroom corner wall
    const geyser = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.5, 14), mat(0xfdfdfb, { roughness: 0.35 }));
    geyser.rotation.z = Math.PI / 2;
    geyser.position.set(...DEVICES3D.geyser.pos);
    dm('geyser', geyser);

    // Inverter — green box in the corridor
    const inverter = box(0.55, 0.45, 0.3, 0x2f7d4f);
    inverter.position.set(...DEVICES3D.inverter.pos);
    inverter.position.y = Y + 0.24;
    dm('inverter', inverter);

    // Kitchen hub — small screen on the counter
    const hub = box(0.34, 0.24, 0.05, 0x2d2a26);
    hub.position.set(...DEVICES3D.kitchen_hub.pos);
    dm('kitchen_hub', hub);

    // Purifier — slim white tower in Dadaji's room
    const purifier = box(0.3, 0.7, 0.3, 0xf6f6f2, { roughness: 0.4 });
    purifier.position.set(...DEVICES3D.purifier.pos);
    purifier.position.y = Y + 0.36;
    dm('purifier', purifier);

    // ─ Water tank tower (outside, back-right) — the classic black Sintex ─
    const towerLegs = new THREE.Group();
    for (const [lx, lz] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) {
      const leg = box(0.18, 3.4, 0.18, 0xb9a284);
      leg.position.set(lx, 1.7, lz);
      towerLegs.add(leg);
    }
    const slab = box(1.9, 0.16, 1.9, 0xcbb99a);
    slab.position.y = 3.45;
    towerLegs.add(slab);
    towerLegs.position.set(7.6, 0, -3.0);
    this.scene.add(towerLegs);

    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 1.25, 20), mat(0x23272b, { roughness: 0.6 }));
    tank.position.set(7.6, 4.2, -3.0);
    tank.castShadow = true;
    this.scene.add(tank);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.42, 0.16, 14), mat(0x2f353a));
    lid.position.set(7.6, 4.9, -3.0);
    this.scene.add(lid);
    // Visible water level — a blue ring column beside the tank (sight tube)
    this._tube = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.2, 10), mat(0xdfeef2, { transparent: true, opacity: 0.55, roughness: 0.2 }));
    this._tube.position.set(8.5, 4.2, -3.0);
    this.scene.add(this._tube);
    this._tubeWater = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1, 10), mat(0x35a8d8, { emissive: 0x1c7fae, emissiveIntensity: 0.35 }));
    this._tubeWater.position.set(8.5, 3.65, -3.0);
    this.scene.add(this._tubeWater);
    // Motor at the tower base
    const motor = box(0.5, 0.35, 0.35, 0x9a3b3b);
    motor.position.set(7.6, 0.2, -1.9);
    dm('water_motor', motor);
    // Pipe up the tower
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.9, 8), mat(0x8a919b, { metalness: 0.5 }));
    pipe.position.set(7.0, 2.0, -2.4);
    this.scene.add(pipe);
  }

  _buildYard() {
    // Tree
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 2.2, 10), mat(0x7a5230));
    trunk.position.set(-9.5, 1.1, 4.5);
    trunk.castShadow = true;
    this.scene.add(trunk);
    for (const [dx, dy, dz, s] of [[0, 2.6, 0, 1.5], [-0.9, 2.1, 0.3, 1.0], [0.8, 2.2, -0.4, 1.1]]) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(s, 12, 12), mat(0x6a994e, { roughness: 0.95 }));
      leaf.position.set(-9.5 + dx, dy, 4.5 + dz);
      leaf.castShadow = true;
      this.scene.add(leaf);
    }

    // Tulsi pot on the porch
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.16, 0.35, 10), mat(0xc75b39));
    pot.position.set(1.8, 0.45, 5.4);
    pot.castShadow = true;
    this.scene.add(pot);
    const tulsi = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 10), mat(0x557b3e));
    tulsi.position.set(1.8, 0.75, 5.4);
    this.scene.add(tulsi);
    // More pots along the porch
    for (const px of [-2.2, -3.4]) {
      const p2 = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.13, 0.3, 10), mat(0xb84a2e));
      p2.position.set(px, 0.42, 5.5);
      this.scene.add(p2);
      const plant = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.45, 8), mat(0x6a994e));
      plant.position.set(px, 0.75, 5.5);
      this.scene.add(plant);
    }

    // Scooter by the path (Activa-ish blob)
    const scooter = new THREE.Group();
    const bodyMain = box(0.5, 0.35, 1.2, 0x7b5ea7, { roughness: 0.4 });
    bodyMain.position.y = 0.45;
    scooter.add(bodyMain);
    const seat = box(0.42, 0.12, 0.62, 0x2d2a26);
    seat.position.set(0, 0.68, -0.15);
    scooter.add(seat);
    const shield = box(0.44, 0.5, 0.06, 0x7b5ea7, { roughness: 0.4 });
    shield.position.set(0, 0.75, 0.58);
    shield.rotation.x = -0.25;
    scooter.add(shield);
    const handle = box(0.55, 0.06, 0.06, 0x3b3a38);
    handle.position.set(0, 1.0, 0.52);
    scooter.add(handle);
    for (const wz of [0.48, -0.45]) {
      const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.07, 8, 16), mat(0x2d2a26));
      wheel.position.set(0, 0.24, wz);
      scooter.add(wheel);
    }
    scooter.position.set(2.6, 0, 7.2);
    scooter.rotation.y = 0.5;
    scooter.traverse((m) => { if (m.isMesh) { m.castShadow = true; } });
    this.scene.add(scooter);

    // Clothesline on the left side yard
    const poleA = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.7, 8), mat(0x8a919b));
    poleA.position.set(-8.6, 0.85, -1.5);
    this.scene.add(poleA);
    const poleB = poleA.clone();
    poleB.position.set(-8.6, 0.85, 1.8);
    this.scene.add(poleB);
    const line = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 3.3, 6), mat(0xd9d9d9));
    line.rotation.x = Math.PI / 2;
    line.position.set(-8.6, 1.62, 0.15);
    this.scene.add(line);
    for (const [cz, col] of [[-0.7, 0xf2c14e], [0.2, 0xd64580], [1.0, 0x9dc3e6]]) {
      const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.7), mat(col, { side: THREE.DoubleSide, roughness: 1 }));
      cloth.position.set(-8.6, 1.28, cz);
      cloth.rotation.y = Math.PI / 2;
      this.scene.add(cloth);
    }
  }

  // ─── Effects API ────────────────────────────────────────────────
  setTimeOfDay(simMinutes) {
    this._simMinutes = simMinutes;
    const h = (simMinutes / 60) % 24;
    // Sun elevation: up 6→18.5
    const dayT = Math.max(0, Math.min(1, (h - 6) / 12.5));
    const elev = Math.sin(dayT * Math.PI);           // 0..1..0
    const isDay = h >= 6 && h <= 18.5;
    const dusk = (h > 17 && h <= 19.5) || (h >= 5 && h < 7);

    const angle = (dayT - 0.5) * Math.PI * 0.9;
    this.sun.position.set(Math.sin(angle) * 18, 6 + elev * 14, 8);
    this.sun.intensity = isDay ? 0.45 + elev * 1.3 : 0.06;
    this.sun.color.setHex(dusk ? 0xffb37a : 0xfff2d9);

    // Sky colour
    const sky = new THREE.Color();
    if (isDay) {
      sky.setHex(dusk ? 0xf6c690 : 0xbfe3f2);
    } else {
      sky.setHex(0x2a3550);
    }
    // AQI haze pushes the sky dusty
    if (this._aqi > 200 && isDay) {
      sky.lerp(new THREE.Color(0xc9b689), Math.min(1, (this._aqi - 200) / 150));
    }
    this.scene.background.lerp(sky, 0.08);
    this.scene.fog.color.copy(this.scene.background);
    this.scene.fog.near = this._aqi > 200 ? 22 : 40;
    this.scene.fog.far = this._aqi > 200 ? 60 : 90;

    this.hemi.intensity = isDay ? 0.55 + elev * 0.5 : 0.25;

    // Interior lights at night (unless power cut)
    const wantLights = !isDay || h < 6.6;
    for (const [room, light] of Object.entries(this._roomLights)) {
      if (this._powerCut) {
        light.intensity = (room === 'study_room' || room === 'living_room') ? 0.55 : 0;
      } else {
        light.intensity = wantLights ? 1.1 : 0;
      }
    }
  }

  setPowerCut(on) {
    this._powerCut = on;
    this.setTimeOfDay(this._simMinutes);
  }

  setAQI(aqi) {
    this._aqi = aqi;
  }

  setTankLevel(pct) {
    const h = Math.max(0.04, (pct / 100) * 1.1);
    this._tubeWater.scale.y = h;
    this._tubeWater.position.y = 3.62 + (h * 1.0) / 2;
  }

  setMotor(on) {
    const motor = this._deviceMeshes.water_motor;
    if (motor) motor.material.emissive = new THREE.Color(on ? 0x5a1010 : 0x000000);
    this._motorOn = on;
  }

  setFan(room, speed) {
    if (this._fans[room]) this._fans[room].speed = speed;
  }

  poojaGlow(on) {
    this.diyaLight.intensity = on ? 1.6 : 0;
  }

  /** Pulsing colored halo ring around a device. */
  deviceHalo(deviceId, colorHex = 0xf59e0b, ttl = 3.2) {
    const def = DEVICES3D[deviceId];
    if (!def) return;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.32, 0.035, 8, 28),
      new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.95 })
    );
    ring.position.set(def.pos[0], def.pos[1], def.pos[2]);
    ring.lookAt(this.camera.position);
    this.scene.add(ring);
    this._halos.push({ mesh: ring, born: this._clock.elapsedTime, ttl, grow: 0.6, billboard: true });
  }

  /** Expanding ring on the floor + emoji rising, at a room. */
  soundRipple(roomId, emoji = '🔊', colorHex = 0x1f6f6e) {
    const c = roomCenter(roomId);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.25, 0.34, 32),
      new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.85, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(c.x, 0.33, c.z);
    this.scene.add(ring);
    this._halos.push({ mesh: ring, born: this._clock.elapsedTime, ttl: 1.8, grow: 2.4 });

    const cvs = document.createElement('canvas');
    cvs.width = 128; cvs.height = 128;
    const cctx = cvs.getContext('2d');
    cctx.font = '96px serif';
    cctx.textAlign = 'center'; cctx.textBaseline = 'middle';
    cctx.fillText(emoji, 64, 70);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cvs), transparent: true }));
    sprite.scale.set(0.9, 0.9, 0.9);
    sprite.position.set(c.x, 1.4, c.z);
    this.scene.add(sprite);
    this._sprites.push({ sprite, born: this._clock.elapsedTime, ttl: 2.4 });
  }

  /** Blue Alexa ring pulse on an Echo device. */
  echoPulse(deviceId = 'echo_living') {
    this.deviceHalo(deviceId, 0x35b8c8, 2.6);
  }

  spawnGuests() {
    if (this._guests.length) return;
    const cols = [0x7b5ea7, 0xd64580];
    cols.forEach((col, i) => {
      const g = this._makeSimplePerson(col);
      g.position.set(0.4 + i * 0.7, 0, 9.5);
      this.scene.add(g);
      this._guests.push({ group: g, target: new THREE.Vector3(-2.2 + i * 1.0, 0, 2.0) });
    });
    // Guests wander home after a while.
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

      // Fans spin
      for (const fan of Object.values(this._fans)) {
        fan.rotor.rotation.z += dt * fan.speed * (this._powerCut ? 0.3 : 1) * 4;
      }

      // Transient halos / ripples
      for (let i = this._halos.length - 1; i >= 0; i--) {
        const hl = this._halos[i];
        const age = t - hl.born;
        if (age > hl.ttl) { this.scene.remove(hl.mesh); this._halos.splice(i, 1); continue; }
        const k = age / hl.ttl;
        hl.mesh.scale.setScalar(1 + k * hl.grow);
        hl.mesh.material.opacity = 0.95 * (1 - k);
        if (hl.billboard) hl.mesh.lookAt(this.camera.position);
      }
      for (let i = this._sprites.length - 1; i >= 0; i--) {
        const sp = this._sprites[i];
        const age = t - sp.born;
        if (age > sp.ttl) { this.scene.remove(sp.sprite); this._sprites.splice(i, 1); continue; }
        sp.sprite.position.y += dt * 0.35;
        sp.sprite.material.opacity = 1 - age / sp.ttl;
      }

      // Guests walk
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

      // Motor vibration
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
