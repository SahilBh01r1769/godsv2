/* ─────────────────────────────────────────────────────────────────
   views/GraphView.js — D3 force-directed graph (v2 modular)
   ───────────────────────────────────────────────────────────────── */

import { PANTHEON_COLORS } from '../data/deities.js';
import { edgeColor, traitVector, sharedTraits } from '../utils/similarity.js';
import { getCognate } from '../data/cognates.js';
import { STATE_KEYS } from '../utils/store.js';

export class GraphView {
  constructor(store, generator, feedback) {
    this.store     = store;
    this.generator = generator;
    this.feedback  = feedback;

    this.svg       = null;
    this.zoom      = null;
    this.gLinks    = null;
    this.gNodes    = null;
    this.simulation = null;
    this.tooltip   = null;
  }

  /* ── Mount ─────────────────────────────────────────────────────── */
  mount(svgElement) {
    this.svg = d3.select(svgElement);

    this.zoom = d3.zoom()
      .scaleExtent([0.1, 5])
      .on('zoom', e => {
        this.gLinks.attr('transform', e.transform);
        this.gNodes.attr('transform', e.transform);
        this.updateMinimap();
      });

    this.svg.call(this.zoom).on('dblclick.zoom', null);
    this.svg.on('click', () => this.clearHighlight());

    this.gLinks = this.svg.append('g').attr('class', 'g-links');
    this.gNodes = this.svg.append('g').attr('class', 'g-nodes');

    // Tooltip
    this.tooltip = d3.select('body').append('div')
      .attr('class', 'graph-tooltip')
      .style('opacity', 0)
      .style('pointer-events', 'none');

    document.querySelectorAll('.empty-tag').forEach(tag => {
      tag.addEventListener('click', () =>
        this.generator.loadDeity(tag.dataset.deity, { resetGraph: true })
      );
    });
  }

  /* ── Subscriptions ─────────────────────────────────────────────── */
  setupSubscriptions() {
    this.store.subscribe(STATE_KEYS.GRAPH_DATA, data => {
      this.render(data.nodes, data.edges);
    });

    this.store.subscribe(STATE_KEYS.SHOW_LABELS, show => {
      this.setLabelsVisible(show);
    });

    this.store.subscribe(STATE_KEYS.SHOW_COGNATES, () => {
      const data = this.store.get(STATE_KEYS.GRAPH_DATA);
      this.render(data.nodes, data.edges);
    });
  }

  /* ── Dimensions ────────────────────────────────────────────────── */
  W() { return document.getElementById('graph-view')?.clientWidth  || 800; }
  H() { return document.getElementById('graph-view')?.clientHeight || 600; }

  /* ── Main render ───────────────────────────────────────────────── */
  render(nodes, edges, options = {}) {
    if (!this.svg) return;
    const empty = document.getElementById('empty-state');
    if (empty) empty.style.display = nodes.length ? 'none' : 'flex';
    this.currentNodes = nodes;
    if (this.simulation) this.simulation.stop();

    const {
      animate       = this.store.get(STATE_KEYS.ANIMATE_ENTRANCE),
      showLabels    = this.store.get(STATE_KEYS.SHOW_LABELS),
      cluster       = this.store.get(STATE_KEYS.CLUSTER_BY_PAN),
      activeFilter  = this.store.get(STATE_KEYS.ACTIVE_TRAIT_FILTER),
      showCognates  = this.store.get(STATE_KEYS.SHOW_COGNATES),
      centerDeityId = this.store.get(STATE_KEYS.SELECTED_DEITY),
    } = options;

    if (!nodes.length) {
      this.gLinks.selectAll('*').remove();
      this.gNodes.selectAll('*').remove();
      return;
    }

    const W = this.W(), H = this.H();

    // ── Links ──
    const link = this.gLinks.selectAll('line.link')
      .data(edges, d => `${d.source.id || d.source}-${d.target.id || d.target}`);

    link.exit().remove();

    const linkEnter = link.enter().append('line')
      .attr('class', 'link')
      .attr('stroke-opacity', 0);

    const linkMerge = linkEnter.merge(link)
      .attr('stroke', d => edgeColor(d.similarity))
      .attr('stroke-width', d => Math.max(1, d.similarity * 4))
      .attr('stroke-opacity', d => {
        if (showCognates && getCognate(
          d.source.id || d.source,
          d.target.id || d.target
        )) return 1;
        return 0.4;
      });

    // ── Nodes ──
    const node = this.gNodes.selectAll('g.node')
      .data(nodes, d => d.id);

    node.exit()
      .transition().duration(animate ? 300 : 0)
      .attr('opacity', 0)
      .remove();

    const nodeEnter = node.enter().append('g')
      .attr('class', 'node')
      .attr('opacity', animate ? 0 : 1)
      .call(d3.drag()
        .on('start', (e, d) => this.dragstarted(e, d))
        .on('drag',  (e, d) => this.dragged(e, d))
        .on('end',   (e, d) => this.dragended(e, d))
      );

    // Circle
    nodeEnter.append('circle')
      .attr('r', d => d.id === centerDeityId ? 12 : 8)
      .attr('fill', d => PANTHEON_COLORS[d.pantheon] || '#888')
      .attr('stroke', d => d.id === centerDeityId ? '#fff' : 'none')
      .attr('stroke-width', 2);

    // Label
    nodeEnter.append('text')
      .attr('class', 'node-label')
      .attr('dx', 14)
      .attr('dy', 4)
      .text(d => d.id)
      .style('display', showLabels ? 'block' : 'none');

    const nodeMerge = nodeEnter.merge(node);

    if (animate) {
      nodeMerge.transition().duration(400).attr('opacity', 1);
    }

    // Events
    nodeMerge
      .on('click', (e, d) => {
        e.stopPropagation();
        this.generator.handleNodeClick(d.id);
      })
      .on('mouseover', (e, d) => this.onNodeHover(e, d))
      .on('mouseout',  ()    => this.hideTooltip());

    linkMerge
      .on('mouseover', (e, d) => this.onEdgeHover(e, d))
      .on('mouseout',  ()    => this.hideTooltip());

    // ── Simulation ──
    this.simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(edges).id(d => d.id).distance(80))
      .force('charge', d3.forceManyBody().strength(-150))
      .force('center', d3.forceCenter(W / 2, H / 2))
      .force('collision', d3.forceCollide().radius(20));

