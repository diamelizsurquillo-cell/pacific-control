/**
 * Diccionarios de mapeo para Pacific Control Dashboard.
 * Basados en análisis cruzado de los datos reales de las hojas Excel.
 */

// Código de Lugar (hoja Órdenes col D) → Nombre de Provincia
const MAPA_LUGAR = {
  '01': 'LIMA',
  '1':  'LIMA',
  '02': 'LURÍN',
  '41': 'CHICLAYO',
  '43': 'PIURA',
  '52': 'TACNA',
  '61': 'PUCALLPA',
  '65': 'CUZCO',
  '66': 'YURIMAGUAS',
  '73': 'CHIMBOTE',
  '82': 'MADRE DE DIOS',
  '84': 'PAITA',
  '204': 'CALLAO',
};

// Código de Inspector (hoja Órdenes col H) → Nombre
// Catálogo oficial según pestaña 'ID Inspector'
const MAPA_INSPECTOR = {
  '01': 'EDU QUISPE',
  '1':  'EDU QUISPE',
  '02': 'CARLOS JULCA',
  '2':  'CARLOS JULCA',
  '03': 'OSCAR AGUILAR',
  '3':  'OSCAR AGUILAR',
  '05': 'ERNESTO SANDOVAL',
  '5':  'ERNESTO SANDOVAL',
  '06': 'JUNIOR NIMA',
  '6':  'JUNIOR NIMA',
  '08': 'SAMUEL PALOMINO',
  '8':  'SAMUEL PALOMINO',
  '103': 'EDGAR VELASQUEZ',
  '104': 'SANDRA CHAVEZ',
  '105': 'REMIGIO RIVAS',
  '108': 'HENRRY HUASASQUICHE',
  '114': 'OSCAR CARRASCO',
  '116': 'JAVIER TABOADA',
  '118': 'SIDNEY DAVALOS',
  '119': 'JIMMY MORAN',
  '120': 'IVAN PIZARRO',
  '123': 'JUAN QUILICHE',
};

// Código de Producto (col F) → Nombre legible
const MAPA_PRODUCTO = {
  'HD': 'Hidrobiológico / Congelado',
  'CO': 'Conserva',
  'HP': 'Harina de Pescado',
  'AP': 'Alimento / Agroalimento',
  'CA': 'Certificación / Auditoría',
  'PO': 'Aceite de Pescado',
  'OT': 'Otros',
};

// Coordenadas geográficas de cada provincia (para Leaflet)
const COORDS_PROVINCIA = {
  'LIMA':          { lat: -12.0464, lng: -77.0428 },
  'CALLAO':        { lat: -12.0565, lng: -77.1185 },
  'LURÍN':         { lat: -12.2833, lng: -76.8681 },
  'TACNA':         { lat: -18.0146, lng: -70.2536 },
  'CHIMBOTE':      { lat: -9.0746,  lng: -78.5936 },
  'PIURA':         { lat: -5.1945,  lng: -80.6328 },
  'PAITA':         { lat: -5.0892,  lng: -81.1145 },
  'SULLANA':       { lat: -4.9036,  lng: -80.6853 },
  'PISCO':         { lat: -13.7100, lng: -76.2033 },
  'MADRE DE DIOS': { lat: -12.5933, lng: -69.1891 },
  'CHILCA':        { lat: -12.5219, lng: -76.7369 },
  'HUARAL':        { lat: -11.4953, lng: -77.2078 },
  'CUZCO':         { lat: -13.5320, lng: -71.9675 },
  'PUCALLPA':      { lat: -8.3791,  lng: -74.5539 },
  'CHICLAYO':      { lat: -6.7714,  lng: -79.8409 },
  'LAMBAYEQUE':    { lat: -6.7011,  lng: -79.9081 },
  'YURIMAGUAS':    { lat: -5.8979,  lng: -76.0831 },
};

// Meses en español → número (para ordenamiento)
const MESES_ORDEN = {
  'ENERO': 1, 'FEBRERO': 2, 'MARZO': 3, 'ABRIL': 4,
  'MAYO': 5, 'JUNIO': 6, 'JULIO': 7, 'AGOSTO': 8,
  'SEPTIEMBRE': 9, 'OCTUBRE': 10, 'NOVIEMBRE': 11, 'DICIEMBRE': 12,
};

