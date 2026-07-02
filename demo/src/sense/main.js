/**
 * Ghar Sense — page bootstrap (warm 3D edition).
 *
 * The 3D house is the hero; the engine drives both the UI panels and the
 * 3D effects (day/night, room lights, halos, ripples, avatars, guests).
 * Everything runs on mock data.
 */

import { eventBus } from '../utils/eventBus.js';
import { SenseEngine, SENSE_EVENTS } from './SenseEngine.js';
import { fmtTime } from './mockData.js';
import {
  buildDayScript,
  cookerScenario,
  guestScenario,
  poojaScenario,
  powerCutScenario,
  motorScenario,
  aqiScenario,
  coughScenario,
  ironScenario,
  voiceScenario,
} from './scenarios.js';
import { House3D } from './house3d/House3D.js';
import { Family3D } from './house3d/Family3D.js';
import { WaveStrip } from './panels/WaveStrip.js';
import { VitalsPanel } from './panels/VitalsPanel.js';
import { VoicePanel } from './panels/VoicePanel.js';
import { WellnessPanel } from './panels/WellnessPanel.js';
import { FeedPanel } from './panels/FeedPanel.js';

// ─── Engine + 3D world ───────────────────────────────────────────────
const engine = new SenseEngine();
engine.loadDayScript(buildDayScript());

const house = new House3D(document.getElementById('house-canvas'));
const family = new Family3D(house);
engine.visuals = house; // scenarios can trigger 3D-only effects (guests)

// ─── Panels ──────────────────────────────────────────────────────────
new WaveStrip(document.getElementById('wave-strip'), engine);
new VitalsPanel(document.getElementById('vitals-panel'), engine);
new VoicePanel(document.getElementById('voice-panel'), engine);
new WellnessPanel(document.getElementById('wellness-panel'), engine);
new FeedPanel(document.getElementById('feed-panel'));

// ─── Engine → 3D wiring ──────────────────────────────────────────────
eventBus.on(SENSE_EVENTS.TICK, ({ simMinutes, state }) => {
  house.setTimeOfDay(simMinutes);
  house.setTankLevel(state.water.level);
  house.setAQI(state.aqi);
  family.setTime(simMinutes);
});

eventBus.on(SENSE_EVENTS.POWER_CUT, ({ on }) => {
  house.setPowerCut(on);
  document.body.classList.toggle('power-cut', on);
});

eventBus.on(SENSE_EVENTS.MODE, (m) => {
  if ('quietMode' in m) house.poojaGlow(m.quietMode);
});

// Sound events → floor ripples / device effects in the house.
const SOUND_FX = {
  cooker_whistle: () => house.soundRipple('kitchen', '🍲', 0xe8890c),
  doorbell:       () => house.soundRipple(null, '🔔', 0x7b5ea7),
  temple_bell:    () => { house.soundRipple('living_room', '🛕', 0xe8890c); house.poojaGlow(true); },
  motor_whine:    () => house.deviceHalo('water_motor', 0xce4a3b, 3.5),
  cough:          () => house.soundRipple('dadaji_room', '🤒', 0xce4a3b),
  mixer:          () => house.soundRipple('kitchen', '🌀', 0x0e9594),
  tap_running:    () => house.soundRipple('master_bedroom', '🚰', 0x3e7cb1),
  glass_break:    () => house.soundRipple('living_room', '🪟', 0xce4a3b),
};
eventBus.on(SENSE_EVENTS.SOUND, (evt) => SOUND_FX[evt.type]?.());

// Appliance signatures → device halos.
const APPLIANCE_FX = {
  geyser:      { device: 'geyser', color: 0xe8560c },
  ac_living:   { device: 'living_room_ac', color: 0x3e9cd6 },
  water_motor: { device: 'water_motor', color: 0x3e7cb1 },
  iron:        { device: 'iron', color: 0xce4a3b },
  mixer:       { device: 'kitchen_hub', color: 0x0e9594 },
  tv:          { device: 'smart_tv', color: 0x7b5ea7 },
  fridge:      { device: 'fridge', color: 0x3e7cb1 },
};
eventBus.on(SENSE_EVENTS.APPLIANCE, (evt) => {
  const fx = APPLIANCE_FX[evt.id];
  if (fx) house.deviceHalo(fx.device, fx.color, 3);
  if (evt.id === 'water_motor') house.setMotor(evt.on);
});

