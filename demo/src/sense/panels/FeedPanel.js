/**
 * FeedPanel — Alexa's diary: the live SENSE → THINK → ACT → EXPLAIN story,
 * rendered as a quiet timeline. Stage is a small colored label; content is
 * typography, not decoration.
 */

import { eventBus } from '../../utils/eventBus.js';
import { SENSE_EVENTS } from '../SenseEngine.js';
import { stripEmoji } from '../icons.js';

const MAX_ENTRIES = 40;

const STAGE_COLORS = {
  SENSE:   '#0E7C72',
  THINK:   '#6D5A96',
  ACT:     '#557347',
  EXPLAIN: '#B0741F',
};

export class FeedPanel {
  constructor(container) {
    this.container = container;
    this.container.innerHTML = `<div id="feed-entries" class="feed-entries"></div>`;
    this.feedEl = this.container.querySelector('#feed-entries');
    eventBus.on(SENSE_EVENTS.FEED, (e) => this._add(e));
  }

  _add(e) {
    const color = STAGE_COLORS[e.stage] || '#857D6F';
    const el = document.createElement('div');
    el.className = 'feed-entry';
    el.style.setProperty('--stage-color', color);
    el.innerHTML = `
      <div class="feed-top">
        <span class="feed-stage" style="color:${color}">${e.stage}</span>
        <span class="feed-time">${e.time}</span>
      </div>
      <div class="feed-title">${stripEmoji(e.title)}</div>
      <div class="feed-detail">${stripEmoji(e.detail)}</div>
    `;
    this.feedEl.prepend(el);
    requestAnimationFrame(() => el.classList.add('in'));
    while (this.feedEl.children.length > MAX_ENTRIES) {
      this.feedEl.lastChild.remove();
    }
  }
}
