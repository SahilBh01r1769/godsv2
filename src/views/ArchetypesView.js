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
    // Render once when view becomes active
  }

  render() {
    if (!this.container) return;

    let html = '<div class="archetypes-wrap"><h2>Archetype Explorer</h2>';
    html += '<div class="archetype-grid">';

    TRAITS.forEach(trait => {
      const deitiesWithTrait = DEITIES.filter(d => d.traits && d.traits[trait] > 0);
      html += `
        <div class="archetype-card" data-trait="${trait}">
          <div class="archetype-name">${trait}</div>
          <div class="archetype-count">${deitiesWithTrait.length} deities</div>
          <div class="archetype-dots">
            ${deitiesWithTrait.slice(0, 8).map(d =>
              `<span class="dot" style="background:${PANTHEON_COLORS[d.pantheon]}" title="${d.id}"></span>`
            ).join('')}
          </div>
        </div>`;
    });

    html += '</div></div>';
    this.container.innerHTML = html;

    // Bind clicks
    this.container.querySelectorAll('.archetype-card').forEach(card => {
      card.addEventListener('click', () => {
        const trait = card.dataset.trait;
        this.store.set(STATE_KEYS.ACTIVE_TRAIT_FILTER, trait);
        this.store.set(STATE_KEYS.CURRENT_VIEW, 'graph');
        this.generator.generate();
      });
    });
  }
}