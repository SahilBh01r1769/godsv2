import { DEITIES, TRAITS, PANTHEON_COLORS } from '../data/deities.js';
import { STATE_KEYS } from '../utils/store.js';

export class ArchetypesView {
  constructor(store, generator) {
    this.store = store;
    this.generator = generator;
    this.container = null;
  }

  mount(container) {
    this.container = container;
  }

  setupSubscriptions() {
    this.store.subscribe(STATE_KEYS.CURRENT_VIEW, view => {
      if (view === 'archetypes') this.render();
    });
    this.store.subscribe(STATE_KEYS.ACTIVE_TRAIT_FILTER, () => {
      if (this.store.get(STATE_KEYS.CURRENT_VIEW) === 'archetypes') this.render();
    });
  }

  render() {
    if (!this.container) return;

    const activeTrait = this.store.get(STATE_KEYS.ACTIVE_TRAIT_FILTER);

    let html = `
      <div class="view-inner">
        <div class="view-title">Archetype Explorer</div>
        <div class="view-subtitle">
          Click any trait to filter the graph to deities sharing that archetype.
          ${activeTrait ? `<br><span style="color:var(--gold)">Currently filtering: <strong>${activeTrait}</strong></span>` : ''}
        </div>
        <div class="archetype-grid">`;

    TRAITS.forEach(trait => {
      const tNorm = trait.toLowerCase().replace(/\s*\/\s*/g, ' / ').trim();
      
      // Case-insensitive lookup for rendering
      const deitiesWithTrait = DEITIES.filter(d => {
        if (!d.traits) return false;
        return Object.keys(d.traits).some(k => {
          const kNorm = k.toLowerCase().replace(/\s*\/\s*/g, ' / ').trim();
          return kNorm === tNorm && d.traits[k] > 0;
        });
      });

      html += `
        <div class="archetype-card ${activeTrait === trait ? 'active' : ''}" data-trait="${trait}">
          <div class="archetype-name">${trait}</div>
          <div class="archetype-count">${deitiesWithTrait.length} deities</div>
          <div class="archetype-dots" style="display:flex;flex-wrap:wrap;gap:3px;justify-content:center;margin-top:6px;">
            ${deitiesWithTrait.slice(0, 8).map(d =>
              // FIX FOR ISSUE 2: Added inline styles for width, height, and border-radius
              `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${PANTHEON_COLORS[d.pantheon]};" title="${d.id}"></span>`
            ).join('')}
            ${deitiesWithTrait.length > 8 ? `<span style="font-size:9px;color:var(--text-3);align-self:center;">+${deitiesWithTrait.length - 8}</span>` : ''}
          </div>
        </div>`;
    });

    html += `</div>`;

    if (activeTrait) {
      html += `<button class="btn btn-sm btn-ghost" id="clear-trait-filter" style="margin-top:16px;">✕ Clear filter</button>`;
    }

    html += `</div>`;
    this.container.innerHTML = html;

    this.container.querySelectorAll('.archetype-card').forEach(card => {
      card.addEventListener('click', () => {
        const trait = card.dataset.trait;
        const tNorm = trait.toLowerCase().replace(/\s*\/\s*/g, ' / ').trim();

        // FIX FOR ISSUE 1: Use case-insensitive lookup for the click handler
        const deitiesWithTrait = DEITIES.filter(d => {
          if (!d.traits) return false;
          return Object.keys(d.traits).some(k => {
            const kNorm = k.toLowerCase().replace(/\s*\/\s*/g, ' / ').trim();
            return kNorm === tNorm && d.traits[k] > 0;
          });
        });

        if (deitiesWithTrait.length === 0) return;

        // Pick the deity with highest trait value (also needs case-insensitive extraction)
        const bestDeity = deitiesWithTrait.reduce((best, d) => {
          const val = Object.entries(d.traits).find(([k]) => k.toLowerCase().replace(/\s*\/\s*/g, ' / ').trim() === tNorm)?.[1] || 0;
          const bestVal = Object.entries(best.traits).find(([k]) => k.toLowerCase().replace(/\s*\/\s*/g, ' / ').trim() === tNorm)?.[1] || 0;
          return val > bestVal ? d : best;
        }, deitiesWithTrait[0]);

        this.store.set(STATE_KEYS.ACTIVE_TRAIT_FILTER, trait);
        this.store.set(STATE_KEYS.CURRENT_VIEW, 'graph');
        this.generator.loadDeity(bestDeity.id, { resetGraph: true });
        this.render();
      });
    });

    this.container.querySelector('#clear-trait-filter')?.addEventListener('click', () => {
      this.store.set(STATE_KEYS.ACTIVE_TRAIT_FILTER, null);
      this.generator.generate();
      this.render();
    });
  }
}