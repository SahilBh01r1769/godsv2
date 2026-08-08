import { STATE_KEYS } from '../utils/store.js';
import { exportJSON, exportSVG } from '../utils/export.js';

export class GraphControls {
  constructor(store, generator, feedback) {
    this.store = store;
    this.generator = generator;
    this.feedback = feedback;
    this.container = null;
  }

  mount(container) {
    this.container = container;
    this.container.innerHTML = `
      <div class="controls-bar">
        <div class="control-group">
          <button class="btn btn-sm" id="gen-btn" title="Generate network">▶ Generate</button>
          <button class="btn btn-sm btn-gold" id="surprise-btn" title="Random deity">✦ Surprise</button>
          <button class="btn btn-sm btn-danger" id="clear-btn" title="Clear">✕ Clear</button>
        </div>

        <div class="control-group">
          <div class="tab-group" id="link-mode-tabs">
            <button class="tab-btn active" data-link="top5">Top 5</button>
            <button class="tab-btn" data-link="top10">Top 10</button>
            <button class="tab-btn" data-link="all">All</button>
          </div>
        </div>

        <div class="control-group">
          <div class="tab-group" id="metric-tabs">
            <button class="tab-btn active" data-metric="cosine">Cosine</button>
            <button class="tab-btn" data-metric="jaccard">Jaccard</button>
            <button class="tab-btn" data-metric="euclidean">Euclidean</button>
          </div>
        </div>

        <div class="control-group slider-row">
          <span class="slider-label">Threshold</span>
          <input type="range" id="thresh-sl" min="0" max="100" value="35" />
          <span class="slider-val" id="thresh-val">0.35</span>
        </div>

        <div class="control-group slider-row">
          <span class="slider-label">Era</span>
          <input type="range" id="era-sl" min="0" max="5" value="0" />
          <span class="slider-val" id="era-val">All</span>
        </div>

        <div class="control-group">
          <label class="toggle-row">
            <span class="toggle-label">Cluster</span>
            <div class="toggle"><input type="checkbox" id="cluster-cb" /><span class="toggle-track"></span></div>
          </label>
          <label class="toggle-row">
            <span class="toggle-label">Labels</span>
            <div class="toggle"><input type="checkbox" id="labels-cb" checked /><span class="toggle-track"></span></div>
          </label>
          <label class="toggle-row">
            <span class="toggle-label">Expand</span>
            <div class="toggle"><input type="checkbox" id="expand-cb" checked /><span class="toggle-track"></span></div>
          </label>
        </div>

        <div class="control-group">
          <button class="btn btn-sm" id="cognate-btn" title="Toggle cognate highlighting">Cognates</button>
          <button class="btn btn-sm btn-icon" id="zoom-in-btn" title="Zoom in">+</button>
          <button class="btn btn-sm btn-icon" id="zoom-out-btn" title="Zoom out">−</button>
          <button class="btn btn-sm btn-icon" id="reset-zoom-btn" title="Reset zoom">⌂</button>
          <button class="btn btn-sm" id="unpin-btn" title="Unpin all">Unpin</button>
        </div>

        <div class="control-group">
          <button class="btn btn-sm btn-ghost" id="export-json-btn" title="Export JSON">↓ JSON</button>
          <button class="btn btn-sm btn-ghost" id="export-svg-btn" title="Export SVG">↓ SVG</button>
        </div>
      </div>`;

    this.bindEvents();
  }

  setupSubscriptions() {
    // Could subscribe to state changes to update UI
  }

