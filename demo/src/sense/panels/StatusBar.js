/**
 * StatusBar — the home's vitals as one slim row of pills.
 *
 * ⚡ kW (tariff dot) · 💧 tank % · 🫙 LPG days · 💨 AQI.
 * The LPG pill turns saffron when low — clicking it books the refill.
 * A blinking GRID DOWN pill appears during power cuts.
 */

import { eventBus } from '../../utils/eventBus.js';
import { SENSE_EVENTS } from '../SenseEngine.js';

function aqiColor(aqi) {
  if (aqi <= 100) return '#6A994E';
  if (aqi <= 200) return '#E8A013';
  if (aqi <= 300) return '#E8890C';
  return '#CE4A3B';
}

export class StatusBar {
  constructor(container, engine) {
    this.engine = engine;
    this.container = container;
    this._displayKw = 0;
    this._booked = false;
    this._render();
    this._bind();
  }

  _render() {
    this.container.innerHTML = `
      <span class="pill pill-grid hidden" id="pill-grid">⚡ GRID DOWN · INVERTER</span>
      <span class="pill" title="Live whole-home load — one clamp on the mains (NILM)">
        ⚡ <b id="kw-now">0.00</b> kW <i id="tariff-dot" class="dot"></i>
      </span>
      <span class="pill" id="pill-water" title="Water tank — ultrasonic level sensor">
        💧 <b id="water-pct">—</b>% <i id="motor-dot" class="dot dot-live hidden"></i>
      </span>
      <span class="pill" id="pill-lpg" title="LPG cylinder — weight pad under the cylinder">
        🫙 <b id="lpg-days">—</b> days
      </span>
      <span class="pill" title="PM2.5 — balcony air sensor">
        💨 <b id="aqi-num">—</b>
      </span>
    `;
    this.gridPill = this.container.querySelector('#pill-grid');
    this.kwEl = this.container.querySelector('#kw-now');
    this.tariffDot = this.container.querySelector('#tariff-dot');
    this.waterEl = this.container.querySelector('#water-pct');
    this.motorDot = this.container.querySelector('#motor-dot');
    this.lpgPill = this.container.querySelector('#pill-lpg');
    this.lpgEl = this.container.querySelector('#lpg-days');
    this.aqiEl = this.container.querySelector('#aqi-num');

    this.lpgPill.addEventListener('click', () => {
      if (!this.lpgPill.classList.contains('pill-warn') || this._booked) return;
      this._booked = true;
      this.lpgPill.classList.remove('pill-warn');
      this.lpgPill.innerHTML = '🫙 ✅ refill booked';
      this.engine.feed('ACT', '📦', 'LPG refill booked via Amazon', 'Weight pad predicted empty in a week — slot: tomorrow 10 AM–1 PM');
    });
  }

  _bind() {
    eventBus.on(SENSE_EVENTS.TICK, () => this._update());
    eventBus.on(SENSE_EVENTS.POWER_CUT, ({ on }) => {
      this.gridPill.classList.toggle('hidden', !on);
    });
    this._update();
  }

  _update() {
    const s = this.engine.state;

    const kw = this.engine.currentLoadWatts() / 1000;
    this._displayKw += (kw - this._displayKw) * 0.25;
    this.kwEl.textContent = this._displayKw.toFixed(2);
    const t = this.engine.tariff();
    this.tariffDot.style.background = t.color;
    this.tariffDot.title = `Tariff: ₹${t.rate}/kWh (${t.band})`;

    this.waterEl.textContent = String(Math.round(s.water.level));
    this.motorDot.classList.toggle('hidden', !s.water.motor);

    if (!this._booked) {
      const days = s.lpg.kg / s.lpg.dailyUse;
      this.lpgEl.textContent = days.toFixed(0);
      const low = days < 8;
      this.lpgPill.classList.toggle('pill-warn', low);
      if (low) this.lpgPill.title = 'Running low — click to book a refill on Amazon';
    }

    const aqi = Math.round(s.aqi);
    this.aqiEl.textContent = String(aqi);
    this.aqiEl.style.color = aqiColor(aqi);
  }
}
