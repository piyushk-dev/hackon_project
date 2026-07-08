/**
 * Cinema — director mode for filming the demo video.
 *
 * Hides the app chrome, overlays film captions + a story clock, and plays
 * scripted scenes: deterministic beats of {camera shot, sim time, caption,
 * actions}. Every take is identical, so the video can be re-recorded until
 * it's perfect. The viewer always knows WHO is acting (Alexa's beams) and
 * WHY (the caption's "learned" line).
 *
 * Keys:  C = toggle cinema · 1 = "One Morning" · 2 = "Power Cut" · Esc = stop
 */

import * as THREE from 'three';
import { fmtTime } from './mockData.js';
import { DEVICES3D } from './house3d/House3D.js';

export class Cinema {
  constructor(engine, house, family) {
    this.engine = engine;
    this.house = house;
    this.family = family;
    this.active = false;
    this._timers = [];
    this._buildOverlay();
  }

  _buildOverlay() {
    const stage = document.querySelector('.stage');

    this.clockEl = document.createElement('div');
    this.clockEl.className = 'cine-clock hidden';
    stage.appendChild(this.clockEl);

    this.capEl = document.createElement('div');
    this.capEl.className = 'cine-caption';
    this.capEl.innerHTML = `
      <div class="cine-kicker"></div>
      <div class="cine-title"></div>
      <div class="cine-sub"></div>
    `;
    stage.appendChild(this.capEl);

    this.hintEl = document.createElement('div');
    this.hintEl.className = 'cine-hint hidden';
    this.hintEl.textContent = '1 — one morning · 2 — power cut · Esc — stop · C — exit';
    stage.appendChild(this.hintEl);
  }

  // ─── Mode ──────────────────────────────────────────────────────────
  enter() {
    if (this.active) return;
    this.active = true;
    this._wasPlaying = this.engine.playing;
    this.engine.pause();
    document.body.classList.add('cinema');
    this.house.controls.enabled = false;
    this.house.controls.autoRotate = false;
    // Brief hint, gone before recording starts
    this.hintEl.classList.remove('hidden');
    this._timers.push(setTimeout(() => this.hintEl.classList.add('hidden'), 3200));
  }

  exit() {
    this.stop();
    this.active = false;
    document.body.classList.remove('cinema');
    this.clockEl.classList.add('hidden');
    this.house.releaseCamera();
    if (this._wasPlaying) this.engine.start();
  }

  stop() {
    this._timers.forEach(clearTimeout);
    this._timers = [];
    this._hideCaption();
  }

  // ─── Captions / clock ──────────────────────────────────────────────
  _caption({ kicker, title, sub }) {
    this.capEl.querySelector('.cine-kicker').textContent = kicker || '';
    this.capEl.querySelector('.cine-title').textContent = title || '';
    this.capEl.querySelector('.cine-sub').textContent = sub || '';
    this.capEl.classList.add('show');
  }

  _hideCaption() {
    this.capEl.classList.remove('show');
  }

  _setTime(simMinutes, dayLabel = 'DAY 30') {
    this.engine.state.simMinutes = simMinutes;
    this.house.setTimeOfDay(simMinutes);
    this.family.setTime(simMinutes);
    this.clockEl.classList.remove('hidden');
    this.clockEl.innerHTML = `${fmtTime(simMinutes)}<small>${dayLabel}</small>`;
  }

  /** Alexa glides above a device, then visibly beams it (twice, for camera). */
  _alexaActs(deviceId, color, delayMs = 1400) {
    const d = DEVICES3D[deviceId];
    if (!d) return;
    this.house.presence.moveTo(new THREE.Vector3(...d.pos));
    this._timers.push(setTimeout(() => this.house.alexaBeam(deviceId, color), delayMs));
    this._timers.push(setTimeout(() => this.house.alexaBeam(deviceId, color), delayMs + 2800));
  }

  // ─── Scene runner ──────────────────────────────────────────────────
  _run(beats) {
    this.stop();
    this.enter();
    for (const b of beats) {
      this._timers.push(setTimeout(() => {
        if (b.time !== undefined) this._setTime(b.time, b.day);
        if (b.cam) this.house.flyTo(b.cam, b.camDur ?? 2.2);
        if (b.caption) this._caption(b.caption); else if (b.caption === null) this._hideCaption();
        if (b.run) b.run(this);
      }, b.at * 1000));
    }
  }

