/**
 * Family3D — the six Sharmas as friendly capsule avatars.
 *
 * Each member follows a keyframed daily schedule (sim-minutes → room) and
 * walks smoothly to their next spot. "away" walks them out the gate and
 * fades them; they return the same way. Dadaji wears white, of course.
 */

import * as THREE from 'three';
import { roomCenter } from './House3D.js';

// Kurta colors — warm, distinct, matching the 2D palette.
const MEMBER_STYLE = {
  rajesh: { color: 0x3e7cb1, height: 1.0, name: 'Rajesh' },
  priya:  { color: 0xd64580, height: 0.95, name: 'Priya' },
  arjun:  { color: 0x0e9594, height: 0.88, name: 'Arjun' },
  ananya: { color: 0xf2b134, height: 0.7, name: 'Ananya' },
  dadaji: { color: 0xf3ede2, height: 0.92, name: 'Dadaji' },
  dadiji: { color: 0xc75b39, height: 0.88, name: 'Dadiji' },
};

// Per-member offset inside a room so people don't stack.
const OFFSETS = {
  rajesh: [0.7, 0.5], priya: [-0.7, 0.6], arjun: [0.6, -0.7],
  ananya: [-0.6, -0.6], dadaji: [0.1, -0.2], dadiji: [-0.3, 0.9],
};

const GATE = new THREE.Vector3(0, 0, 10.5);
const PORCH = new THREE.Vector3(0, 0, 6.2);

// Daily schedule: sorted keyframes {t: simMinutes, room} — 'away' = out the gate.
const SCHEDULES = {
  rajesh: [
    { t: 0, room: 'master_bedroom' }, { t: 400, room: 'kitchen' },
    { t: 455, room: 'living_room' }, { t: 570, room: 'away' },
    { t: 1075, room: 'living_room' }, { t: 1180, room: 'kitchen' },
    { t: 1290, room: 'master_bedroom' },
  ],
  priya: [
    { t: 0, room: 'master_bedroom' }, { t: 350, room: 'kitchen' },
    { t: 470, room: 'living_room' }, { t: 575, room: 'away' },
    { t: 1045, room: 'kitchen' }, { t: 1175, room: 'living_room' },
    { t: 1300, room: 'master_bedroom' },
  ],
  arjun: [
    { t: 0, room: 'study_room' }, { t: 395, room: 'kitchen' },
    { t: 480, room: 'away' }, { t: 905, room: 'study_room' },
    { t: 1170, room: 'living_room' }, { t: 1320, room: 'study_room' },
  ],
  ananya: [
    { t: 0, room: 'study_room' }, { t: 410, room: 'kitchen' },
    { t: 485, room: 'away' }, { t: 935, room: 'living_room' },
    { t: 1080, room: 'study_room' }, { t: 1185, room: 'living_room' },
    { t: 1310, room: 'study_room' },
  ],
  dadaji: [
    { t: 0, room: 'dadaji_room' }, { t: 362, room: 'dadaji_room' },
    { t: 405, room: 'master_bedroom' },   // bath
    { t: 430, room: 'dadaji_room' },
    { t: 478, room: 'living_room' },      // pooja at the mandir
    { t: 540, room: 'kitchen' },          // chai
    { t: 600, room: 'living_room' },
    { t: 780, room: 'dadaji_room' },      // rest
    { t: 1050, room: 'porch' },           // evening (indoor walk day!)
    { t: 1140, room: 'living_room' },
    { t: 1265, room: 'dadaji_room' },
  ],
  dadiji: [
    { t: 0, room: 'dadaji_room' }, { t: 345, room: 'kitchen' },
    { t: 475, room: 'living_room' },      // pooja
    { t: 545, room: 'kitchen' },
    { t: 660, room: 'living_room' },
    { t: 800, room: 'dadaji_room' },
    { t: 1040, room: 'kitchen' },
    { t: 1190, room: 'living_room' },
    { t: 1285, room: 'dadaji_room' },
  ],
};

