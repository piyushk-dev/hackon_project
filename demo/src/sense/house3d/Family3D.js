/**
 * Family3D — the six Sharmas as stylized low-poly Indian figures.
 *
 * Men in kurta-pyjama, women in sari silhouettes (skirt cone + pallu drape),
 * Dadaji in white with a walking stick, Dadiji with a bun, Ananya with
 * pigtails. Each follows a keyframed daily schedule and walks between rooms.
 */

import * as THREE from 'three';
import { roomCenter } from './House3D.js';

const STYLE = {
  rajesh: { kurta: 0x3e6c94, pants: 0x3a3f45, skin: 0xc68b59, hair: 0x2b2620, height: 1.0,  type: 'man' },
  priya:  { kurta: 0xb2496f, pants: 0x8f3a59, skin: 0xd9a377, hair: 0x241f1a, height: 0.94, type: 'woman', drape: 0xd8a03c },
  arjun:  { kurta: 0x1e8c8a, pants: 0x40464d, skin: 0xc68b59, hair: 0x2b2620, height: 0.9,  type: 'man' },
  ananya: { kurta: 0xd9912b, pants: 0x8a4d2a, skin: 0xd9a377, hair: 0x241f1a, height: 0.68, type: 'girl' },
  dadaji: { kurta: 0xf3ede0, pants: 0xe8e0cf, skin: 0xb87f4f, hair: 0xe9e6df, height: 0.94, type: 'elder-man' },
  dadiji: { kurta: 0x8a5a96, pants: 0x6e4478, skin: 0xc08b5f, hair: 0xdfdcd4, height: 0.88, type: 'woman', drape: 0xc7b6cf, bun: true },
};

const OFFSETS = {
  rajesh: [0.7, 0.5], priya: [-0.7, 0.6], arjun: [0.6, -0.7],
  ananya: [-0.6, -0.6], dadaji: [0.1, -0.2], dadiji: [-0.3, 0.9],
};

const GATE = new THREE.Vector3(0, 0, 10.5);
const PORCH = new THREE.Vector3(0, 0, 6.2);

// Where each member lies before their first scheduled move of the day.
const SLEEP = {
  rajesh: { pos: [-4.7, 0.74, -2.1],  yaw: 0 },
  priya:  { pos: [-4.1, 0.74, -2.1],  yaw: 0 },
  dadaji: { pos: [-1.35, 0.74, -2.35], yaw: 0 },
  dadiji: { pos: [-1.0, 0.74, -2.35], yaw: 0 },
  arjun:  { pos: [3.35, 1.52, -1.2],  yaw: Math.PI / 2 },
  ananya: { pos: [3.35, 0.72, -1.2],  yaw: Math.PI / 2 },
};

const SCHEDULES = {
  rajesh: [
    { t: 0, room: 'master_bedroom' }, { t: 430, room: 'kitchen' },
    { t: 455, room: 'living_room' }, { t: 570, room: 'away' },
    { t: 1075, room: 'living_room' }, { t: 1180, room: 'kitchen' },
    { t: 1290, room: 'master_bedroom' },
  ],
  priya: [
    { t: 0, room: 'master_bedroom' }, { t: 372, room: 'kitchen' },
    { t: 470, room: 'living_room' }, { t: 575, room: 'away' },
    { t: 1045, room: 'kitchen' }, { t: 1175, room: 'living_room' },
    { t: 1300, room: 'master_bedroom' },
  ],
  arjun: [
    { t: 0, room: 'study_room' }, { t: 433, room: 'kitchen' },
    { t: 480, room: 'away' }, { t: 905, room: 'study_room' },
    { t: 1170, room: 'living_room' }, { t: 1320, room: 'study_room' },
  ],
  ananya: [
    { t: 0, room: 'study_room' }, { t: 437, room: 'kitchen' },
    { t: 485, room: 'away' }, { t: 935, room: 'living_room' },
    { t: 1080, room: 'study_room' }, { t: 1185, room: 'living_room' },
    { t: 1310, room: 'study_room' },
  ],
  dadaji: [
    { t: 0, room: 'dadaji_room' }, { t: 362, room: 'dadaji_room' },
    { t: 405, room: 'master_bedroom' },
    { t: 430, room: 'dadaji_room' },
    { t: 478, room: 'living_room' },
    { t: 540, room: 'kitchen' },
    { t: 600, room: 'living_room' },
    { t: 780, room: 'dadaji_room' },
    { t: 1050, room: 'porch' },
    { t: 1140, room: 'living_room' },
    { t: 1265, room: 'dadaji_room' },
  ],
  dadiji: [
    { t: 0, room: 'dadaji_room' }, { t: 368, room: 'kitchen' },
    { t: 475, room: 'living_room' },
    { t: 545, room: 'kitchen' },
    { t: 660, room: 'living_room' },
    { t: 800, room: 'dadaji_room' },
    { t: 1040, room: 'kitchen' },
    { t: 1190, room: 'living_room' },
    { t: 1285, room: 'dadaji_room' },
  ],
};

