import { DEITIES, PANTHEON_COLORS } from '../data/deities.js';
import { STATE_KEYS } from '../utils/store.js';

export class Surprising {
  constructor(store, generator, feedback) {
    this.store = store;
    this.generator = generator;
    this.feedback = feedback;
    this.container = null;
  }

  mount(container) {
    this.container = container;
  }

  render(deityId) {
    if (!this.container) return;
    this.container.style.display = 'block';
    this.container.innerHTML = `
      <div class="panel-title"><span class="panel-icon">⚡</span> Surprising connection</div>
      <div class="card">
        <p>Unexpected link found for <strong>${deityId}</strong></p>
        <button class="btn btn-sm btn-accent" id="surprising-load">Explore</button>
        <button class="btn btn-sm btn-ghost" id="surprising-close">✕</button>
      </div>`;

    this.container.querySelector('#surprising-load')?.addEventListener('click', () => {
      this.generator.loadDeity(deityId, { resetGraph: true });
    });
    this.container.querySelector('#surprising-close')?.addEventListener('click', () => {
      this.container.style.display = 'none';
    });
  }

  hide() {
    if (this.container) this.container.style.display = 'none';
  }
}