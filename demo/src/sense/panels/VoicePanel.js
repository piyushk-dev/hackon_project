/**
 * VoicePanel — asks, trust ladder, and voice moments in the family dock.
 *
 * Ask cards appear when Alexa wants permission; answering moves the trust
 * ladder (+5 / −15 — the backend's exact math). Members are shown with
 * initial avatars, not emoji.
 */

import { eventBus } from '../../utils/eventBus.js';
import { SENSE_EVENTS } from '../SenseEngine.js';
import { FAMILY, TIER_COLORS, tierFor, TIER_NAMES } from '../mockData.js';
import { stripEmoji } from '../icons.js';

const MAX_TRANSCRIPTS = 2;
const LANG_LABELS = { hi: 'हिंदी', en: 'EN', 'hi-en': 'HINGLISH' };

function avatar(member, size = '') {
  return `<span class="avatar${size}" style="background:${member.color}1c;color:${member.color};border-color:${member.color}55">${member.name[0]}</span>`;
}

export class VoicePanel {
  constructor(container, engine) {
    this.engine = engine;
    this.container = container;
    this._render();
    this._bind();
  }

  _render() {
    this.container.innerHTML = `
      <div id="asks" class="asks"></div>
      <div class="sec-label" title="Trust grows when the family accepts Alexa's actions (+5) and drops on overrides (−15). Higher tiers mean more autonomy.">Trust ladder</div>
      <div id="trust-rows" class="trust-rows"></div>
      <div id="transcripts" class="transcripts"></div>
    `;
    this.asksEl = this.container.querySelector('#asks');
    this.transcriptsEl = this.container.querySelector('#transcripts');
    this.trustRowsEl = this.container.querySelector('#trust-rows');

    this._trustEls = {};
    for (const [id, member] of Object.entries(FAMILY)) {
      const score = this.engine.state.trust[id];
      const row = document.createElement('div');
      row.className = 'trust-row';
      row.innerHTML = `
        <span class="trust-name">${avatar(member)}${member.name}</span>
        <div class="trust-track"><i class="trust-fill"></i><span class="trust-delta"></span></div>
        <span class="trust-tier"></span>
      `;
      this.trustRowsEl.appendChild(row);
      this._trustEls[id] = {
        fill: row.querySelector('.trust-fill'),
        tier: row.querySelector('.trust-tier'),
        delta: row.querySelector('.trust-delta'),
      };
      this._paintTrust(id, score);
    }
  }

  _paintTrust(member, score) {
    const els = this._trustEls[member];
    if (!els) return;
    const tier = tierFor(score);
    els.fill.style.width = `${score}%`;
    els.fill.style.background = TIER_COLORS[tier];
    els.tier.textContent = TIER_NAMES[tier];
  }

  _bind() {
    eventBus.on(SENSE_EVENTS.ASK, (ask) => this._onAsk(ask));
    eventBus.on(SENSE_EVENTS.VOICE, (v) => this._onVoice(v));
    eventBus.on(SENSE_EVENTS.TRUST, (t) => {
      this._paintTrust(t.member, t.score);
      const els = this._trustEls[t.member];
      if (els) {
        els.delta.textContent = t.delta > 0 ? `+${t.delta}` : `${t.delta}`;
        els.delta.className = 'trust-delta show ' + (t.delta > 0 ? 'up' : 'down');
        setTimeout(() => els.delta.classList.remove('show'), 2200);
      }
    });
  }

  _onAsk(ask) {
    const member = FAMILY[ask.member];
    const card = document.createElement('div');
    card.className = 'ask-card';
    card.innerHTML = `
      <div class="ask-label">Alexa asks</div>
      <div class="ask-q">${stripEmoji(ask.question)}</div>
      <div class="ask-meta">for ${member.name} · ${ask.category}</div>
      <div class="ask-actions">
        <button class="btn-yes">Haan, karo</button>
        <button class="btn-no">Nahi</button>
      </div>
    `;
    const close = (answered) => {
      card.classList.add('out');
      setTimeout(() => card.remove(), 400);
      this.engine.feed(
        answered ? 'ACT' : 'EXPLAIN',
        '',
        answered ? `${member.name} accepted — trust +5` : `${member.name} overrode — trust −15`,
        answered
          ? 'One step closer to Alexa doing this without asking'
          : 'Alexa steps back: this action will need permission for longer'
      );
    };
    card.querySelector('.btn-yes').addEventListener('click', () => { ask.accept(); close(true); });
    card.querySelector('.btn-no').addEventListener('click', () => { ask.decline(); close(false); });
    this.asksEl.prepend(card);
    requestAnimationFrame(() => card.classList.add('in'));

    setTimeout(() => {
      if (card.isConnected) {
        ask.accept();
        close(true);
      }
    }, ask.autoAcceptMs ?? 14000);
  }

  _onVoice(v) {
    const member = FAMILY[v.member];
    const item = document.createElement('div');
    item.className = 'transcript';
    item.innerHTML = `
      <div class="tr-head">
        ${avatar(member)}
        <span class="tr-name" style="color:${member.color}">${member.name}</span>
        <span class="lang-chip">${LANG_LABELS[v.lang] || v.lang}</span>
      </div>
      <div class="tr-text">“${stripEmoji(v.text)}”</div>
      <div class="tr-intent">${stripEmoji(v.intent)}</div>
    `;
    this.transcriptsEl.prepend(item);
    requestAnimationFrame(() => item.classList.add('in'));
    while (this.transcriptsEl.children.length > MAX_TRANSCRIPTS) {
      this.transcriptsEl.lastChild.remove();
    }
  }
}
