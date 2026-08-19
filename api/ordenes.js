const {
  readRange,
  readMultipleRanges,
  parseOrdenes,
  parseIdLugar,
  parseIdInspector,
  parseCodigoProducto,
} = require('../lib/google-sheets');
const cache = require('../lib/cache');
const {
  MAPA_LUGAR,
  MAPA_INSPECTOR,
  MAPA_PRODUCTO,
  extraerSector,
  resolverInspectores,
  resolverLugar,
} = require('../lib/data-maps');

const CACHE_KEY = 'ordenes_data';

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const forceRefresh = req.query.refresh === 'true';

    if (!forceRefresh) {
      const cached = cache.get(CACHE_KEY);
      if (cached) {
        return res.status(200).json({
          ...cached,
          fromCache: true,
          cacheAge: cache.getAge(CACHE_KEY),
        });
      }
    }

    const sheetId = process.env.SHEET_ID_ORDENES;
    if (!sheetId) {
      return res.status(500).json({ error: 'SHEET_ID_ORDENES not configured' });
    }

    const ranges = [
      'SERVICIOS!A3:W2000',
      "'ID Lugar'!B3:D100",
      "'ID Inspector'!B3:D150",
      "'Código de Producto'!B3:C50",
    ];

    const dataBatch = await readMultipleRanges(sheetId, ranges).catch(async () => {
      const rows = await readRange(sheetId, 'SERVICIOS!A3:W2000');
      return { 'SERVICIOS!A3:W2000': rows };
    });

    const dynamicLugares = parseIdLugar(dataBatch["'ID Lugar'!B3:D100"] || []);
    const dynamicInspectores = parseIdInspector(dataBatch["'ID Inspector'!B3:D150"] || []);
    const dynamicProductos = parseCodigoProducto(dataBatch["'Código de Producto'!B3:C50"] || []);

    const mapaLugarFinal = { ...MAPA_LUGAR, ...dynamicLugares };
    const mapaInspectorFinal = { ...MAPA_INSPECTOR, ...dynamicInspectores };
    const mapaProductoFinal = { ...MAPA_PRODUCTO, ...dynamicProductos };

    const ordenes = parseOrdenes(dataBatch['SERVICIOS!A3:W2000'] || []);

    // Enrich with mapped values
    const enriched = ordenes.map(o => {
      const inspectores = resolverInspectores(o.nroInspector, mapaInspectorFinal);
      return {
        ...o,
        ubicacion: resolverLugar(o.lugarCodigo, mapaLugarFinal),
        inspectores,
        inspectorPrincipal: inspectores[0],
        sector: extraerSector(o.descripcion),
        productoNombre: mapaProductoFinal[o.codigoProducto] || o.codigoProducto,
      };
    });

    const result = {
      data: enriched,
      total: enriched.length,
      timestamp: new Date().toISOString(),
    };

    cache.set(CACHE_KEY, result);
    res.status(200).json({ ...result, fromCache: false, cacheAge: 0 });
  } catch (error) {
    console.error('Error fetching ordenes:', error);
    res.status(500).json({
      error: 'Failed to fetch ordenes data',
      message: error.message,
    });
  }
};

