/* ─────────────────────────────────────────────────────────────────
   core/App.js — Application orchestrator (v2 modular)
   Replaces the old monolithic app.js
   ───────────────────────────────────────────────────────────────── */

import { DEITIES, PANTHEON_COLORS, TRAITS } from '../data/deities.js';
import { TOURS } from '../data/tours.js';
import { STATE_KEYS } from '../utils/store.js';

import { Router } from './Router.js';
import { Generator } from './Generator.js';
import { FeedbackUI } from '../ui/Feedback.js';

import { GraphView } from '../views/GraphView.js';
import { MatrixView } from '../views/MatrixView.js';
import { ArchetypesView } from '../views/ArchetypesView.js';
import { MapView } from '../views/MapView.js';

import { Sidebar } from '../components/Sidebar.js';
import { SearchBar } from '../components/SearchBar.js';
import { Tours } from '../components/Tours.js';
import { Surprising } from '../components/Surprising.js';
import { GraphControls } from '../components/GraphControls.js';
import { Legend } from '../components/Legend.js';
import { CompareModal } from '../components/CompareModal.js';
import { PathStrip } from '../components/PathStrip.js';

export class App {
  constructor(store) {
    this.store = store;

    // Core services
    this.feedback  = new FeedbackUI();
    this.router    = new Router(store);
    this.generator = new Generator(store, this.feedback);

    // Views
    this.graphView      = new GraphView(store, this.generator, this.feedback);
    this.matrixView     = new MatrixView(store, this.generator);
    this.archetypesView = new ArchetypesView(store, this.generator);
    this.mapView        = new MapView(store, this.generator);

    // Components
    this.sidebar       = new Sidebar(store, this.generator, this.feedback);
    this.searchBar     = new SearchBar(store, this.generator);
    this.tours         = new Tours(store, this.generator, this.feedback);
    this.surprising    = new Surprising(store, this.generator, this.feedback);
    this.graphControls = new GraphControls(store, this.generator, this.feedback);
    this.legend        = new Legend(store, this.generator);
    this.compareModal  = new CompareModal(store);
    this.pathStrip     = new PathStrip(store);
  }

  start() {
    // 1. Seed data
    this.store.set(STATE_KEYS.DEITIES, DEITIES);
    this.store.set(STATE_KEYS.TOURS, TOURS);

    // 2. Mount components
    this.graphView.mount(document.getElementById('graph-svg'));
    this.matrixView.mount(document.getElementById('matrix-view'));
    this.archetypesView.mount(document.getElementById('archetypes-view'));
    this.mapView.mount(document.getElementById('map-view'));

    this.sidebar.mount(document.getElementById('sidebar'));
    this.searchBar.mount(document.getElementById('search-wrap'));
    this.tours.mount(document.getElementById('stab-tours-content'));
    this.surprising.mount(document.getElementById('surprising-panel'));
    this.graphControls.mount(document.getElementById('graph-controls'));
    this.legend.mount(document.getElementById('graph-view'));
    this.compareModal.mount(document.getElementById('compare-modal'));
    this.pathStrip.mount(document.getElementById('path-strip'));

    // 3. Wire subscriptions
    this.router.setup();
    this.graphView.setupSubscriptions();
    this.matrixView.setupSubscriptions();
    this.archetypesView.setupSubscriptions();
    this.mapView.setupSubscriptions();
    this.sidebar.setupSubscriptions();
    this.tours.setupSubscriptions();
    this.graphControls.setupSubscriptions();

    // 4. Build search index
    this.searchBar.buildIndex(DEITIES);

    // 5. Global UI subscriptions
    this.store.subscribe(STATE_KEYS.UI_TOAST, msg => {
      if (msg) this.feedback.toast(msg);
    });
    this.store.subscribe(STATE_KEYS.UI_LOADING, isLoading => {
      this.feedback.showLoading(isLoading);
    });
    this.store.subscribe(STATE_KEYS.UI_STATUS, msg => {
      this.feedback.setStatus(msg);
    });

    // 6. Sidebar tab switching
    document.getElementById('sidebar-tabs')?.addEventListener('click', e => {
      const btn = e.target.closest('.stab');
      if (!btn) return;
      const tab = btn.dataset.tab;
      document.querySelectorAll('#sidebar-tabs .stab').forEach(b =>
        b.classList.toggle('active', b.dataset.tab === tab)
      );
      document.querySelectorAll('.stab-content').forEach(c => c.classList.remove('active'));
      document.getElementById(`stab-${tab}-content`)?.classList.add('active');
    });

    console.log('[App] Modular architecture initialized.');
  }
}