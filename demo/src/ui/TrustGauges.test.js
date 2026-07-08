/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TrustGauges } from './TrustGauges.js';

function setupDOM() {
  document.body.innerHTML = `
    <div id="trust-gauges" class="glass-panel"></div>
  `;
}

function createMockStateStore() {
  const listeners = new Map();
  return {
    devices: new Map(),
    trustScores: new Map(),
    events: [],
    on(key, callback) {
      if (!listeners.has(key)) listeners.set(key, new Set());
      listeners.get(key).add(callback);
    },
    emit(key, data) {
      const cbs = listeners.get(key);
      if (cbs) cbs.forEach(cb => cb(data));
    },
    _listeners: listeners,
  };
}

const CATEGORIES = [
  'climate', 'lighting', 'security', 'kitchen',
  'utility', 'power', 'entertainment', 'assistant',
];

describe('TrustGauges', () => {
  let trustGauges;
  let mockStateStore;

  beforeEach(() => {
    setupDOM();
    mockStateStore = createMockStateStore();
    trustGauges = new TrustGauges(mockStateStore);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('constructor', () => {
    it('stores the stateStore reference', () => {
      expect(trustGauges.stateStore).toBe(mockStateStore);
    });

    it('calls render() creating list HTML', () => {
      const container = document.getElementById('trust-gauges');
      expect(container.querySelector('.trust-gauges-title')).not.toBeNull();
    });

    it('subscribes to trust updates for all categories', () => {
      for (const category of CATEGORIES) {
        expect(mockStateStore._listeners.has(`trust:${category}`)).toBe(true);
      }
    });
  });

  describe('render()', () => {
    it('creates a title "Trust Scores"', () => {
      const title = document.querySelector('.trust-gauges-title');
      expect(title.textContent).toBe('Trust Scores');
    });

    it('creates one row per category (8 rows)', () => {
      const rows = document.querySelectorAll('.trust-row');
      expect(rows.length).toBe(8);
    });

    it('each row has a data-gauge attribute matching its category', () => {
      for (const category of CATEGORIES) {
        const row = document.querySelector(`[data-gauge="${category}"]`);
        expect(row).not.toBeNull();
      }
    });

    it('each row contains a progress track and fill bar', () => {
      const row = document.querySelector('[data-gauge="climate"]');
      expect(row.querySelector('.trust-row-track')).not.toBeNull();
      expect(row.querySelector('.trust-row-fill')).not.toBeNull();
    });

    it('each row shows score text defaulting to 0', () => {
      const scoreText = document.querySelector('[data-gauge="climate"] .trust-row-score');
      expect(scoreText.textContent).toBe('0');
    });

    it('each row shows tier defaulting to Tier 1', () => {
      const tierText = document.querySelector('[data-gauge="climate"] .trust-row-tier');
      expect(tierText.textContent).toBe('Tier 1');
    });

    it('each row displays the category name', () => {
      const labelEl = document.querySelector('[data-gauge="climate"] .trust-row-label');
      expect(labelEl.textContent).toContain('Climate');
    });
  });

  describe('subscribeToUpdates()', () => {
    it('updates row when StateStore emits trust event', () => {
      mockStateStore.emit('trust:climate', { score: 75, tier: 4 });

      const scoreText = document.querySelector('[data-gauge="climate"] .trust-row-score');
      const tierText = document.querySelector('[data-gauge="climate"] .trust-row-tier');
      expect(scoreText.textContent).toBe('75');
      expect(tierText.textContent).toBe('Tier 4');
    });

    it('responds to multiple category updates independently', () => {
      mockStateStore.emit('trust:lighting', { score: 50, tier: 3 });
      mockStateStore.emit('trust:security', { score: 20, tier: 1 });

      const lightingScore = document.querySelector('[data-gauge="lighting"] .trust-row-score');
      const securityScore = document.querySelector('[data-gauge="security"] .trust-row-score');
      expect(lightingScore.textContent).toBe('50');
      expect(securityScore.textContent).toBe('20');
    });
  });

  describe('updateGauge()', () => {
    it('sets fill width based on score percentage', () => {
      trustGauges.updateGauge('climate', { score: 50, tier: 3 });

      const fill = document.querySelector('[data-gauge="climate"] .trust-row-fill');
      expect(fill.style.width).toBe('50%');
    });

    it('clamps score to 0-100 range', () => {
      trustGauges.updateGauge('power', { score: 150, tier: 5 });
      const fill = document.querySelector('[data-gauge="power"] .trust-row-fill');
      expect(fill.style.width).toBe('100%');
    });

    it('handles score of 0 (empty bar)', () => {
      trustGauges.updateGauge('kitchen', { score: 0, tier: 1 });
      const fill = document.querySelector('[data-gauge="kitchen"] .trust-row-fill');
      expect(fill.style.width).toBe('0%');
    });

    it('updates score text to rounded value', () => {
      trustGauges.updateGauge('utility', { score: 62.7, tier: 3 });
      const scoreText = document.querySelector('[data-gauge="utility"] .trust-row-score');
      expect(scoreText.textContent).toBe('63');
    });

    it('updates tier text', () => {
      trustGauges.updateGauge('assistant', { score: 95, tier: 5 });
      const tierText = document.querySelector('[data-gauge="assistant"] .trust-row-tier');
      expect(tierText.textContent).toBe('Tier 5');
    });
  });

  describe('initializeFromData()', () => {
    it('sets initial row values from tier data', () => {
      const tiersData = {
        tiers: [
          { category: 'climate', currentTier: 3, trustScore: 55 },
          { category: 'lighting', currentTier: 4, trustScore: 78 },
        ],
      };

      trustGauges.initializeFromData(tiersData);

      const climateScore = document.querySelector('[data-gauge="climate"] .trust-row-score');
      const lightingTier = document.querySelector('[data-gauge="lighting"] .trust-row-tier');
      expect(climateScore.textContent).toBe('55');
      expect(lightingTier.textContent).toBe('Tier 4');
    });

    it('updates stateStore trustScores map', () => {
      const tiersData = {
        tiers: [
          { category: 'security', currentTier: 2, trustScore: 35 },
        ],
      };

      trustGauges.initializeFromData(tiersData);

      const stored = mockStateStore.trustScores.get('security');
      expect(stored).toEqual({ score: 35, tier: 2 });
    });

    it('handles null/undefined input gracefully', () => {
      expect(() => trustGauges.initializeFromData(null)).not.toThrow();
      expect(() => trustGauges.initializeFromData(undefined)).not.toThrow();
      expect(() => trustGauges.initializeFromData({})).not.toThrow();
    });

    it('ignores unknown categories in tier data', () => {
      const tiersData = {
        tiers: [
          { category: 'unknown_category', currentTier: 1, trustScore: 10 },
        ],
      };

      expect(() => trustGauges.initializeFromData(tiersData)).not.toThrow();
      expect(mockStateStore.trustScores.has('unknown_category')).toBe(false);
    });
  });
});
