/**
 * WellnessPanel — "Dadaji's day looks normal."
 *
 * Collapsed by default to a single status line; click to expand the
 * checkpoint timeline. Inferred from the same device events everything
 * else uses — no camera, no wearable.
 */

import { eventBus } from '../../utils/eventBus.js';
import { SENSE_EVENTS } from '../SenseEngine.js';
import { WELLNESS_CHECKPOINTS, fmtTime } from '../mockData.js';

const STATUS_META = {
  pending:   { icon: '○',  cls: 'cp-pending' },
  done:      { icon: '✓',  cls: 'cp-done' },
  attention: { icon: '!',  cls: 'cp-attention' },
  skipped:   { icon: '～', cls: 'cp-skipped' },
};

export class WellnessPanel {
  constructor(container, engine) {
    this.engine = engine;
    this.container = container;
    this._statuses = {};
    this._render();
    this._bind();
  }

  _render() {
    this.container.innerHTML = `
      <div class="wellness-head" title="Click to expand Dadaji's routine timeline">
        <span class="wellness-title">👴 Dadaji's Day</span>
        <span id="wellness-status" class="badge badge-ok">● Looks normal</span>
        <span class="wellness-chevron">▾</span>
      </div>
      <div class="wellness-body">
        <div class="wellness-note">Inferred from motion, kitchen & sound events — <b>no camera, no wearable</b></div>
        <div id="checkpoints" class="checkpoints"></div>
        <div id="wellness-foot" class="wellness-foot">Priya gets one line at 9 PM: <i>“Dadaji's day was completely normal.”</i></div>
      </div>
    `;
    this.statusEl = this.container.querySelector('#wellness-status');
    this.cpsEl = this.container.querySelector('#checkpoints');
    this.footEl = this.container.querySelector('#wellness-foot');

    this.container.querySelector('.wellness-head').addEventListener('click', () => {
      this.container.classList.toggle('collapsed');
    });

    this._cpEls = {};
    for (const cp of WELLNESS_CHECKPOINTS) {
      this._statuses[cp.id] = 'pending';
      const row = document.createElement('div');
      row.className = 'checkpoint cp-pending';
      row.innerHTML = `
        <span class="cp-mark">○</span>
        <span class="cp-time">${fmtTime(cp.time)}</span>
        <span class="cp-label">${cp.label}</span>
        <span class="cp-signal">${cp.signal}</span>
      `;
      this.cpsEl.appendChild(row);
      this._cpEls[cp.id] = row;
    }
  }

  _bind() {
    eventBus.on(SENSE_EVENTS.WELLNESS, ({ checkpointId, status, note }) => {
      const row = this._cpEls[checkpointId];
      if (!row) return;
      this._statuses[checkpointId] = status;
      const meta = STATUS_META[status] || STATUS_META.pending;
      row.className = `checkpoint ${meta.cls} pop`;
      row.querySelector('.cp-mark').textContent = meta.icon;
      if (note) row.querySelector('.cp-signal').textContent = note;
      setTimeout(() => row.classList.remove('pop'), 700);
      this._refreshOverall();
    });
  }

  _refreshOverall() {
    const vals = Object.values(this._statuses);
    if (vals.includes('attention')) {
      this.statusEl.textContent = '● Needs a look';
      this.statusEl.className = 'badge badge-warn';
      this.footEl.innerHTML = 'Priya\'s brief tonight: <i>“Dadaji coughed more than usual — maybe check on him.”</i>';
      // Surface it: pop the panel open on an attention signal.
      this.container.classList.remove('collapsed');
    } else if (vals.includes('skipped')) {
      this.statusEl.textContent = '● Normal, 1 change';
      this.statusEl.className = 'badge badge-ok';
      this.footEl.innerHTML = 'Priya\'s brief tonight: <i>“Normal day — walk was indoors because of the air.”</i>';
    } else {
      this.statusEl.textContent = '● Looks normal';
      this.statusEl.className = 'badge badge-ok';
    }
  }
}
