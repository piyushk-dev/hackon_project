/**
 * StatusBar — the home's vitals as one slim row of pills, SVG-iconed.
 * Energy (live kW + tariff dot) · water tank % · LPG days · AQI.
 */

import { eventBus } from '../../utils/eventBus.js';
import { SENSE_EVENTS } from '../SenseEngine.js';
import { icon } from '../icons.js';

function aqiColor(aqi) {
  if (aqi <= 100) return '#557347';
  if (aqi <= 200) return '#B0741F';
  if (aqi <= 300) return '#C2410C';
  return '#B03A2E';
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
      <span class="pill pill-grid hidden" id="pill-grid">${icon('zap')} Grid down · inverter</span>
      <span class="pill" title="Live whole-home load — one clamp on the mains (NILM)">
        ${icon('zap')} <b id="kw-now">0.00</b><span class="pill-unit">kW</span> <i id="tariff-dot" class="dot"></i>
      </span>
      <span class="pill" title="Water tank — ultrasonic level sensor">
        ${icon('droplet')} <b id="water-pct">—</b><span class="pill-unit">%</span> <i id="motor-dot" class="dot dot-live hidden"></i>
      </span>
      <span class="pill" id="pill-lpg" title="LPG cylinder — weight pad under the cylinder">
        ${icon('cylinder')} <b id="lpg-days">—</b><span class="pill-unit">days</span>
      </span>
      <span class="pill" title="PM2.5 — balcony air sensor">
        ${icon('wind')} <b id="aqi-num">—</b><span class="pill-unit">AQI</span>
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
      this.lpgPill.innerHTML = `${icon('cylinder')} refill booked`;
      this.engine.feed('ACT', '', 'LPG refill booked via Amazon', 'Weight pad predicted empty in a week — slot: tomorrow 10 AM–1 PM');
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