  bindEvents() {
    const $ = id => this.container.querySelector(`#${id}`);

    // Generate
    $('gen-btn')?.addEventListener('click', () => {
      this.generator.generate();
    });

    // Surprise
    $('surprise-btn')?.addEventListener('click', () => {
      this.generator.surprise();
    });

    // Clear
    $('clear-btn')?.addEventListener('click', () => {
      this.generator.clearGraph();
      const searchInput = document.querySelector('.search-input');
      if (searchInput) searchInput.value = '';
      document.getElementById('path-strip').style.display = 'none';
      document.getElementById('surprising-panel').style.display = 'none';
    });

    // Link mode tabs
    $('link-mode-tabs')?.addEventListener('click', e => {
      const btn = e.target.closest('.tab-btn');
      if (!btn) return;
      this.store.set(STATE_KEYS.LINK_MODE, btn.dataset.link);
      this.container.querySelectorAll('#link-mode-tabs .tab-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.link === btn.dataset.link)
      );
      if (this.store.get(STATE_KEYS.SELECTED_DEITY)) this.generator.generate();
    });

    // Metric tabs
    $('metric-tabs')?.addEventListener('click', e => {
      const btn = e.target.closest('.tab-btn');
      if (!btn) return;
      this.store.set(STATE_KEYS.SIMILARITY_METHOD, btn.dataset.metric);
      this.container.querySelectorAll('#metric-tabs .tab-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.metric === btn.dataset.metric)
      );
    });

    // Threshold slider
    $('thresh-sl')?.addEventListener('input', e => {
      const value = parseFloat(e.target.value) / 100;
      this.store.set(STATE_KEYS.GRAPH_THRESHOLD, value);
      $('thresh-val').textContent = value.toFixed(2);
    });

    // Era slider
    const eraLabels = ['All', '500 CE', '200 BCE', '800 BCE', '1500 BCE', '2000 BCE'];
    $('era-sl')?.addEventListener('input', e => {
      const value = parseInt(e.target.value);
      this.store.set(STATE_KEYS.ERA_FILTER, value);
      $('era-val').textContent = eraLabels[value];
    });

    // Toggles
    $('cluster-cb')?.addEventListener('change', e => {
      this.store.set(STATE_KEYS.CLUSTER_BY_PAN, e.target.checked);
      if (this.store.get(STATE_KEYS.SELECTED_DEITY)) this.generator.generate();
    });

    $('labels-cb')?.addEventListener('change', e => {
      this.store.set(STATE_KEYS.SHOW_LABELS, e.target.checked);
    });

    $('expand-cb')?.addEventListener('change', e => {
      this.store.set(STATE_KEYS.EXPAND_ON_CLICK, e.target.checked);
    });

    // Cognates
    $('cognate-btn')?.addEventListener('click', () => {
      const next = !this.store.get(STATE_KEYS.SHOW_COGNATES);
      this.store.set(STATE_KEYS.SHOW_COGNATES, next);
      $('cognate-btn').classList.toggle('btn-active', next);
      this.store.set(STATE_KEYS.UI_TOAST,
        next ? 'Cognate pairs highlighted in gold' : 'Cognate highlighting off');
    });

    // Zoom controls (delegated to GraphView via custom events)
    $('zoom-in-btn')?.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('graph:zoomIn'));
    });
    $('zoom-out-btn')?.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('graph:zoomOut'));
    });
    $('reset-zoom-btn')?.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('graph:resetZoom'));
    });
    $('unpin-btn')?.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('graph:unpinAll'));
      this.store.set(STATE_KEYS.PINNED_NODES, new Set());
      this.store.set(STATE_KEYS.UI_TOAST, 'All nodes unpinned');
    });

    // Export
    $('export-json-btn')?.addEventListener('click', () => {
      const data = this.store.get(STATE_KEYS.GRAPH_DATA);
      const filename = exportJSON({
        nodes: data.nodes,
        edges: data.edges,
        centerDeity: this.store.get(STATE_KEYS.SELECTED_DEITY),
        metric: this.store.get(STATE_KEYS.SIMILARITY_METHOD),
        threshold: this.store.get(STATE_KEYS.GRAPH_THRESHOLD),
      });
      this.store.set(STATE_KEYS.UI_TOAST, filename ? `Exported: ${filename}` : 'Generate a network first');
    });

    $('export-svg-btn')?.addEventListener('click', () => {
      const filename = exportSVG();
      this.store.set(STATE_KEYS.UI_TOAST, filename ? `Exported: ${filename}` : 'Nothing to export');
    });
  }
}