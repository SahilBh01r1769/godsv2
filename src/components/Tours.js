import { TOURS } from '../data/tours.js';
import { PANTHEON_COLORS, DEITIES } from '../data/deities.js';
import { STATE_KEYS } from '../utils/store.js';

export class Tours {
  constructor(store, generator, feedback) {
    this.store = store;
    this.generator = generator;
    this.feedback = feedback;
    this.container = null;
    this.activeTourId = null;
  }

  mount(container) {
    this.container = container;
    this.renderTourList();
  }

  setupSubscriptions() {
    // Could subscribe to tour state changes
  }

  renderTourList() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="panel-title"><span class="panel-icon">✦</span> Guided tours</div>
      <div style="font-size:11px;color:var(--text-3);margin-bottom:10px">
        Pre-built story paths through the network
      </div>
      <div class="tour-list">
        ${TOURS.map(tour => this.buildTourCard(tour)).join('')}
      </div>`;

    this.container.querySelectorAll('.tour-card').forEach(el => {
      el.addEventListener('click', () => {
        const tourId = el.dataset.tourId;
        this.selectTour(TOURS.find(t => t.id === tourId));
      });
    });
  }

  buildTourCard(tour) {
    // Defensive: handle missing steps/stops/whatever the property is called
    const steps = tour.steps || tour.stops || tour.chapters || tour.route || [];
    const stepCount = Array.isArray(steps) ? steps.length : 0;

    return `
      <div class="tour-card ${this.activeTourId === tour.id ? 'active' : ''}" data-tour-id="${tour.id}">
        <span class="tour-icon">${tour.icon || '✦'}</span>
        <div class="tour-card-body">
          <div class="tour-name">${tour.name || tour.id}</div>
          <div class="tour-desc">${tour.description || ''}</div>
          <div class="tour-steps">${stepCount} stops</div>
        </div>
      </div>`;
  }

  selectTour(tour) {
    if (!tour) return;
    this.activeTourId = tour.id;
    this.renderTourList();

    // Find the actual steps array (whatever it's called)
    const steps = tour.steps || tour.stops || tour.chapters || tour.route || [];

    if (steps.length > 0) {
      // First step might be { deityId: 'Zeus' } or { id: 'Zeus' } or just 'Zeus'
      const firstStep = steps[0];
      const deityId = typeof firstStep === 'string'
        ? firstStep
        : firstStep.deityId || firstStep.id || firstStep.deity || firstStep;

      this.generator.loadDeity(deityId, { resetGraph: true });
      this.store.set(STATE_KEYS.UI_TOAST, `Tour: ${tour.name}`);
    }
  }

  clear() {
    this.activeTourId = null;
    this.renderTourList();
  }
}