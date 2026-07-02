/**
 * FeedPanel — Alexa's diary: the live SENSE → THINK → ACT → EXPLAIN story.
 *
 * Rendered as a light timeline (dot + rail), not boxed cards — the dock
 * header carries the title, entries carry only what matters.
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
    this.container.innerHTML = `<div id="feed-entries" class="feed-entries"></div>`;
    this.feedEl = this.container.querySelector('#feed-entries');
    eventBus.on(SENSE_EVENTS.FEED, (e) => this._add(e));
  }

  _add(e) {
    const meta = STAGE_META[e.stage] || { color: '#8A7B68' };
    const el = document.createElement('div');
    el.className = 'feed-entry';
    el.style.setProperty('--stage-color', meta.color);
    el.innerHTML = `
      <div class="feed-top">
        <span class="feed-stage" style="color:${meta.color}">${e.stage}</span>
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
