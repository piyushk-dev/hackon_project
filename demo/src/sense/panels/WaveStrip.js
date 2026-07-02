/**
 * WaveStrip — the acoustic intelligence strip overlaid on the 3D view.
 *
 * A slim translucent bar across the bottom of the house: live waveform,
 * whistle counter, quiet-mode badge, privacy chip. Detections pop up as
 * floating chips above the strip and fade away on their own.
 */

import { eventBus } from '../../utils/eventBus.js';
import { SENSE_EVENTS } from '../SenseEngine.js';

export class WaveStrip {
  constructor(container, engine) {
    this.engine = engine;
    this.container = container;
    this._energy = 0;
    this._samples = [];
    this._render();
    this._bind();
    this._animate();
  }

  _render() {
    this.container.innerHTML = `
      <div class="wave-pops" id="wave-pops"></div>
      <div class="wave-bar">
        <span class="wave-mic">🎙️</span>
        <canvas id="wave-canvas"></canvas>
        <div id="whistle-counter" class="whistle-counter hidden">
          <span>🍲</span>
          <span class="whistle-dots"><i class="wdot" data-n="1"></i><i class="wdot" data-n="2"></i><i class="wdot" data-n="3"></i></span>
        </div>
        <span id="quiet-badge" class="chip chip-quiet hidden">🤫 Quiet</span>
        <span class="chip chip-privacy" title="Sound classification runs on the Echo itself. Raw audio is never recorded or uploaded.">🔒 On-device</span>
      </div>
    `;
    this.canvas = this.container.querySelector('#wave-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.popsEl = this.container.querySelector('#wave-pops');
    this.whistleEl = this.container.querySelector('#whistle-counter');
    this.quietBadge = this.container.querySelector('#quiet-badge');
  }

  _bind() {
    eventBus.on(SENSE_EVENTS.SOUND, (evt) => this._onSound(evt));
    eventBus.on(SENSE_EVENTS.MODE, (m) => {
      if ('quietMode' in m) this.quietBadge.classList.toggle('hidden', !m.quietMode);
    });
  }

  _onSound(evt) {
    this._energy = evt.tone === 'alert' ? 1.0 : 0.75;

    if (evt.type === 'cooker_whistle') {
      this.whistleEl.classList.remove('hidden');
      const n = this.engine.state.whistles;
      this.whistleEl.querySelectorAll('.wdot').forEach((d) => {
        d.classList.toggle('lit', Number(d.dataset.n) <= n);
      });
      if (n >= 3) setTimeout(() => this.whistleEl.classList.add('hidden'), 9000);
    }

    // Floating detection chip above the strip.
    const pop = document.createElement('div');
    pop.className = `wave-pop tone-${evt.tone}`;
    pop.innerHTML = `
      <span class="pop-icon">${evt.icon}</span>
      <span class="pop-text"><b>${evt.label}</b> · ${evt.room} · ${Math.round(evt.conf * 100)}%</span>
    `;
    this.popsEl.appendChild(pop);
    requestAnimationFrame(() => pop.classList.add('in'));
    setTimeout(() => {
      pop.classList.remove('in');
      setTimeout(() => pop.remove(), 400);
    }, 5600);
    while (this.popsEl.children.length > 3) this.popsEl.firstChild.remove();
  }

  _animate() {
    const draw = () => {
      const { canvas, ctx } = this;
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w) { requestAnimationFrame(draw); return; }
      if (canvas.width !== w * 2) { canvas.width = w * 2; canvas.height = h * 2; ctx.scale(2, 2); }

      this._energy *= 0.965;
      const quiet = this.engine.state.quietMode ? 0.4 : 1;
      const amp = (0.07 + this._energy * 0.85) * quiet;
      this._samples.push((Math.random() * 2 - 1) * amp);
      const maxSamples = Math.floor(w / 3);
      while (this._samples.length > maxSamples) this._samples.shift();

      ctx.clearRect(0, 0, w, h);
      const mid = h / 2;
      for (let i = 0; i < this._samples.length; i++) {
        const v = Math.abs(this._samples[i]);
        const barH = Math.max(1.5, v * (h * 0.92));
        const heat = Math.min(1, v * 2.2);
        // Teal → saffron as it gets loud.
        const r = Math.round(14 + heat * 220);
        const g = Math.round(111 + heat * 26);
        const b = Math.round(110 - heat * 98);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${0.5 + heat * 0.5})`;
        ctx.fillRect(i * 3, mid - barH / 2, 2, barH);
      }
      requestAnimationFrame(draw);
    };
    requestAnimationFrame(draw);
  }
}
