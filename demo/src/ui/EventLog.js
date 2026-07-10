/**
 * EventLog — Right sidebar panel displaying chronological proactive action entries.
 *
 * Subscribes to StateStore 'eventlog' events and renders each entry with:
 * - HH:MM timestamp plus stage/tier/confidence meta
 * - Action name with a category line icon
 * - Human-readable device line and plain reasoning sentence
 * - Semantic category badge (Comfort / Security / Energy Saving / Power)
 * - "Override" button that strikes the entry and reduces trust by 15
 *
 * Auto-scrolls to the bottom when new entries arrive.
 *
 * Requirements: 7.3, 8.1
 */
import { formatTime } from '../utils/helpers.js';

export class EventLog {
  /**
   * @param {import('../simulation/StateStore.js').StateStore} stateStore
   */
  constructor(stateStore) {
    this.stateStore = stateStore;
    this.container = document.getElementById('event-log-panel');
    this.entriesContainer = null;

    this.render();
    this.stateStore.on('eventlog', (entry) => this.addEntry(entry));
  }

  /**
   * Creates the HTML structure inside #event-log-panel:
   * - "Alexa Activity" header with close button
   * - Scrollable entries container (#event-log-entries)
   */
  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="event-log-header">
        <h3 class="event-log-title"><span class="alexa-ring-dot" aria-hidden="true"></span>Alexa Activity</h3>
        <button class="event-log-close" aria-label="Close event log" title="Hide event log">✕</button>
      </div>
      <div id="event-log-entries" class="event-log-entries"></div>
    `;

    this.entriesContainer = this.container.querySelector('#event-log-entries');

    // Wire the close button to hide the panel
    const closeBtn = this.container.querySelector('.event-log-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.hide());
    }
  }

  /**
   * Hide the event log panel.
   */
  hide() {
    if (this.container) {
      this.container.classList.add('hidden');
    }
  }

  /**
   * Show the event log panel.
   */
  show() {
    if (this.container) {
      this.container.classList.remove('hidden');
    }
  }

  /**
   * Creates a DOM element for a log entry and appends it to the entries container.
   *
   * Each entry card contains a timestamp, action name with category icon,
   * device line, reasoning sentence, semantic badge, and an Override button.
   *
   * @param {object} entry — { time, action, device, reasoning, type, tier?, confidence?, stage?, category? }
   */
  addEntry(entry) {
    if (!this.entriesContainer) return;

    const el = document.createElement('div');
    el.className = 'event-log-entry';
    if (entry.type) el.dataset.type = entry.type;

    const accentColor = this.getAccentColor(entry.type);
    el.style.borderLeftColor = accentColor;

    const icon = this.getIcon(entry.type);
    const timestamp = this.formatTime(entry.time);

    // Header row
    const header = document.createElement('div');
    header.className = 'event-log-entry-header';

    const timeSpan = document.createElement('span');
    timeSpan.className = 'event-log-time';
    timeSpan.textContent = timestamp;
    header.appendChild(timeSpan);

    // Meta info (stage, tier, confidence)
    if (entry.stage || entry.tier !== undefined || entry.confidence !== undefined) {
      const meta = document.createElement('div');
      meta.className = 'event-log-meta';

      if (entry.stage) {
        const stageSpan = document.createElement('span');
        stageSpan.className = 'event-log-stage';
        stageSpan.textContent = entry.stage;
        meta.appendChild(stageSpan);
      }
      if (entry.tier !== undefined) {
        const tierSpan = document.createElement('span');
        tierSpan.className = 'event-log-tier';
        tierSpan.textContent = `Tier ${entry.tier}`;
        meta.appendChild(tierSpan);
      }
      if (entry.confidence !== undefined) {
        const confSpan = document.createElement('span');
        confSpan.className = 'event-log-confidence';
        confSpan.textContent = `${Math.round(entry.confidence * 100)}%`;
        meta.appendChild(confSpan);
      }

      header.appendChild(meta);
    }

    el.appendChild(header);

    // Action row (icon + name)
    const actionRow = document.createElement('div');
    actionRow.className = 'event-log-entry-action';

    const iconSpan = document.createElement('span');
    iconSpan.className = 'event-log-icon';
    iconSpan.setAttribute('aria-hidden', 'true');
    iconSpan.innerHTML = icon;
    actionRow.appendChild(iconSpan);

    const actionName = document.createElement('span');
    actionName.className = 'event-log-action-name';
    actionName.textContent = entry.action || 'Unknown Action';
    actionRow.appendChild(actionName);

    el.appendChild(actionRow);

    // Device target line — human-readable device name
    const deviceDiv = document.createElement('div');
    deviceDiv.className = 'event-log-device';
    deviceDiv.textContent = this._formatDeviceName(entry.device);
    el.appendChild(deviceDiv);

    // Reasoning line — plain sentence, no prefix
    const reasoningDiv = document.createElement('div');
    reasoningDiv.className = 'event-log-reasoning';
    reasoningDiv.textContent = entry.reasoning || '';
    el.appendChild(reasoningDiv);

    // Badge row (type/tier badge + Override button)
    const badgeRow = document.createElement('div');
    badgeRow.className = 'event-log-badge-row';

    const badge = document.createElement('span');
    badge.className = 'event-log-type-badge';
    badge.textContent = this._getBadgeText(entry);
    badgeRow.appendChild(badge);

    const overrideBtn = document.createElement('button');
    overrideBtn.className = 'event-log-override-btn';
    overrideBtn.textContent = 'Override';
    overrideBtn.addEventListener('click', () => {
      this._handleOverride(el, entry);
    });
    badgeRow.appendChild(overrideBtn);

    el.appendChild(badgeRow);

    this.entriesContainer.appendChild(el);
    this.autoScroll();
  }

  /**
   * Handle override action: apply strikethrough and reduce trust score.
   * @param {HTMLElement} entryEl - The entry DOM element
   * @param {object} entry - The event entry data
   */
  _handleOverride(entryEl, entry) {
    // Apply strikethrough visual
    entryEl.classList.add('event-log-entry--overridden');

    // Determine category from entry (use entry.category or derive from type)
    const category = entry.category || this._categoryFromType(entry.type);

    // Reduce trust score by -15
    if (this.stateStore.updateTrustScore) {
      this.stateStore.updateTrustScore(category, -15);
    }

    // Disable the override button after use
    const btn = entryEl.querySelector('.event-log-override-btn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Overridden';
    }
  }

  /**
   * Map action type to device category for trust score updates.
   * @param {string} type
   * @returns {string}
   */
  _categoryFromType(type) {
    const typeToCategory = {
      ac_precool: 'climate',
      geyser_preheat: 'utility',
      security_arm: 'security',
      energy_optimization: 'power',
      comfort_lighting: 'lighting',
      power_cut: 'power',
    };
    return Object.hasOwn(typeToCategory, type) ? typeToCategory[type] : 'assistant';
  }

  /**
   * Badge text — the semantic benefit category (the title already names the
   * action, so repeating the type here would be noise).
   * @param {object} entry
   * @returns {string}
   */
  _getBadgeText(entry) {
    const labels = {
      ac_precool: 'Comfort',
      comfort_lighting: 'Comfort',
      geyser_preheat: 'Comfort',
      security_arm: 'Security',
      energy_optimization: 'Energy Saving',
      power_cut: 'Power',
    };
    return Object.hasOwn(labels, entry.type) ? labels[entry.type] : this._formatTypeName(entry.type);
  }

  /**
   * Humanize a device identifier: 'living_room_ac' → 'Living Room AC'.
   * Free-form device strings (containing spaces/commas) pass through as-is.
   * @param {string} device
   * @returns {string}
   */
  _formatDeviceName(device) {
    if (!device) return '';
    if (!/^[a-z0-9_]+$/.test(device)) return device;
    return device
      .split('_')
      .map((w) => (w === 'ac' || w === 'tv' || w === 'ups' ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
      .join(' ');
  }

  /**
   * Format a type string into a human-readable label.
   * @param {string} type
   * @returns {string}
   */
  _formatTypeName(type) {
    if (!type) return 'Action';
    return type
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  /**
   * Scrolls the entries container to the bottom to show the latest entry.
   */
  autoScroll() {
    if (this.entriesContainer) {
      this.entriesContainer.scrollTop = this.entriesContainer.scrollHeight;
    }
  }

  /**
   * Removes all entries from the event log.
   */
  clear() {
    if (this.entriesContainer) {
      this.entriesContainer.innerHTML = '';
    }
  }

  /**
   * Returns inline SVG icon markup for the given action type.
   * Line icons drawn with currentColor so CSS can tint them per category.
   * @param {string} type
   * @returns {string}
   */
  getIcon(type) {
    const paths = {
      ac_precool: '<path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9"/>',
      geyser_preheat:
        '<path d="M12 3.5c1.6 3 5 5.2 5 8.9a5 5 0 1 1-10 0c0-1.9.8-3.4 2-5 .4 1.2 1 2 2 2.6.3-2.4.4-4.5 1-6.5z"/>',
      security_arm: '<rect x="5.5" y="11" width="13" height="8.5" rx="2"/><path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3"/>',
      energy_optimization: '<path d="M13 2.5 5 13.5h6L9.8 21.5 18 10.5h-6z"/>',
      comfort_lighting:
        '<path d="M12 3a6 6 0 0 0-3.9 10.6c.7.6.9 1.4.9 2.4h6c0-1 .2-1.8.9-2.4A6 6 0 0 0 12 3zM9.5 19h5M10.5 21.5h3"/>',
      power_cut: '<path d="M12 3.5 2.8 19.5h18.4zM12 9.8v4.4M12 17.2h.01"/>',
    };
    const d = Object.hasOwn(paths, type)
      ? paths[type]
      : '<path d="M18 9.5a6 6 0 1 0-12 0c0 5.5-2.2 6.7-2.2 6.7h16.4S18 15 18 9.5M10.4 19.5a1.8 1.8 0 0 0 3.2 0"/>';
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  }

  /**
   * Returns a CSS color string for the border-left accent per action type.
   * @param {string} type
   * @returns {string}
   */
  getAccentColor(type) {
    const colorMap = {
      ac_precool: '#00CAFF',
      geyser_preheat: '#FF6B35',
      security_arm: '#FFD700',
      energy_optimization: '#00FF88',
      comfort_lighting: '#FFB347',
      power_cut: '#FF4757',
    };
    return Object.hasOwn(colorMap, type) ? colorMap[type] : '#00CAFF';
  }

  /**
   * Format minutes (0–1439) as HH:MM.
   * Uses formatTime from helpers.js.
   * @param {number} minutes
   * @returns {string}
   */
  formatTime(minutes) {
    if (typeof minutes !== 'number' || isNaN(minutes)) return '--:--';
    return formatTime(minutes);
  }
}
