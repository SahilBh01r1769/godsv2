import { DEITIES, PANTHEON_COLORS } from '../data/deities.js';
import { STATE_KEYS } from '../utils/store.js';

export class MapView {
  constructor(store, generator) {
    this.store = store;
    this.generator = generator;
    this.container = null;
    this.map = null;
    this.markers = [];
  }

  mount(container) {
    this.container = container;
    this.container.innerHTML = '<div id="leaflet-map" style="height:100%;width:100%;"></div>';
  }

  setupSubscriptions() {
    // Lazy init when view becomes active
    this.store.subscribe(STATE_KEYS.CURRENT_VIEW, view => {
      if (view === 'map' && !this.map) {
        this.initMap();
        this.render();
      }
    });
  }

  initMap() {
    this.map = L.map('leaflet-map').setView([35, 30], 3);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(this.map);
  }

  render() {
    if (!this.map) return;

    // Clear existing markers
    this.markers.forEach(m => m.remove());
    this.markers = [];

    DEITIES.forEach(d => {
      if (!d.lat || !d.lng) return;
      const color = PANTHEON_COLORS[d.pantheon] || '#888';
      const icon = L.divIcon({
        className: 'map-marker',
        html: `<div style="width:12px;height:12px;border-radius:50%;background:${color};border:2px solid #fff;"></div>`,
        iconSize: [16, 16],
      });
      const marker = L.marker([d.lat, d.lng], { icon })
        .bindPopup(`<b>${d.id}</b><br>${d.pantheon}`)
        .addTo(this.map);
      this.markers.push(marker);
    });
  }
}