/**
 * Pacific Control — Interactive Leaflet Map
 * Plots geographical locations resolved dynamically from the ID Lugar sheet.
 */

const DashboardMap = (function() {
  let _map = null;
  let _markersLayer = null;

  // Center of Peru
  const PERU_CENTER = [-9.19, -75.015];
  const DEFAULT_ZOOM = 5;

  /**
   * Initialize Leaflet map with dark theme CartoDB tiles
   */
  function initMap() {
    const container = document.getElementById('peruMap');
    if (!container || _map) return;

    _map = L.map('peruMap', {
      center: PERU_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: true,
      scrollWheelZoom: false,
    });

    // Light-themed tiles (CartoDB Voyager)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://carto.com/">CARTO</a> &bull; Pacific Control',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(_map);

    _markersLayer = L.layerGroup().addTo(_map);
  }

  /**
   * Update map markers based on aggregated locations
   * @param {Array} ubicaciones - Array of location objects with coords, count, gastoReal
   */
  function updateMarkers(ubicaciones) {
    initMap();
    if (!_map || !_markersLayer) return;

    _markersLayer.clearLayers();

    if (!Array.isArray(ubicaciones) || ubicaciones.length === 0) return;

    const bounds = [];

    ubicaciones.forEach(loc => {
      if (!loc.coords || typeof loc.coords.lat !== 'number' || typeof loc.coords.lng !== 'number') {
        return;
      }

      const { lat, lng } = loc.coords;
      bounds.push([lat, lng]);

      // Determine circle marker radius based on volume
      const radius = Math.min(Math.max(loc.count * 2.2, 8), 24);

      const circleMarker = L.circleMarker([lat, lng], {
        radius,
        fillColor: '#1b365d',
        color: '#3b6ba5',
        weight: 2,
        opacity: 0.9,
        fillOpacity: 0.7,
      });

      // Rich popup content
      const popupHtml = `
        <div class="map-popup">
          <div class="map-popup__title" style="color: #1b365d;">📍 ${loc.nombre}</div>
          <div class="map-popup__stat">
            <span class="map-popup__stat-label">Servicios:</span>
            <span class="map-popup__stat-value">${loc.count}</span>
          </div>
          <div class="map-popup__stat">
            <span class="map-popup__stat-label">Gasto Real:</span>
            <span class="map-popup__stat-value" style="color: #c5222f;">S/ ${(loc.gastoReal || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
          </div>
          ${loc.gastoSolicitado > 0 ? `
          <div class="map-popup__stat">
            <span class="map-popup__stat-label">Solicitado:</span>
            <span class="map-popup__stat-value">S/ ${loc.gastoSolicitado.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
          </div>` : ''}
        </div>
      `;

      circleMarker.bindPopup(popupHtml);

      // Mouse hover animations
      circleMarker.on('mouseover', function() {
        this.setStyle({ fillColor: '#c5222f', color: '#ed5f6e', fillOpacity: 0.9 });
      });
      circleMarker.on('mouseout', function() {
        this.setStyle({ fillColor: '#1b365d', color: '#3b6ba5', fillOpacity: 0.7 });
      });

      _markersLayer.addLayer(circleMarker);
    });

    // Auto-fit view if valid coordinates exist
    if (bounds.length > 0) {
      const isMobile = typeof window !== 'undefined' && window.innerWidth <= 640;
      _map.fitBounds(bounds, { padding: isMobile ? [15, 15] : [40, 40], maxZoom: 8 });
    }
  }

  return {
    init: initMap,
    updateMarkers,
  };
})();