function m(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...opts });
}

function shadowed(mesh) { mesh.castShadow = true; return mesh; }

export class Family3D {
  constructor(house) {
    this.house = house;
    this.members = {};

    for (const [id, style] of Object.entries(STYLE)) {
      const group = this._makePerson(id, style);
      const start = this._targetFor(id, SCHEDULES[id][0].room);
      group.position.copy(start);
      house.scene.add(group);
      house.registerPickable(group, 'person', id);
      this.members[id] = {
        id, group,
        target: start.clone(),
        away: false,
        opacity: 1,
        room: SCHEDULES[id][0].room,
        speed: id === 'dadaji' || id === 'dadiji' ? 0.85 : 1.5,
      };
    }
    house.avatars = this;
  }

  whereIs(id) {
    const mem = this.members[id];
    if (!mem) return 'Unknown';
    if (mem.room === 'away') return 'Away from home';
    if (mem.room === 'porch') return 'On the porch';
    const names = {
      living_room: 'in the Living Room',
      kitchen: 'in the Kitchen',
      master_bedroom: 'in the Master Bedroom',
      dadaji_room: "in Dadaji's Room",
      study_room: 'in the Study',
    };
    return names[mem.room] || 'at home';
  }

  /**
   * Stylized figure. Proportions are driven by height h; women get a
   * sari-skirt cone + pallu drape, men get kurta over pants, elders get
   * white hair (and Dadaji his stick).
   */
  _makePerson(id, s) {
    const g = new THREE.Group();
    const h = s.height;
    const isWoman = s.type === 'woman';
    const isGirl = s.type === 'girl';
    const isElder = s.type.startsWith('elder');
    const FLOOR = 0.24;

    // Legs / skirt
    if (isWoman) {
      const skirt = shadowed(new THREE.Mesh(
        new THREE.CylinderGeometry(0.13 * h + 0.03, 0.24 * h + 0.03, 0.52 * h, 12), m(s.kurta)));
      skirt.position.y = FLOOR + 0.26 * h;
      g.add(skirt);
    } else {
      for (const side of [-1, 1]) {
        const leg = shadowed(new THREE.Mesh(
          new THREE.CylinderGeometry(0.05 * h + 0.01, 0.05 * h + 0.01, 0.34 * h, 8), m(s.pants)));
        leg.position.set(side * 0.075 * h, FLOOR + 0.17 * h, 0);
        g.add(leg);
      }
    }

    // Torso (kurta)
    const torso = shadowed(new THREE.Mesh(
      new THREE.CapsuleGeometry(0.15 * h + 0.015, 0.3 * h, 6, 12),
      m(isWoman ? (s.drape ? 0xf0e4d0 : s.kurta) : s.kurta)  // blouse tone under drape
    ));
    torso.position.y = FLOOR + (isWoman ? 0.62 : 0.5) * h;
    g.add(torso);

    // Sari pallu — a diagonal drape across the torso
    if (isWoman) {
      const pallu = shadowed(new THREE.Mesh(
        new THREE.BoxGeometry(0.09 * h, 0.5 * h, 0.3 * h), m(s.kurta)));
      pallu.position.set(-0.07 * h, FLOOR + 0.62 * h, 0.02);
      pallu.rotation.z = 0.5;
      g.add(pallu);
    }

    // Arms
    for (const side of [-1, 1]) {
      const arm = shadowed(new THREE.Mesh(
        new THREE.CapsuleGeometry(0.038 * h, 0.26 * h, 4, 8),
        m(isWoman ? s.skin : s.kurta)));
      arm.position.set(side * 0.2 * h, FLOOR + (isWoman ? 0.62 : 0.52) * h, 0);
      arm.rotation.z = side * 0.22;
      g.add(arm);
    }

    // Head
    const head = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.125 * (0.85 + h * 0.2), 14, 14), m(s.skin, { roughness: 0.7 })));
    const headY = FLOOR + (isWoman ? 0.98 : 0.86) * h + 0.06;
    head.position.y = headY;
    g.add(head);

    // Hair
    const hairR = 0.125 * (0.85 + h * 0.2);
    const hair = new THREE.Mesh(
      new THREE.SphereGeometry(hairR * 1.06, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), m(s.hair, { roughness: 1 }));
    hair.position.y = headY + hairR * 0.1;
    g.add(hair);
    if (s.bun || isWoman) {
      const bun = new THREE.Mesh(new THREE.SphereGeometry(hairR * 0.45, 8, 8), m(s.hair, { roughness: 1 }));
      bun.position.set(0, headY + hairR * 0.35, -hairR * 0.85);
      g.add(bun);
    }
    if (isGirl) {
      for (const side of [-1, 1]) {
        const tail = new THREE.Mesh(new THREE.SphereGeometry(hairR * 0.38, 8, 8), m(s.hair, { roughness: 1 }));
        tail.position.set(side * hairR * 1.0, headY - hairR * 0.15, -hairR * 0.3);
        g.add(tail);
      }
    }
    if (isElder) {
      // White beard hint
      const beard = new THREE.Mesh(new THREE.SphereGeometry(hairR * 0.5, 8, 8), m(0xe9e6df, { roughness: 1 }));
      beard.scale.set(1, 0.55, 0.7);
      beard.position.set(0, headY - hairR * 0.72, hairR * 0.45);
      g.add(beard);
      // Walking stick
      const stick = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.02, 0.85 * h, 6), m(0x6e523a)));
      stick.position.set(0.26 * h, FLOOR + 0.42 * h, 0.06);
      stick.rotation.z = 0.1;
      g.add(stick);
    }

    return g;
  }

  _targetFor(id, room) {
    const off = OFFSETS[id];
    if (room === 'away') return GATE.clone();
    if (room === 'porch') return PORCH.clone().add(new THREE.Vector3(off[0], 0, 0));
    const c = roomCenter(room);
    return new THREE.Vector3(c.x + off[0], 0, c.z + off[1]);
  }

  setTime(simMinutes) {
    const t = ((simMinutes % 1440) + 1440) % 1440;
    for (const [id, mem] of Object.entries(this.members)) {
      const sched = SCHEDULES[id];
      let current = sched[0];
      for (const kf of sched) { if (kf.t <= t) current = kf; }
      mem.away = current.room === 'away';
      mem.room = current.room;
      mem.target = this._targetFor(id, current.room);

      // Off-screen instantly on time jumps — no ghosts walking to the gate.
      if (mem.away) {
        mem.group.position.copy(GATE);
        mem.opacity = 0;
        mem.group.visible = false;
      }

      // Before their first move of the day, they're asleep in bed.
      const wakeAt = sched[1] ? sched[1].t : 0;
      const shouldLie = t < wakeAt && !!SLEEP[id];
      if (shouldLie && !mem.lying) {
        const s = SLEEP[id];
        mem.group.position.set(...s.pos);
        mem.group.rotation.order = 'YXZ';
        mem.group.rotation.set(-Math.PI / 2, s.yaw, 0);
      } else if (!shouldLie && mem.lying) {
        mem.group.rotation.set(0, 0, 0);
        mem.group.position.y = 0;
      }
      mem.lying = shouldLie;
    }
  }

  update(dt, elapsed) {
    for (const mem of Object.values(this.members)) {
      if (mem.lying) continue; // asleep — no walking, no bobbing
      const pos = mem.group.position;
      const dir = mem.target.clone().sub(pos);
      dir.y = 0;
      const dist = dir.length();
      if (dist > 0.08) {
        dir.normalize().multiplyScalar(Math.min(dist, dt * mem.speed));
        pos.add(dir);
        mem.group.position.y = Math.abs(Math.sin(elapsed * 7)) * 0.04;
        mem.group.rotation.y = Math.atan2(dir.x, dir.z);
      } else {
        mem.group.position.y *= 0.8;
      }
      const gateDist = pos.distanceTo(GATE);
      const targetOpacity = mem.away && gateDist < 1.2 ? 0 : 1;
      mem.opacity += (targetOpacity - mem.opacity) * dt * 3;
      mem.group.visible = mem.opacity > 0.04;
      mem.group.traverse((child) => {
        if (child.material) {
          child.material.transparent = true;
          child.material.opacity = mem.opacity;
        }
      });
    }
  }
}
