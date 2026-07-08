/**
 * Ghar Sense — page bootstrap (interactive 3D edition).
 *
 * The 3D house is the stage, Alexa is the star: she speaks (browser TTS),
 * her words type out in the bubble, and every device and family member in
 * the house is clickable. Everything runs on mock data.
 */

import { eventBus } from '../utils/eventBus.js';
import { SenseEngine, SENSE_EVENTS } from './SenseEngine.js';
import { fmtTime, FAMILY, tierFor, TIER_NAMES } from './mockData.js';
import {
  buildDayScript,
  DAY_MOMENTS,
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
import { Cinema } from './cinema.js';
import { VoiceService } from './VoiceService.js';
import { icon, stripEmoji } from './icons.js';
import { WaveStrip } from './panels/WaveStrip.js';
import { StatusBar } from './panels/StatusBar.js';
import { VoicePanel } from './panels/VoicePanel.js';
import { WellnessPanel } from './panels/WellnessPanel.js';
import { FeedPanel } from './panels/FeedPanel.js';

// ─── Core ────────────────────────────────────────────────────────────
const engine = new SenseEngine();
engine.loadDayScript(buildDayScript());

const house = new House3D(document.getElementById('house-canvas'));
const family = new Family3D(house);
engine.visuals = house;

const alexaVoice = new VoiceService();
const cinema = new Cinema(engine, house, family);
window.gharSense = { engine, house, family, cinema };

// Director keys: C cinema · 1 morning scene · 2 power-cut scene · Esc stop
document.addEventListener('keydown', (ev) => {
  if (ev.target.tagName === 'INPUT' || ev.target.tagName === 'TEXTAREA') return;
  const k = ev.key.toLowerCase();
  if (k === 'c') cinema.active ? cinema.exit() : cinema.enter();
  else if (k === '1') cinema.playMorning();
  else if (k === '2') cinema.playPowerCut();
  else if (k === 'escape' && cinema.active) cinema.exit();
});

// ─── Chrome icons ────────────────────────────────────────────────────
document.getElementById('brand-mark').innerHTML = icon('home');
document.getElementById('diary-title').innerHTML = `${icon('sparkle')} Alexa's Diary`;
document.getElementById('family-title').innerHTML = `${icon('users')} Family & Trust`;
document.getElementById('scenario-fab').innerHTML = `${icon('film')} Scenarios`;

// ─── Panels ──────────────────────────────────────────────────────────
new WaveStrip(document.getElementById('wave-strip'), engine);
new StatusBar(document.getElementById('status-pills'), engine);
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
  if (fx) {
    house.deviceHalo(fx.device, fx.color, 3);
    // Autonomous actions come FROM Alexa — show her doing it
    if (evt.detected !== false && evt.on) house.alexaBeam(fx.device, fx.color);
  }
  if (evt.id === 'water_motor') house.setMotor(evt.on);
});

// ─── Alexa bubble: typed text + voice + echo pulse ───────────────────
const bubble = document.getElementById('alexa-bubble');
const bubbleText = document.getElementById('alexa-text');
const bubbleTarget = document.getElementById('alexa-target');
let bubbleTimer = null;
let typeTimer = null;

function alexaSpeak(text, target) {
  // Typewriter
  const shown = stripEmoji(text);
  if (typeTimer) clearInterval(typeTimer);
  bubbleText.textContent = '';
  let i = 0;
  typeTimer = setInterval(() => {
    i += 2;
    bubbleText.textContent = shown.slice(0, i);
    if (i >= shown.length) clearInterval(typeTimer);
  }, 22);

  bubbleTarget.textContent = target;
  bubble.classList.add('show', 'speaking');
  if (bubbleTimer) clearTimeout(bubbleTimer);
  bubbleTimer = setTimeout(() => bubble.classList.remove('show', 'speaking'), 8500);

  alexaVoice.speak(text);
}

