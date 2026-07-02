/**
 * FeedPanel — the live SENSE → THINK → ACT → EXPLAIN narrative.
 *
 * Every stage of the cognitive loop lands here, color-coded. This is the
 * running answer to "what is the home doing and why" — explainability as
 * a first-class surface, not a debug log.
 */

import { eventBus } from '../../utils/eventBus.js';
import { SENSE_EVENTS } from '../SenseEngine.js';

const MAX_ENTRIES = 40;

const STAGE_META = {
  SENSE:   { color: '#0E9594' },
  THINK:   { color: '#7B5EA7' },
  ACT:     { color: '#6A994E' },
  EXPLAIN: { color: '#E8890C' },
};

export class FeedPanel {
  constructor(container) {
    this.container = container;
    this._render();
    this._bind();
  }

  _render() {
    this.container.innerHTML = `
      <div class="panel-head">
        <div class="panel-title"><span class="panel-icon">🧠</span> Alexa's Diary</div>
        <div class="stage-legend">
          <span style="color:#0E9594">SENSE</span><span style="color:#7B5EA7">THINK</span><span style="color:#6A994E">ACT</span><span style="color:#E8890C">EXPLAIN</span>
        </div>
      </div>
      <div id="feed-entries" class="feed-entries"></div>
    `;
    this.feedEl = this.container.querySelector('#feed-entries');
  }

  _bind() {
    eventBus.on(SENSE_EVENTS.FEED, (e) => this._add(e));
  }

  _add(e) {
    const meta = STAGE_META[e.stage] || { color: '#8b949e' };
    const el = document.createElement('div');
    el.className = 'feed-entry';
    el.style.setProperty('--stage-color', meta.color);
    el.innerHTML = `
      <div class="feed-top">
        <span class="feed-stage" style="color:${meta.color};border-color:${meta.color}55">${e.stage}</span>
        <span class="feed-time">${e.time}</span>
      </div>
      <div class="feed-title">${e.icon} ${e.title}</div>
      <div class="feed-detail">${e.detail}</div>
    `;
    this.feedEl.prepend(el);
    requestAnimationFrame(() => el.classList.add('in'));
    while (this.feedEl.children.length > MAX_ENTRIES) {
      this.feedEl.lastChild.remove();
    }
  }
}
