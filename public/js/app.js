/**
 * Pacific Control — Main Application Controller
 * Coordinates API data, interactive filters, KPI metrics, charts, map and paginated table.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Application State
  const state = {
    rawServicios: [],
    filteredServicios: [],
    filtros: {
      search: '',
      mes: '',
      cliente: '',
      inspector: '',
      ubicacion: '',
      sector: '',
      unidadNegocio: '',
    },
    pagination: {
      page: 1,
      pageSize: 10,
    },
    lastUpdated: null,
  };

  // DOM Element References
  const els = {
    loadingOverlay: document.getElementById('loadingOverlay'),
    liveStatusBadge: document.getElementById('liveStatusBadge'),
    liveStatusText: document.getElementById('liveStatusText'),
    lastUpdatedText: document.getElementById('lastUpdatedText'),
    autoRefreshSelect: document.getElementById('autoRefreshSelect'),
    btnRefresh: document.getElementById('btnRefresh'),

    // Filters
    filterSearch: document.getElementById('filterSearch'),
    filterMes: document.getElementById('filterMes'),
    filterCliente: document.getElementById('filterCliente'),
    filterInspector: document.getElementById('filterInspector'),
    filterUbicacion: document.getElementById('filterUbicacion'),
    filterAcreditacion: document.getElementById('filterAcreditacion'),
    filterSector: document.getElementById('filterSector'),
    filterUnidadNegocio: document.getElementById('filterUnidadNegocio'),
    btnClearFilters: document.getElementById('btnClearFilters'),
    activeFilterBadge: document.getElementById('activeFilterBadge'),

    // KPIs
    kpiTotalServicios: document.getElementById('kpiTotalServicios'),
    kpiClientesUnicos: document.getElementById('kpiClientesUnicos'),
    kpiAcreditadosValue: document.getElementById('kpiAcreditadosValue'),
    kpiAcreditadosSub: document.getElementById('kpiAcreditadosSub'),
    kpiAcreditacionBadge: document.getElementById('kpiAcreditacionBadge'),
    kpiGastoTotalReal: document.getElementById('kpiGastoTotalReal'),
    kpiGastoSolicitado: document.getElementById('kpiGastoSolicitado'),
    kpiSedesActivas: document.getElementById('kpiSedesActivas'),
    kpiDesviacionBadge: document.getElementById('kpiDesviacionBadge'),

    // Table
    servicesTableBody: document.getElementById('servicesTableBody'),
    tableRecordCount: document.getElementById('tableRecordCount'),
    tablePaginationInfo: document.getElementById('tablePaginationInfo'),
    paginationButtons: document.getElementById('paginationButtons'),
    btnExportCSV: document.getElementById('btnExportCSV'),

    // Modal
    detailModal: document.getElementById('detailModal'),
    modalTitle: document.getElementById('modalTitle'),
    modalSubtitle: document.getElementById('modalSubtitle'),
    modalContent: document.getElementById('modalContent'),
    modalCloseBtn: document.getElementById('modalCloseBtn'),
  };

  // Initialize UI & Event Listeners
  initEventListeners();

  // Connect to API and start live data stream
  Api.onStatus(handleApiStatus);
  Api.onData(handleApiData);

  // Initial load
  Api.fetchDashboard(false).catch(err => {
    console.error('Error en carga inicial:', err);
  });

  // Start auto-refresh timer (default 60s)
  Api.setAutoRefresh(60);

  // Time-ago ticker every 10 seconds
  setInterval(updateLastUpdatedDisplay, 10000);

  /**
   * Bind DOM Events
   */
  function initEventListeners() {
    // Manual refresh
    els.btnRefresh.addEventListener('click', () => {
      els.btnRefresh.classList.add('loading');
      Api.fetchDashboard(true).finally(() => {
        setTimeout(() => els.btnRefresh.classList.remove('loading'), 600);
      });
    });

    // Auto-refresh rate change
    els.autoRefreshSelect.addEventListener('change', (e) => {
      const sec = parseInt(e.target.value, 10);
      Api.setAutoRefresh(sec);
    });

    // Search filter input (debounced)
    let searchTimeout = null;
    els.filterSearch.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        state.filtros.search = e.target.value.trim().toLowerCase();
        state.pagination.page = 1;
        applyFilters();
      }, 250);
    });

    // Dropdown filters
    const dropdowns = [
      { el: els.filterMes, key: 'mes' },
      { el: els.filterCliente, key: 'cliente' },
      { el: els.filterInspector, key: 'inspector' },
      { el: els.filterUbicacion, key: 'ubicacion' },
      { el: els.filterAcreditacion, key: 'acreditacion' },
      { el: els.filterSector, key: 'sector' },
      { el: els.filterUnidadNegocio, key: 'unidadNegocio' },
    ];

    dropdowns.forEach(({ el, key }) => {
      if (!el) return;
      el.addEventListener('change', (e) => {
        state.filtros[key] = e.target.value;
        state.pagination.page = 1;
        applyFilters();
      });
    });

    // Clear filters
    els.btnClearFilters.addEventListener('click', () => {
      state.filtros = { search: '', mes: '', cliente: '', inspector: '', ubicacion: '', acreditacion: '', sector: '', unidadNegocio: '' };
      els.filterSearch.value = '';
      els.filterMes.value = '';
      if (els.filterCliente) els.filterCliente.value = '';
      els.filterInspector.value = '';
      els.filterUbicacion.value = '';
      if (els.filterAcreditacion) els.filterAcreditacion.value = '';
      els.filterSector.value = '';
      els.filterUnidadNegocio.value = '';
      state.pagination.page = 1;
      applyFilters();
    });

    // Export CSV
    els.btnExportCSV.addEventListener('click', exportToCSV);

    // Modal Close
    els.modalCloseBtn.addEventListener('click', () => {
      els.detailModal.style.display = 'none';
    });
    els.detailModal.addEventListener('click', (e) => {
      if (e.target === els.detailModal) els.detailModal.style.display = 'none';
    });
  }

  /**
   * Handle API Status Updates
   */
  function handleApiStatus({ status, message, timestamp }) {
    if (status === 'loading') {
      els.liveStatusBadge.className = 'badge badge--warning';
      els.liveStatusText.textContent = '🟡 SINCRONIZANDO...';
    } else if (status === 'success') {
      els.liveStatusBadge.className = 'badge badge--success';
      els.liveStatusText.textContent = '🟢 EN VIVO';
      state.lastUpdated = timestamp || new Date();
      updateLastUpdatedDisplay();

      // Fade out loading overlay
      if (els.loadingOverlay) {
        els.loadingOverlay.classList.add('fade-out');
        setTimeout(() => { els.loadingOverlay.style.display = 'none'; }, 500);
      }
    } else if (status === 'error') {
      els.liveStatusBadge.className = 'badge badge--danger';
      els.liveStatusText.textContent = '🔴 ERROR DE CONEXIÓN';
      els.lastUpdatedText.textContent = message || 'Fallo de sincronización';
    }
  }

  /**
   * Handle Ingested Data from API
   */
  function handleApiData(data) {
    if (!data) return;

    state.rawServicios = data.servicios || [];
    populateFilterDropdowns(data.filtros);
    applyFilters();
  }

  /**
   * Populate Filter Selects
   */
  function populateFilterDropdowns(filtros) {
    if (!filtros) return;

    populateSelect(els.filterMes, filtros.meses || [], 'Todos los Meses');
    if (els.filterCliente) populateSelect(els.filterCliente, filtros.clientes || [], 'Todos los Clientes');
    populateSelect(els.filterInspector, filtros.inspectores || [], 'Todos los Inspectores');
    populateSelect(els.filterUbicacion, filtros.ubicaciones || [], 'Todas las Sedes / Provincias');
    if (els.filterAcreditacion) populateSelect(els.filterAcreditacion, filtros.acreditaciones || [], 'Acreditados y No Acreditados');
    populateSelect(els.filterSector, filtros.sectores || [], 'Todos los Sectores');
    populateSelect(els.filterUnidadNegocio, filtros.unidadesNegocio || [], 'Unidad de Negocio');
  }

  function populateSelect(selectEl, items, placeholder) {
    const currentVal = selectEl.value;
    selectEl.innerHTML = `<option value="">${placeholder}</option>`;
    items.forEach(item => {
      const opt = document.createElement('option');
      opt.value = item;
      opt.textContent = item;
      if (item === currentVal) opt.selected = true;
      selectEl.appendChild(opt);
    });
  }

  /**
   * Filter Dataset and Recalculate KPIs / Charts / Map
   */
  function applyFilters() {
    const f = state.filtros;
    let activeCount = 0;
    Object.keys(f).forEach(k => { if (f[k]) activeCount++; });

    // Update filter badge
    if (activeCount > 0) {
      els.btnClearFilters.style.display = 'inline-flex';
      els.activeFilterBadge.textContent = activeCount;
    } else {
      els.btnClearFilters.style.display = 'none';
    }

    // Filter array
    state.filteredServicios = state.rawServicios.filter(s => {
      // Free text search in description, client, acta, cotizacion, inspector, ubicacion
      if (f.search) {
        const fullText = [
          s.descripcion,
          s.cliente,
          s.nroActa,
          s.cotizacion,
          s.ubicacion,
          (s.inspectores || []).join(' '),
          s.sector,
          s.acreditacion,
          s.productoNombre,
        ].filter(Boolean).join(' ').toLowerCase();

        if (!fullText.includes(f.search)) return false;
      }

      if (f.mes && s.mesRequerido !== f.mes) return false;
      if (f.cliente && s.cliente !== f.cliente) return false;
      if (f.inspector && (!s.inspectores || !s.inspectores.includes(f.inspector))) return false;
      if (f.ubicacion && s.ubicacion !== f.ubicacion) return false;
      if (f.acreditacion && s.acreditacion !== f.acreditacion) return false;
      if (f.sector && s.sector !== f.sector) return false;
      if (f.unidadNegocio && s.unidadNegocio !== f.unidadNegocio) return false;

      return true;
    });

    // Recompute Metrics & Aggregations
    renderKPIs();
    updateChartsAndMap();
    renderTable();
  }

  /**
   * Compute and Render KPI Cards
   */
  function renderKPIs() {
    const list = state.filteredServicios;
    const totalServicios = list.length;
    const clientes = new Set(list.map(s => s.cliente).filter(Boolean)).size;
    const sedes = new Set(list.map(s => s.ubicacion).filter(u => u && u !== 'DESCONOCIDO')).size;
    const gastoReal = list.reduce((sum, s) => sum + (s.gastoReal || 0), 0);
    const gastoSolicitado = list.reduce((sum, s) => sum + (s.gastoSolicitado || 0), 0);

    const acreditados = list.filter(s => s.acreditacion === 'ACREDITADO').length;
    const noAcreditados = list.filter(s => s.acreditacion === 'NO ACREDITADO').length;
    const pctAcreditados = totalServicios > 0 ? ((acreditados / totalServicios) * 100).toFixed(1) : '0';

    els.kpiTotalServicios.textContent = totalServicios.toLocaleString('es-PE');
    els.kpiClientesUnicos.textContent = clientes.toLocaleString('es-PE');
    els.kpiSedesActivas.textContent = sedes.toLocaleString('es-PE');
    els.kpiGastoTotalReal.textContent = `S/ ${gastoReal.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    els.kpiGastoSolicitado.textContent = `S/ ${gastoSolicitado.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    if (els.kpiAcreditadosValue) {
      els.kpiAcreditadosValue.textContent = `${acreditados} (${pctAcreditados}%)`;
    }
    if (els.kpiAcreditadosSub) {
      els.kpiAcreditadosSub.textContent = `${noAcreditados} No Acreditados`;
    }

    if (gastoSolicitado > 0) {
      const diffPct = Math.round(((gastoReal - gastoSolicitado) / gastoSolicitado) * 100);
      els.kpiDesviacionBadge.textContent = diffPct > 0 ? `+${diffPct}% sobre pres.` : `${diffPct}% ahorro`;
      els.kpiDesviacionBadge.className = diffPct > 0 ? 'badge badge--danger' : 'badge badge--success';
    } else {
      els.kpiDesviacionBadge.textContent = 'GO Real';
      els.kpiDesviacionBadge.className = 'badge badge--warning';
    }
  }

  /**
   * Recalculate and update Charts + Leaflet Map for filtered subset
   */
  function updateChartsAndMap() {
    const list = state.filteredServicios;

    const porMes = {};
    const porInspector = {};
    const porSector = {};
    const porAcreditacion = {};
    const porUnidadNegocio = {};
    const porUbicacion = {};

    list.forEach(s => {
      // Mes
      const mes = s.mesRequerido || 'SIN MES';
      if (!porMes[mes]) porMes[mes] = { count: 0, gastoReal: 0 };
      porMes[mes].count++;
      porMes[mes].gastoReal += s.gastoReal;

      // Inspector (supports multiple co-inspectors per service)
      const inspList = (s.inspectores && s.inspectores.length > 0 && s.inspectores[0] !== 'Sin asignar')
        ? s.inspectores
        : [s.depositadoA || s.inspectorPrincipal || 'Sin asignar'];

      inspList.forEach(insp => {
        if (!porInspector[insp]) porInspector[insp] = { count: 0, gastoReal: 0 };
        porInspector[insp].count++;
        porInspector[insp].gastoReal += Math.round((s.gastoReal / inspList.length) * 100) / 100;
      });

      // Acreditación
      const acr = s.acreditacion || 'NO ESPECIFICADO';
      if (!porAcreditacion[acr]) porAcreditacion[acr] = { count: 0, gastoReal: 0 };
      porAcreditacion[acr].count++;
      porAcreditacion[acr].gastoReal += s.gastoReal;

      // Sector
      const sec = s.sector || 'OTROS';
      if (!porSector[sec]) porSector[sec] = { count: 0, gastoReal: 0 };
      porSector[sec].count++;
      porSector[sec].gastoReal += s.gastoReal;

      // Unidad de Negocio
      const un = s.unidadNegocio || 'SIN CLASIFICAR';
      if (!porUnidadNegocio[un]) porUnidadNegocio[un] = { count: 0, gastoReal: 0 };
      porUnidadNegocio[un].count++;
      porUnidadNegocio[un].gastoReal += s.gastoReal;

      // Ubicación
      const ub = s.ubicacion || 'DESCONOCIDO';
      if (!porUbicacion[ub]) porUbicacion[ub] = { count: 0, gastoReal: 0, gastoSolicitado: 0 };
      porUbicacion[ub].count++;
      porUbicacion[ub].gastoReal += s.gastoReal;
      porUbicacion[ub].gastoSolicitado += s.gastoSolicitado;
    });

    // Update charts
    DashboardCharts.updateAll({
      porMes,
      porInspector,
      porAcreditacion,
      porUbicacion,
      porSector,
      porUnidadNegocio,
    });

    // Update Map with coordinates
    const allData = Api.getCurrentData();
    const mapaCoords = (allData && allData.mapa) || [];
    const coordsLookup = {};
    mapaCoords.forEach(m => { if (m.coords) coordsLookup[m.nombre] = m.coords; });

    const ubicacionesArray = Object.entries(porUbicacion).map(([nombre, d]) => ({
      nombre,
      ...d,
      coords: coordsLookup[nombre] || null,
    }));

    DashboardMap.updateMarkers(ubicacionesArray);
  }

  /**
   * Render Interactive Paginated Table
   */
  function renderTable() {
    const list = state.filteredServicios;
    const total = list.length;
    const { page, pageSize } = state.pagination;

    els.tableRecordCount.textContent = `${total.toLocaleString('es-PE')} servicios`;

    if (total === 0) {
      els.servicesTableBody.innerHTML = `
        <tr>
          <td colspan="9" class="empty-state">
            <div class="empty-state__icon">🔍</div>
            <div class="empty-state__text">No se encontraron órdenes de servicio con los filtros aplicados.</div>
          </td>
        </tr>
      `;
      els.tablePaginationInfo.textContent = 'Mostrando 0 registros';
      els.paginationButtons.innerHTML = '';
      return;
    }

    const totalPages = Math.ceil(total / pageSize);
    const currentPage = Math.min(page, totalPages);
    const startIdx = (currentPage - 1) * pageSize;
    const endIdx = Math.min(startIdx + pageSize, total);
    const pageItems = list.slice(startIdx, endIdx);

    els.tablePaginationInfo.textContent = `Mostrando ${startIdx + 1} a ${endIdx} de ${total} registros (Página ${currentPage} de ${totalPages})`;

    // Generate table rows
    let html = '';
    pageItems.forEach((s, idx) => {
      const sectorBadgeClass = getSectorBadgeClass(s.sector);
      const gastoFormatted = s.gastoReal > 0
        ? `<span style="font-weight:600; color: var(--accent-400);">S/ ${s.gastoReal.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>`
        : `<span style="color: var(--text-muted); font-size: var(--text-xs);">-</span>`;

      const inspectoresText = (s.inspectores && s.inspectores.length > 0)
        ? s.inspectores.join(' / ')
        : (s.inspectorPrincipal || 'Sin asignar');

      const acreditacionBadge = s.acreditacion === 'ACREDITADO'
        ? `<span class="badge badge--success">✓ Acreditado</span>`
        : (s.acreditacion === 'NO ACREDITADO'
          ? `<span class="badge badge--warning">No Acred.</span>`
          : `<span class="badge badge--neutral">${escapeHtml(s.acreditacion || '-')}</span>`);

      html += `
        <tr>
          <td>
            <div style="font-weight: 600; color: var(--text-primary);">${escapeHtml(s.nroActa || '-')}</div>
            <div style="font-size: var(--text-xs); color: var(--text-muted);">${escapeHtml(s.cotizacion || '')}</div>
          </td>
          <td style="white-space: nowrap;">
            ${escapeHtml(s.fechaInspeccion || '-')}
          </td>
          <td>
            <div style="font-weight: 500; max-width: 220px; word-break: break-word;">${escapeHtml(s.cliente || 'Sin Cliente')}</div>
          </td>
          <td>
            <div style="max-width: 320px; font-size: var(--text-xs); color: var(--text-secondary); line-height: 1.4; word-break: break-word;">
              ${escapeHtml(s.descripcion || 'Sin descripción')}
            </div>
          </td>
          <td>
            <div style="font-weight: 500; color: var(--primary-300);">${escapeHtml(inspectoresText)}</div>
            ${s.nroInspector ? `<div style="font-size: var(--text-xs); color: var(--text-muted);">Cód. ${escapeHtml(s.nroInspector)}</div>` : ''}
          </td>
          <td>
            <span class="badge badge--neutral">📍 ${escapeHtml(s.ubicacion || 'DESCONOCIDO')}</span>
          </td>
          <td>
            <span class="badge ${sectorBadgeClass}">${escapeHtml(s.sector || 'OTROS')}</span>
          </td>
          <td>
            ${acreditacionBadge}
          </td>
          <td>
            ${gastoFormatted}
          </td>
          <td>
            <button class="export-btn" style="padding: 4px 8px; font-size: var(--text-xs);" onclick="window.viewServiceDetail(${startIdx + idx})">
              Ver
            </button>
          </td>
        </tr>
      `;
    });

    els.servicesTableBody.innerHTML = html;

    // Render pagination buttons
    renderPaginationControls(currentPage, totalPages);
  }

  function renderPaginationControls(currentPage, totalPages) {
    let btns = '';

    // Prev Button
    btns += `
      <button class="topbar__refresh-btn" style="padding: 4px 10px; font-size: var(--text-xs);" ${currentPage === 1 ? 'disabled style="opacity:0.4; pointer-events:none;"' : ''} onclick="window.changePage(${currentPage - 1})">
        &laquo; Anterior
      </button>
    `;

    // Numeric pages
    const maxButtons = 5;
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + maxButtons - 1);
    if (endPage - startPage < maxButtons - 1) {
      startPage = Math.max(1, endPage - maxButtons + 1);
    }

    for (let p = startPage; p <= endPage; p++) {
      const activeStyle = p === currentPage
        ? 'background: var(--primary-600); color: white; border-color: var(--primary-500);'
        : '';
      btns += `
        <button class="topbar__refresh-btn" style="padding: 4px 10px; font-size: var(--text-xs); ${activeStyle}" onclick="window.changePage(${p})">
          ${p}
        </button>
      `;
    }

    // Next Button
    btns += `
      <button class="topbar__refresh-btn" style="padding: 4px 10px; font-size: var(--text-xs);" ${currentPage === totalPages ? 'disabled style="opacity:0.4; pointer-events:none;"' : ''} onclick="window.changePage(${currentPage + 1})">
        Siguiente &raquo;
      </button>
    `;

    els.paginationButtons.innerHTML = btns;
  }

  // Global handler for page navigation
  window.changePage = function(page) {
    state.pagination.page = page;
    renderTable();
  };

  // Global handler for detail modal
  window.viewServiceDetail = function(index) {
    const s = state.filteredServicios[index];
    if (!s) return;

    els.modalTitle.textContent = `Acta N° ${s.nroActa || 'S/N'}`;
    els.modalSubtitle.textContent = `Cotización: ${s.cotizacion || 'S/N'} • Cliente: ${s.cliente || 'Desconocido'}`;

    const desglose = s.desglose;
    let desgloseHtml = '<div style="color: var(--text-muted); font-size: var(--text-xs);">Sin desglose de rendición GO registrado</div>';

    if (desglose) {
      desgloseHtml = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 8px; margin-top: 8px;">
          <div class="kpi-card" style="padding: 8px 10px;">
            <div style="font-size: var(--text-xs); color: var(--text-muted);">Pasajes</div>
            <div style="font-size: 0.95rem; font-weight: 700; color: var(--text-primary);">S/ ${(desglose.pasajes || 0).toFixed(2)}</div>
          </div>
          <div class="kpi-card" style="padding: 8px 10px;">
            <div style="font-size: var(--text-xs); color: var(--text-muted);">Movilidad Local</div>
            <div style="font-size: 0.95rem; font-weight: 700; color: var(--text-primary);">S/ ${(desglose.movilidad || 0).toFixed(2)}</div>
          </div>
          <div class="kpi-card" style="padding: 8px 10px;">
            <div style="font-size: var(--text-xs); color: var(--text-muted);">Viáticos / Alim.</div>
            <div style="font-size: 0.95rem; font-weight: 700; color: var(--text-primary);">S/ ${(desglose.viaticos || 0).toFixed(2)}</div>
          </div>
          <div class="kpi-card" style="padding: 8px 10px;">
            <div style="font-size: var(--text-xs); color: var(--text-muted);">Envío Materiales</div>
            <div style="font-size: 0.95rem; font-weight: 700; color: var(--text-primary);">S/ ${(desglose.envioMateriales || 0).toFixed(2)}</div>
          </div>
          <div class="kpi-card" style="padding: 8px 10px;">
            <div style="font-size: var(--text-xs); color: var(--text-muted);">Otros Gastos</div>
            <div style="font-size: 0.95rem; font-weight: 700; color: var(--text-primary);">S/ ${(desglose.otros || 0).toFixed(2)}</div>
          </div>
        </div>
      `;
    }

    const inspectoresFullText = (s.inspectores && s.inspectores.length > 0)
      ? s.inspectores.join(' / ')
      : (s.inspectorPrincipal || 'Sin asignar');

    els.modalContent.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 12px; font-size: var(--text-sm);">
        <div style="background: var(--bg-elevated); padding: 10px 12px; border-radius: var(--radius-md);">
          <div style="font-size: 0.7rem; font-weight: 700; color: var(--text-muted); margin-bottom: 2px;">DESCRIPCIÓN DEL SERVICIO</div>
          <div style="color: var(--text-primary); line-height: 1.4; font-size: 0.85rem; word-break: break-word;">${escapeHtml(s.descripcion || 'Sin descripción')}</div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px;">
          <div>
            <span style="color: var(--text-muted); font-size: 0.75rem; display: block;">Sede / Lugar:</span>
            <strong style="color: var(--text-primary);">${escapeHtml(s.ubicacion)} (Cód. ${s.lugarCodigo || '-'})</strong>
          </div>
          <div>
            <span style="color: var(--text-muted); font-size: 0.75rem; display: block;">Inspector(es):</span>
            <strong style="color: var(--primary-500);">${escapeHtml(inspectoresFullText)} (Cód. ${escapeHtml(s.nroInspector || '-')})</strong>
          </div>
          <div>
            <span style="color: var(--text-muted); font-size: 0.75rem; display: block;">Fecha Inspección:</span>
            <strong style="color: var(--text-primary);">${escapeHtml(s.fechaInspeccion || '-')}</strong>
          </div>
          <div>
            <span style="color: var(--text-muted); font-size: 0.75rem; display: block;">Sector / Producto:</span>
            <strong style="color: var(--text-primary);">${escapeHtml(s.productoNombre || s.sector)}</strong>
          </div>
          <div>
            <span style="color: var(--text-muted); font-size: 0.75rem; display: block;">Unidad de Negocio:</span>
            <strong style="color: var(--text-primary);">${escapeHtml(s.unidadNegocio || '-')}</strong>
          </div>
          <div>
            <span style="color: var(--text-muted); font-size: 0.75rem; display: block;">Depositado A:</span>
            <strong style="color: var(--text-primary);">${escapeHtml(s.depositadoA || '-')}</strong>
          </div>
        </div>

        <div style="border-top: 1px solid var(--border-default); padding-top: 10px;">
          <h4 style="margin: 0 0 6px 0; color: var(--text-primary); font-size: var(--text-xs); font-weight: 700; text-transform: uppercase;">Desglose de Rendición Operativa GO</h4>

          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span>Gasto Solicitado: <strong>S/ ${(s.gastoSolicitado || 0).toFixed(2)}</strong></span>
            <span>Gasto Real Ejecutado: <strong style="color: var(--accent-400);">S/ ${(s.gastoReal || 0).toFixed(2)}</strong></span>
          </div>
          ${desgloseHtml}
        </div>

        ${s.observaciones ? `
        <div style="background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.2); padding: 10px; border-radius: var(--radius-md); font-size: var(--text-xs);">
          <strong style="color: var(--warning-400);">Observaciones:</strong> ${escapeHtml(s.observaciones)}
        </div>` : ''}
      </div>
    `;

    els.detailModal.style.display = 'flex';
  };

  /**
   * Export Filtered Rows to CSV
   */
  function exportToCSV() {
    const list = state.filteredServicios;
    if (list.length === 0) {
      alert('No hay registros para exportar.');
      return;
    }

    const headers = [
      'N° Acta', 'Cotización', 'Fecha Inspección', 'Cliente',
      'Descripción', 'Sector', 'Código Lugar', 'Ubicación / Sede',
      'Inspector', 'Gasto Solicitado', 'Gasto Real', 'Unidad Negocio'
    ];

    const rows = list.map(s => [
      `"${(s.nroActa || '').replace(/"/g, '""')}"`,
      `"${(s.cotizacion || '').replace(/"/g, '""')}"`,
      `"${(s.fechaInspeccion || '').replace(/"/g, '""')}"`,
      `"${(s.cliente || '').replace(/"/g, '""')}"`,
      `"${(s.descripcion || '').replace(/"/g, '""')}"`,
      `"${(s.sector || '').replace(/"/g, '""')}"`,
      `"${(s.lugarCodigo || '').replace(/"/g, '""')}"`,
      `"${(s.ubicacion || '').replace(/"/g, '""')}"`,
      `"${((s.inspectores && s.inspectores.length > 0) ? s.inspectores.join(' / ') : s.inspectorPrincipal || '').replace(/"/g, '""')}"`,
      s.gastoSolicitado || 0,
      s.gastoReal || 0,
      `"${(s.unidadNegocio || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `PacificControl_Servicios_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function updateLastUpdatedDisplay() {
    if (!state.lastUpdated) return;
    const elapsedSec = Math.floor((Date.now() - state.lastUpdated.getTime()) / 1000);
    if (elapsedSec < 5) {
      els.lastUpdatedText.textContent = 'Actualizado hace un momento';
    } else if (elapsedSec < 60) {
      els.lastUpdatedText.textContent = `Actualizado hace ${elapsedSec}s`;
    } else {
      const min = Math.floor(elapsedSec / 60);
      els.lastUpdatedText.textContent = `Actualizado hace ${min}m`;
    }
  }

  function getSectorBadgeClass(sector) {
    switch ((sector || '').toUpperCase()) {
      case 'CONGELADO': return 'badge--primary';
      case 'CONSERVA':  return 'badge--purple';
      case 'HARINA':    return 'badge--warning';
      case 'ALIMENTOS': return 'badge--success';
      case 'ACEITE':    return 'badge--info';
      case 'EMBARQUE / AFORO': return 'badge--danger';
      default: return 'badge--neutral';
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
});