    // Cluster by pantheon
    if (cluster) {
      const pantheons = [...new Set(nodes.map(n => n.pantheon))];
      const angleStep = (2 * Math.PI) / pantheons.length;
      const clusterCenters = {};
      pantheons.forEach((p, i) => {
        clusterCenters[p] = {
          x: W / 2 + Math.cos(i * angleStep) * 150,
          y: H / 2 + Math.sin(i * angleStep) * 150,
        };
      });
      this.simulation.force('cluster', d3.forceX(d => clusterCenters[d.pantheon]?.x || W / 2).strength(0.3));
      this.simulation.force('clusterY', d3.forceY(d => clusterCenters[d.pantheon]?.y || H / 2).strength(0.3));
    }

    this.simulation.on('tick', () => {
      linkMerge
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      nodeMerge
        .attr('transform', d => `translate(${d.x},${d.y})`);

      this.updateMinimap();
    });
  }

  /* ── Drag handlers ─────────────────────────────────────────────── */
  dragstarted(event, d) {
    if (!event.active) this.simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }

  dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
  }

  dragended(event, d) {
    if (!event.active) this.simulation.alphaTarget(0);
    const pinned = this.store.get(STATE_KEYS.PINNED_NODES);
    if (!pinned.has(d.id)) {
      d.fx = null;
      d.fy = null;
    }
  }

  /* ── Tooltip ───────────────────────────────────────────────────── */
  onNodeHover(event, d) {
    const traits = Object.entries(d.traits || {})
      .filter(([, v]) => v > 0)
      .map(([k]) => k)
      .join(', ');

    this.tooltip
      .style('opacity', 1)
      .html(`
        <div class="tt-name">${d.id}</div>
        <div class="tt-pantheon" style="color:${PANTHEON_COLORS[d.pantheon]}">${d.pantheon}</div>
        <div class="tt-epithet">${d.epithet || ''}</div>
        <div class="tt-traits">${traits}</div>
      `)
      .style('left', (event.pageX + 12) + 'px')
      .style('top',  (event.pageY - 10) + 'px');
  }

  onEdgeHover(event, d) {
    const srcId = d.source.id || d.source;
    const tgtId = d.target.id || d.target;
    const shared = sharedTraits(srcId, tgtId);

    this.tooltip
      .style('opacity', 1)
      .html(`
        <div class="tt-name">${srcId} ↔ ${tgtId}</div>
        <div class="tt-sim">Similarity: ${(d.similarity * 100).toFixed(1)}%</div>
        <div class="tt-traits">Shared: ${shared.join(', ')}</div>
      `)
      .style('left', (event.pageX + 12) + 'px')
      .style('top',  (event.pageY - 10) + 'px');
  }

  hideTooltip() {
    this.tooltip.style('opacity', 0);
  }

  /* ── Highlight / Clear ─────────────────────────────────────────── */
  highlightByTrait(trait) {
    this.gNodes.selectAll('g.node')
      .attr('opacity', d => (d.traits && d.traits[trait] > 0) ? 1 : 0.15);
  }

  clearHighlight() {
    this.gNodes.selectAll('g.node').attr('opacity', 1);
    this.store.set(STATE_KEYS.ACTIVE_TRAIT_FILTER, null);
  }

  /* ── Controls ──────────────────────────────────────────────────── */
  setLabelsVisible(show) {
    this.gNodes.selectAll('.node-label')
      .style('display', show ? 'block' : 'none');
  }

  resetZoom() {
    this.svg.transition().duration(400)
      .call(this.zoom.transform, d3.zoomIdentity);
  }

  zoomIn() {
    this.svg.transition().duration(200)
      .call(this.zoom.scaleBy, 1.3);
  }

  zoomOut() {
    this.svg.transition().duration(200)
      .call(this.zoom.scaleBy, 0.7);
  }

  unpinAll(nodes) {
    nodes.forEach(n => { n.fx = null; n.fy = null; });
    if (this.simulation) this.simulation.alpha(0.3).restart();
  }

  updateMinimap() {
  const canvas = document.getElementById('minimap-canvas');
  if (!canvas || !this.currentNodes) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  const gw = this.W() || 1, gh = this.H() || 1;
  this.currentNodes.forEach(n => {
    if (n.x == null) return;
    ctx.fillStyle = PANTHEON_COLORS[n.pantheon] || '#888';
    ctx.beginPath();
    ctx.arc((n.x / gw) * W, (n.y / gh) * H, 2, 0, Math.PI * 2);
    ctx.fill();
  });
}

  clearGraph() {
    if (this.simulation) this.simulation.stop();
    this.gLinks.selectAll('*').remove();
    this.gNodes.selectAll('*').remove();
  }
}