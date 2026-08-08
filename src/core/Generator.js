/* ─────────────────────────────────────────────────────────────────
   core/Generator.js — Graph generation + worker orchestration
   All business logic lives here. No DOM manipulation.
   ───────────────────────────────────────────────────────────────── */

import { getDeityById, sharedTraits, traitVector } from '../utils/similarity.js';
import { workerClient } from '../utils/workerClient.js';
import { STATE_KEYS } from '../utils/store.js';
import { DEITIES } from '../data/deities.js';

export class Generator {
  constructor(store, feedback) {
    this.store = store;
    this.feedback = feedback;
  }

  async loadDeity(nameOrId, options = {}) {
    const deity = getDeityById(nameOrId);
    if (!deity) {
      this.store.set(STATE_KEYS.UI_TOAST, `"${nameOrId}" not found`);
      return;
    }

    const { resetGraph = false } = options;

    if (resetGraph || this.store.get(STATE_KEYS.MODE) !== 'explore') {
      this.store.set(STATE_KEYS.GRAPH_DATA, { nodes: [], edges: [] });
    }

    this.store.set(STATE_KEYS.SELECTED_DEITY, deity.id);
    this.store.set(STATE_KEYS.ACTIVE_TRAIT_FILTER, null);

    // Switch to graph view
    this.store.set(STATE_KEYS.CURRENT_VIEW, 'graph');

    await this.generate();
  }

  async generate() {
    const deityId = this.store.get(STATE_KEYS.SELECTED_DEITY);
    if (!deityId) return;

    this.store.set(STATE_KEYS.UI_LOADING, true);

    try {
      const metric    = this.store.get(STATE_KEYS.SIMILARITY_METHOD);
      const threshold = this.store.get(STATE_KEYS.GRAPH_THRESHOLD);
      const linkMode  = this.store.get(STATE_KEYS.LINK_MODE);
      const eraFilter = this.store.get(STATE_KEYS.ERA_FILTER);

      // Call the Web Worker
      const result = await workerClient.getConnections({
        deityId,
        metric,
        threshold,
        linkMode,
        eraFilter,
        allDeities: DEITIES,
      });

      // Update store — this triggers GraphView, Sidebar, etc. automatically
      this.store.set(STATE_KEYS.GRAPH_DATA, {
        nodes: result.nodes,
        edges: result.edges,
      });

      const statusMsg = `${result.nodes.length} deities · ${result.edges.length} connections`;
      this.store.set(STATE_KEYS.UI_STATUS, statusMsg);

    } catch (err) {
      console.error('[Generator] Error:', err);
      this.store.set(STATE_KEYS.UI_TOAST, 'Error computing network');
    } finally {
      this.store.set(STATE_KEYS.UI_LOADING, false);
    }
  }

  clearGraph() {
    this.store.set(STATE_KEYS.GRAPH_DATA, { nodes: [], edges: [] });
    this.store.set(STATE_KEYS.SELECTED_DEITY, null);
    this.store.set(STATE_KEYS.PINNED_NODES, new Set());
    this.store.set(STATE_KEYS.UI_STATUS, '');
  }

  surprise() {
    const d = DEITIES[Math.floor(Math.random() * DEITIES.length)];
    this.loadDeity(d.id, { resetGraph: true });
    this.store.set(STATE_KEYS.UI_TOAST, `✦ ${d.id} — ${d.epithet}`);
  }

  handleNodeClick(nodeId) {
    const mode = this.store.get(STATE_KEYS.MODE);
    const expandOnClick = this.store.get(STATE_KEYS.EXPAND_ON_CLICK);

    if (mode === 'compare') {
      const a = this.store.get(STATE_KEYS.COMPARE_A);
      if (!a) {
        this.store.set(STATE_KEYS.COMPARE_A, nodeId);
        this.store.set(STATE_KEYS.UI_TOAST, `Selected ${nodeId}. Pick a second deity.`);
      } else {
        this.store.set(STATE_KEYS.COMPARE_B, nodeId);
        this.store.set(STATE_KEYS.MODE, 'explore');
        // Open compare modal
        document.getElementById('compare-modal')?.classList.add('open');
      }
      return;
    }

    if (mode === 'path') {
      const from = this.store.get(STATE_KEYS.PATH_FROM);
      if (!from) {
        this.store.set(STATE_KEYS.PATH_FROM, nodeId);
        this.store.set(STATE_KEYS.UI_TOAST, `Path start: ${nodeId}. Pick destination.`);
      } else {
        this.store.set(STATE_KEYS.PATH_TO, nodeId);
        this.store.set(STATE_KEYS.MODE, 'explore');
      }
      return;
    }

    // Explore mode
    if (expandOnClick) {
      this.store.set(STATE_KEYS.SELECTED_DEITY, nodeId);
      this.generate();
    } else {
      this.store.set(STATE_KEYS.SELECTED_DEITY, nodeId);
    }
  }

  handleTraitClick(trait) {
    this.store.set(STATE_KEYS.ACTIVE_TRAIT_FILTER, trait);
    this.generate();
  }
}