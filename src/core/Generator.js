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

  _normalizeMetric(metric) {
    const map = { cosine: 'cosine', overlap: 'overlap', jaccard: 'overlap', euclidean: 'cosine' };
    return map[metric] || 'cosine';
  }

  async generate() {
    const deityId = this.store.get(STATE_KEYS.SELECTED_DEITY);
    if (!deityId) return;

    this.store.set(STATE_KEYS.UI_LOADING, true);

    try {
      const deity      = getDeityById(deityId);
      const rawMetric  = this.store.get(STATE_KEYS.SIMILARITY_METHOD) || 'cosine';
      const metric     = this._normalizeMetric(rawMetric);
      const threshold  = this.store.get(STATE_KEYS.GRAPH_THRESHOLD)  || 0.35;
      const linkMode   = this.store.get(STATE_KEYS.LINK_MODE)        || 'top5';
      const eraFilter  = this.store.get(STATE_KEYS.ERA_FILTER)       || 0;

      const eraMap = { 5: -2000, 4: -1500, 3: -800, 2: -100, 1: 800 };
      let candidateDeities = DEITIES;
      if (eraFilter > 0) {
        const cutoff = eraMap[eraFilter];
        candidateDeities = DEITIES.filter(d => d.era >= cutoff);
      }

      const existing = this.store.get(STATE_KEYS.GRAPH_DATA);
      const existingNodes = existing.nodes || [];
      const existingEdges = existing.edges || [];

      const connections = await workerClient.getConnections(
        deity,
        candidateDeities,
        metric,
        threshold
      );

      // Apply linkMode with cap
      let limited;
      if (linkMode === 'top5')       limited = connections.slice(0, 5);
      else if (linkMode === 'top10') limited = connections.slice(0, 10);
      else                           limited = connections.slice(0, 30); // Cap "all" at 30

      const newEdges = [];
      const edgeKeys = new Set(existingEdges.map(e => `${e.source}-${e.target}`));

      limited.forEach(c => {
        const key = `${deityId}-${c.deity.id}`;
        const reverseKey = `${c.deity.id}-${deityId}`;
        if (!edgeKeys.has(key) && !edgeKeys.has(reverseKey)) {
          newEdges.push({
            source: deityId,
            target: c.deity.id,
            similarity: c.score,
            shared: c.shared,
          });
        }
      });

      const existingNodeIds = new Set(existingNodes.map(n => n.id));
      const newNodes = limited
        .filter(c => !existingNodeIds.has(c.deity.id))
        .map(c => c.deity);

      if (!existingNodeIds.has(deityId)) {
        newNodes.unshift(deity);
      }

      const mergedNodes = [...existingNodes, ...newNodes];
      const mergedEdges = [...existingEdges, ...newEdges];

      this.store.set(STATE_KEYS.GRAPH_DATA, {
        nodes: mergedNodes,
        edges: mergedEdges,
      });

      this.store.set(STATE_KEYS.UI_STATUS, `${mergedNodes.length} deities · ${mergedEdges.length} connections`);

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

    this.store.set(STATE_KEYS.SELECTED_DEITY, nodeId);
    if (expandOnClick) {
      this.generate();
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
        this._normalizeMetric(this.store.get(STATE_KEYS.SIMILARITY_METHOD)),
        this.store.get(STATE_KEYS.GRAPH_THRESHOLD)
      );
      if (path) {
        this.store.set(STATE_KEYS.UI_TOAST, `Path: ${path.join(' → ')}`);
      } else {
        this.store.set(STATE_KEYS.UI_TOAST, 'No path found.');
      }
    } catch (err) {
      this.store.set(STATE_KEYS.UI_TOAST, 'Path error: ' + err.message);
    } finally {
      this.store.set(STATE_KEYS.UI_LOADING, false);
    }
  }
}