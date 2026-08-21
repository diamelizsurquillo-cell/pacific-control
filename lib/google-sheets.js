const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

const DEFAULT_SHEET_ID_ORDENES = '1FPfC4d0xxBSw63jaWcvBsLQJx7DgfpXr';
const DEFAULT_SHEET_ID_GASTOS = '1_zIG3LkIPwf_SkPgF4yoN3E4Y5983QSI';

let _sheetsClient = null;

/**
 * Check if real Google Service Account credentials are configured
 */
function hasValidGoogleCredentials() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '';
  const key = process.env.GOOGLE_PRIVATE_KEY || '';
  const sheetOrdenes = process.env.SHEET_ID_ORDENES || DEFAULT_SHEET_ID_ORDENES;
  return email && !email.includes('your-') && key && !key.includes('your-') && key.length > 200 && sheetOrdenes && !sheetOrdenes.includes('your_');
}

/**
 * Check if local Excel files exist in workspace
 */
function hasLocalExcelFiles() {
  const f1 = path.join(process.cwd(), '1. FR-12-01-04 Ordenes de servicio de Inspeccion 2026.xlsx');
  const f1Alt = path.join(__dirname, '..', '1. FR-12-01-04 Ordenes de servicio de Inspeccion 2026.xlsx');
  return fs.existsSync(f1) || fs.existsSync(f1Alt);
}

/**
 * Get latest modification time of local Excel files
 */
function getLocalExcelMTime() {
  let maxTime = 0;
  const files = [
    '1. FR-12-01-04 Ordenes de servicio de Inspeccion 2026.xlsx',
    '4. Rendicion de operativos 2026.xlsx',
  ];
  for (const f of files) {
    let p = path.join(process.cwd(), f);
    if (!fs.existsSync(p)) p = path.join(__dirname, '..', f);
    if (fs.existsSync(p)) {
      try {
        const stat = fs.statSync(p);
        if (stat.mtimeMs > maxTime) maxTime = stat.mtimeMs;
      } catch (e) {}
    }
  }
  return maxTime;
}

/**
 * Helper to read raw rows from local Excel workbook sheet
 */
function readLocalExcelSheet(fileName, sheetName, startRow = 1) {
  try {
    const xlsx = require('xlsx');
    let filePath = path.join(process.cwd(), fileName);
    if (!fs.existsSync(filePath)) {
      filePath = path.join(__dirname, '..', fileName);
    }
    if (!fs.existsSync(filePath)) {
      filePath = path.join(__dirname, fileName);
    }
    if (!fs.existsSync(filePath)) {
      console.warn(`[Local Excel Read Warning] File not found: ${fileName} in paths evaluated.`);
      return [];
    }
    const workbook = xlsx.readFile(filePath);
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return [];
    const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' });
    return rows.slice(startRow - 1);
  } catch (err) {
    console.warn(`[Local Excel Read Error] ${fileName} -> ${sheetName}:`, err.message);
    return [];
  }
}

/**
 * Initialize and return a cached Google Sheets API client.
 */
function getSheetsClient() {
  if (_sheetsClient) return _sheetsClient;

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  _sheetsClient = google.sheets({ version: 'v4', auth });
  return _sheetsClient;
}

const https = require('https');

// In-memory workbook cache to avoid repeated HTTP downloads
const _workbookCache = new Map();
const WORKBOOK_CACHE_TTL_MS = 30 * 1000; // 30 seconds cache in memory

function clearWorkbookCache() {
  _workbookCache.clear();
}

/**
 * Fetch a Google Sheet directly as XLSX buffer via Google Drive public export
 */
