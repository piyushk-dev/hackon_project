/**
 * AlexaPresence — Alexa as a visible being in the 3D scene.
 *
 * A luminous orb floating above the house: glowing core, halo ring, soft
 * light. When Alexa acts, she fires a beam of light from the orb to the
 * device — the viewer *sees* who is doing things. `speaking()` makes the
 * orb pulse with expanding rings while she talks.
 */

import * as THREE from 'three';

const CYAN = 0x2aa8b8;

function glowTexture() {
  const cvs = document.createElement('canvas');
  cvs.width = 128; cvs.height = 128;
  const ctx = cvs.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
  g.addColorStop(0, 'rgba(190, 245, 255, 0.9)');
  g.addColorStop(0.35, 'rgba(74, 196, 214, 0.35)');
  g.addColorStop(1, 'rgba(42, 168, 184, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(cvs);
}

export class AlexaPresence {
  constructor(scene, position = new THREE.Vector3(0, 5.7, 0)) {
    this.scene = scene;
    this.home = position.clone();
    this._dest = position.clone();
    this._beams = [];
    this._pings = [];
    this._speakUntil = 0;

    this.group = new THREE.Group();
    this.group.position.copy(position);

    // Core
    this.core = new THREE.Mesh(
      new THREE.SphereGeometry(0.4, 28, 28),
      new THREE.MeshStandardMaterial({
        color: 0xe8fbfd,
        emissive: CYAN,
        emissiveIntensity: 1.1,
        roughness: 0.25,
        metalness: 0.05,
      })
    );
    this.group.add(this.core);

    // Soft glow sprite
    this.glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture(),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    this.glow.scale.setScalar(3.4);
    this.group.add(this.glow);

    // Halo ring
    this.ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.66, 0.02, 10, 48),
      new THREE.MeshStandardMaterial({
        color: CYAN, emissive: CYAN, emissiveIntensity: 1.4,
        transparent: true, opacity: 0.85,
      })
    );
    this.ring.rotation.x = Math.PI / 2.6;
    this.group.add(this.ring);

    // Light she casts on the home below
    this.light = new THREE.PointLight(CYAN, 1.0, 14, 1.6);
    this.group.add(this.light);

    scene.add(this.group);
  }

  /** Pulse rings while Alexa is talking. */
  speaking(durationMs = 3000) {
    this._speakUntil = performance.now() + durationMs;
  }

  /** Glide the orb over a spot in the house — she attends where she acts. */
  moveTo(vec3, hoverHeight = 3.1) {
    this._dest = vec3.clone();
    this._dest.y = Math.max(hoverHeight, vec3.y + 1.6);
  }

  goHome() {
    this._dest = this.home.clone();
  }

  /** Fire a light beam from the orb to a world position. */
  beamTo(targetVec3, colorHex = CYAN) {
    const from = this.group.position.clone();
    const to = targetVec3.clone();
    const mid = from.clone().lerp(to, 0.45);
    mid.y = Math.max(from.y, to.y) + 1.0;
    const curve = new THREE.QuadraticBezierCurve3(from, mid, to);

    const tube = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 40, 0.028, 8, false),
      new THREE.MeshBasicMaterial({
        color: colorHex, transparent: true, opacity: 0.0,
        blending: THREE.AdditiveBlending, depthWrite: false,
      })
    );
    this.scene.add(tube);

    // Traveling pulse
    const pulse = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 12, 12),
      new THREE.MeshBasicMaterial({
        color: 0xdffcff, transparent: true, opacity: 0.95,
        blending: THREE.AdditiveBlending, depthWrite: false,
      })
    );
    this.scene.add(pulse);

    this._beams.push({ tube, pulse, curve, born: performance.now(), ttl: 2300 });
    this.speaking(1500);
  }

  _spawnPing() {
    const ping = new THREE.Mesh(
      new THREE.TorusGeometry(0.5, 0.014, 8, 40),
      new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.8 })
    );
    ping.rotation.x = Math.PI / 2.6;
    ping.position.copy(this.group.position);
    this.scene.add(ping);
    this._pings.push({ mesh: ping, born: performance.now(), ttl: 1100 });
  }

  update(dt, t) {
    // Glide toward destination, then float + breathe around it
    const k = 1 - Math.exp(-dt * 2.2);
    this.group.position.x += (this._dest.x - this.group.position.x) * k;
    this.group.position.z += (this._dest.z - this.group.position.z) * k;
    const wantY = this._dest.y + Math.sin(t * 0.9) * 0.14;
    this.group.position.y += (wantY - this.group.position.y) * k * 1.6;
    this.ring.rotation.z += dt * 0.5;

    const speaking = performance.now() < this._speakUntil;
    const base = speaking ? 1.5 : 1.05;
    this.core.material.emissiveIntensity = base + Math.sin(t * (speaking ? 9 : 2.2)) * (speaking ? 0.45 : 0.15);
    this.glow.material.opacity = speaking ? 0.95 : 0.75;
    this.light.intensity = speaking ? 1.7 : 0.9;

    if (speaking && Math.floor(t * 2.2) !== this._lastPing) {
      this._lastPing = Math.floor(t * 2.2);
      this._spawnPing();
    }

    const now = performance.now();
    for (let i = this._beams.length - 1; i >= 0; i--) {
      const b = this._beams[i];
      const k = (now - b.born) / b.ttl;
      if (k >= 1) {
        this.scene.remove(b.tube); this.scene.remove(b.pulse);
        this._beams.splice(i, 1);
        continue;
      }
      // Beam fades in fast, lingers, fades out
      b.tube.material.opacity = k < 0.15 ? k / 0.15 * 0.75 : 0.75 * (1 - (k - 0.15) / 0.85);
      const pk = Math.min(1, k / 0.45);
      b.pulse.position.copy(b.curve.getPoint(pk));
      b.pulse.material.opacity = pk >= 1 ? Math.max(0, 0.95 - (k - 0.45) * 3) : 0.95;
    }
    for (let i = this._pings.length - 1; i >= 0; i--) {
      const p = this._pings[i];
      const k = (now - p.born) / p.ttl;
      if (k >= 1) { this.scene.remove(p.mesh); this._pings.splice(i, 1); continue; }
      p.mesh.scale.setScalar(1 + k * 2.6);
      p.mesh.material.opacity = 0.8 * (1 - k);
      p.mesh.position.y = this.group.position.y;
    }
  }
}
