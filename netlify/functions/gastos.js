/**
 * Netlify Function: gastos
 * GET /.netlify/functions/gastos (redirected from /api/gastos)
 */

const { readRange, parseGastos } = require('../../lib/google-sheets');
const cache = require('../../lib/cache');

const CACHE_KEY = 'gastos_data';

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

    const sheetId = process.env.SHEET_ID_GASTOS;
    if (!sheetId) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'SHEET_ID_GASTOS not configured' }),
      };
    }

    const rows = await readRange(sheetId, "'Gastos Operativos GO 2026'!A1:Q700");
    const gastos = parseGastos(rows);

    const result = {
      data: gastos,
      total: gastos.length,
      timestamp: new Date().toISOString(),
    };

    cache.set(CACHE_KEY, result);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ...result, fromCache: false }),
    };
  } catch (error) {
    console.error('Error fetching gastos:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to fetch gastos data',
        message: error.message,
      }),
    };
  }
};
