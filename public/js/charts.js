/**
 * Pacific Control — Charts Manager
 * Handles Chart.js charts initialization, updates, themes and responsiveness.
 */

const DashboardCharts = (function() {
  let _chartMensual = null;
  let _chartInspectores = null;
  let _chartSectores = null;
  let _chartUnidadNegocio = null;

  // Design Theme Palette (Light Theme)
  const THEME = {
    primary: '#0d7fd0',
    primaryLight: '#0284c7',
    accent: '#e8573d',
    accentLight: '#ea580c',
    success: '#16a34a',
    purple: '#7e22ce',
    amber: '#d97706',
    cyan: '#0284c7',
    pink: '#db2777',
    indigo: '#4f46e5',
    teal: '#0d9488',
    grayText: '#475569',
    gridLines: 'rgba(226, 232, 240, 0.8)',
    surfaceBg: '#ffffff',
  };

  /**
   * Set global Chart.js defaults for consistent light styling
   */
  function applyGlobalDefaults() {
    if (typeof Chart === 'undefined') return;

    Chart.defaults.color = THEME.grayText;
    Chart.defaults.font.family = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    Chart.defaults.font.size = 12;
    Chart.defaults.plugins.tooltip.backgroundColor = '#0f172a';
    Chart.defaults.plugins.tooltip.titleColor = '#ffffff';
    Chart.defaults.plugins.tooltip.bodyColor = '#f1f5f9';
    Chart.defaults.plugins.tooltip.borderColor = 'rgba(148, 163, 184, 0.2)';
    Chart.defaults.plugins.tooltip.borderWidth = 1;
    Chart.defaults.plugins.tooltip.padding = 10;
    Chart.defaults.plugins.tooltip.cornerRadius = 8;
  }

  /**
   * Render or update Monthly Evolution Chart (Services & Expenses)
   */
  function renderChartMensual(agrupacionMes) {
    const ctx = document.getElementById('chartMensual');
    if (!ctx) return;

    const labels = Object.keys(agrupacionMes || {});
    const counts = labels.map(m => agrupacionMes[m].count || 0);
    const gastosReales = labels.map(m => Math.round(agrupacionMes[m].gastoReal || 0));

    if (_chartMensual) {
      _chartMensual.data.labels = labels;
      _chartMensual.data.datasets[0].data = counts;
      _chartMensual.data.datasets[1].data = gastosReales;
      _chartMensual.update();
      return;
    }

    _chartMensual = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            type: 'bar',
            label: 'N° Servicios',
            data: counts,
            backgroundColor: 'rgba(27, 54, 93, 0.85)',
            borderColor: '#1b365d',
            borderWidth: 1,
            borderRadius: 4,
            yAxisID: 'yServicios',
            order: 2,
          },
          {
            type: 'line',
            label: 'Gasto Real (S/)',
            data: gastosReales,
            borderColor: '#c5222f',
            backgroundColor: 'rgba(197, 34, 47, 0.12)',
            pointBackgroundColor: '#c5222f',
            pointBorderColor: '#fff',
            pointRadius: 4,
            pointHoverRadius: 6,
            borderWidth: 2,
            tension: 0.35,
            fill: true,
            yAxisID: 'yGastos',
            order: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        scales: {
          x: {
            grid: { color: THEME.gridLines },
            ticks: { color: THEME.grayText },
          },
          yServicios: {
            type: 'linear',
            position: 'left',
            grid: { color: THEME.gridLines },
            ticks: { precision: 0, color: THEME.primaryLight },
            title: { display: true, text: 'Cantidad de Servicios', color: THEME.primaryLight, font: { size: 11 } },
          },
          yGastos: {
            type: 'linear',
            position: 'right',
            grid: { display: false },
            ticks: {
              color: THEME.accentLight,
              callback: val => `S/ ${val >= 1000 ? (val/1000).toFixed(1) + 'k' : val}`,
            },
            title: { display: true, text: 'Gasto Ejecutado (S/)', color: THEME.accentLight, font: { size: 11 } },
          },
        },
        plugins: {
          legend: {
            position: 'top',
            labels: { boxWidth: 12, usePointStyle: true },
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                if (context.dataset.yAxisID === 'yGastos') {
                  return ` Gasto Real: S/ ${context.parsed.y.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;
                }
                return ` Servicios: ${context.parsed.y} órdenes`;
              },
            },
          },
        },
      },
    });
  }

  /**
   * Render or update Inspector Workload Chart (Dynamic Names from ID Inspector)
   */
  function renderChartInspectores(agrupacionInspector) {
    const ctx = document.getElementById('chartInspectores');
    if (!ctx) return;

    // Sort by service count descending
    const sorted = Object.entries(agrupacionInspector || {})
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 10); // Top 10

    const labels = sorted.map(([name]) => name);
    const counts = sorted.map(([, data]) => data.count);
    const gastos = sorted.map(([, data]) => Math.round(data.gastoReal || 0));

    if (_chartInspectores) {
      _chartInspectores.data.labels = labels;
      _chartInspectores.data.datasets[0].data = counts;
      _chartInspectores.data.datasets[1].data = gastos;
      _chartInspectores.update();
      return;
    }

    _chartInspectores = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Servicios Asignados',
            data: counts,
            backgroundColor: 'rgba(27, 54, 93, 0.85)',
            borderColor: '#1b365d',
            borderWidth: 1,
            borderRadius: 4,
          },
          {
            label: 'Gasto Gestionado (S/)',
            data: gastos,
            backgroundColor: 'rgba(197, 34, 47, 0.85)',
            borderColor: '#c5222f',
            borderWidth: 1,
            borderRadius: 4,
            hidden: true, // Toggleable
          },
        ],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            grid: { color: THEME.gridLines },
            ticks: { precision: 0 },
          },
          y: {
            grid: { display: false },
            ticks: {
              color: '#1e293b',
              font: { weight: '600' },
            },
          },
        },
        plugins: {
          legend: {
            position: 'top',
            labels: { boxWidth: 12, usePointStyle: true },
          },
        },
      },
    });
  }

  /**
   * Render or update Sectors Doughnut Chart
   */
  function renderChartSectores(agrupacionSector) {
    const ctx = document.getElementById('chartSectores');
    if (!ctx) return;

    const labels = Object.keys(agrupacionSector || {});
    const counts = labels.map(k => agrupacionSector[k].count);

    const sectorColors = [
      '#1b365d', '#c5222f', '#3b6ba5', '#ed5f6e',
      '#0d9488', '#d97706', '#7e22ce', '#64748b',
    ];

    if (_chartSectores) {
      _chartSectores.data.labels = labels;
      _chartSectores.data.datasets[0].data = counts;
      _chartSectores.update();
      return;
    }

    _chartSectores = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [
          {
            data: counts,
            backgroundColor: sectorColors.slice(0, labels.length),
            borderColor: '#ffffff',
            borderWidth: 2,
            hoverOffset: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '62%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 10,
              padding: 12,
              font: { size: 11 },
            },
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const val = context.parsed;
                const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
                return ` ${context.label}: ${val} (${pct}%)`;
              },
            },
          },
        },
      },
    });
  }

  /**
   * Render or update Business Unit Expenses Chart
   */
  function renderChartUnidadNegocio(agrupacionUnidad) {
    const ctx = document.getElementById('chartUnidadNegocio');
    if (!ctx) return;

    const labels = Object.keys(agrupacionUnidad || {});
    const gastos = labels.map(k => Math.round(agrupacionUnidad[k].gastoReal || 0));

    if (_chartUnidadNegocio) {
      _chartUnidadNegocio.data.labels = labels;
      _chartUnidadNegocio.data.datasets[0].data = gastos;
      _chartUnidadNegocio.update();
      return;
    }

    _chartUnidadNegocio = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Gasto Real (S/)',
            data: gastos,
            backgroundColor: 'rgba(34, 197, 94, 0.75)',
            borderColor: '#22c55e',
            borderWidth: 1,
            borderRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            grid: { display: false },
          },
          y: {
            grid: { color: THEME.gridLines },
            ticks: {
              callback: val => `S/ ${val >= 1000 ? (val/1000).toFixed(1) + 'k' : val}`,
            },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function(context) {
                return ` Gasto Real: S/ ${context.parsed.y.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;
              },
            },
          },
        },
      },
    });
  }

  /**
   * Update all charts with newly aggregated dashboard data
   */
  function updateAll(agrupaciones) {
    if (!agrupaciones) return;
    applyGlobalDefaults();
    renderChartMensual(agrupaciones.porMes);
    renderChartInspectores(agrupaciones.porInspector);
    renderChartSectores(agrupaciones.porSector);
    renderChartUnidadNegocio(agrupaciones.porUnidadNegocio);
  }

  return {
    init: applyGlobalDefaults,
    updateAll,
  };
})();
