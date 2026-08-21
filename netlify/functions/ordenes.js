/**
 * Netlify Function: ordenes
 * GET /.netlify/functions/ordenes (redirected from /api/ordenes)
 */

const {
  readRange,
  readMultipleRanges,
  parseOrdenes,
  parseIdLugar,
  parseIdInspector,
  parseCodigoProducto,
  DEFAULT_SHEET_ID_ORDENES,
} = require('../../lib/google-sheets');
const cache = require('../../lib/cache');
const {
  MAPA_LUGAR,
  MAPA_INSPECTOR,
  MAPA_PRODUCTO,
  extraerSector,
  resolverInspectores,
  resolverLugar,
} = require('../../lib/data-maps');

const CACHE_KEY = 'ordenes_data';

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

exports.handler = async function(event, context) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const params = event.queryStringParameters || {};
    const forceRefresh = params.refresh === 'true';

    if (!forceRefresh) {
      const cached = cache.get(CACHE_KEY);
      if (cached) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            ...cached,
            fromCache: true,
            cacheAge: cache.getAge(CACHE_KEY),
          }),
        };
      }
    }

    const sheetId = process.env.SHEET_ID_ORDENES || DEFAULT_SHEET_ID_ORDENES;

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

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ...result, fromCache: false, cacheAge: 0 }),
    };
  } catch (error) {
    console.error('Error fetching ordenes:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to fetch ordenes data',
        message: error.message,
      }),
    };
  }
};