function fetchGoogleSheetXLSX(spreadsheetId, force = false) {
  if (!spreadsheetId || spreadsheetId === 'local' || spreadsheetId.includes('your_')) {
    return Promise.resolve(null);
  }

  if (!force) {
    const cached = _workbookCache.get(spreadsheetId);
    if (cached && (Date.now() - cached.timestamp < WORKBOOK_CACHE_TTL_MS)) {
      return Promise.resolve(cached.workbook);
    }
  }

  return new Promise((resolve) => {
    const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=xlsx`;
    
    function makeReq(targetUrl, redirectCount = 0) {
      if (redirectCount > 5) {
        return resolve(null);
      }
      const req = https.get(targetUrl, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return makeReq(res.headers.location, redirectCount + 1);
        }
        if (res.statusCode !== 200) {
          return resolve(null);
        }

        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => {
          try {
            const buffer = Buffer.concat(chunks);
            const xlsx = require('xlsx');
            const workbook = xlsx.read(buffer, { type: 'buffer' });
            _workbookCache.set(spreadsheetId, { workbook, timestamp: Date.now() });
            resolve(workbook);
          } catch (e) {
            resolve(null);
          }
        });
      });
      req.setTimeout(8000, () => {
        req.destroy();
        resolve(null);
      });
      req.on('error', () => resolve(null));
    }

    makeReq(url);
  });
}

/**
 * Extract rows from a loaded XLSX workbook sheet
 */
function readWorkbookSheet(workbook, sheetName, startRow = 1) {
  if (!workbook) return null;
  const xlsx = require('xlsx');
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return null;
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' });
  return rows.slice(startRow - 1);
}

/**
 * Read a range from Google Sheet (Drive live export / API) or local Excel fallback.
 */
async function readRange(spreadsheetId, range, forceRefresh = false) {
  const cleanRange = range.replace(/['"]/g, '');
  const targetId = spreadsheetId || (cleanRange.includes('Gastos') ? (process.env.SHEET_ID_GASTOS || DEFAULT_SHEET_ID_GASTOS) : (process.env.SHEET_ID_ORDENES || DEFAULT_SHEET_ID_ORDENES));

  // 1. Try Google Service Account API if configured
  if (hasValidGoogleCredentials()) {
    try {
      const sheets = getSheetsClient();
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: targetId,
        range,
        valueRenderOption: 'UNFORMATTED_VALUE',
        dateTimeRenderOption: 'SERIAL_NUMBER',
      });
      if (response.data.values && response.data.values.length > 0) {
        return response.data.values;
      }
    } catch (err) {
      console.warn(`[Google API Warning]: Falling back to live export for range ${range}`);
    }
  }

  // 2. Try live XLSX export from Google Drive (reads online Sheet live)
  if (targetId && targetId !== 'local' && !targetId.includes('your_')) {
    try {
      const wb = await fetchGoogleSheetXLSX(targetId, forceRefresh);
      if (wb) {
        const cleanSheetName = cleanRange.split('!')[0];
        const startRow = cleanSheetName.includes('Gastos') ? 1 : 3;
        const rows = readWorkbookSheet(wb, cleanSheetName, startRow);
        if (rows && rows.length > 0) {
          return rows;
        }
      }
    } catch (e) {
      // Fall through to local
    }
  }

  // 3. Fallback to local Excel file
  return readRangeFromLocal(range);
}

/**
 * Read multiple ranges via Google Sheets live export / batch API / local Excel fallback.
 */
async function readMultipleRanges(spreadsheetId, ranges, forceRefresh = false) {
  const targetId = spreadsheetId || process.env.SHEET_ID_ORDENES || DEFAULT_SHEET_ID_ORDENES;

  // 1. Try Google API
  if (hasValidGoogleCredentials()) {
    try {
      const sheets = getSheetsClient();
      const response = await sheets.spreadsheets.values.batchGet({
        spreadsheetId: targetId,
        ranges,
        valueRenderOption: 'UNFORMATTED_VALUE',
        dateTimeRenderOption: 'SERIAL_NUMBER',
      });
      const valueRanges = response.data.valueRanges || [];
      const result = {};
      valueRanges.forEach((vr, idx) => {
        const key = ranges[idx] || vr.range;
        result[key] = vr.values || [];
      });
      return result;
    } catch (err) {
      console.warn(`[Google API Batch Warning]: Falling back to live export`);
    }
  }

  // 2. Try live XLSX export from Google Drive
  if (targetId && targetId !== 'local' && !targetId.includes('your_')) {
    try {
      const wb = await fetchGoogleSheetXLSX(targetId, forceRefresh);
      if (wb) {
        const result = {};
        ranges.forEach(r => {
          const cleanSheetName = r.split('!')[0].replace(/['"]/g, '');
          const startRow = cleanSheetName.includes('Gastos') ? 1 : 3;
          result[r] = readWorkbookSheet(wb, cleanSheetName, startRow) || readRangeFromLocal(r);
        });
        return result;
      }
    } catch (e) {
      // Fall through
    }
  }

  // 3. Fallback to local
  const result = {};
  ranges.forEach(r => {
    result[r] = readRangeFromLocal(r);
  });
  return result;
}

function readRangeFromLocal(range) {
  const cleanRange = range.replace(/['"]/g, '');
  if (cleanRange.includes('SERVICIOS')) {
    return readLocalExcelSheet('1. FR-12-01-04 Ordenes de servicio de Inspeccion 2026.xlsx', 'SERVICIOS', 3);
  }
  if (cleanRange.includes('ID Lugar')) {
    return readLocalExcelSheet('1. FR-12-01-04 Ordenes de servicio de Inspeccion 2026.xlsx', 'ID Lugar', 3);
  }
  if (cleanRange.includes('ID Inspector')) {
    return readLocalExcelSheet('1. FR-12-01-04 Ordenes de servicio de Inspeccion 2026.xlsx', 'ID Inspector', 3);
  }
  if (cleanRange.includes('Código de Producto') || cleanRange.includes('Codigo de Producto')) {
    return readLocalExcelSheet('1. FR-12-01-04 Ordenes de servicio de Inspeccion 2026.xlsx', 'Código de Producto', 3);
  }
  if (cleanRange.includes('Gastos Operativos GO 2026') || cleanRange.includes('Gastos Operativos')) {
    return readLocalExcelSheet('4. Rendicion de operativos 2026.xlsx', 'Gastos Operativos GO 2026', 1);
  }
  return [];
}


/**
 * Clean text from leading numeric code prefixes (e.g. "01 - Lima" -> "LIMA")
 */
function cleanLabel(text) {
  if (!text) return '';
  return String(text)
    .replace(/^[\d\s\.\-_]+/, '')
    .trim()
    .toUpperCase();
}

/**
 * Parse ID Lugar sheet into a dynamic mapping object { [codigo]: "LIMA", ... }
 */
function parseIdLugar(rows) {
  const map = {};
  if (!rows || rows.length === 0) return map;

  for (const row of rows) {
    if (!row || row.length < 2) continue;
    // Row might have columns: [Item, Código, Descripción] or [Código, Descripción]
    let codigo = '';
    let descripcion = '';

    if (row.length >= 3 && !isNaN(parseInt(row[1], 10))) {
      codigo = String(row[1]).trim();
      descripcion = String(row[2] || '').trim();
    } else {
      codigo = String(row[0] || '').trim();
      descripcion = String(row[1] || '').trim();
    }

    if (!codigo || codigo === 'Lugar' || codigo === 'Cdigo' || codigo === 'Código') continue;

    const nombreLugar = cleanLabel(descripcion) || cleanLabel(codigo);
    if (nombreLugar && nombreLugar !== '-') {
      map[codigo] = nombreLugar;
      // Also map unpadded integer if applicable
      const num = parseInt(codigo, 10);
      if (!isNaN(num)) {
        map[String(num)] = nombreLugar;
        map[String(num).padStart(2, '0')] = nombreLugar;
      }
    }
  }
  return map;
}

/**
 * Parse ID Inspector sheet into a dynamic mapping object { [codigo]: "NOMBRE INSPECTOR", ... }
 */
function parseIdInspector(rows) {
  const map = {};
  if (!rows || rows.length === 0) return map;

  for (const row of rows) {
    if (!row || row.length === 0) continue;

    for (let i = 0; i < row.length; i++) {
      const val = String(row[i] || '').trim();
      if (!val || val.toLowerCase() === 'item' || val.toLowerCase().includes('código') || val.toLowerCase().includes('codigo') || val.toLowerCase() === 'inspector' || val === 'ID Inspector') continue;

      // Detect numeric codes (e.g. 1 to 3 digits)
      if (/^\d{1,3}$/.test(val)) {
        const codigo = val;
        let inspector = '';
        for (let j = i + 1; j < row.length; j++) {
          const nextVal = String(row[j] || '').trim();
          if (nextVal && nextVal !== '-' && !/^\d+$/.test(nextVal)) {
            inspector = nextVal;
            break;
          }
        }

        if (codigo && inspector) {
          const nombre = cleanLabel(inspector);
          if (nombre && nombre !== '-' && !nombre.includes('SYSTEM.XML')) {
            map[codigo] = nombre;
            const num = parseInt(codigo, 10);
            if (!isNaN(num)) {
              map[String(num)] = nombre;
              map[String(num).padStart(2, '0')] = nombre;
              map[String(num).padStart(3, '0')] = nombre;
            }
          }
        }
      }
    }
  }
  return map;
}

/**
 * Parse Código de Producto sheet
 */
function parseCodigoProducto(rows) {
  const map = {};
  if (!rows || rows.length === 0) return map;

  for (const row of rows) {
    if (!row || row.length < 2) continue;
    const codigo = String(row[0] || '').trim().toUpperCase();
    const desc = String(row[1] || '').trim();
    if (!codigo || codigo === 'CÓDIGO' || codigo === 'PRODUCTO') continue;
    map[codigo] = desc.replace(/^[A-Z0-9\s\.\-_]+/, '').trim() || desc;
  }
  return map;
}

/**
 * Helper to validate that a client name has real content (excludes empty, '-', dashes, or whitespace).
 */
function isValidCliente(cliente) {
  if (!cliente) return false;
  const str = String(cliente).trim().replace(/[\u200B-\u200D\uFEFF]/g, '');
  if (!str || str === '-' || str === '—' || str === '–' || str.toLowerCase() === 'n/a') return false;
  return /[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]/.test(str);
}

/**
 * Clean client string removing zero-width characters and normalizing whitespace
 */
function cleanCliente(text) {
  if (!text) return '';
  return String(text)
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Convert Excel serial date number to ISO date string.
 * Excel epoch is 1900-01-01 (with the erroneous 1900-02-29).
 */
function excelDateToISO(serial) {
  if (!serial || typeof serial !== 'number' || serial < 1) return null;
  // Excel epoch offset: 25569 days between 1900-01-01 and 1970-01-01
  const utcDays = serial - 25569;
  const date = new Date(utcDays * 86400000);
  return date.toISOString().split('T')[0];
}

/**
 * Parse the Órdenes de Servicio sheet into structured objects.
 * Headers are in row 3 (index 0 of the returned data if range starts at A3).
 * Data starts from row 4.
 * Filters out records without a valid client name (skips '-' and empty).
 */
function parseOrdenes(rows) {
  if (!rows || rows.length < 2) return [];

  // First row is headers
  const results = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const cotizacion = String(row[0] || '').trim();
    const rawActa = row[1];
    const rawCliente = row[8];
    const nroInspeccion = row[4] || null;

    // Filter only records with valid client info (no '-' or empty)
    if (!isValidCliente(rawCliente)) continue;

    // Must have at least an acta, a cotizacion, or an inspeccion number
    if (!rawActa && !cotizacion && !nroInspeccion) continue;

    const nroActa = String(rawActa || (nroInspeccion ? `26-${nroInspeccion}` : 'S/N')).trim();
    const cliente = cleanCliente(rawCliente);

    const rawObs = String(row[11] || '').trim();
    let acreditacion = 'NO ESPECIFICADO';
    const uObs = rawObs.toUpperCase();
    if (uObs.includes('NO ACREDITADO') || uObs.includes('NO-ACREDITADO')) {
      acreditacion = 'NO ACREDITADO';
    } else if (uObs.includes('ACREDITADO')) {
      acreditacion = 'ACREDITADO';
    } else if (uObs.includes('CANCELADO')) {
      acreditacion = 'CANCELADO';
    } else if (uObs.includes('TESTIFICACION') || uObs.includes('TESTIFICACIÓN')) {
      acreditacion = 'TESTIFICACIÓN';
    } else if (uObs.includes('REPROGRAMADO')) {
      acreditacion = 'REPROGRAMADO';
    } else if (uObs.includes('AMPLIACION') || uObs.includes('AMPLIACIÓN')) {
      acreditacion = 'AMPLIACIÓN';
    } else if (rawObs) {
      acreditacion = rawObs;
    }

    results.push({
      cotizacion,
      nroActa,
      anio: row[2] || null,
      lugarCodigo: String(row[3] || '').trim(),
      nroInspeccion,
      codigoProducto: String(row[5] || '').trim(),
      tipoInspeccion: String(row[6] || '').trim(),
      nroInspector: String(row[7] || '').trim(),
      cliente,
      descripcion: String(row[9] || '').trim(), // Texto libre sin diccionario
      fechaInspeccion: excelDateToISO(row[10]),
      fechaInspeccionRaw: row[10] || null,
      observaciones: rawObs,
      acreditacion,
      fechaTentativa: excelDateToISO(row[17]),
      fechaLaboratorio: excelDateToISO(row[18]),
      fechaCertificado: excelDateToISO(row[20]),
      codigoDocumento: String(row[22] || '').trim(),
    });
  }
  return results;
}

/**
 * Parse the Gastos Operativos GO sheet into structured objects.
 * Headers are in row 1 (index 0). Data starts from row 2.
 * Accepts rows that have a valid GO and either a valid client or valid cotizacion.
 */
function parseGastos(rows) {
  if (!rows || rows.length < 2) return [];

  const results = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const rawCliente = row[0];
    const go = String(row[1] || '').trim();
    const cotizacion = String(row[2] || '').trim();

    if (!go) continue;

    const hasValidClient = isValidCliente(rawCliente);
    // If client is missing/invalid but cotizacion is valid, still include it
    if (!hasValidClient && !cotizacion) continue;

    const cliente = hasValidClient ? cleanCliente(rawCliente) : 'SIN CLIENTE';

    results.push({
      cliente,
      go,
      cotizacion,
      unidadNegocio: String(row[3] || '').trim(),
      provincia: String(row[4] || '').trim().toUpperCase(),
      tipoServicio: String(row[5] || '').trim(),
      fechaServicio: excelDateToISO(row[6]),
      fechaServicioRaw: row[6] || null,
      mesRequerido: String(row[7] || '').trim().toUpperCase(),
      pasajes: parseFloat(row[8]) || 0,
      movilidad: parseFloat(row[9]) || 0,
      envioMateriales: parseFloat(row[10]) || 0,
      viaticos: parseFloat(row[11]) || 0,
      otros: parseFloat(row[12]) || 0,
      goTotalSolicitado: parseFloat(row[13]) || 0,
      goReal: parseFloat(row[14]) || 0,
      depositadoA: String(row[15] || '').trim().toUpperCase(),
      fechaDeposito: excelDateToISO(row[16]),
    });
  }
  return results;
}

module.exports = {
  readRange,
  readMultipleRanges,
  parseOrdenes,
  parseGastos,
  parseIdLugar,
  parseIdInspector,
  parseCodigoProducto,
  excelDateToISO,
  cleanLabel,
  isValidCliente,
  cleanCliente,
  hasLocalExcelFiles,
  getLocalExcelMTime,
  clearWorkbookCache,
  fetchGoogleSheetXLSX,
  DEFAULT_SHEET_ID_ORDENES,
  DEFAULT_SHEET_ID_GASTOS,
};



