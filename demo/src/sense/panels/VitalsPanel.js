/**
 * VitalsPanel — the home's vitals strip under the 3D view.
 *
 * Four warm cards: Energy (live kW sparkline, ₹ saved, tariff, voltage),
 * Water tank, LPG cylinder, Air quality — plus the NILM appliance chip row.
 */

import { eventBus } from '../../utils/eventBus.js';
import { SENSE_EVENTS } from '../SenseEngine.js';
import { APPLIANCES, fmtTime } from '../mockData.js';

const TRACE_SECONDS = 48;
const SAMPLES_PER_SEC = 5;

function aqiBand(aqi) {
  if (aqi <= 100) return { label: 'Good', color: '#6A994E' };
  if (aqi <= 200) return { label: 'Moderate', color: '#E8A013' };
  if (aqi <= 300) return { label: 'Poor', color: '#E8890C' };
  return { label: 'Severe', color: '#CE4A3B' };
}

export class VitalsPanel {
  constructor(container, engine) {
    this.engine = engine;
    this.container = container;
    this._trace = [];
    this._displayKw = 0;
    this._render();
    this._bind();
    this._animate();
  }

  _render() {
    const [ws, we] = this.engine.state.water.supplyWindow;
    this.container.innerHTML = `
      <div class="vitals-row">
        <div class="vital-card vital-energy" id="energy-card">
          <div class="vital-head">⚡ Energy <span id="tariff-chip" class="chip chip-mini">—</span></div>
          <div class="vital-main">
            <span class="vital-big"><b id="kw-now">0.00</b> kW</span>
            <canvas id="power-spark"></canvas>
          </div>
          <div class="vital-foot"><span id="voltage-txt">— V</span> · <b id="savings-today" class="savings">₹0</b> saved today</div>
          <div id="powercut-flag" class="powercut-flag hidden">⚡ GRID DOWN · INVERTER</div>
        </div>

        <div class="vital-card">
          <div class="vital-head">💧 Water <span id="motor-badge" class="chip chip-mini chip-live hidden">MOTOR ON</span></div>
          <div class="vital-main vital-water">
            <div class="tank"><div class="tank-fill" id="tank-fill"></div><span class="tank-pct" id="tank-pct">—%</span></div>
            <div class="vital-note">Supply window learned<br><b>${fmtTime(ws)} – ${fmtTime(we)}</b></div>
          </div>
        </div>

        <div class="vital-card">
          <div class="vital-head">🫙 LPG</div>
          <div class="vital-main">
            <span class="vital-big"><b id="lpg-days">—</b> days</span>
            <div class="lpg-bar"><i id="lpg-fill"></i></div>
          </div>
          <div class="vital-foot"><span id="lpg-kg">—</span> kg left · <button id="lpg-book" class="link-btn hidden">Book refill →</button><span id="lpg-booked" class="booked hidden">✅ arriving tomorrow</span></div>
        </div>

        <div class="vital-card">
          <div class="vital-head">💨 Air <span id="purifier-badge" class="chip chip-mini chip-live hidden">PURIFIER ON</span></div>
          <div class="vital-main">
            <span class="vital-big"><b id="aqi-num">—</b> <span id="aqi-band" class="aqi-band">—</span></span>
          </div>
          <div class="vital-foot">PM2.5 · balcony sensor</div>
        </div>
      </div>
      <div class="appliance-row" id="appliance-row"></div>
    `;

    this.kwEl = this.container.querySelector('#kw-now');
    this.spark = this.container.querySelector('#power-spark');
    this.sparkCtx = this.spark.getContext('2d');
    this.savingsEl = this.container.querySelector('#savings-today');
    this.tariffChip = this.container.querySelector('#tariff-chip');
    this.voltageTxt = this.container.querySelector('#voltage-txt');
    this.cutFlag = this.container.querySelector('#powercut-flag');
    this.tankFill = this.container.querySelector('#tank-fill');
    this.tankPct = this.container.querySelector('#tank-pct');
    this.motorBadge = this.container.querySelector('#motor-badge');
    this.lpgDays = this.container.querySelector('#lpg-days');
    this.lpgKg = this.container.querySelector('#lpg-kg');
    this.lpgFill = this.container.querySelector('#lpg-fill');
    this.lpgBook = this.container.querySelector('#lpg-book');
    this.lpgBooked = this.container.querySelector('#lpg-booked');
    this.aqiNum = this.container.querySelector('#aqi-num');
    this.aqiBandEl = this.container.querySelector('#aqi-band');
    this.purifierBadge = this.container.querySelector('#purifier-badge');

    this.lpgBook.addEventListener('click', () => {
      this.lpgBook.classList.add('hidden');
      this.lpgBooked.classList.remove('hidden');
      this.engine.feed('ACT', '📦', 'LPG refill booked via Amazon', 'Weight pad predicted empty in a week — slot: tomorrow 10 AM–1 PM');
    });

    // NILM appliance chips
    this._chips = {};
    const row = this.container.querySelector('#appliance-row');
    for (const [id, a] of Object.entries(APPLIANCES)) {
      const chip = document.createElement('span');
      chip.className = 'appliance-chip' + (a.always ? ' on' : '');
      chip.innerHTML = `${a.icon} ${a.label} <i>${a.watts}W</i>`;
      row.appendChild(chip);
      this._chips[id] = chip;
    }
  }

