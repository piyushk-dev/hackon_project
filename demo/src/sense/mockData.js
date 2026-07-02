/**
 * Ghar Sense — Mock data layer.
 *
 * Every signal on the Ghar Sense page is generated from the constants and
 * scripts in this file. No backend, no AI calls — this is the "what the
 * sensing layer would feel like" demo. Swapping this for live data means
 * pointing the panels at the EventBridge → API pipeline instead.
 */

// ─── Family (speaker-ID roster) ──────────────────────────────────────
export const FAMILY = {
  rajesh:  { name: 'Rajesh',  role: 'Parent',  color: '#3E7CB1', emoji: '👨' },
  priya:   { name: 'Priya',   role: 'Parent',  color: '#D64580', emoji: '👩' },
  arjun:   { name: 'Arjun',   role: 'Teen',    color: '#0E9594', emoji: '🧑' },
  ananya:  { name: 'Ananya',  role: 'Child',   color: '#E8A013', emoji: '👧' },
  dadaji:  { name: 'Dadaji',  role: 'Elder',   color: '#C75B39', emoji: '👴' },
  dadiji:  { name: 'Dadiji',  role: 'Elder',   color: '#7B5EA7', emoji: '👵' },
};

// Starting trust scores (0–100). Tier boundaries mirror the backend:
// [0, 21, 46, 71, 91] → Observer, Suggester, Assistant, Manager, Guardian.
export const INITIAL_TRUST = {
  rajesh: 74,
  priya: 68,
  arjun: 43,
  ananya: 22,
  dadaji: 58,
  dadiji: 55,
};

export const TIER_THRESHOLDS = [0, 21, 46, 71, 91];
export const TIER_NAMES = ['Observer', 'Suggester', 'Assistant', 'Manager', 'Guardian'];
export const TIER_COLORS = ['#A39A8B', '#E8890C', '#0E9594', '#6A994E', '#C9A227'];

export function tierFor(score) {
  let tier = 0;
  for (let i = 0; i < TIER_THRESHOLDS.length; i++) {
    if (score >= TIER_THRESHOLDS[i]) tier = i;
  }
  return tier; // 0-indexed; display as tier+1
}

// ─── Acoustic event library (on-device sound classification) ────────
export const SOUND_LIBRARY = {
  cooker_whistle: { icon: '🍲', label: 'Pressure Cooker Whistle', room: 'Kitchen',   conf: 0.97, tone: 'info' },
  doorbell:       { icon: '🔔', label: 'Doorbell',                room: 'Entrance',  conf: 0.99, tone: 'info' },
  temple_bell:    { icon: '🛕', label: 'Pooja Bell',              room: 'Mandir',    conf: 0.95, tone: 'calm' },
  motor_whine:    { icon: '🚱', label: 'Motor Dry-Run Whine',     room: 'Terrace',   conf: 0.93, tone: 'alert' },
  cough:          { icon: '🤒', label: 'Repeated Coughing',       room: "Dadaji's Room", conf: 0.88, tone: 'alert' },
  mixer:          { icon: '🌀', label: 'Mixer-Grinder',           room: 'Kitchen',   conf: 0.91, tone: 'info' },
  tap_running:    { icon: '🚰', label: 'Tap Left Running',        room: 'Bathroom',  conf: 0.9,  tone: 'alert' },
  glass_break:    { icon: '🪟', label: 'Glass Break',             room: 'Unknown',   conf: 0.96, tone: 'alert' },
};

// ─── NILM appliance signature library (mains clamp) ─────────────────
export const APPLIANCES = {
  fridge:      { label: 'Refrigerator',   watts: 150,  icon: '🧊', always: true },
  geyser:      { label: 'Geyser',         watts: 2000, icon: '♨️' },
  ac_living:   { label: 'Living Room AC', watts: 1500, icon: '❄️' },
  water_motor: { label: 'Water Motor',    watts: 750,  icon: '💧' },
  iron:        { label: 'Iron',           watts: 1000, icon: '🔥' },
  mixer:       { label: 'Mixer-Grinder',  watts: 500,  icon: '🌀' },
  washing:     { label: 'Washing Machine',watts: 450,  icon: '🫧' },
  tv:          { label: 'Smart TV',       watts: 120,  icon: '📺' },
  lights:      { label: 'Lights + Fans',  watts: 280,  icon: '💡' },
};

export const BASE_LOAD_WATTS = 90; // routers, standby, chargers

// Time-of-day tariff (₹/kWh) — modelled on Indian ToD slabs.
export function tariffAt(simMinutes) {
  const h = Math.floor(simMinutes / 60) % 24;
  if (h >= 18 && h < 22) return { rate: 8, band: 'PEAK', color: '#CE4A3B' };
  if (h >= 22 || h < 6)  return { rate: 4, band: 'OFF-PEAK', color: '#6A994E' };
  return { rate: 6, band: 'NORMAL', color: '#0E9594' };
}

// ─── Dadaji wellness routine checkpoints ─────────────────────────────
export const WELLNESS_CHECKPOINTS = [
  { id: 'wake',   time: 6 * 60,       label: 'Wake up',        signal: 'Bedroom motion' },
  { id: 'bath',   time: 6 * 60 + 45,  label: 'Morning bath',   signal: 'Geyser + bathroom' },
  { id: 'pooja',  time: 8 * 60,       label: 'Pooja',          signal: 'Bell sound event' },
  { id: 'tea',    time: 9 * 60,       label: 'Morning chai',   signal: 'Kitchen activity' },
  { id: 'lunch',  time: 13 * 60,      label: 'Lunch',          signal: 'Kitchen + dining' },
  { id: 'walk',   time: 17 * 60 + 30, label: 'Evening walk',   signal: 'Door + gate sensor' },
  { id: 'meds',   time: 21 * 60,      label: 'Medicines',      signal: 'Voice confirmation' },
];

// ─── Initial home state ──────────────────────────────────────────────
export function initialHomeState() {
  return {
    simMinutes: 6 * 60 - 15, // 05:45 — just before the day begins
    powerCut: false,
    voltage: 231,
    appliances: { fridge: true, lights: false },
    savingsToday: 12.4,       // ₹ — carries a little from the night
    actionsToday: 3,
    kwhToday: 1.8,
    water: { level: 34, capacity: 1000, motor: false, supplyWindow: [6 * 60 + 15, 7 * 60 + 30] },
    lpg: { kg: 4.6, full: 14.2, dailyUse: 0.62 },
    aqi: 128,
    purifier: false,
    quietMode: false,
    whistles: 0,
    trust: { ...INITIAL_TRUST },
  };
}

// ─── Utility ─────────────────────────────────────────────────────────
export function fmtTime(simMinutes) {
  const m = ((simMinutes % 1440) + 1440) % 1440;
  const h24 = Math.floor(m / 60);
  const mm = String(Math.floor(m % 60)).padStart(2, '0');
  const ampm = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${mm} ${ampm}`;
}
