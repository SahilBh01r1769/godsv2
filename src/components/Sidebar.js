import { TRAITS, PANTHEON_COLORS } from '../data/deities.js';
import { getDeityById } from '../utils/similarity.js';
import { getDeityRefs } from '../data/citations.js';
import { STATE_KEYS } from '../utils/store.js';

const TRAIT_COLORS = {
  'archer': '#e87040',
  'healer': '#6bc46d',
  'disease sender': '#d9534f',
  'storm god': '#5ba8e0',
  'wilderness': '#6a9f6a',
  'liminal outsider': '#b07cd8',
  'ecstasy / madness': '#d47bc4',
  'ascetic / wisdom': '#e0a846',
  'solar': '#f0c040',
  'war / victory': '#e85555',
  'trickster': '#9b8fe8',
  'smith / craft': '#c48040',
  'sea / water': '#4a9eff',
  'death / underworld': '#808080',
  'fertility': '#2ec27e',
  'fire': '#f5a623',
};

export class Sidebar {
  constructor(store, generator, feedback) {
    this.store = store;
    this.generator = generator;
    this.feedback = feedback;
  }

  mount() {
    this.render();
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
        <div class="panel">
          <div class="panel-title"><span class="panel-icon">☽</span> Explore</div>
          <div class="card" style="padding:14px 12px;">
            <p style="font-size:12px;color:var(--text-2);line-height:1.55;margin:0 0 12px;">
              Select a deity from search or the graph to see traits, domains, sources, and connections.
            </p>
            <div style="font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;">
              Try a tour
            </div>
            <p style="font-size:11px;color:var(--text-2);margin:0;line-height:1.5;">
              Open the <strong style="color:var(--text-1)">Guided Tours</strong> tab for curated paths through storm gods, psychopomps, and solar deities.
            </p>
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
      .filter(e => {
        const src = e.source.id || e.source;
        const tgt = e.target.id || e.target;
        return src === deityId || tgt === deityId;
      })
      .map(e => {
        const src = e.source.id || e.source;
        const tgt = e.target.id || e.target;
        const otherId = src === deityId ? tgt : src;
        const otherDeity = getDeityById(otherId);
        return {
          id: otherId,
          similarity: e.similarity,
          pantheon: otherDeity?.pantheon || 'Unknown',
        };
      })
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
          <div class="deity-card-epithet">${deity.epithet || ''}</div>

          ${deity.desc ? `
            <div class="deity-desc" style="font-size:12px;color:var(--text-2);line-height:1.55;margin:8px 0 10px;">
              ${deity.desc}
            </div>` : ''}

          ${(deity.domains || []).length ? `
            <div class="deity-domains" style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:8px;">
              ${deity.domains.map(d => `<span class="domain-tag">${d}</span>`).join('')}
            </div>` : ''}

          ${(deity.symbols || []).length ? `
            <div style="margin-bottom:8px;">
              <div class="meta-label">Symbols</div>
              <div class="meta-value" style="font-size:11px;color:var(--text-2);">${deity.symbols.join(' · ')}</div>
            </div>` : ''}

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
    // Get only top 8 traits for cleaner visualization
    const traitData = TRAITS.map(t => ({
      trait: t,
      value: deity.traits?.[t] || 0
    })).sort((a, b) => b.value - a.value).slice(0, 8);

    if (!traitData.some(t => t.value > 0)) return '';

    const size = 200, cx = size / 2, cy = size / 2, r = 70;
    const angleStep = (2 * Math.PI) / traitData.length;

    // Concentric circles
    let gridCircles = '';
    [0.33, 0.66, 1.0].forEach(frac => {
      gridCircles += `<circle cx="${cx}" cy="${cy}" r="${r * frac}" fill="none" stroke="var(--border-1)" stroke-width="0.5" opacity="0.3"/>`;
    });

    // Axes
    let axes = '';
    traitData.forEach((t, i) => {
      const angle = i * angleStep - Math.PI / 2;
      const x2 = cx + r * Math.cos(angle);
      const y2 = cy + r * Math.sin(angle);
      axes += `<line x1="${cx}" y1="${cy}" x2="${x2}" y2="${y2}" stroke="var(--border-1)" stroke-width="0.5" opacity="0.3"/>`;
    });

    // Data polygon
    let pts = '';
    traitData.forEach((t, i) => {
      const angle = i * angleStep - Math.PI / 2;
      const x = cx + t.value * r * Math.cos(angle);
      const y = cy + t.value * r * Math.sin(angle);
      pts += `${x},${y} `;
    });

    // Data points with labels
    let points = '';
    traitData.forEach((t, i) => {
      const angle = i * angleStep - Math.PI / 2;
      const x = cx + t.value * r * Math.cos(angle);
      const y = cy + t.value * r * Math.sin(angle);
      
      // Point
      points += `<circle cx="${x}" cy="${y}" r="3" fill="var(--accent-bright)" stroke="white" stroke-width="1.5"/>`;
      
      // Label (outside circle)
      const labelR = r + 15;
      const lx = cx + labelR * Math.cos(angle);
      const ly = cy + labelR * Math.sin(angle);
      
      const shortName = t.trait.length > 12 ? t.trait.split(' ')[0] : t.trait;
      const anchor = Math.cos(angle) > 0.3 ? 'start' : (Math.cos(angle) < -0.3 ? 'end' : 'middle');
      
      points += `<text x="${lx}" y="${ly}" text-anchor="${anchor}" dominant-baseline="middle"
                       font-size="8" fill="var(--text-2)" font-weight="500">${shortName}</text>`;
    });

    return `
      <div class="panel">
        <div class="panel-title"><span class="panel-icon">◈</span> Top traits</div>
        <div class="card" style="text-align:center;padding:12px;">
          <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="overflow:visible;">
            ${gridCircles}
            ${axes}
            <polygon points="${pts.trim()}" fill="var(--accent-glow)" fill-opacity="0.4" stroke="var(--accent)" stroke-width="1.5"/>
            ${points}
          </svg>
        </div>
      </div>`;
  }