  _bind() {
    eventBus.on(SENSE_EVENTS.TICK, () => this._update());
    eventBus.on(SENSE_EVENTS.STAT, () => this._update(true));
    eventBus.on(SENSE_EVENTS.APPLIANCE, (evt) => {
      const chip = this._chips[evt.id];
      if (!chip) return;
      chip.classList.toggle('on', evt.on);
      if (evt.on && evt.detected) {
        chip.classList.add('detected');
        setTimeout(() => chip.classList.remove('detected'), 2400);
      }
    });
    eventBus.on(SENSE_EVENTS.POWER_CUT, ({ on }) => {
      this.cutFlag.classList.toggle('hidden', !on);
      this.container.querySelector('#energy-card').classList.toggle('grid-down', on);
    });
    eventBus.on(SENSE_EVENTS.MODE, (m) => {
      if ('purifier' in m) this.purifierBadge.classList.toggle('hidden', !m.purifier);
    });
    this._update();
  }

  _update(bump = false) {
    const s = this.engine.state;

    this.savingsEl.textContent = `₹${s.savingsToday.toFixed(0)}`;
    if (bump) {
      this.savingsEl.classList.add('bump');
      setTimeout(() => this.savingsEl.classList.remove('bump'), 450);
    }
    const t = this.engine.tariff();
    this.tariffChip.textContent = `₹${t.rate}/kWh ${t.band}`;
    this.tariffChip.style.color = t.color;
    this.tariffChip.style.borderColor = t.color + '66';
    this.voltageTxt.textContent = s.powerCut ? '0 V' : `${Math.round(s.voltage)} V`;
    this.voltageTxt.style.color = s.powerCut ? '#CE4A3B' : '';

    const lvl = Math.round(s.water.level);
    this.tankFill.style.height = `${lvl}%`;
    this.tankFill.classList.toggle('filling', s.water.motor);
    this.tankPct.textContent = `${lvl}%`;
    this.motorBadge.classList.toggle('hidden', !s.water.motor);

    const days = s.lpg.kg / s.lpg.dailyUse;
    this.lpgDays.textContent = days.toFixed(0);
    this.lpgKg.textContent = s.lpg.kg.toFixed(1);
    this.lpgFill.style.width = `${(s.lpg.kg / s.lpg.full) * 100}%`;
    if (days < 8 && this.lpgBooked.classList.contains('hidden')) {
      this.lpgBook.classList.remove('hidden');
    }

    const aqi = Math.round(s.aqi);
    const band = aqiBand(aqi);
    this.aqiNum.textContent = aqi;
    this.aqiNum.style.color = band.color;
    this.aqiBandEl.textContent = band.label;
    this.aqiBandEl.style.color = band.color;
  }

  _animate() {
    let lastSample = 0;
    const draw = (ts) => {
      if (ts - lastSample > 1000 / SAMPLES_PER_SEC) {
        lastSample = ts;
        const w = this.engine.currentLoadWatts();
        this._trace.push(w * (1 + (Math.random() - 0.5) * 0.03));
        const maxLen = TRACE_SECONDS * SAMPLES_PER_SEC;
        while (this._trace.length > maxLen) this._trace.shift();
        this._displayKw += (w / 1000 - this._displayKw) * 0.2;
        this.kwEl.textContent = this._displayKw.toFixed(2);
      }

      const { spark: canvas, sparkCtx: ctx } = this;
      const cw = canvas.clientWidth, ch = canvas.clientHeight;
      if (!cw) { requestAnimationFrame(draw); return; }
      if (canvas.width !== cw * 2) { canvas.width = cw * 2; canvas.height = ch * 2; ctx.scale(2, 2); }
      ctx.clearRect(0, 0, cw, ch);

      const maxW = 5200;
      const n = this._trace.length;
      if (n > 1) {
        const step = cw / (TRACE_SECONDS * SAMPLES_PER_SEC - 1);
        const x0 = cw - (n - 1) * step;
        ctx.beginPath();
        ctx.moveTo(x0, ch);
        for (let i = 0; i < n; i++) ctx.lineTo(x0 + i * step, ch - (this._trace[i] / maxW) * (ch - 4) - 2);
        ctx.lineTo(x0 + (n - 1) * step, ch);
        ctx.closePath();
        const grad = ctx.createLinearGradient(0, 0, 0, ch);
        const down = this.engine.state.powerCut;
        grad.addColorStop(0, down ? 'rgba(206, 74, 59, 0.35)' : 'rgba(14, 149, 148, 0.35)');
        grad.addColorStop(1, 'rgba(14, 149, 148, 0.02)');
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
          const x = x0 + i * step;
          const y = ch - (this._trace[i] / maxW) * (ch - 4) - 2;
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.strokeStyle = down ? '#CE4A3B' : '#0E9594';
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }
      requestAnimationFrame(draw);
    };
    requestAnimationFrame(draw);
  }
}
