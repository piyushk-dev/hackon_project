/**
 * VoiceService — Alexa's voice.
 *
 * Uses the browser's built-in speech synthesis (free, offline, no keys).
 * Prefers an Indian-English voice when the OS has one. The public API is
 * deliberately tiny (speak / stop / setEnabled) so a premium TTS provider
 * (e.g. ElevenLabs with an API token) can be swapped in behind it later.
 */

const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu;

export class VoiceService {
  constructor() {
    this.supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
    this.enabled = this.supported;
    this.voice = null;
    if (this.supported) this._pickVoice();
  }

  _pickVoice() {
    const pick = () => {
      const voices = speechSynthesis.getVoices();
      if (!voices.length) return;
      this.voice =
        voices.find((v) => v.lang === 'en-IN' && /female|heera|neerja|priya/i.test(v.name)) ||
        voices.find((v) => v.lang === 'en-IN') ||
        voices.find((v) => v.lang === 'hi-IN') ||
        voices.find((v) => /female|zira|susan|samantha/i.test(v.name) && v.lang.startsWith('en')) ||
        voices.find((v) => v.lang.startsWith('en')) ||
        voices[0];
    };
    pick();
    speechSynthesis.onvoiceschanged = pick;
  }

  /** Speak a line as Alexa. Interrupts anything currently being spoken. */
  speak(text) {
    if (!this.supported || !this.enabled || !text) return;
    try {
      speechSynthesis.cancel();
      const clean = text.replace(EMOJI_RE, '').replace(/\s+/g, ' ').trim();
      if (!clean) return;
      const u = new SpeechSynthesisUtterance(clean);
      if (this.voice) u.voice = this.voice;
      u.rate = 1.04;
      u.pitch = 1.05;
      u.volume = 1;
      speechSynthesis.speak(u);
    } catch { /* voice is a garnish — never break the demo over it */ }
  }

  stop() {
    if (this.supported) speechSynthesis.cancel();
  }

  setEnabled(on) {
    this.enabled = this.supported && on;
    if (!on) this.stop();
  }
}