  renderHeatmap(deity, activeFilter) {
    const sortedTraits = [...TRAITS].sort((a, b) => {
      const va = deity.traits?.[a] || 0;
      const vb = deity.traits?.[b] || 0;
      return vb - va;
    });

    return `
      <div class="panel">
        <div class="panel-title"><span class="panel-icon">▦</span> Trait heatmap</div>
        <div class="card" style="padding:10px 12px;">
          ${sortedTraits.map(t => {
            const val = deity.traits?.[t] || 0;
            const color = TRAIT_COLORS[t] || '#888';
            const pct = (val * 100).toFixed(0);
            return `
              <div class="hm-row">
                <span class="hm-label ${activeFilter === t ? 'active-filter' : ''}" data-trait="${t}">${t}</span>
                <div class="hm-bar">
                  <div class="hm-fill" style="width:${pct}%;background:${color};"></div>
                </div>
                <span class="hm-val">${pct}%</span>
              </div>`;
          }).join('')}
        </div>
      </div>`;
  }

  renderConnections(connections) {
    if (!connections.length) return '';

    return `
      <div class="panel">
        <div class="panel-title"><span class="panel-icon">⬡</span> Top connections</div>
        <div class="card" style="padding:8px 10px;">
          ${connections.map(c => {
            const pantheonColor = PANTHEON_COLORS[c.pantheon] || '#888';
            return `
              <div class="conn-item" data-deity="${c.id}">
                <span class="conn-dot" style="background:${pantheonColor}"></span>
                <div class="conn-info">
                  <div class="conn-name">${c.id}</div>
                  <div class="conn-pan">${c.pantheon}</div>
                </div>
                <span class="conn-score">${(c.similarity * 100).toFixed(0)}%</span>
              </div>`;
          }).join('')}
        </div>
      </div>`;
  }

  bindEvents(panel) {
    panel.querySelectorAll('.hm-label').forEach(label => {
      label.addEventListener('click', () => {
        this.generator.handleTraitClick(label.dataset.trait);
      });
    });

    panel.querySelectorAll('.conn-item').forEach(item => {
      item.addEventListener('click', () => {
        this.generator.loadDeity(item.dataset.deity);
      });
    });
  }

  eraLabel(era) {
    if (era >= -2000 && era < -1500) return '~2000–1500 BCE';
    if (era >= -1500 && era < -800) return '~1500–800 BCE';
    if (era >= -800 && era < -100) return '~800–200 BCE';
    if (era >= -100 && era < 500) return '~200 BCE–500 CE';
    if (era >= 500) return '~500 CE+';
    return 'Classical period';
  }

  clear() {
    const p = document.getElementById('stab-info-content');
    if (p) p.innerHTML = '';
  }
}