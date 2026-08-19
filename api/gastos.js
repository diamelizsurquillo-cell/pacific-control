/**
 * GET /api/gastos
 * Returns parsed operational expenses from Google Sheets.
 */

const { readRange, parseGastos } = require('../lib/google-sheets');
const cache = require('../lib/cache');

const CACHE_KEY = 'gastos_data';

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

    const sheetId = process.env.SHEET_ID_GASTOS;
    if (!sheetId) {
      return res.status(500).json({ error: 'SHEET_ID_GASTOS not configured' });
    }

    // Read headers + data from GO 2026 sheet
    const rows = await readRange(sheetId, "'Gastos Operativos GO 2026'!A1:Q700");
    const gastos = parseGastos(rows);

    const result = {
      data: gastos,
      total: gastos.length,
      timestamp: new Date().toISOString(),
    };

    cache.set(CACHE_KEY, result);

    res.status(200).json({ ...result, fromCache: false });
  } catch (error) {
    console.error('Error fetching gastos:', error);
    res.status(500).json({
      error: 'Failed to fetch gastos data',
      message: error.message,
    });
  }
};
