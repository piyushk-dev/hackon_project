/**
 * Inline SVG icon set — single stroke style, 24px grid, currentColor.
 * No emoji in the chrome: every glyph in the UI comes from here so the
 * whole product shares one visual voice.
 */

const S = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';

const PATHS = {
  play: '<path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none"/>',
  pause: '<rect x="7" y="5" width="3.4" height="14" rx="1" fill="currentColor" stroke="none"/><rect x="13.6" y="5" width="3.4" height="14" rx="1" fill="currentColor" stroke="none"/>',
  volume: `<path d="M11 5 6 9H2v6h4l5 4z" ${S}/><path d="M15.5 8.5a5 5 0 0 1 0 7" ${S}/><path d="M18.5 5.8a9 9 0 0 1 0 12.4" ${S}/>`,
  volumeOff: `<path d="M11 5 6 9H2v6h4l5 4z" ${S}/><line x1="16" y1="9.5" x2="21" y2="14.5" ${S}/><line x1="21" y1="9.5" x2="16" y2="14.5" ${S}/>`,
  mic: `<rect x="9" y="2.5" width="6" height="11" rx="3" ${S}/><path d="M5.5 11a6.5 6.5 0 0 0 13 0" ${S}/><line x1="12" y1="17.5" x2="12" y2="21" ${S}/>`,
  zap: `<path d="M13 2.5 4.5 13.5H11l-1 8 8.5-11H12z" ${S}/>`,
  droplet: `<path d="M12 3s6 6.2 6 10.2a6 6 0 0 1-12 0C6 9.2 12 3 12 3z" ${S}/>`,
  cylinder: `<rect x="7.5" y="7" width="9" height="14" rx="2" ${S}/><path d="M10 7V5.2A2.2 2.2 0 0 1 12.2 3h-.4A2.2 2.2 0 0 1 14 5.2V7" ${S}/><line x1="7.5" y1="11" x2="16.5" y2="11" ${S}/>`,
  wind: `<path d="M9.6 4.6A2 2 0 1 1 11 8H3" ${S}/><path d="M12.6 19.4A2 2 0 1 0 14 16H3" ${S}/><path d="M16.5 8a2.5 2.5 0 1 1 2 4H3" ${S}/>`,
  x: `<line x1="6" y1="6" x2="18" y2="18" ${S}/><line x1="18" y1="6" x2="6" y2="18" ${S}/>`,
  chevronDown: `<polyline points="6.5 9.5 12 15 17.5 9.5" ${S}/>`,
  home: `<path d="M3.5 10.5 12 3.5l8.5 7" ${S}/><path d="M5.5 9.5V20h13V9.5" ${S}/><path d="M10 20v-5h4v5" ${S}/>`,
  sun: `<circle cx="12" cy="12" r="4" ${S}/><line x1="12" y1="2.5" x2="12" y2="4.5" ${S}/><line x1="12" y1="19.5" x2="12" y2="21.5" ${S}/><line x1="2.5" y1="12" x2="4.5" y2="12" ${S}/><line x1="19.5" y1="12" x2="21.5" y2="12" ${S}/><line x1="5.3" y1="5.3" x2="6.7" y2="6.7" ${S}/><line x1="17.3" y1="17.3" x2="18.7" y2="18.7" ${S}/><line x1="5.3" y1="18.7" x2="6.7" y2="17.3" ${S}/><line x1="17.3" y1="6.7" x2="18.7" y2="5.3" ${S}/>`,
  moon: `<path d="M20.5 13.2A8.5 8.5 0 1 1 10.8 3.5a7 7 0 0 0 9.7 9.7z" ${S}/>`,
  film: `<rect x="3" y="4" width="18" height="16" rx="2.5" ${S}/><line x1="8" y1="4" x2="8" y2="20" ${S}/><line x1="16" y1="4" x2="16" y2="20" ${S}/><line x1="3" y1="9" x2="8" y2="9" ${S}/><line x1="3" y1="15" x2="8" y2="15" ${S}/><line x1="16" y1="9" x2="21" y2="9" ${S}/><line x1="16" y1="15" x2="21" y2="15" ${S}/>`,
  sparkle: `<path d="M12 3.5 13.8 9.2 19.5 11 13.8 12.8 12 18.5 10.2 12.8 4.5 11 10.2 9.2z" ${S}/><path d="M18.5 3.5v3M17 5h3" ${S}/>`,
  users: `<circle cx="9" cy="8" r="3.4" ${S}/><path d="M3.5 20a5.5 5.5 0 0 1 11 0" ${S}/><path d="M15.5 5.2a3.4 3.4 0 0 1 0 5.9" ${S}/><path d="M17.5 14.6a5.5 5.5 0 0 1 3 4.9" ${S}/>`,
  heart: `<path d="M12 20s-7.5-4.7-9.3-9A5.2 5.2 0 0 1 12 6.6 5.2 5.2 0 0 1 21.3 11c-1.8 4.3-9.3 9-9.3 9z" ${S}/>`,
  shield: `<path d="M12 21.5s7.5-3.7 7.5-9.5V5.5L12 2.8 4.5 5.5V12c0 5.8 7.5 9.5 7.5 9.5z" ${S}/>`,
  lock: `<rect x="5" y="10.5" width="14" height="10" rx="2" ${S}/><path d="M8.5 10.5v-3a3.5 3.5 0 0 1 7 0v3" ${S}/>`,
  activity: `<polyline points="3 12.5 7.5 12.5 10 6.5 14 18 16.5 12.5 21 12.5" ${S}/>`,
};

export function icon(name, cls = '') {
  const body = PATHS[name] || PATHS.sparkle;
  return `<svg class="icon${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
}

const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu;

/** Strip emoji (used to keep the chrome clean while data stays expressive). */
export function stripEmoji(text) {
  return String(text || '').replace(EMOJI_RE, '').replace(/\s{2,}/g, ' ').replace(/^\s*[·—-]\s*/, '').trim();
}