eventBus.on(SENSE_EVENTS.ALEXA_SAYS, ({ text, target }) => {
  alexaSpeak(text, target);
  house.presence.speaking(Math.min(9000, 1500 + text.length * 55));

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

// ─── Interactivity: click devices & people in the house ─────────────
const DEVICE_INFO = {
  living_room_ac: { label: 'Living Room AC', desc: '1.5-ton split · learned comfort: 24 °C', watts: 1500, appliance: 'ac_living' },
  geyser:         { label: 'Smart Geyser', desc: '25 L storage · pre-heats before learned bath times', watts: 2000, appliance: 'geyser' },
  smart_tv:       { label: 'Smart TV', desc: '55″ Fire TV · off during Arjun\'s tuition hours', watts: 120, appliance: 'tv' },
  fridge:         { label: 'Refrigerator', desc: 'Always on · protected first during power cuts', watts: 150 },
  cooker:         { label: 'Pressure Cooker', desc: 'Not smart — Alexa counts its whistles by sound', watts: 0 },
  water_motor:    { label: 'Water Motor', desc: '1 HP · auto-runs in the supply window, dry-run protected', watts: 750, motor: true },
  purifier:       { label: 'Air Purifier', desc: 'Dadaji\'s room · auto-on when AQI crosses 200', watts: 45, purifier: true },
  inverter:       { label: 'Inverter', desc: 'Keeps study, fridge & fans alive in power cuts', watts: 0 },
  kitchen_hub:    { label: 'Kitchen Hub', desc: 'Echo Show 8 · recipes, timers, chai suggestions', watts: 15 },
  water_tank:     { label: 'Water Tank', desc: '1000 L overhead · level from an ultrasonic sensor', watts: 0 },
  echo_living:    { label: 'Echo · Living Room', echo: true },
  echo_dadaji:    { label: "Echo · Dadaji's Room", echo: true },
  echo_study:     { label: 'Echo · Study', echo: true },
};

const pickPop = document.getElementById('pick-pop');
const stage = document.querySelector('.stage');

function closePop() {
  pickPop.classList.add('hidden');
}
document.addEventListener('pointerdown', (ev) => {
  if (!pickPop.classList.contains('hidden') && !pickPop.contains(ev.target)) closePop();
});

function positionPop(x, y) {
  const rect = stage.getBoundingClientRect();
  let px = x - rect.left + 14;
  let py = y - rect.top - 10;
  pickPop.classList.remove('hidden');
  const w = pickPop.offsetWidth || 240;
  const h = pickPop.offsetHeight || 140;
  if (px + w > rect.width - 12) px = x - rect.left - w - 14;
  if (py + h > rect.height - 12) py = rect.height - h - 12;
  if (py < 12) py = 12;
  pickPop.style.left = `${px}px`;
  pickPop.style.top = `${py}px`;
}

function showDevicePop(id, x, y) {
  const info = DEVICE_INFO[id];
  if (!info) return;

  if (info.echo) {
    pickPop.innerHTML = `
      <div class="pop-head"><span class="pop-dot pop-dot-alexa"></span><b>${info.label}</b><button class="pop-x">×</button></div>
      <div class="pop-desc">Alexa is listening here — wake-word only, always.</div>
      <button class="pop-btn" id="pop-action">${icon('mic')} Ask Alexa</button>
    `;
    positionPop(x, y);
    pickPop.querySelector('#pop-action').addEventListener('click', () => {
      closePop();
      engine.alexaSays('Namaste! Main sun rahi hoon. Try a scenario from the Scenarios menu — or tap any device to control it yourself.', info.label);
    });
  } else {
    let on = false, toggleable = false;
    if (info.appliance) { on = !!engine.state.appliances[info.appliance]; toggleable = true; }
    if (info.motor) { on = engine.state.water.motor; toggleable = true; }
    if (info.purifier) { on = engine.state.purifier; toggleable = true; }

    pickPop.innerHTML = `
      <div class="pop-head"><span class="pop-dot ${on ? 'pop-dot-on' : ''}"></span><b>${info.label}</b><button class="pop-x">×</button></div>
      <div class="pop-desc">${info.desc}</div>
      ${info.watts ? `<div class="pop-meta">${info.watts} W ${on ? '· running' : '· idle'}</div>` : ''}
      ${toggleable ? `<button class="pop-btn" id="pop-action">${on ? 'Turn off' : 'Turn on'}</button>` : ''}
    `;
    positionPop(x, y);
    const btn = pickPop.querySelector('#pop-action');
    if (btn) {
      btn.addEventListener('click', () => {
        closePop();
        const next = !on;
        if (info.motor) { engine.setMotor(next); }
        else if (info.purifier) { engine.setPurifier(next); house.deviceHalo('purifier', 0x0e9594, 3); }
        else { engine.setAppliance(info.appliance, next); }
        engine.feed('ACT', '👆', `${info.label} turned ${next ? 'on' : 'off'} — by you`, 'Manual control from the 3D house. Alexa notes the correction and learns.');
      });
    }
  }
  pickPop.querySelector('.pop-x').addEventListener('click', closePop);
}

function showPersonPop(id, x, y) {
  const member = FAMILY[id];
  if (!member) return;
  const score = engine.state.trust[id];
  const tier = tierFor(score);
  pickPop.innerHTML = `
    <div class="pop-head"><span class="avatar" style="background:${member.color}1c;color:${member.color};border-color:${member.color}55">${member.name[0]}</span><b style="color:${member.color}">${member.name}</b><button class="pop-x">×</button></div>
    <div class="pop-desc">${member.role} · ${family.whereIs(id)}</div>
    <div class="pop-trust">
      <span>Trust ${Math.round(score)}</span>
      <div class="pop-trust-track"><i style="width:${score}%; background:${member.color}"></i></div>
      <span>${TIER_NAMES[tier]}</span>
    </div>
    <div class="pop-meta">Alexa ${tier >= 3 ? 'acts on its own' : tier >= 2 ? 'suggests, then acts' : 'always asks first'} for ${member.name}</div>
  `;
  positionPop(x, y);
  pickPop.querySelector('.pop-x').addEventListener('click', closePop);
}

house.onPick = ({ type, id, x, y }) => {
  if (type === 'device') showDevicePop(id, x, y);
  else if (type === 'person') showPersonPop(id, x, y);
};

// ─── Header: clock, stats, timeline ──────────────────────────────────
const clockEl = document.getElementById('sim-clock');
const clockSky = document.getElementById('clock-sky');
const statSavings = document.getElementById('stat-savings');
const statActions = document.getElementById('stat-actions');

let lastSkyIcon = '';
function updateSkyIcon(simMinutes) {
  const h = (simMinutes / 60) % 24;
  const name = h >= 6 && h < 19 ? 'sun' : 'moon';
  if (name !== lastSkyIcon) {
    lastSkyIcon = name;
    clockSky.innerHTML = icon(name);
    clockSky.classList.toggle('is-night', name === 'moon');
  }
}

// Day timeline: 6:00 → 22:30
const DAY_START = 6 * 60, DAY_END = 22.5 * 60;
const dayTrack = document.getElementById('day-track');
const dayFill = document.getElementById('day-fill');
const dayNow = document.getElementById('day-now');
const momentEls = [];
for (const m of DAY_MOMENTS) {
  const el = document.createElement('span');
  el.className = 'day-moment';
  el.title = `${fmtTime(m.time)} — ${m.label}`;
  el.style.left = `${((m.time - DAY_START) / (DAY_END - DAY_START)) * 100}%`;
  dayTrack.appendChild(el);
  momentEls.push({ el, time: m.time });
}

eventBus.on(SENSE_EVENTS.TICK, ({ simMinutes, state }) => {
  clockEl.textContent = fmtTime(simMinutes);
  updateSkyIcon(simMinutes);
  statSavings.textContent = `₹${state.savingsToday.toFixed(0)}`;
  statActions.textContent = String(state.actionsToday);

  const p = Math.max(0, Math.min(1, (simMinutes - DAY_START) / (DAY_END - DAY_START)));
  dayFill.style.width = `${p * 100}%`;
  dayNow.style.left = `${p * 100}%`;
  for (const m of momentEls) m.el.classList.toggle('past', simMinutes >= m.time);
});
eventBus.on(SENSE_EVENTS.STAT, (state) => {
  statSavings.classList.add('bump');
  setTimeout(() => statSavings.classList.remove('bump'), 500);
  statSavings.textContent = `₹${state.savingsToday.toFixed(0)}`;
  statActions.textContent = String(state.actionsToday);
});

// ─── Controls: play / speed / voice ──────────────────────────────────
const playBtn = document.getElementById('play-btn');
playBtn.innerHTML = `${icon('play')} Play the day`;
playBtn.addEventListener('click', () => {
  if (engine.playing) {
    engine.pause();
    playBtn.innerHTML = `${icon('play')} Play the day`;
    playBtn.classList.remove('playing');
  } else {
    engine.start();
    playBtn.innerHTML = `${icon('pause')} Pause`;
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

const voiceBtn = document.getElementById('voice-btn');
voiceBtn.innerHTML = icon('volume');
if (!alexaVoice.supported) voiceBtn.classList.add('hidden');
voiceBtn.addEventListener('click', () => {
  const next = !alexaVoice.enabled;
  alexaVoice.setEnabled(next);
  voiceBtn.innerHTML = icon(next ? 'volume' : 'volumeOff');
  voiceBtn.classList.toggle('muted', !next);
});

// ─── Scenario launcher ───────────────────────────────────────────────
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

const scenarioFab = document.getElementById('scenario-fab');
const scenarioMenu = document.getElementById('scenario-menu');
scenarioFab.addEventListener('click', () => {
  scenarioMenu.classList.toggle('open');
  scenarioFab.classList.toggle('open');
});

document.querySelectorAll('.scenario-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const fn = SCENARIOS[btn.dataset.scenario];
    if (!fn) return;
    btn.classList.add('fired');
    setTimeout(() => btn.classList.remove('fired'), 1200);
    scenarioMenu.classList.remove('open');
    scenarioFab.classList.remove('open');
    fn(engine);
  });
});

// ─── Dock collapse toggles ───────────────────────────────────────────
document.querySelectorAll('.dock-toggle').forEach((btn) => {
  btn.addEventListener('click', () => {
    const dock = btn.closest('.dock');
    dock.classList.toggle('collapsed');
    btn.textContent = dock.classList.contains('collapsed') ? '+' : '–';
  });
});

// ─── Splash → enter ──────────────────────────────────────────────────
const splash = document.getElementById('splash');
document.getElementById('enter-btn').addEventListener('click', () => {
  splash.classList.add('gone');
  setTimeout(() => splash.remove(), 700);

  house.startIntro();
  engine.start();
  playBtn.innerHTML = `${icon('pause')} Pause`;
  playBtn.classList.add('playing');

  engine.feed('EXPLAIN', '', 'Namaste — I\'m watching over Sharma Niwas', 'Click any device or family member in the house · run moments from Scenarios');
  setTimeout(() => {
    engine.alexaSays('Namaste! I\'m Alexa, and this is the Sharma family\'s home. It\'s almost six — Dadaji will be up any minute. Let me show you their day.', 'Ghar Sense');
  }, 1400);
});

console.log('Ghar Sense — interactive 3D edition ready (mock data).');
