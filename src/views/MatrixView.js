import { DEITIES, TRAITS, PANTHEON_COLORS } from '../data/deities.js';
import { traitVector } from '../utils/similarity.js';
import { STATE_KEYS } from '../utils/store.js';

export class MatrixView {
  constructor(store, generator) {
    this.store = store;
    this.generator = generator;
    this.container = null;
  }

  mount(container) {
    this.container = container;
  }

  setupSubscriptions() {
    this.store.subscribe(STATE_KEYS.GRAPH_DATA, () => this.render());
  }

  render() {
    if (!this.container) return;
    const { nodes } = this.store.get(STATE_KEYS.GRAPH_DATA);

    if (!nodes.length) {
      this.container.innerHTML = `
        <div class="view-empty">
          <p>Generate a network first to see the similarity matrix.</p>
        </div>`;
      return;
    }

    let html = '<div class="matrix-wrap"><table class="matrix-table"><thead><tr><th></th>';
    nodes.forEach(n => {
      html += `<th class="matrix-header" title="${n.id}">${n.id.slice(0, 6)}</th>`;
    });
    html += '</tr></thead><tbody>';

    nodes.forEach((row, i) => {
      html += `<tr><td class="matrix-row-label">${row.id}</td>`;
      nodes.forEach((col, j) => {
        const sim = i === j ? 1 : this.cosine(row, col);
        const alpha = Math.max(0.05, sim);
        const bg = `rgba(99, 179, 237, ${alpha})`;
        html += `<td class="matrix-cell" data-deity="${col.id}"
                      style="background:${bg}" title="${row.id} ↔ ${col.id}: ${(sim*100).toFixed(0)}%">
                   ${(sim * 100).toFixed(0)}
                 </td>`;
      });
      html += '</tr>';
    });

    html += '</tbody></table></div>';
    this.container.innerHTML = html;

    // Bind cell clicks
    this.container.querySelectorAll('.matrix-cell').forEach(cell => {
      cell.addEventListener('click', () => {
        const deityId = cell.dataset.deity;
        if (deityId) this.generator.loadDeity(deityId, { resetGraph: true });
      });
    });
  }

  cosine(a, b) {
    const va = traitVector(a), vb = traitVector(b);
    const dot = va.reduce((s, v, i) => s + v * vb[i], 0);
    const magA = Math.sqrt(va.reduce((s, v) => s + v * v, 0));
    const magB = Math.sqrt(vb.reduce((s, v) => s + v * v, 0));
    return magA && magB ? dot / (magA * magB) : 0;
  }
}