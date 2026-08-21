/**
 * GET /api/dashboard
 * Returns combined, cross-referenced data from both sheets with pre-calculated KPIs.
 * This is the main endpoint consumed by the frontend.
 */

const {
  readRange,
  readMultipleRanges,
  parseOrdenes,
  parseGastos,
  parseIdLugar,
  parseIdInspector,
  parseCodigoProducto,
  isValidCliente,
  hasLocalExcelFiles,
  getLocalExcelMTime,
  clearWorkbookCache,
} = require('../lib/google-sheets');
const cache = require('../lib/cache');
const path = require('path');
const fs = require('fs');
const {
  MAPA_LUGAR,
  MAPA_INSPECTOR,
  MAPA_PRODUCTO,
  COORDS_PROVINCIA,
  MESES_ORDEN,
  extraerSector,
  resolverInspectores,
  resolverLugar,
} = require('../lib/data-maps');

const CACHE_KEY = 'dashboard_combined';

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const forceRefresh = req.query.refresh === 'true';
    if (forceRefresh) {
      clearWorkbookCache();
    }

    const excelMTime = getLocalExcelMTime();
    const cacheCreatedAt = cache.getCreatedAt(CACHE_KEY);

    // If local Excel file was edited after the cache was generated, force refresh
    const isExcelUpdated = excelMTime > 0 && excelMTime > cacheCreatedAt;

    if (!forceRefresh && !isExcelUpdated) {
      const cached = cache.get(CACHE_KEY);
      if (cached) {
        return res.status(200).json({
          ...cached,
          fromCache: true,
          cacheAge: cache.getAge(CACHE_KEY),
        });
      }
    }

    const hasLocal = hasLocalExcelFiles();
    const sheetIdOrdenes = process.env.SHEET_ID_ORDENES;
    const sheetIdGastos = process.env.SHEET_ID_GASTOS;

    if (!hasLocal && (!sheetIdOrdenes || !sheetIdGastos)) {
      return res.status(500).json({ error: 'Sheet IDs not configured and no local Excel files found' });
    }

    // Fetch dynamic sheets from Órdenes spreadsheet and Gastos Operativos in parallel
    const ordenesRanges = [
      'SERVICIOS!A3:W2000',
      "'ID Lugar'!B3:D100",
      "'ID Inspector'!B3:D150",
      "'Código de Producto'!B3:C50",
    ];

    const [ordenesDataBatch, gastosRows] = await Promise.all([
      readMultipleRanges(sheetIdOrdenes, ordenesRanges, forceRefresh).catch(async () => {
        // Fallback to individual reads if batch fails
        const rows = await readRange(sheetIdOrdenes, 'SERVICIOS!A3:W2000', forceRefresh);
        return { 'SERVICIOS!A3:W2000': rows };
      }),
      readRange(sheetIdGastos, "'Gastos Operativos GO 2026'!A1:Q700", forceRefresh).catch(() => []),
    ]);

    // Parse dynamic catalogs from the Sheet
    const dynamicLugares = parseIdLugar(ordenesDataBatch["'ID Lugar'!B3:D100"] || []);
    const dynamicInspectores = parseIdInspector(ordenesDataBatch["'ID Inspector'!B3:D150"] || []);
    const dynamicProductos = parseCodigoProducto(ordenesDataBatch["'Código de Producto'!B3:C50"] || []);

    // Merge dynamic catalogs with static fallbacks
    const mapaLugarFinal = { ...MAPA_LUGAR, ...dynamicLugares };
    const mapaInspectorFinal = { ...MAPA_INSPECTOR, ...dynamicInspectores };
    const mapaProductoFinal = { ...MAPA_PRODUCTO, ...dynamicProductos };

    const ordenes = parseOrdenes(ordenesDataBatch['SERVICIOS!A3:W2000'] || []);
    const gastos = parseGastos(gastosRows);

    // --- CROSS-REFERENCE by Cotización ---
    const gastosMap = {};
    gastos.forEach(g => {
      const cot = g.cotizacion.trim();
      if (!cot) return;
      if (!gastosMap[cot]) gastosMap[cot] = [];
      gastosMap[cot].push(g);
    });

    // Track which gastos were matched
    const matchedCotizaciones = new Set();

    // Enrich orders with mapped values and associated expenses
    const servicios = ordenes.map(o => {
      const cot = o.cotizacion.trim();
      const gastosAsociados = gastosMap[cot] || [];
      if (gastosAsociados.length > 0) matchedCotizaciones.add(cot);

      const gastoSolicitado = gastosAsociados.reduce((s, g) => s + g.goTotalSolicitado, 0);
      const gastoReal = gastosAsociados.reduce((s, g) => s + g.goReal, 0);
      
      // Resolve location name dynamically from ID Lugar sheet or associated GO
      const provincia = resolverLugar(o.lugarCodigo, mapaLugarFinal) !== 'DESCONOCIDO'
        ? resolverLugar(o.lugarCodigo, mapaLugarFinal)
        : (gastosAsociados.length > 0 ? gastosAsociados[0].provincia : 'DESCONOCIDO');

      const inspectoresResueltos = resolverInspectores(o.nroInspector, mapaInspectorFinal);

      return {
        cotizacion: cot,
        nroActa: o.nroActa,
        anio: o.anio,
        lugarCodigo: o.lugarCodigo,
        ubicacion: provincia,
        nroInspeccion: o.nroInspeccion,
        codigoProducto: o.codigoProducto,
        productoNombre: mapaProductoFinal[o.codigoProducto] || o.codigoProducto,
        tipoInspeccion: o.tipoInspeccion,
        nroInspector: o.nroInspector,
        inspectores: inspectoresResueltos,
        inspectorPrincipal: inspectoresResueltos[0],
        cliente: o.cliente,
        descripcion: o.descripcion, // Texto libre original del sheet
        sector: extraerSector(o.descripcion),
        fechaInspeccion: o.fechaInspeccion,
        observaciones: o.observaciones,
        acreditacion: o.acreditacion || 'NO ESPECIFICADO',
        codigoDocumento: o.codigoDocumento,
        // Expense cross-reference
        tieneGasto: gastosAsociados.length > 0,
        gastoSolicitado,
        gastoReal,
        desviacion: gastoSolicitado > 0
          ? Math.round(((gastoReal - gastoSolicitado) / gastoSolicitado) * 10000) / 100
          : 0,
        unidadNegocio: gastosAsociados.length > 0 ? gastosAsociados[0].unidadNegocio : '',
        mesRequerido: gastosAsociados.length > 0 ? gastosAsociados[0].mesRequerido : '',
        depositadoA: gastosAsociados.length > 0 ? gastosAsociados[0].depositadoA : '',
        desglose: gastosAsociados.length > 0 ? {
          pasajes: gastosAsociados.reduce((s, g) => s + g.pasajes, 0),
          movilidad: gastosAsociados.reduce((s, g) => s + g.movilidad, 0),
          envioMateriales: gastosAsociados.reduce((s, g) => s + g.envioMateriales, 0),
          viaticos: gastosAsociados.reduce((s, g) => s + g.viaticos, 0),
          otros: gastosAsociados.reduce((s, g) => s + g.otros, 0),
        } : null,
      };
    });

    // Orphan expenses (in GO but not in Órdenes)
    const gastosHuerfanos = gastos.filter(g => !matchedCotizaciones.has(g.cotizacion.trim()));

    // --- KPI Calculations ---
    const totalServicios = servicios.length;
    const clientesUnicos = new Set(servicios.map(s => s.cliente).filter(isValidCliente)).size;
    const gastoTotalReal = servicios.reduce((s, sv) => s + sv.gastoReal, 0)
      + gastosHuerfanos.reduce((s, g) => s + g.goReal, 0);
    const gastoTotalSolicitado = servicios.reduce((s, sv) => s + sv.gastoSolicitado, 0)
      + gastosHuerfanos.reduce((s, g) => s + g.goTotalSolicitado, 0);
    const serviciosConGasto = servicios.filter(s => s.tieneGasto).length;
    const serviciosSinGasto = servicios.filter(s => !s.tieneGasto).length;

    // Group by Sector
    const porSector = {};
    servicios.forEach(s => {
      const sec = s.sector || 'OTROS';
      if (!porSector[sec]) porSector[sec] = { count: 0, gastoReal: 0 };
      porSector[sec].count++;
      porSector[sec].gastoReal += s.gastoReal;
    });

    // Group by Acreditación
    const porAcreditacion = {};
    servicios.forEach(s => {
      const acr = s.acreditacion || 'NO ESPECIFICADO';
      if (!porAcreditacion[acr]) porAcreditacion[acr] = { count: 0, gastoReal: 0 };
      porAcreditacion[acr].count++;
      porAcreditacion[acr].gastoReal += s.gastoReal;
    });

    // Group by Ubicacion
    const porUbicacion = {};
    servicios.forEach(s => {
      const ub = s.ubicacion || 'DESCONOCIDO';
      if (!porUbicacion[ub]) porUbicacion[ub] = { count: 0, gastoReal: 0, gastoSolicitado: 0 };
      porUbicacion[ub].count++;
      porUbicacion[ub].gastoReal += s.gastoReal;
      porUbicacion[ub].gastoSolicitado += s.gastoSolicitado;
    });
    // Add orphans
    gastosHuerfanos.forEach(g => {
      const ub = g.provincia || 'DESCONOCIDO';
      if (!porUbicacion[ub]) porUbicacion[ub] = { count: 0, gastoReal: 0, gastoSolicitado: 0 };
      porUbicacion[ub].gastoReal += g.goReal;
      porUbicacion[ub].gastoSolicitado += g.goTotalSolicitado;
    });

    // Group by Inspector (supports multiple co-inspectors per service)
    const porInspector = {};
    servicios.forEach(s => {
      const list = (s.inspectores && s.inspectores.length > 0 && s.inspectores[0] !== 'Sin asignar')
        ? s.inspectores
        : [s.depositadoA || s.inspectorPrincipal || 'Sin asignar'];

      list.forEach(insp => {
        if (!porInspector[insp]) porInspector[insp] = { count: 0, gastoReal: 0 };
        porInspector[insp].count++;
        porInspector[insp].gastoReal += Math.round((s.gastoReal / list.length) * 100) / 100;
      });
    });

    // Frequency tiering of inspectors
    const frecuenciaInspectores = {
      '1 servicio': 0,
      '2 servicios': 0,
      '3 servicios': 0,
      '4 a 10 servicios': 0,
      '11 a 50 servicios': 0,
      'Más de 50 servicios': 0,
    };
    Object.values(porInspector).forEach(data => {
      const c = data.count;
      if (c === 1) frecuenciaInspectores['1 servicio']++;
      else if (c === 2) frecuenciaInspectores['2 servicios']++;
      else if (c === 3) frecuenciaInspectores['3 servicios']++;
      else if (c <= 10) frecuenciaInspectores['4 a 10 servicios']++;
      else if (c <= 50) frecuenciaInspectores['11 a 50 servicios']++;
      else frecuenciaInspectores['Más de 50 servicios']++;
    });

    // Group by Mes
    const porMes = {};
    servicios.forEach(s => {
      const mes = s.mesRequerido || 'SIN MES';
      if (!porMes[mes]) porMes[mes] = { count: 0, gastoReal: 0, gastoSolicitado: 0 };
      porMes[mes].count++;
      porMes[mes].gastoReal += s.gastoReal;
      porMes[mes].gastoSolicitado += s.gastoSolicitado;
    });
    const porMesOrdenado = Object.entries(porMes)
      .sort(([a], [b]) => (MESES_ORDEN[a] || 99) - (MESES_ORDEN[b] || 99))
      .reduce((acc, [k, v]) => { acc[k] = v; return acc; }, {});

    // Group by Unidad de Negocio
    const porUnidadNegocio = {};
    gastos.forEach(g => {
      const un = g.unidadNegocio || 'SIN CLASIFICAR';
      if (!porUnidadNegocio[un]) porUnidadNegocio[un] = { count: 0, gastoReal: 0 };
      porUnidadNegocio[un].count++;
      porUnidadNegocio[un].gastoReal += g.goReal;
    });

    // Map locations with coordinates
    const ubicacionesConCoords = Object.entries(porUbicacion).map(([nombre, data]) => ({
      nombre,
      ...data,
      coords: COORDS_PROVINCIA[nombre] || null,
    }));

    const serviciosAcreditados = servicios.filter(s => s.acreditacion === 'ACREDITADO').length;
    const serviciosNoAcreditados = servicios.filter(s => s.acreditacion === 'NO ACREDITADO').length;
    const porcentajeAcreditados = totalServicios > 0 ? Math.round((serviciosAcreditados / totalServicios) * 1000) / 10 : 0;

    // Filter options (for dropdowns)
    const filtros = {
      meses: Object.keys(MESES_ORDEN),
      sectores: [...new Set(servicios.map(s => s.sector))].sort(),
      acreditaciones: [...new Set(servicios.map(s => s.acreditacion))].filter(Boolean).sort(),
      ubicaciones: [...new Set(servicios.map(s => s.ubicacion).filter(u => u !== 'DESCONOCIDO'))].sort(),
      inspectores: [...new Set(servicios.flatMap(s => s.inspectores || [s.inspectorPrincipal]).filter(i => i && i !== 'Sin asignar'))].sort(),
      unidadesNegocio: [...new Set(gastos.map(g => g.unidadNegocio).filter(Boolean))].sort(),
      clientes: [...new Set(servicios.map(s => s.cliente).filter(isValidCliente))].sort(),
    };

    const result = {
      kpis: {
        totalServicios,
        clientesUnicos,
        gastoTotalReal: Math.round(gastoTotalReal * 100) / 100,
        gastoTotalSolicitado: Math.round(gastoTotalSolicitado * 100) / 100,
        gastoPromedio: totalServicios > 0 ? Math.round((gastoTotalReal / totalServicios) * 100) / 100 : 0,
        serviciosConGasto,
        serviciosSinGasto,
        serviciosAcreditados,
        serviciosNoAcreditados,
        porcentajeAcreditados,
        sedesCount: Object.keys(porUbicacion).filter(u => u !== 'DESCONOCIDO').length,
        gastosHuerfanosCount: gastosHuerfanos.length,
      },
      agrupaciones: {
        porSector,
        porAcreditacion,
        porMes: porMesOrdenado,
        porUbicacion,
        porInspector,
        frecuenciaInspectores,
        porUnidadNegocio,
      },
      mapa: ubicacionesConCoords,
      filtros,
      servicios,
      catalogos: {
        lugaresCount: Object.keys(dynamicLugares).length,
        inspectoresCount: Object.keys(dynamicInspectores).length,
        productosCount: Object.keys(dynamicProductos).length,
      },
      gastosHuerfanos: gastosHuerfanos.map(g => ({
        go: g.go,
        cotizacion: g.cotizacion,
        cliente: g.cliente,
        provincia: g.provincia,
        mesRequerido: g.mesRequerido,
        goTotalSolicitado: g.goTotalSolicitado,
        goReal: g.goReal,
        depositadoA: g.depositadoA,
      })),
      timestamp: new Date().toISOString(),
    };

    cache.set(CACHE_KEY, result);

    // Keep public/data/dashboard.json updated in local environment
    try {
      const outDir = path.join(__dirname, '..', 'public', 'data');
      if (fs.existsSync(outDir)) {
        fs.writeFileSync(path.join(outDir, 'dashboard.json'), JSON.stringify(result, null, 2));
      }
    } catch (e) {
      // Ignore in read-only serverless environments
    }

    res.status(200).json({ ...result, fromCache: false, cacheAge: 0 });

  } catch (error) {
    console.error('Error in dashboard API:', error);
    res.status(500).json({ error: 'Failed to build dashboard data', message: error.message });
  }
};

