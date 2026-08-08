import { TRAITS, PANTHEON_COLORS } from '../data/deities.js';
import { traitVector, traitFillColor, getDeityById } from '../utils/similarity.js';
import { getDeityRefs } from '../data/citations.js';
import { STATE_KEYS } from '../utils/store.js';

export class Sidebar {
  constructor(store, generator, feedback) {
    this.store = store;
    this.generator = generator;
    this.feedback = feedback;
  }

  mount() {}

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
        <div class="panel">
          <div style="text-align:center;color:var(--text-3);font-size:12px;padding:24px 12px;">
            <div style="font-size:32px;opacity:.4;margin-bottom:10px;">☽</div>
            Select or search for a deity to explore their connections.
          </div>
        </div>`;
      return;
    }

    const deity = getDeityById(deityId);
    if (!deity) return;

    const col = PANTHEON_COLORS[deity.pantheon] || '#888';
    const refs = getDeityRefs(deity.id);
    const { edges } = this.store.get(STATE_KEYS.GRAPH_DATA);
    const activeFilter = this.store.get(STATE_KEYS.ACTIVE_TRAIT_FILTER);

    const connections = (edges || [])
      .filter(e => (e.source.id || e.source) === deityId || (e.target.id || e.target) === deityId)
      .map(e => ({
        id: (e.source.id || e.source) === deityId ? (e.target.id || e.target) : (e.source.id || e.source),
        similarity: e.similarity,
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 10);

    infoPanel.innerHTML = `
      ${this.renderDeityCard(deity, col, refs)}
      ${this.renderRadar(deity)}
      ${this.renderHeatmap(deity, activeFilter)}
      ${this.renderConnections(connections)}`;

    this.bindEvents(infoPanel);
  }

  renderDeityCard(deity, col, refs) {
    return `
      <div class="panel">
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
              ${refs.map(r => `
                <div class="ref-item">
                  <div class="ref-note">${r.note || ''}</div>
                  <div class="ref-src" style="font-size:10px;color:var(--text-3);margin-top:2px;">
                    ${r.bib ? `${r.bib.author} (${r.bib.year}) <em>${r.bib.title}</em>` : (r.ref || '')}
                    ${r.pages ? ` · ${r.pages}` : ''}
                  </div>
                </div>`).join('')}
            </div>` : ''}
        </div>
      </div>`;
  }

  renderRadar(deity) {
    const active = TRAITS.filter(t => deity.traits && deity.traits[t] > 0);
    if (!active.length) return '';

    const size = 180, cx = size / 2, cy = size / 2, r = 70;
    const angleStep = (2 * Math.PI) / TRAITS.length;

    let grid = '', pts = '';
    TRAITS.forEach((t, i) => {
      const angle = i * angleStep - Math.PI / 2;
      grid += `<line x1="${cx}" y1="${cy}" x2="${cx + r * Math.cos(angle)}" y2="${cy + r * Math.sin(angle)}" stroke="var(--border-1)" stroke-width="0.5"/>`;
      const val = deity.traits[t] || 0;
      pts += `${cx + val * r * Math.cos(angle)},${cy + val * r * Math.sin(angle)} `;
    });

    return `
      <div class="panel">
        <div class="panel-title"><span class="panel-icon">◈</span> Trait radar</div>
        <div class="card" style="text-align:center;">
          <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
            ${grid}
            <polygon points="${pts.trim()}" fill="var(--accent-glow)" stroke="var(--accent)" stroke-width="1.5"/>
          </svg>
        </div>
      </div>`;
  }

  renderHeatmap(deity, activeFilter) {
    return `
      <div class="panel">
        <div class="panel-title"><span class="panel-icon">▦</span> Trait heatmap</div>
        <div class="card"><div class="heatmap-grid" style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px;">
          ${TRAITS.map(t => {
            const val = deity.traits?.[t] || 0;
            return `
              <div class="heatmap-cell ${activeFilter === t ? 'active' : ''}" data-trait="${t}"
                   style="background:${val > 0 ? traitFillColor(t) : 'var(--bg-4)'};opacity:${val > 0 ? 0.3 + val * 0.7 : 0.3};
                          padding:6px 4px;border-radius:4px;font-size:10px;text-align:center;cursor:pointer;"
                   title="${t}: ${val}">
                ${t.slice(0, 4)}
              </div>`;
          }).join('')}
        </div></div>
      </div>`;
  }

  renderConnections(connections) {
    if (!connections.length) return '';
    return `
      <div class="panel">
        <div class="panel-title"><span class="panel-icon">⬡</span> Top connections</div>
        <div class="card">
          ${connections.map(c => `
            <div class="conn-row" data-deity="${c.id}" style="display:flex;align-items:center;gap:8px;margin-bottom:6px;cursor:pointer;">
              <span class="conn-name" style="font-size:12px;min-width:70px;">${c.id}</span>
              <div class="conn-bar-wrap" style="flex:1;height:4px;background:var(--bg-5);border-radius:2px;">
                <div class="conn-bar" style="width:${(c.similarity * 100).toFixed(0)}%;height:100%;background:var(--accent);border-radius:2px;"></div>
              </div>
              <span class="conn-sim" style="font-size:10px;color:var(--text-3);">${(c.similarity * 100).toFixed(0)}%</span>
            </div>`).join('')}
        </div>
      </div>`;
  }

  bindEvents(panel) {
    panel.querySelectorAll('.heatmap-cell').forEach(cell => {
      cell.addEventListener('click', () => this.generator.handleTraitClick(cell.dataset.trait));
    });
    panel.querySelectorAll('.conn-row').forEach(row => {
      row.addEventListener('click', () => this.generator.loadDeity(row.dataset.deity));
    });
  }

  eraLabel(era) {
    const map = {
      5: '~2000–1500 BCE',
      4: '~1500–800 BCE',
      3: '~800–200 BCE',
      2: '~200 BCE–500 CE',
      1: '~500 CE+',
    };
    return map[era] || 'Classical period';
  }

  clear() {
    const p = document.getElementById('stab-info-content');
    if (p) p.innerHTML = '';
  }
}