/**
 * Ghar Sense — simulation engine.
 *
 * Owns the simulated clock and the shared HomeState. Panels never mutate
 * state directly; scenarios and the day script mutate it through the engine,
 * which emits events on the shared bus. This mirrors the backend split:
 * engine = EventBridge + ContextEngine, panels = read-only consumers.
 */

import { eventBus } from '../utils/eventBus.js';
import {
  initialHomeState,
  APPLIANCES,
  BASE_LOAD_WATTS,
  SOUND_LIBRARY,
  tariffAt,
  tierFor,
  TIER_NAMES,
  fmtTime,
} from './mockData.js';

export const SENSE_EVENTS = {
  TICK: 'sense:tick',               // { simMinutes, state }
  SOUND: 'sense:sound',             // { type, ...SOUND_LIBRARY entry, detail }
  APPLIANCE: 'sense:appliance',     // { id, on, watts, label, icon, detected }
  FEED: 'sense:feed',               // { stage, icon, title, detail, time }
  ASK: 'sense:ask',                 // { id, member, question, category, onAccept, onDecline }
  VOICE: 'sense:voice',             // { member, text, lang, intent }
  ALEXA_SAYS: 'sense:alexaSays',    // { text, target }
  TRUST: 'sense:trust',             // { member, score, delta, tier, tierName }
  WELLNESS: 'sense:wellness',       // { checkpointId, status, note }
  POWER_CUT: 'sense:powerCut',      // { on }
  MODE: 'sense:mode',               // { quietMode } | { purifier }
  STAT: 'sense:stat',               // savings / actions counters changed
};

export class SenseEngine {
  constructor() {
    this.state = initialHomeState();
    this.playing = false;
    this.speed = 4; // sim-minutes per real second
    this._timer = null;
    this._lastReal = null;
    this._dayScript = [];   // { time, fired, fn }
    this._askSeq = 0;
  }

  // ─── Clock ─────────────────────────────────────────────────────────
  start() {
    if (this.playing) return;
    this.playing = true;
    this._lastReal = performance.now();
    this._timer = setInterval(() => this._tick(), 250);
    eventBus.emit(SENSE_EVENTS.TICK, { simMinutes: this.state.simMinutes, state: this.state });
  }

  pause() {
    this.playing = false;
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
  }

  setSpeed(simMinutesPerSecond) {
    this.speed = simMinutesPerSecond;
  }

  _tick() {
    const now = performance.now();
    const dt = (now - this._lastReal) / 1000;
    this._lastReal = now;
    const prev = this.state.simMinutes;
    this.state.simMinutes += dt * this.speed;

    this._advanceContinuous(dt * this.speed);
    this._fireDayScript(prev, this.state.simMinutes);

    eventBus.emit(SENSE_EVENTS.TICK, { simMinutes: this.state.simMinutes, state: this.state });
  }

  /** Continuous physics: tank drain/fill, LPG use, energy cost, voltage jitter. */
  _advanceContinuous(simMinutesElapsed) {
    const s = this.state;

    // Water: motor fills fast, family usage drains slowly.
    if (s.water.motor) {
      s.water.level = Math.min(100, s.water.level + simMinutesElapsed * 1.55);
    } else {
      s.water.level = Math.max(2, s.water.level - simMinutesElapsed * 0.045);
    }

    // LPG: burns while the kitchen is audibly active (approximation: mixer or whistles recently)
    s.lpg.kg = Math.max(0, s.lpg.kg - (s.lpg.dailyUse / 1440) * simMinutesElapsed);

    // Energy: integrate load into kWh + running cost awareness.
    const kw = this.currentLoadWatts() / 1000;
    s.kwhToday += kw * (simMinutesElapsed / 60);

    // Voltage jitter (unless power cut).
    if (!s.powerCut) {
      s.voltage = 228 + Math.sin(s.simMinutes / 7) * 4 + (Math.random() - 0.5) * 2;
    } else {
      s.voltage = 0;
    }

    // AQI drifts slowly back toward baseline after spikes.
    if (s.aqi > 130) s.aqi -= simMinutesElapsed * (s.purifier ? 0.9 : 0.25);
  }

  // ─── Day script ────────────────────────────────────────────────────
  loadDayScript(entries) {
    this._dayScript = entries.map((e) => ({ ...e, fired: false }));
  }