// Alexa announcements → toast + echo ring pulse in 3D.
const toast = document.getElementById('alexa-toast');
const toastText = document.getElementById('alexa-toast-text');
const toastTarget = document.getElementById('alexa-toast-target');
let toastTimer = null;

eventBus.on(SENSE_EVENTS.ALEXA_SAYS, ({ text, target }) => {
  toastText.textContent = text;
  toastTarget.textContent = `🔊 ${target}`;
  toast.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 7000);

  const t = (target || '').toLowerCase();
  if (t.includes('all')) {
    ['echo_living', 'echo_dadaji', 'echo_study'].forEach((d) => house.echoPulse(d));
  } else if (t.includes('dadaji')) {
    house.echoPulse('echo_dadaji');
  } else if (t.includes('study') || t.includes('arjun') || t.includes('kids')) {
    house.echoPulse('echo_study');
  } else if (t.includes('kitchen')) {
    house.deviceHalo('kitchen_hub', 0x35b8c8, 2.6);
  } else {
    house.echoPulse('echo_living');
  }
});

// ─── Header: clock + stats ───────────────────────────────────────────
const clockEl = document.getElementById('sim-clock');
const clockSky = document.getElementById('clock-sky');
const statSavings = document.getElementById('stat-savings');
const statActions = document.getElementById('stat-actions');

function skyEmoji(simMinutes) {
  const h = (simMinutes / 60) % 24;
  if (h < 6) return '🌙';
  if (h < 8) return '🌅';
  if (h < 17) return '☀️';
  if (h < 19.5) return '🌇';
  return '🌙';
}

eventBus.on(SENSE_EVENTS.TICK, ({ simMinutes, state }) => {
  clockEl.textContent = fmtTime(simMinutes);
  clockSky.textContent = skyEmoji(simMinutes);
  statSavings.textContent = `₹${state.savingsToday.toFixed(0)}`;
  statActions.textContent = String(state.actionsToday);
});
eventBus.on(SENSE_EVENTS.STAT, (state) => {
  statSavings.classList.add('bump');
  setTimeout(() => statSavings.classList.remove('bump'), 500);
  statSavings.textContent = `₹${state.savingsToday.toFixed(0)}`;
  statActions.textContent = String(state.actionsToday);
});

// ─── Header: play / pause / speed ────────────────────────────────────
const playBtn = document.getElementById('play-btn');
playBtn.addEventListener('click', () => {
  if (engine.playing) {
    engine.pause();
    playBtn.textContent = '▶ Play the Day';
    playBtn.classList.remove('playing');
  } else {
    engine.start();
    playBtn.textContent = '⏸ Pause';
    playBtn.classList.add('playing');
  }
});

document.querySelectorAll('.speed-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.speed-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    engine.setSpeed(Number(btn.dataset.speed));
  });
});

// ─── Scenario trigger chips ──────────────────────────────────────────
const SCENARIOS = {
  cooker: cookerScenario,
  guest: guestScenario,
  pooja: poojaScenario,
  powercut: powerCutScenario,
  motor: motorScenario,
  aqi: aqiScenario,
  cough: coughScenario,
  iron: ironScenario,
  voice: voiceScenario,
};

document.querySelectorAll('.scenario-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const fn = SCENARIOS[btn.dataset.scenario];
    if (!fn) return;
    btn.classList.add('fired');
    setTimeout(() => btn.classList.remove('fired'), 1200);
    fn(engine);
  });
});

// ─── Go ──────────────────────────────────────────────────────────────
engine.start();
playBtn.textContent = '⏸ Pause';
playBtn.classList.add('playing');

console.log('Ghar Sense — Sharma Niwas 3D ready (mock data).');
