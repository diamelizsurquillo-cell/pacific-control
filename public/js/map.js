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

  // Built-in fallback coordinates for all Peruvian provinces and departments
  const COORDS_FALLBACK = {
    'LIMA':          { lat: -12.0464, lng: -77.0428 },
    'CALLAO':        { lat: -12.0565, lng: -77.1185 },
    'LURÍN':         { lat: -12.2833, lng: -76.8681 },
    'LURIN':         { lat: -12.2833, lng: -76.8681 },
    'TACNA':         { lat: -18.0146, lng: -70.2536 },
    'CHIMBOTE':      { lat: -9.0746,  lng: -78.5936 },
    'PIURA':         { lat: -5.1945,  lng: -80.6328 },
    'PAITA':         { lat: -5.0892,  lng: -81.1145 },
    'PIURA (PAITA)': { lat: -5.0892,  lng: -81.1145 },
    'SULLANA':       { lat: -4.9036,  lng: -80.6853 },
    'PISCO':         { lat: -13.7100, lng: -76.2033 },
    'MADRE DE DIOS': { lat: -12.5933, lng: -69.1891 },
    'CHILCA':        { lat: -12.5219, lng: -76.7369 },
    'HUARAL':        { lat: -11.4953, lng: -77.2078 },
    'CUZCO':         { lat: -13.5320, lng: -71.9675 },
    'CUSCO':         { lat: -13.5320, lng: -71.9675 },
    'PUCALLPA':      { lat: -8.3791,  lng: -74.5539 },
    'CHICLAYO':      { lat: -6.7714,  lng: -79.8409 },
    'LAMBAYEQUE':    { lat: -6.7011,  lng: -79.9081 },
    'YURIMAGUAS':    { lat: -5.8979,  lng: -76.0831 },
    'IQUITOS':       { lat: -3.7491,  lng: -73.2538 },
    'LORETO':        { lat: -3.7491,  lng: -73.2538 },
    'ANCASH':        { lat: -9.5261,  lng: -77.5288 },
    'AMAZONAS':      { lat: -6.2308,  lng: -77.8708 },
    'AREQUIPA':      { lat: -16.4090, lng: -71.5375 },
    'TRUJILLO':      { lat: -8.1116,  lng: -79.0287 },
    'LA LIBERTAD':   { lat: -8.1116,  lng: -79.0287 },
    'ICA':           { lat: -14.0678, lng: -75.7286 },
    'MOQUEGUA':      { lat: -17.1936, lng: -70.9344 },
    'ILO':           { lat: -17.6394, lng: -71.3375 },
  };

  /**
   * Initialize Leaflet map with CartoDB tiles
   */
  function initMap() {
    const container = document.getElementById('peruMap');
    if (!container) {
      console.warn('[Map] Container #peruMap not found in DOM');
      return;
    }

    if (_map) return; // Already initialized

    if (typeof L === 'undefined') {
      console.error('[Map] Leaflet (L) is NOT loaded — the CDN may be blocked or failed.');
      container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#94a3b8;font-size:14px;text-align:center;padding:20px;">⚠️ No se pudo cargar el mapa.<br>Verifica tu conexión a internet y recarga la página (Ctrl+F5).</div>';
      return;
    }

    console.log('[Map] Initializing Leaflet map...');

    try {
      _map = L.map('peruMap', {
        center: PERU_CENTER,
        zoom: DEFAULT_ZOOM,
        zoomControl: true,
        scrollWheelZoom: false,
      });

      // OpenStreetMap tiles — free, no API key required
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &bull; Pacific Control',
        maxZoom: 19,
      }).addTo(_map);

      _markersLayer = L.layerGroup().addTo(_map);

      console.log('[Map] Leaflet map initialized successfully');

      // Multiple invalidateSize calls at different intervals
      setTimeout(() => { if (_map) _map.invalidateSize(); }, 200);
      setTimeout(() => { if (_map) _map.invalidateSize(); }, 800);
      setTimeout(() => { if (_map) _map.invalidateSize(); }, 2000);
    } catch (err) {
      console.error('[Map] Error initializing map:', err);
      container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#ef4444;font-size:14px;text-align:center;padding:20px;">❌ Error al inicializar el mapa: ' + err.message + '</div>';
    }
  }

  /**
   * Update map markers based on aggregated locations
   * @param {Array} ubicaciones - Array of location objects with coords, count, gastoReal
   */
  function updateMarkers(ubicaciones) {
    if (typeof L === 'undefined') return;

    if (!_map) initMap();
    if (!_map || !_markersLayer) return;

    _markersLayer.clearLayers();

    if (!Array.isArray(ubicaciones) || ubicaciones.length === 0) return;

    const bounds = [];

    ubicaciones.forEach(loc => {
      let coords = loc.coords;
      if (!coords || typeof coords.lat !== 'number') {
        const normKey = (loc.nombre || '').trim().toUpperCase();
        coords = COORDS_FALLBACK[normKey] || null;
      }

      if (!coords || typeof coords.lat !== 'number' || typeof coords.lng !== 'number') {
        return;
      }

      const { lat, lng } = coords;
      bounds.push([lat, lng]);

      // Determine circle marker radius based on volume
      const radius = Math.min(Math.max((loc.count || 0) * 1.8, 8), 24);

      const circleMarker = L.circleMarker([lat, lng], {
        radius,
        fillColor: '#1b365d',
        color: '#3b6ba5',
        weight: 2,
        opacity: 0.9,
        fillOpacity: 0.75,
      });

      // Rich popup content
      const popupHtml = `
        <div class="map-popup">
          <div class="map-popup__title" style="font-weight:700; color: #1b365d; margin-bottom: 4px;">📍 ${loc.nombre}</div>
          <div class="map-popup__stat" style="display:flex; justify-content:space-between; gap:10px; font-size:12px; margin-bottom:2px;">
            <span class="map-popup__stat-label" style="color:#64748b;">Servicios:</span>
            <span class="map-popup__stat-value" style="font-weight:600; color:#0f172a;">${loc.count || 0}</span>
          </div>
          <div class="map-popup__stat" style="display:flex; justify-content:space-between; gap:10px; font-size:12px;">
            <span class="map-popup__stat-label" style="color:#64748b;">Gasto Real:</span>
            <span class="map-popup__stat-value" style="font-weight:600; color: #c5222f;">S/ ${(loc.gastoReal || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
          </div>
          ${loc.gastoSolicitado > 0 ? `
          <div class="map-popup__stat" style="display:flex; justify-content:space-between; gap:10px; font-size:11px; color:#64748b; margin-top:2px;">
            <span>Solicitado:</span>
            <span>S/ ${loc.gastoSolicitado.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
          </div>` : ''}
        </div>
      `;

      circleMarker.bindPopup(popupHtml);

      // Mouse hover animations
      circleMarker.on('mouseover', function() {
        this.setStyle({ fillColor: '#c5222f', color: '#ed5f6e', fillOpacity: 0.95 });
      });
      circleMarker.on('mouseout', function() {
        this.setStyle({ fillColor: '#1b365d', color: '#3b6ba5', fillOpacity: 0.75 });
      });

      _markersLayer.addLayer(circleMarker);
    });

    // Auto-fit view or center
    if (bounds.length > 0) {
      const isMobile = typeof window !== 'undefined' && window.innerWidth <= 640;
      _map.fitBounds(bounds, { padding: isMobile ? [15, 15] : [35, 35], maxZoom: 7 });
    } else {
      _map.setView(PERU_CENTER, DEFAULT_ZOOM);
    }

    setTimeout(() => {
      if (_map) _map.invalidateSize();
    }, 150);
  }

  /**
   * Force the map to recalculate its size — needed when the container
   * becomes visible (e.g., after a loading overlay is removed).
   */
  function invalidateSize() {
    if (_map) {
      _map.invalidateSize();
    }
  }

  return {
    init: initMap,
    updateMarkers,
    invalidateSize,
  };
})();