  _fireDayScript(prevMin, nowMin) {
    for (const entry of this._dayScript) {
      if (!entry.fired && entry.time > prevMin && entry.time <= nowMin) {
        entry.fired = true;
        try { entry.fn(this); } catch (err) { console.error('day script step failed', err); }
      }
    }
  }

  // ─── State mutations (used by scenarios + day script) ──────────────
  currentLoadWatts() {
    const s = this.state;
    if (s.powerCut) {
      // Inverter carries only essentials.
      let w = 60; // fridge cycling low + router
      if (s.appliances.lights) w += 120;
      return w;
    }
    let w = BASE_LOAD_WATTS;
    for (const [id, on] of Object.entries(s.appliances)) {
      if (on && APPLIANCES[id]) w += APPLIANCES[id].watts;
    }
    return w;
  }

  setAppliance(id, on, { detected = true, silent = false } = {}) {
    const s = this.state;
    if (!!s.appliances[id] === on) return;
    s.appliances[id] = on;
    const a = APPLIANCES[id];
    if (!silent && a) {
      eventBus.emit(SENSE_EVENTS.APPLIANCE, {
        id, on, watts: a.watts, label: a.label, icon: a.icon, detected,
      });
    }
  }

  emitSound(type, detail = '') {
    const def = SOUND_LIBRARY[type];
    if (!def) return;
    eventBus.emit(SENSE_EVENTS.SOUND, { type, ...def, detail, time: this.state.simMinutes });
  }

  feed(stage, icon, title, detail) {
    eventBus.emit(SENSE_EVENTS.FEED, {
      stage, icon, title, detail, time: fmtTime(this.state.simMinutes),
    });
  }

  alexaSays(text, target = 'Echo · Living Room') {
    eventBus.emit(SENSE_EVENTS.ALEXA_SAYS, { text, target });
  }

  voice(member, text, lang, intent) {
    eventBus.emit(SENSE_EVENTS.VOICE, { member, text, lang, intent });
  }

  /**
   * Alexa asks before acting. The card renders ✓/✗ buttons; the answer
   * feeds trust exactly like backend record_acceptance / record_override
   * (+5 accept, −15 override).
   */
  ask(member, question, category, { onAccept, onDecline, autoAcceptMs = null } = {}) {
    const id = `ask-${++this._askSeq}`;
    eventBus.emit(SENSE_EVENTS.ASK, {
      id, member, question, category, autoAcceptMs,
      accept: () => {
        this.adjustTrust(member, +5);
        this.state.actionsToday += 1;
        eventBus.emit(SENSE_EVENTS.STAT, this.state);
        if (onAccept) onAccept(this);
      },
      decline: () => {
        this.adjustTrust(member, -15);
        if (onDecline) onDecline(this);
      },
    });
  }

  adjustTrust(member, delta) {
    const s = this.state;
    const score = Math.max(0, Math.min(100, (s.trust[member] ?? 50) + delta));
    s.trust[member] = score;
    const tier = tierFor(score);
    eventBus.emit(SENSE_EVENTS.TRUST, {
      member, score, delta, tier, tierName: TIER_NAMES[tier],
    });
  }

  addSavings(rupees, reason) {
    this.state.savingsToday += rupees;
    eventBus.emit(SENSE_EVENTS.STAT, this.state);
    if (reason) {
      this.feed('ACT', '💰', `Saved ₹${rupees.toFixed(0)}`, reason);
    }
  }

  setPowerCut(on) {
    this.state.powerCut = on;
    eventBus.emit(SENSE_EVENTS.POWER_CUT, { on });
  }

  setQuietMode(on) {
    this.state.quietMode = on;
    eventBus.emit(SENSE_EVENTS.MODE, { quietMode: on });
  }

  setPurifier(on) {
    this.state.purifier = on;
    eventBus.emit(SENSE_EVENTS.MODE, { purifier: on });
  }

  setMotor(on) {
    this.state.water.motor = on;
    this.setAppliance('water_motor', on);
  }

  wellness(checkpointId, status, note = '') {
    eventBus.emit(SENSE_EVENTS.WELLNESS, { checkpointId, status, note });
  }

  tariff() {
    return tariffAt(this.state.simMinutes);
  }
}
