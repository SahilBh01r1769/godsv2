/* ─────────────────────────────────────────────────────────────────
   core/Generator.js — Graph generation + worker orchestration (v2)
   Matches the actual workerClient API
   ───────────────────────────────────────────────────────────────── */
import { getDeityById } from '../utils/similarity.js';
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
    this.store.set(STATE_KEYS.CURRENT_VIEW, 'graph');

    await this.generate();
  }

  async generate() {
    const deityId = this.store.get(STATE_KEYS.SELECTED_DEITY);
    if (!deityId) return;

    this.store.set(STATE_KEYS.UI_LOADING, true);

    try {
      const deity      = getDeityById(deityId);
      const metric     = this.store.get(STATE_KEYS.SIMILARITY_METHOD) || 'cosine';
      const threshold  = this.store.get(STATE_KEYS.GRAPH_THRESHOLD)  || 0.35;
      const linkMode   = this.store.get(STATE_KEYS.LINK_MODE)        || 'top5';
      const eraFilter  = this.store.get(STATE_KEYS.ERA_FILTER)       || 0;

      // ── Filter deities by era before sending to worker ──
      // ERA_FILTER: 0=all, 5=2000 BCE, 4=1500 BCE, 3=800 BCE, 2=200 BCE, 1=500 CE
      const eraMap = { 5: -2000, 4: -1500, 3: -800, 2: -100, 1: 800 };
      let candidateDeities = DEITIES;
      if (eraFilter > 0) {
        const cutoff = eraMap[eraFilter];
        candidateDeities = DEITIES.filter(d => d.era >= cutoff);
      }

      // ── Call the worker with correct positional args ──
      const connections = await workerClient.getConnections(
        deity,              // full deity object, not id
        candidateDeities,   // array of deities to compare against
        metric,             // 'cosine' | 'overlap'
        threshold           // 0..1
      );

      // ── Apply linkMode (top5 / top10 / all) ──
      // Worker returns sorted by score desc already
      let limited;
      if (linkMode === 'top5')       limited = connections.slice(0, 5);
      else if (linkMode === 'top10') limited = connections.slice(0, 10);
      else                           limited = connections;

      // ── Transform flat array into { nodes, edges } shape ──
      const nodes = [deity, ...limited.map(c => c.deity)];
      const edges = limited.map(c => ({
        source: deity.id,
        target: c.deity.id,
        similarity: c.score,
        shared: c.shared,
      }));

      this.store.set(STATE_KEYS.GRAPH_DATA, { nodes, edges });
      this.store.set(STATE_KEYS.UI_STATUS, `${nodes.length} deities · ${edges.length} connections`);

    } catch (err) {
      console.error('[Generator] Error:', err);
      this.store.set(STATE_KEYS.UI_TOAST, 'Error: ' + err.message);
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

  async findPath(fromId, toId) {
    this.store.set(STATE_KEYS.UI_LOADING, true);
    try {
      const path = await workerClient.findPath(
        fromId, toId, DEITIES,
        this.store.get(STATE_KEYS.SIMILARITY_METHOD),
        this.store.get(STATE_KEYS.GRAPH_THRESHOLD)
      );
      if (path) {
        this.store.set(STATE_KEYS.UI_TOAST, `Path: ${path.join(' → ')}`);
      } else {
        this.store.set(STATE_KEYS.UI_TOAST, 'No path found between those deities.');
      }
    } catch (err) {
      this.store.set(STATE_KEYS.UI_TOAST, 'Path error: ' + err.message);
    } finally {
      this.store.set(STATE_KEYS.UI_LOADING, false);
    }
  }
}