  // ─── Scene 1: One Morning at Sharma Niwas (~75s) ───────────────────
  playMorning() {
    const E = this.engine, H = this.house;
    this._run([
      { at: 0, time: 5 * 60 + 55, cam: 'overview', camDur: 0.1,
        caption: { kicker: 'Sharma Niwas · 5:55 AM', title: 'The family is asleep.', sub: 'Alexa isn\'t. Everything you\'re about to see happens without a single command.' } },

      { at: 7, cam: 'alexa', camDur: 2.6,
        caption: { kicker: 'Ghar Sense', title: 'She has watched this home for 30 days.', sub: 'Its rhythms, its sounds, its people — learned, not programmed.' },
        run: (c) => H.presence.speaking(3000) },

      { at: 15, time: 6 * 60 + 15, cam: 'tank', camDur: 2.4,
        caption: { kicker: 'Learned · municipal supply 6:15–7:30', title: 'Water motor — on.', sub: 'No 5:55 alarm for Priya anymore. Alexa learned the supply window weeks ago.' },
        run: (c) => { E.setMotor(true); c._alexaActs('water_motor'); } },

      { at: 25, time: 6 * 60 + 25, cam: 'bath', camDur: 2.4,
        caption: { kicker: 'Learned · bath at 6:45, 14 mornings straight', title: 'Water warming for Dadaji.', sub: 'Pre-heated on the off-peak tariff — ₹3 cheaper than heating at 7.' },
        run: (c) => { E.setAppliance('geyser', true, { detected: false }); c._alexaActs('geyser', 0xd97706); } },

      { at: 35, time: 6 * 60 + 45, cam: 'dadaji', camDur: 2.4,
        caption: { kicker: '6:45 AM', title: 'Warm water. Exactly on time.', sub: 'Nobody asked. Nobody even woke up.' },
        run: (c) => {
          E.setAppliance('geyser', false, { detected: false, silent: true });
          c._alexaActs('echo_dadaji', undefined, 1800);
        } },

      { at: 45, time: 7 * 60 + 2, cam: 'kitchen', camDur: 2.4,
        caption: { kicker: 'Heard · on-device sound recognition', title: '“Priya — teesri seeti ho gayi.”', sub: 'The pressure cooker isn\'t smart. Alexa counted its whistles from the kitchen Echo.' },
        run: (c) => {
          H.presence.moveTo(new THREE.Vector3(...DEVICES3D.kitchen_hub.pos));
          E.state.whistles = 0;
          [0, 1600, 3200].forEach((d, idx) => c._timers.push(setTimeout(() => {
            E.state.whistles = idx + 1;
            E.emitSound('cooker_whistle');
          }, d)));
          c._timers.push(setTimeout(() => { H.alexaBeam('kitchen_hub'); H.presence.speaking(2500); }, 4200));
        } },

      { at: 57, time: 8 * 60, cam: 'mandir', camDur: 2.4,
        caption: { kicker: 'Heard · the 8 AM aarti bell, 27 of 30 mornings', title: 'The house goes quiet on its own.', sub: 'Notifications held, volumes low — pooja time is sacred, and she knows it.' },
        run: (c) => { E.emitSound('temple_bell'); E.setQuietMode(true); H.poojaGlow(true); c._alexaActs('echo_living'); } },

      { at: 68, time: 8 * 60 + 5, cam: 'overview_high', camDur: 3.0,
        caption: { kicker: 'By 8 AM', title: 'Six things handled. Zero commands.', sub: 'This is Ghar Sense — Alexa that thinks ahead, because she learned your home.' },
        run: () => { H.presence.goHome(); H.presence.speaking(4000); } },

      { at: 76, caption: null },
    ]);
  }

  // ─── Scene 2: The Power Cut (~35s) ─────────────────────────────────
  playPowerCut() {
    const E = this.engine, H = this.house;
    this._run([
      { at: 0, time: 15 * 60 + 28, cam: 'overview', camDur: 0.1,
        caption: { kicker: 'Sharma Niwas · 3:28 PM', title: 'An ordinary afternoon.', sub: 'Arjun\'s online class is running in the study.' } },

      { at: 6, time: 15 * 60 + 30,
        caption: { kicker: '3:30 PM', title: 'The grid fails.', sub: 'The mains clamp sees the voltage collapse instantly — this is a power cut, not a tripped fuse.' },
        run: () => E.setPowerCut(true) },

      { at: 13, cam: 'study', camDur: 2.2,
        caption: { kicker: 'Decided in 2 seconds', title: 'Arjun\'s class survives.', sub: 'Inverter triage: study room first, fridge second, fans third. AC and geyser shed.' },
        run: (c) => {
          E.setAppliance('ac_living', false, { detected: false });
          c._alexaActs('echo_study');
          c._timers.push(setTimeout(() => H.alexaBeam('inverter'), 2200));
        } },

      { at: 21, cam: 'dadaji', camDur: 2.2,
        caption: { kicker: 'Announced, in Hindi, to the right room', title: '“Dadaji, fan chal raha hai. Backup: 2.6 hours.”', sub: 'The one person who worries most hears it first.' },
        run: (c) => { c._alexaActs('echo_dadaji'); H.presence.speaking(3000); } },

      { at: 29, time: 15 * 60 + 52, cam: 'overview', camDur: 2.6,
        caption: { kicker: '22 minutes later', title: 'Power returns. The house eases back.', sub: 'Heavy loads wait 90 seconds for the voltage to settle — appliances protected.' },
        run: () => { H.presence.goHome(); E.setPowerCut(false) } },

      { at: 36, caption: null },
    ]);
  }
}
