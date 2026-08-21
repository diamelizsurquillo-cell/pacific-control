const { readRange, parseGastos, hasLocalExcelFiles, getLocalExcelMTime, DEFAULT_SHEET_ID_GASTOS } = require('../lib/google-sheets');
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
    const excelMTime = getLocalExcelMTime();
    const cacheCreatedAt = cache.getCreatedAt(CACHE_KEY);
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
    const sheetId = process.env.SHEET_ID_GASTOS || DEFAULT_SHEET_ID_GASTOS;
    if (!hasLocal && !sheetId) {
      return res.status(500).json({ error: 'SHEET_ID_GASTOS not configured and no local Excel found' });
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