// Extraer sector desde la descripción del servicio (texto libre)
function extraerSector(descripcion) {
  const desc = (descripcion || '').toUpperCase();
  if (desc.includes('CONGELADO'))  return 'CONGELADO';
  if (desc.includes('CONSERVA'))   return 'CONSERVA';
  if (desc.includes('HARINA'))     return 'HARINA';
  if (desc.includes('ALIMENTO') || desc.includes('AGRO')) return 'ALIMENTOS';
  if (desc.includes('ACEITE'))     return 'ACEITE';
  if (desc.includes('EMBARQUE') || desc.includes('AFORO')) return 'EMBARQUE / AFORO';
  if (desc.includes('SANITARIO') || desc.includes('HIGIENE') || desc.includes('SUPERFICIE')) return 'HIGIENE / SANITARIO';
  if (desc.includes('AGUA') || desc.includes('EFLUENTE')) return 'AGUA / AMBIENTAL';
  if (desc.includes('QUIMICO'))    return 'QUÍMICO';
  return 'OTROS';
}

// Resolver inspector cuando hay múltiples códigos (ej: "114/119", "104/114/120", "103 / 06", "05/06/120")
function resolverInspectores(codigo, mapaDinamico = {}) {
  if (!codigo || codigo === '-' || codigo === '0' || codigo === 'Sin asignar') return ['Sin asignar'];

  // Split by slash (/), comma (,), semicolon (;), and remove leading/trailing spaces
  const rawCodes = String(codigo)
    .split(/[\/,;]+/)
    .map(c => c.trim())
    .filter(c => c && c !== '-' && c !== '0');

  if (rawCodes.length === 0) return ['Sin asignar'];

  const resolved = rawCodes.map(c => {
    // 1. Direct lookup in dynamic sheet map or static fallback
    if (mapaDinamico[c]) return mapaDinamico[c];
    if (MAPA_INSPECTOR[c]) return MAPA_INSPECTOR[c];

    // 2. Numeric lookup with zero-padding (e.g. 6 -> 06 -> 006)
    const num = parseInt(c, 10);
    if (!isNaN(num)) {
      const numStr = String(num);
      const pad2 = numStr.padStart(2, '0');
      const pad3 = numStr.padStart(3, '0');

      if (mapaDinamico[numStr]) return mapaDinamico[numStr];
      if (MAPA_INSPECTOR[numStr]) return MAPA_INSPECTOR[numStr];
      if (mapaDinamico[pad2]) return mapaDinamico[pad2];
      if (MAPA_INSPECTOR[pad2]) return MAPA_INSPECTOR[pad2];
      if (mapaDinamico[pad3]) return mapaDinamico[pad3];
      if (MAPA_INSPECTOR[pad3]) return MAPA_INSPECTOR[pad3];
    }

    return `Inspector ${c}`;
  });

  // Deduplicate in case same inspector code was repeated
  return [...new Set(resolved)];
}

// Resolver lugar con mapa dinámico y fallback
function resolverLugar(codigo, mapaDinamico = {}) {
  if (!codigo || codigo === '-') return 'DESCONOCIDO';
  const c = String(codigo).trim();
  return mapaDinamico[c] || MAPA_LUGAR[c] || `LUGAR ${c}`;
}

// Derive month name from an ISO date string (e.g. "2026-01-15" → "ENERO")
const MESES_NOMBRE = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE',
];
function mesDesdeISO(fechaISO) {
  if (!fechaISO || typeof fechaISO !== 'string') return '';
  const parts = fechaISO.split('-');
  const monthIndex = parseInt(parts[1], 10) - 1;
  if (isNaN(monthIndex) || monthIndex < 0 || monthIndex > 11) return '';
  return MESES_NOMBRE[monthIndex];
}

module.exports = {
  MAPA_LUGAR,
  MAPA_INSPECTOR,
  MAPA_PRODUCTO,
  COORDS_PROVINCIA,
  MESES_ORDEN,
  extraerSector,
  resolverInspectores,
  resolverLugar,
  mesDesdeISO,
};

