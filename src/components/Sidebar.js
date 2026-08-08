/* ─────────────────────────────────────────────────────────────────
   components/Sidebar.js — Deity info, radar, heatmap, connections
   ───────────────────────────────────────────────────────────────── */

import { TRAITS, PANTHEON_COLORS } from '../data/deities.js';
import { traitVector, traitFillColor, getDeityById } from '../utils/similarity.js';
import { getDeityRefs } from '../data/citations.js';
import { STATE_KEYS } from '../utils/store.js';

export class Sidebar {
  constructor(store, generator, feedback) {
    this.store = store;
    this.generator = generator;
    this.feedback = feedback;
    this.container = null;
  }

  mount(container) {
    this.container = container;
  }

  setupSubscriptions() {
    this.store.subscribe(STATE_KEYS.SELECTED_DEITY, () => this.render());
    this.store.subscribe(STATE_KEYS.GRAPH_DATA, () => this.render());
    this.store.subscribe(STATE_KEYS.ACTIVE_TRAIT_FILTER, () => this.render());
  }

  render() {
    const deityId = this.store.get(STATE_KEYS.SELECTED_DEITY);
    const infoPanel = document.getElementById('stab-info-content');
    if (!infoPanel) return;

    if (!deityId) {
      infoPanel.innerHTML = `
        <div class="sidebar-empty">
          <div class="sidebar-empty-icon">☽</div>
          <p>Select or search for a deity to explore their connections.</p>
        </div>`;
      return;
    }

    const deity = getDeityById(deityId);
    if (!deity) return;

    const col  = PANTHEON_COLORS[deity.pantheon] || '#888';
    const refs = getDeityRefs(deity.id);
    const { nodes, edges } = this.store.get(STATE_KEYS.GRAPH_DATA);
    const activeFilter = this.store.get(STATE_KEYS.ACTIVE_TRAIT_FILTER);

    // Build connections list
    const connections = edges
      .filter(e => (e.source.id || e.source) === deityId || (e.target.id || e.target) === deityId)
      .map(e => {
        const otherId = (e.source.id || e.source) === deityId
          ? (e.target.id || e.target)
          : (e.source.id || e.source);
        return { id: otherId, similarity: e.similarity };
      })
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 10);

    infoPanel.innerHTML = `
      ${this.renderDeityCard(deity, col, refs)}
      ${this.renderRadar(deity)}
      ${this.renderHeatmap(deity, activeFilter)}
      ${this.renderConnections(connections)}
    `;

    // Bind events
    this.bindEvents(infoPanel, deity);
  }

  renderDeityCard(deity, col, refs) {
    return `
      <div class="panel-title"><span class="panel-icon">⟁</span> Selected deity</div>
      <div class="card">
        <div class="pantheon-badge" style="background:${col}20;color:${col};border:1px solid ${col}44">
          <span class="pantheon-dot" style="background:${col}"></span>
          ${deity.pantheon}
        </div>
        <div class="deity-card-name">${deity.id}</div>
        ${deity.originalScript ? `<div class="original-script">${deity.originalScript}</div>` : ''}
        <div class="deity-card-epithet">${deity.epithet}</div>
        <div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap;">
          <span class="era-badge">📅 ${this.eraLabel(deity.era)}</span>
        </div>
        ${refs.length ? `
          <div class="deity-refs">
            <div class="refs-title">📜 Primary sources</div>
            ${refs.map(r => `<div class="ref-item">${r}</div>`).join('')}
          </div>` : ''}
      </div>`;
  }

  renderRadar(deity) {
    const traits = TRAITS.filter(t => deity.traits && deity.traits[t] > 0);
    if (!traits.length) return '';

    const size = 160, cx = size / 2, cy = size / 2, r = 60;
    const angleStep = (2 * Math.PI) / TRAITS.length;

    let gridLines = '', dataPoints = '';
    TRAITS.forEach((t, i) => {
      const angle = i * angleStep - Math.PI / 2;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      gridLines += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="var(--border-1)" stroke-width="0.5"/>`;

      const val = deity.traits[t] || 0;
      const dr = val * r;
      const dx = cx + dr * Math.cos(angle);
      const dy = cy + dr * Math.sin(angle);
      dataPoints += `${dx},${dy} `;
    });

    return `
      <div class="panel-title"><span class="panel-icon">◈</span> Trait radar</div>
      <div class="card" style="text-align:center;">
        <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
          ${gridLines}
          <polygon points="${dataPoints.trim()}" fill="var(--accent-glow)" stroke="var(--accent)" stroke-width="1.5"/>
        </svg>
      </div>`;
  }

  renderHeatmap(deity, activeFilter) {
    let html = `<div class="panel-title"><span class="panel-icon">▦</span> Trait heatmap</div><div class="card"><div class="heatmap-grid">`;

    TRAITS.forEach(t => {
      const val = deity.traits?.[t] || 0;
      const isActive = activeFilter === t;
      const bg = val > 0 ? traitFillColor(t) : 'var(--bg-4)';
      html += `
        <div class="heatmap-cell ${isActive ? 'active' : ''}" data-trait="${t}"
             style="background:${bg};opacity:${val > 0 ? 0.3 + val * 0.7 : 0.3}"
             title="${t}: ${val}">
          ${t.slice(0, 3)}
        </div>`;
    });

    html += '</div></div>';
    return html;
  }

  renderConnections(connections) {
    if (!connections.length) return '';

    return `
      <div class="panel-title"><span class="panel-icon">⬡</span> Top connections</div>
      <div class="card">
        ${connections.map(c => `
          <div class="conn-row" data-deity="${c.id}">
            <span class="conn-name">${c.id}</span>
            <div class="conn-bar-wrap">
              <div class="conn-bar" style="width:${(c.similarity * 100).toFixed(0)}%"></div>
            </div>
            <span class="conn-sim">${(c.similarity * 100).toFixed(0)}%</span>
          </div>`).join('')}
      </div>`;
  }

  bindEvents(panel, deity) {
    // Trait heatmap click
    panel.querySelectorAll('.heatmap-cell').forEach(cell => {
      cell.addEventListener('click', () => {
        const trait = cell.dataset.trait;
        this.generator.handleTraitClick(trait);
      });
    });

    // Connection row click
    panel.querySelectorAll('.conn-row').forEach(row => {
      row.addEventListener('click', () => {
        const id = row.dataset.deity;
        this.generator.loadDeity(id);
      });
    });
  }

  eraLabel(era) {
    const labels = ['All', '~2000–1500 BCE', '~1500–800 BCE', '~800–200 BCE', '~200 BCE–500 CE', '~500 CE+'];
    return labels[era] || 'Unknown';
  }

  clear() {
    const infoPanel = document.getElementById('stab-info-content');
    if (infoPanel) infoPanel.innerHTML = '';
  }
}