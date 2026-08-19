/**
 * Pacific Control — API Client & Live Sync Manager
 * Manages Google Sheets data fetching, caching, and auto-refresh cycles.
 */

const Api = (function() {
  let _currentData = null;
  let _lastFetchTime = null;
  let _autoRefreshTimer = null;
  let _listeners = [];
  let _statusListeners = [];

  /**
   * Fetch dashboard data from /api/dashboard
   * @param {boolean} forceRefresh - If true, bypasses cache on server
   */
  async function fetchDashboard(forceRefresh = false) {
    notifyStatus('loading', forceRefresh ? 'Sincronizando con Google Sheets...' : 'Cargando datos...');

    try {
      let response;
      try {
        const url = `/api/dashboard${forceRefresh ? '?refresh=true' : ''}`;
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
        // Cargar instantáneamente desde el JSON pregenerado
        response = await fetch('/data/dashboard.json');
      }

      if (!response.ok) {
        throw new Error(`Error al obtener datos (${response.status})`);
      }

      const data = await response.json();
      _currentData = data;
      _lastFetchTime = new Date();

      notifyStatus('success', 'Conectado en vivo', data);
      notifyData(data);
      return data;
    } catch (error) {
      console.error('[API Error]:', error);
      notifyStatus('error', error.message || 'Error de conexión');
      throw error;
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
    setAutoRefresh,
    onData,
    onStatus,
    getCurrentData,
    getLastFetchTime,
  };
})();
