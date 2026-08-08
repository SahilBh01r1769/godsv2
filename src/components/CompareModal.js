import { getDeityById, traitVector } from '../utils/similarity.js';
import { TRAITS, PANTHEON_COLORS } from '../data/deities.js';
import { STATE_KEYS } from '../utils/store.js';

export class CompareModal {
  constructor(store) {
    this.store = store;
    this.container = null;
  }

  mount(container) {
    this.container = container;
    this.bindEvents();

    // Subscribe to compare state
    this.store.subscribe(STATE_KEYS.COMPARE_B, () => {
      const a = this.store.get(STATE_KEYS.COMPARE_A);
      const b = this.store.get(STATE_KEYS.COMPARE_B);
      if (a && b) this.render(a, b);
    });
  }

  bindEvents() {
    this.container?.querySelector('#compare-close')?.addEventListener('click', () => {
      this.container.classList.remove('open');
      this.store.set(STATE_KEYS.COMPARE_A, null);
      this.store.set(STATE_KEYS.COMPARE_B, null);
    });

    this.container?.addEventListener('click', e => {
      if (e.target === this.container) {
        this.container.classList.remove('open');
        this.store.set(STATE_KEYS.COMPARE_A, null);
        this.store.set(STATE_KEYS.COMPARE_B, null);
      }
    });
  }

  render(idA, idB) {
    const a = getDeityById(idA);
    const b = getDeityById(idB);
    if (!a || !b) return;

    const content = this.container.querySelector('#compare-content');
    if (!content) return;

    const va = traitVector(a), vb = traitVector(b);

    content.innerHTML = `
      <div class="compare-grid">
        <div class="compare-col">
          <h3 style="color:${PANTHEON_COLORS[a.pantheon]}">${a.id}</h3>
          <p>${a.epithet}</p>
        </div>
        <div class="compare-col">
          <h3 style="color:${PANTHEON_COLORS[b.pantheon]}">${b.id}</h3>
          <p>${b.epithet}</p>
        </div>
      </div>
      <div class="compare-traits">
        ${TRAITS.map((t, i) => `
          <div class="compare-trait-row">
            <span class="ct-val">${va[i] || 0}</span>
            <span class="ct-name">${t}</span>
            <span class="ct-val">${vb[i] || 0}</span>
          </div>`).join('')}
      </div>`;

    this.container.classList.add('open');
  }
}