export class Family3D {
  constructor(house) {
    this.house = house;
    this.members = {};

    for (const [id, style] of Object.entries(MEMBER_STYLE)) {
      const group = this._makePerson(id, style);
      const start = this._targetFor(id, SCHEDULES[id][0].room);
      group.position.copy(start);
      house.scene.add(group);
      this.members[id] = {
        id, group,
        target: start.clone(),
        away: false,
        opacity: 1,
        speed: id === 'dadaji' || id === 'dadiji' ? 0.85 : 1.5,
      };
    }
    house.avatars = this;
  }

  _makePerson(id, style) {
    const g = new THREE.Group();
    const h = style.height;
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.17 * h + 0.02, 0.45 * h, 6, 12),
      new THREE.MeshStandardMaterial({ color: style.color, roughness: 0.8 })
    );
    body.position.y = 0.42 * h + 0.24;
    body.castShadow = true;
    g.add(body);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.14 * (0.8 + h * 0.25), 12, 12),
      new THREE.MeshStandardMaterial({ color: 0xd9a377, roughness: 0.75 })
    );
    head.position.y = 0.95 * h + 0.24;
    head.castShadow = true;
    g.add(head);
    // Dadaji's white hair / Dadiji's bun
    if (id === 'dadaji' || id === 'dadiji') {
      const hair = new THREE.Mesh(
        new THREE.SphereGeometry(0.11, 10, 10),
        new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 1 })
      );
      hair.position.y = 1.03 * h + 0.24;
      hair.scale.y = 0.55;
      g.add(hair);
    }
    // Name tag sprite
    const cvs = document.createElement('canvas');
    cvs.width = 256; cvs.height = 80;
    const ctx = cvs.getContext('2d');
    ctx.font = 'bold 40px Georgia';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const label = style.name;
    const tw = ctx.measureText(label).width + 40;
    ctx.fillStyle = 'rgba(255,252,244,0.92)';
    const rx = (256 - tw) / 2;
    ctx.beginPath();
    ctx.roundRect(rx, 14, tw, 52, 26);
    ctx.fill();
    ctx.fillStyle = '#4a3f30';
    ctx.fillText(label, 128, 42);
    const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cvs), transparent: true }));
    tag.scale.set(1.15, 0.36, 1);
    tag.position.y = 1.35 * h + 0.35;
    g.add(tag);
    return g;
  }

  _targetFor(id, room) {
    const off = OFFSETS[id];
    if (room === 'away') return GATE.clone();
    if (room === 'porch') return PORCH.clone().add(new THREE.Vector3(off[0], 0, 0));
    const c = roomCenter(room);
    return new THREE.Vector3(c.x + off[0], 0, c.z + off[1]);
  }

  /** Called each engine tick with the sim clock. */
  setTime(simMinutes) {
    const t = ((simMinutes % 1440) + 1440) % 1440;
    for (const [id, m] of Object.entries(this.members)) {
      const sched = SCHEDULES[id];
      let current = sched[0];
      for (const kf of sched) { if (kf.t <= t) current = kf; }
      m.away = current.room === 'away';
      m.target = this._targetFor(id, current.room);
    }
  }

  /** Called from the House3D render loop. */
  update(dt, elapsed) {
    for (const m of Object.values(this.members)) {
      const pos = m.group.position;
      const dir = m.target.clone().sub(pos);
      dir.y = 0;
      const dist = dir.length();
      if (dist > 0.08) {
        dir.normalize().multiplyScalar(Math.min(dist, dt * m.speed));
        pos.add(dir);
        // Walk bob
        m.group.position.y = Math.abs(Math.sin(elapsed * 7)) * 0.045;
        m.group.rotation.y = Math.atan2(dir.x, dir.z);
      } else {
        m.group.position.y *= 0.8;
      }
      // Fade in/out at the gate for away members
      const gateDist = pos.distanceTo(GATE);
      const targetOpacity = m.away && gateDist < 1.2 ? 0 : 1;
      m.opacity += (targetOpacity - m.opacity) * dt * 3;
      m.group.visible = m.opacity > 0.04;
      m.group.traverse((child) => {
        if (child.material) {
          child.material.transparent = true;
          child.material.opacity = m.opacity;
        }
      });
    }
  }
}
