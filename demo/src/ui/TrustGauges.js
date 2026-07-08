/**
 * TrustGauges — Trust scores as a clean vertical list.
 *
 * Each row shows:
 * - Category name + tier chip
 * - Score number, right-aligned
 * - Slim horizontal progress bar (blue fill on a light-grey track)
 *
 * Subscribes to StateStore trust updates and animates bar width changes.
 *
 * Requirements: 9.1, 9.2, 9.3
 */

/** Device categories to display rows for */
const CATEGORIES = [
  'climate',
  'lighting',
  'security',
  'kitchen',
  'utility',
  'power',
  'entertainment',
  'assistant',
];

export class TrustGauges {
  /**
   * @param {import('../simulation/StateStore.js').StateStore} stateStore
   */
  constructor(stateStore) {
    this.stateStore = stateStore;
    this.gaugeElements = new Map(); // category → { fill, scoreText, tierText }
    this.render();
    this.subscribeToUpdates();
  }

  /**
   * Create the list HTML within #trust-gauges container.
   * Each row has a label, tier chip, score, and progress bar.
   */
  render() {
    const container = document.getElementById('trust-gauges');
    if (!container) return;

    container.innerHTML = '';

    // Title
    const title = document.createElement('h3');
    title.className = 'trust-gauges-title';
    title.textContent = 'Trust Scores';
    container.appendChild(title);

    // List container
    const list = document.createElement('div');
    list.className = 'trust-list';
    container.appendChild(list);

    // Create each row
    for (const category of CATEGORIES) {
      const rowEl = this._createRowElement(category);
      list.appendChild(rowEl);

      // Cache references
      const fill = rowEl.querySelector('.trust-row-fill');
      const scoreText = rowEl.querySelector('.trust-row-score');
      const tierText = rowEl.querySelector('.trust-row-tier');
      this.gaugeElements.set(category, { fill, scoreText, tierText });
    }
  }

  /**
   * Create a single trust row DOM element.
   * @param {string} category
   * @returns {HTMLElement}
   */
  _createRowElement(category) {
    const displayName = category.charAt(0).toUpperCase() + category.slice(1);

    const row = document.createElement('div');
    row.className = 'trust-row';
    row.setAttribute('data-gauge', category);

    const label = document.createElement('span');
    label.className = 'trust-row-label';
    label.textContent = displayName;

    const tierSpan = document.createElement('span');
    tierSpan.className = 'trust-row-tier';
    tierSpan.textContent = 'Tier 1';
    label.appendChild(tierSpan);

    const score = document.createElement('span');
    score.className = 'trust-row-score';
    score.textContent = '0';

    const track = document.createElement('div');
    track.className = 'trust-row-track';

    const fill = document.createElement('div');
    fill.className = 'trust-row-fill';
    track.appendChild(fill);

    row.appendChild(label);
    row.appendChild(score);
    row.appendChild(track);

    return row;
  }

  /**
   * Subscribe to StateStore trust updates for each category.
   * When trust:{category} fires, animate the corresponding row.
   */
  subscribeToUpdates() {
    for (const category of CATEGORIES) {
      this.stateStore.on(`trust:${category}`, (data) => {
        this.updateGauge(category, data);
      });
    }
  }

  /**
   * Update a single row's bar and text to reflect a new score/tier.
   * The bar width animates via CSS transition.
   *
   * @param {string} category
   * @param {{ score: number, tier: number }} data
   */
  updateGauge(category, { score, tier }) {
    const elements = this.gaugeElements.get(category);
    if (!elements) return;

    const { fill, scoreText, tierText } = elements;

    const percentage = Math.max(0, Math.min(100, score));

    if (fill) {
      fill.style.width = `${percentage}%`;
    }

    if (scoreText) {
      scoreText.textContent = String(Math.round(score));
    }

    if (tierText) {
      tierText.textContent = `Tier ${tier}`;
    }
  }

  /**
   * Accept initial tier data (from DataLayer.getAutonomyTiers()) to set starting values.
   * @param {{ tiers: Array<{ category: string, currentTier: number, trustScore: number }> }} tiersData
   */
  initializeFromData(tiersData) {
    if (!tiersData || !tiersData.tiers) return;

    for (const tierEntry of tiersData.tiers) {
      const { category, currentTier, trustScore } = tierEntry;
      if (CATEGORIES.includes(category)) {
        // Set the state store so it's in sync
        this.stateStore.trustScores.set(category, { score: trustScore, tier: currentTier });
        // Update the row visually
        this.updateGauge(category, { score: trustScore, tier: currentTier });
      }
    }
  }
}
