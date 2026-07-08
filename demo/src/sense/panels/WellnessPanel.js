/**
 * WellnessPanel — "Dadaji's day looks normal."
 *
 * Collapsed to a single status line by default; expands to the checkpoint
 * timeline. Auto-opens only when something needs attention.
 */

import { eventBus } from '../../utils/eventBus.js';
import { SENSE_EVENTS } from '../SenseEngine.js';
import { WELLNESS_CHECKPOINTS, fmtTime } from '../mockData.js';
import { icon } from '../icons.js';

const STATUS_META = {
  pending:   { mark: '', cls: 'cp-pending' },
  done:      { mark: '✓', cls: 'cp-done' },
  attention: { mark: '!', cls: 'cp-attention' },
  skipped:   { mark: '~', cls: 'cp-skipped' },
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
      <div class="wellness-head" title="Dadaji's routine, inferred from home activity — expand for the timeline">
        <span class="wellness-title">${icon('heart')} Dadaji's Day</span>
        <span id="wellness-status" class="badge badge-ok">Looks normal</span>
        <span class="wellness-chevron">${icon('chevronDown')}</span>
      </div>
      <div class="wellness-body">
        <div class="wellness-note">Inferred from motion, kitchen and sound events — <b>no camera, no wearable</b></div>
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
        <span class="cp-mark"></span>
        <span class="cp-time">${fmtTime(cp.time)}</span>
        <span class="cp-label">${cp.label}</span>
      `;
      this.cpsEl.appendChild(row);
      this._cpEls[cp.id] = row;
    }
  }

  _bind() {
    eventBus.on(SENSE_EVENTS.WELLNESS, ({ checkpointId, status }) => {
      const row = this._cpEls[checkpointId];
      if (!row) return;
      this._statuses[checkpointId] = status;
      const meta = STATUS_META[status] || STATUS_META.pending;
      row.className = `checkpoint ${meta.cls} pop`;
      row.querySelector('.cp-mark').textContent = meta.mark;
      setTimeout(() => row.classList.remove('pop'), 700);
      this._refreshOverall();
    });
  }

  _refreshOverall() {
    const vals = Object.values(this._statuses);
    if (vals.includes('attention')) {
      this.statusEl.textContent = 'Needs a look';
      this.statusEl.className = 'badge badge-warn';
      this.footEl.innerHTML = 'Priya\'s brief tonight: <i>“Dadaji coughed more than usual — maybe check on him.”</i>';
      this.container.classList.remove('collapsed');
    } else if (vals.includes('skipped')) {
      this.statusEl.textContent = 'Normal, 1 change';
      this.statusEl.className = 'badge badge-ok';
      this.footEl.innerHTML = 'Priya\'s brief tonight: <i>“Normal day — walk was indoors because of the air.”</i>';
    } else {
      this.statusEl.textContent = 'Looks normal';
      this.statusEl.className = 'badge badge-ok';
    }
  }
}
