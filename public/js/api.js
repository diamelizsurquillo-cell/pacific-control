/**
 * Pacific Control — API Client & Live Sync Manager
 * Manages Google Sheets data fetching, caching, auto-refresh cycles,
 * and real-time updates via Server-Sent Events (SSE) when Excel files change.
 */

const Api = (function() {
  let _currentData = null;
  let _lastFetchTime = null;
  let _autoRefreshTimer = null;
  let _listeners = [];
  let _statusListeners = [];
  let _eventSource = null;
  let _sseReconnectTimer = null;

  /**
   * Fetch dashboard data from /api/dashboard
   * @param {boolean} forceRefresh - If true, bypasses cache on server
   */
  async function fetchDashboard(forceRefresh = false) {
    notifyStatus('loading', forceRefresh ? 'Actualizando datos del Excel...' : 'Cargando datos...');

    try {
      let response;
      const timestamp = Date.now();
      try {
        const url = `/api/dashboard${forceRefresh ? `?refresh=true&_t=${timestamp}` : `?_t=${timestamp}`}`;
        response = await fetch(url, {
          headers: {
            'Accept': 'application/json',
            'Cache-Control': forceRefresh ? 'no-cache' : 'default',
          },
        });
      } catch (netErr) {
        // Red / serverless fallida -> ir a estático
      }

      if (!response || !response.ok) {
        // Cargar instantáneamente desde el JSON pregenerado con cache-busting
        response = await fetch(`/data/dashboard.json?_t=${timestamp}`);
      }

      if (!response.ok) {
        throw new Error(`Error al obtener datos (${response.status})`);
      }

      const data = await response.json();
      _currentData = data;
      _lastFetchTime = new Date();

      notifyStatus('success', 'Datos actualizados', data);
      notifyData(data);
      return data;
    } catch (error) {
      console.error('[API Error]:', error);
      notifyStatus('error', error.message || 'Error de conexión');
      throw error;
    }
  }

  /**
   * Connect to Server-Sent Events for live Excel change notifications
   */
  function connectSSE() {
    if (_eventSource) {
      _eventSource.close();
      _eventSource = null;
    }

    try {
      _eventSource = new EventSource('/api/events');

      _eventSource.addEventListener('connected', (e) => {
        console.log('[SSE] Conectado al servidor para actualizaciones en vivo');
      });

      _eventSource.addEventListener('excel-changed', (e) => {
        try {
          const info = JSON.parse(e.data);
          console.log('[SSE] Cambio detectado en Excel:', info.file);
          notifyStatus('loading', `Excel modificado: ${info.file}. Recargando...`);

          // Wait a moment for the file to finish writing, then reload
          setTimeout(() => {
            fetchDashboard(true).catch(err => {
              console.warn('[SSE AutoRefresh Error]:', err);
            });
          }, 500);
        } catch (err) {
          console.warn('[SSE] Error procesando evento:', err);
        }
      });

      _eventSource.onerror = () => {
        console.warn('[SSE] Conexión perdida, reintentando en 5s...');
        _eventSource.close();
        _eventSource = null;
        // Retry connection after 5 seconds
        if (_sseReconnectTimer) clearTimeout(_sseReconnectTimer);
        _sseReconnectTimer = setTimeout(connectSSE, 5000);
      };
    } catch (err) {
      console.warn('[SSE] No disponible:', err.message);
    }
  }

  /**
   * Set up or update auto-refresh interval
   * @param {number} seconds - Interval in seconds (0 to disable)
   */
  function setAutoRefresh(seconds) {
    if (_autoRefreshTimer) {
      clearInterval(_autoRefreshTimer);
      _autoRefreshTimer = null;
    }

    if (seconds > 0) {
      _autoRefreshTimer = setInterval(() => {
        fetchDashboard(true).catch(err => console.warn('[AutoRefresh Error]:', err));
      }, seconds * 1000);
    }
  }

  /**
   * Subscribe to data updates
   */
  function onData(callback) {
    _listeners.push(callback);
    if (_currentData) callback(_currentData);
  }

  /**
   * Subscribe to status updates (loading, success, error)
   */
  function onStatus(callback) {
    _statusListeners.push(callback);
  }

  function notifyData(data) {
    _listeners.forEach(fn => fn(data));
  }

  function notifyStatus(status, message, data = null) {
    _statusListeners.forEach(fn => fn({ status, message, data, timestamp: _lastFetchTime }));
  }

  function getCurrentData() {
    return _currentData;
  }

  function getLastFetchTime() {
    return _lastFetchTime;
  }

  return {
    fetchDashboard,
    connectSSE,
    setAutoRefresh,
    onData,
    onStatus,
    getCurrentData,
    getLastFetchTime,
  };
})();
