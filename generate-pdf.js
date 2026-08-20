/**
 * generate-pdf.js
 * Genera un PDF informativo profesional sobre la plataforma Dashboard Pacific Control
 * Usa el logo de Canal Ejecutivo y su paleta de colores azul (#1A73E8)
 * 
 * Ejecutar:  node generate-pdf.js
 * Salida:    ./INFORME_PLATAFORMA_PACIFIC_CONTROL.pdf
 */

const { jsPDF } = require('jspdf');
const fs = require('fs');
const path = require('path');

// ─── Color Palette (Canal Ejecutivo Blue) ───
const BLUE      = [26, 115, 232];   // #1A73E8  — primary
const BLUE_DARK = [13, 71, 161];    // #0D47A1  — dark accent
const BLUE_LIGHT= [66, 133, 244];   // #4285F4  — lighter accent
const WHITE     = [255, 255, 255];
const GRAY_50   = [248, 249, 250];
const GRAY_100  = [241, 243, 244];
const GRAY_600  = [95, 99, 104];
const GRAY_800  = [32, 33, 36];
const RED_ACCENT= [211, 47, 47];    // for Pacific Control red accent

// ─── Page dimensions (A4) ───
const W = 210;
const H = 297;
const MARGIN = 20;
const CONTENT_W = W - MARGIN * 2;

// ─── Helpers ───
function drawRect(doc, x, y, w, h, color, radius) {
  doc.setFillColor(...color);
  if (radius) {
    doc.roundedRect(x, y, w, h, radius, radius, 'F');
  } else {
    doc.rect(x, y, w, h, 'F');
  }
}

function drawLine(doc, x1, y1, x2, y2, color, width) {
  doc.setDrawColor(...color);
  doc.setLineWidth(width || 0.5);
  doc.line(x1, y1, x2, y2);
}

function addText(doc, text, x, y, { size = 10, color = GRAY_800, font = 'helvetica', style = 'normal', maxWidth = CONTENT_W, align = 'left' } = {}) {
  doc.setFont(font, style);
  doc.setFontSize(size);
  doc.setTextColor(...color);
  if (align === 'center') {
    doc.text(text, x, y, { align: 'center', maxWidth });
  } else if (align === 'right') {
    doc.text(text, x, y, { align: 'right', maxWidth });
  } else {
    doc.text(text, x, y, { maxWidth });
  }
}

function addWrappedText(doc, text, x, y, { size = 10, color = GRAY_800, style = 'normal', maxWidth = CONTENT_W, lineHeight = 5 } = {}) {
  doc.setFont('helvetica', style);
  doc.setFontSize(size);
  doc.setTextColor(...color);
  const lines = doc.splitTextToSize(text, maxWidth);
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
}

// ─── Main ───
function generatePDF() {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  // Load logo
  const logoPath = path.join(__dirname, 'LOGO CANAL EJECUTIVO.png');
  let logoData = null;
  if (fs.existsSync(logoPath)) {
    const logoBuffer = fs.readFileSync(logoPath);
    logoData = 'data:image/png;base64,' + logoBuffer.toString('base64');
  }

  // Load Pacific Control logo
  const pcLogoPath = path.join(__dirname, 'LOGO-COLORES.png');
  let pcLogoData = null;
  if (fs.existsSync(pcLogoPath)) {
    const pcBuffer = fs.readFileSync(pcLogoPath);
    pcLogoData = 'data:image/png;base64,' + pcBuffer.toString('base64');
  }

  // ═══════════════════════════════════════════
  // PAGE 1 — PORTADA
  // ═══════════════════════════════════════════

  // Full blue header band
  drawRect(doc, 0, 0, W, 120, BLUE);

  // Darker accent stripe at top
  drawRect(doc, 0, 0, W, 6, BLUE_DARK);

  // Logo Canal Ejecutivo
  if (logoData) {
    // White background badge for logo
    drawRect(doc, MARGIN, 18, 65, 22, WHITE, 4);
    doc.addImage(logoData, 'PNG', MARGIN + 4, 20, 57, 18);
  }

  // Tag
  addText(doc, 'Desarrollado por Canal Ejecutivo', MARGIN + 2, 48, { size: 8, color: [200, 220, 255], style: 'italic' });

  // Main title
  addText(doc, 'DASHBOARD DE', MARGIN, 70, { size: 30, color: WHITE, style: 'bold' });
  addText(doc, 'OPERACIONES', MARGIN, 83, { size: 30, color: WHITE, style: 'bold' });
  addText(doc, 'EN VIVO', MARGIN, 96, { size: 30, color: WHITE, style: 'bold' });

  // Right side — Pacific Control logo
  if (pcLogoData) {
    drawRect(doc, W - MARGIN - 60, 62, 58, 38, WHITE, 6);
    doc.addImage(pcLogoData, 'PNG', W - MARGIN - 57, 65, 52, 32);
  }

  // Subtitle bar
  drawRect(doc, 0, 108, W, 12, BLUE_DARK);
  addText(doc, 'PACIFIC CONTROL S.A.C.  |  Guia Informativa de la Plataforma  |  2026', W / 2, 116, { size: 10, color: WHITE, style: 'bold', align: 'center' });

  // ─── Section: ¿Qué es? ───
  let y = 135;

  addText(doc, 'QUE ES ESTA PLATAFORMA?', MARGIN, y, { size: 16, color: BLUE, style: 'bold' });
  drawLine(doc, MARGIN, y + 2, MARGIN + 75, y + 2, BLUE, 1);
  y += 12;

  y = addWrappedText(doc, 
    'El Dashboard de Operaciones en Vivo es una plataforma web desarrollada por Canal Ejecutivo que permite a Pacific Control S.A.C. visualizar, monitorear y analizar en tiempo real toda su operacion de inspecciones y servicios a nivel nacional.',
    MARGIN, y, { size: 11, color: GRAY_800, maxWidth: CONTENT_W, lineHeight: 5.5 });
  y += 5;

  y = addWrappedText(doc,
    'La plataforma se sincroniza automaticamente con los archivos Excel alojados en Google Drive, eliminando la necesidad de actualizaciones manuales y proporcionando informacion siempre vigente.',
    MARGIN, y, { size: 11, color: GRAY_800, maxWidth: CONTENT_W, lineHeight: 5.5 });
  y += 10;

  // ─── Section: Indicadores de la Plataforma ───
  addText(doc, 'INDICADORES DE LA PLATAFORMA', MARGIN, y, { size: 15, color: BLUE, style: 'bold' });
  drawLine(doc, MARGIN, y + 2, MARGIN + 85, y + 2, BLUE, 1);
  y += 9;

  addWrappedText(doc, 'La plataforma cuenta con los siguientes indicadores operativos y de gestion en tiempo real:', MARGIN, y, { size: 9.5, color: GRAY_800, maxWidth: CONTENT_W, lineHeight: 4.5 });
  y += 7;

  // --- KPI Cards indicator list ---
  addText(doc, 'TARJETAS KPI (Panel Superior)', MARGIN + 4, y, { size: 10, color: BLUE_DARK, style: 'bold' });
  y += 6;

  const kpiIndicators = [
    { num: '1', name: 'Total Ordenes de Inspeccion', val: '525 servicios', desc: 'Total de actas y cotizaciones registradas en el periodo 2026.' },
    { num: '2', name: 'Clientes Unicos Atendidos', val: '79 empresas', desc: 'Cartera comercial activa con al menos un servicio registrado.' },
    { num: '3', name: 'Servicios Acreditados vs No Acreditados', val: '322 (61.3%) / 185 (35.2%)', desc: 'Inspecciones bajo alcance de acreditacion vs no acreditadas.' },
    { num: '4', name: 'Zonas de Muestreo (Sedes)', val: '20 sedes / provincias', desc: 'Cobertura nacional: Lima, Paita, Chimbote, Callao, Pisco, etc.' },
    { num: '5', name: 'Gasto Operativo Ejecutado (GO Real)', val: 'S/ 92,103.25', desc: 'Desembolso real rendido en viaticos, pasajes y movilidad.' },
    { num: '6', name: 'Monto Solicitado (Presupuesto GO)', val: 'S/ 99,745.70', desc: 'Presupuesto solicitado (-7.66% ahorro / S/ 7,642.45 no gastados).' },
  ];

  for (const kpi of kpiIndicators) {
    drawRect(doc, MARGIN + 4, y - 3, CONTENT_W - 8, 10, GRAY_50, 2);
    // Number badge
    drawRect(doc, MARGIN + 6, y - 2, 4.5, 4.5, BLUE, 2.25);
    addText(doc, kpi.num, MARGIN + 7.3, y + 1.2, { size: 6.5, color: WHITE, style: 'bold' });
    addText(doc, kpi.name, MARGIN + 13, y + 1.2, { size: 8.5, color: GRAY_800, style: 'bold' });
    addText(doc, kpi.val, W - MARGIN - 4, y + 1.2, { size: 8.5, color: BLUE, style: 'bold', align: 'right' });
    addText(doc, kpi.desc, MARGIN + 13, y + 5.2, { size: 7, color: GRAY_600 });
    y += 11.5;
  }

  y += 2;

  // --- Charts indicator list ---
  addText(doc, 'GRAFICOS ANALITICOS Y MODULOS', MARGIN + 4, y, { size: 10, color: BLUE_DARK, style: 'bold' });
  y += 6;

  const chartIndicators = [
    { num: '7', name: 'Evolucion Mensual de Servicios', type: 'Grafico de Lineas (Tendencia 2026)' },
    { num: '8', name: 'Carga por Inspector (1, 2, 3 a +100)', type: 'Barras Horizontales + Frecuencia' },
    { num: '9', name: 'Acreditacion (Acreditado vs No Acreditado)', type: 'Grafico de Dona (61.3% vs 35.2%)' },
    { num: '10', name: 'Zonas de Muestreo / Sedes Principales', type: 'Barras (Lima, Paita, Chimbote...)' },
    { num: '11', name: 'Distribucion por Sector Industrial', type: 'Grafico de Dona (Congelado, Harina...)' },
    { num: '12', name: 'Gastos por Unidad de Negocio', type: 'Barras Verticales en Soles (S/)' },
    { num: '13', name: 'Mapa Operativo Nacional (Perú)', type: 'Georreferenciacion Leaflet con Popups' },
    { num: '14', name: 'Tabla Detallada con Acreditacion', type: 'Paginacion, Busqueda y Exportacion CSV' },
  ];

  for (const ch of chartIndicators) {
    drawRect(doc, MARGIN + 4, y - 2.5, CONTENT_W - 8, 7, GRAY_50, 2);
    drawRect(doc, MARGIN + 6, y - 1.8, 4.5, 4.5, BLUE_LIGHT, 2.25);
    addText(doc, ch.num, MARGIN + 7.1, y + 1.2, { size: 6.5, color: WHITE, style: 'bold' });
    addText(doc, ch.name, MARGIN + 13, y + 1.2, { size: 8, color: GRAY_800, style: 'bold' });
    addText(doc, ch.type, W - MARGIN - 4, y + 1.2, { size: 7.5, color: GRAY_600, style: 'italic', align: 'right' });
    y += 8.5;
  }

  // Footer band
  drawRect(doc, 0, H - 16, W, 16, BLUE_DARK);
  addText(doc, 'Canal Ejecutivo  |  Soluciones Tecnologicas Empresariales  |  www.canalejecutivo.pe', W / 2, H - 7, { size: 8, color: WHITE, align: 'center' });
  addText(doc, 'Pagina 1 de 3', W - MARGIN, H - 7, { size: 7, color: [180, 200, 240], align: 'right' });

  // ═══════════════════════════════════════════
  // PAGE 2 — KPIs
  // ═══════════════════════════════════════════
  doc.addPage();

  // Header band
  drawRect(doc, 0, 0, W, 30, BLUE);
  drawRect(doc, 0, 0, W, 4, BLUE_DARK);
  if (logoData) {
    drawRect(doc, MARGIN - 2, 8, 42, 16, WHITE, 3);
    doc.addImage(logoData, 'PNG', MARGIN, 9.5, 38, 13);
  }
  addText(doc, 'DETALLE DE INDICADORES CLAVE (KPIs)', W / 2 + 10, 20, { size: 14, color: WHITE, style: 'bold', align: 'center' });

  y = 40;

  // ─── KPI Cards ───
  addText(doc, 'INDICADORES OPERATIVOS Y DE CALIDAD', MARGIN, y, { size: 13, color: BLUE, style: 'bold' });
  drawLine(doc, MARGIN, y + 2, MARGIN + 90, y + 2, BLUE, 1);
  y += 10;

  const kpis = [
    { value: '525', label: 'Total Ordenes de Inspeccion', desc: 'Cantidad total de servicios operativos registrados en 2026. Mide el volumen general de operaciones.', color: BLUE },
    { value: '322 vs 185', label: 'Servicios Acreditados vs No Acreditados', desc: '322 servicios (61.3%) bajo alcance de acreditacion INACAL vs 185 servicios (35.2%) no acreditados y 18 otros (cancelados/testificacion).', color: [22, 163, 74] },
    { value: '20 Sedes', label: 'Zonas de Muestreo (Sedes de Operacion)', desc: 'Concentracion geografica: Lima (297 servicios / 56.6%), Paita (101 / 19.2%), Chimbote (57 / 10.9%), Callao (45 / 8.6%), Chancay, Pisco, etc.', color: [2, 132, 199] },
    { value: '79', label: 'Clientes Unicos Atendidos', desc: 'Empresas distintas con servicios atendidos. Refleja la diversificacion de la cartera comercial.', color: BLUE_LIGHT },
    { value: 'S/ 92,103.25', label: 'Gasto Operativo Ejecutado (GO Real)', desc: 'Rendicion total de viaticos, movilidad y materiales. Representa el desembolso operativo real.', color: [217, 119, 6] },
    { value: '-7.66% Ahorro', label: 'Desviacion Presupuestal (Solicitado vs Real)', desc: 'Presupuesto solicitado: S/ 99,745.70 vs Real: S/ 92,103.25. Se genero un ahorro neto de S/ 7,642.45.', color: [126, 34, 206] },
  ];

  for (const kpi of kpis) {
    drawRect(doc, MARGIN, y - 3, CONTENT_W, 23, WHITE, 3);
    drawRect(doc, MARGIN, y - 3, 3.5, 23, kpi.color, 1.5);
    doc.setDrawColor(...GRAY_100);
    doc.setLineWidth(0.3);
    doc.roundedRect(MARGIN, y - 3, CONTENT_W, 23, 3, 3, 'S');

    addText(doc, kpi.value, MARGIN + 8, y + 2, { size: 14, color: kpi.color, style: 'bold' });
    addText(doc, kpi.label, MARGIN + 8, y + 8, { size: 9, color: GRAY_800, style: 'bold' });
    addWrappedText(doc, kpi.desc, MARGIN + 8, y + 13, { size: 7.5, color: GRAY_600, maxWidth: CONTENT_W - 14, lineHeight: 3.4 });
    
    y += 26.5;
  }

  // ─── Inspector frequency breakdown ───
  y += 2;
  addText(doc, 'CANTIDAD DE SERVICIOS POR INSPECTOR (FRECUENCIA OPERATIVA)', MARGIN, y, { size: 12, color: BLUE_DARK, style: 'bold' });
  drawLine(doc, MARGIN, y + 2, MARGIN + 120, y + 2, BLUE, 1);
  y += 8;

  const inspectorTiers = [
    ['Alta Carga (> 50 servicios)', '4 inspectores', 'Junior Nima (159), Edgar Velasquez (144), Jimmy Moran (98), Ivan Pizarro (92).'],
    ['Carga Media (11 a 50 servicios)', '5 inspectores', 'Samuel Palomino (45), Sandra Chavez (36), Ernesto Sandoval (36), Henrry Huasasquiche (15), Oscar Carrasco (15).'],
    ['Servicios Puntuales (1 a 3 servicios)', '5 inspectores', 'Oscar Aguilar (3 servicios), Edu Quispe (2 servicios), Inspector 107 (2 servicios), Inspector 96 (1 servicio), Inspector 100 (1 servicio).'],
  ];

  for (const [tier, count, names] of inspectorTiers) {
    drawRect(doc, MARGIN, y - 2.5, CONTENT_W, 12, GRAY_50, 2);
    addText(doc, '- ' + tier + ': ', MARGIN + 3, y + 1.2, { size: 8, color: GRAY_800, style: 'bold' });
    addText(doc, count, MARGIN + 3 + doc.getTextWidth('- ' + tier + ': '), y + 1.2, { size: 8, color: BLUE, style: 'bold' });
    addWrappedText(doc, names, MARGIN + 6, y + 5.5, { size: 7.2, color: GRAY_600, maxWidth: CONTENT_W - 10, lineHeight: 3.2 });
    y += 14.5;
  }

  // Footer
  drawRect(doc, 0, H - 16, W, 16, BLUE_DARK);
  addText(doc, 'Canal Ejecutivo  |  Soluciones Tecnologicas Empresariales  |  www.canalejecutivo.pe', W / 2, H - 7, { size: 8, color: WHITE, align: 'center' });
  addText(doc, 'Pagina 2 de 3', W - MARGIN, H - 7, { size: 7, color: [180, 200, 240], align: 'right' });

  // ═══════════════════════════════════════════
  // PAGE 3 — Gráficos y Detalles
  // ═══════════════════════════════════════════
  doc.addPage();

  // Header
  drawRect(doc, 0, 0, W, 30, BLUE);
  drawRect(doc, 0, 0, W, 4, BLUE_DARK);
  if (logoData) {
    drawRect(doc, MARGIN - 2, 8, 42, 16, WHITE, 3);
    doc.addImage(logoData, 'PNG', MARGIN, 9.5, 38, 13);
  }
  addText(doc, 'VISUALIZACIONES Y MODULOS ANALITICOS', W / 2 + 10, 20, { size: 14, color: WHITE, style: 'bold', align: 'center' });

  y = 38;

  // ─── Charts & Modules Description ───
  addText(doc, 'GRAFICOS Y MODULOS DEL DASHBOARD', MARGIN, y, { size: 13, color: BLUE, style: 'bold' });
  drawLine(doc, MARGIN, y + 2, MARGIN + 90, y + 2, BLUE, 1);
  y += 9;

  const modules = [
    { 
      title: 'Evolucion Mensual de Servicios vs Gasto', 
      desc: 'Grafico de barras y lineas que combina el volumen mensual de ordenes y los desembolsos reales ejecutados, permitiendo evaluar la estacionalidad del negocio.',
      details: 'Line & Bar Chart  |  Enero a Diciembre 2026' 
    },
    { 
      title: 'Carga Operativa por Inspector (Ranking y Frecuencia)', 
      desc: 'Grafico de barras horizontales con el volumen de servicios asignados a cada inspector. Permite monitorear inspectores de alta carga (>50 serv.) y servicios puntuales (1, 2 o 3 serv.).',
      details: 'Horizontal Bar Chart  |  Top Inspectores' 
    },
    { 
      title: 'Servicios Acreditados vs No Acreditados', 
      desc: 'Grafico de dona que compara la cantidad y proporcion de servicios bajo alcance de acreditacion (322 / 61.3%) frente a no acreditados (185 / 35.2%) y cancelados/testificacion.',
      details: 'Doughnut Chart  |  Acreditados vs No Acreditados' 
    },
    { 
      title: 'Zonas de Muestreo (Sedes Principales)', 
      desc: 'Grafico de barras que clasifica la concentracion operativa por localidad de muestreo: Lima (297), Paita (101), Chimbote (57), Callao (45), Chancay, Pisco, etc.',
      details: 'Bar Chart  |  Top Sedes de Muestreo' 
    },
    { 
      title: 'Distribucion por Sector Operativo', 
      desc: 'Grafico de dona por rubro industrial: Congelado (200), Harina de Pescado (137), Conserva (111), Alimentos (58), Embarques y Quimicos (19).',
      details: 'Doughnut Chart  |  7 Sectores Industriales' 
    },
    { 
      title: 'Gastos por Unidad de Negocio', 
      desc: 'Grafico de barras verticales que compara el gasto operativo ejecutado (GO Real) entre las distintas unidades de negocio de la empresa.',
      details: 'Bar Chart  |  Montos en Soles (S/)' 
    },
    { 
      title: 'Mapa Nacional Interactivo (Perú)', 
      desc: 'Georreferenciacion con marcadores interactivos en cada provincia con operaciones. Muestra en popup la cantidad de servicios y clientes atendidos.',
      details: 'Leaflet.js  |  Cobertura Geografica Nacional' 
    },
    { 
      title: 'Tabla de Detalle con Acreditacion y Exportacion CSV', 
      desc: 'Registro completo de ordenes con numero de acta/cotizacion, cliente, descripcion, inspector, sede, sector, acreditacion y gasto real. Incluye paginacion y descarga en CSV.',
      details: 'DataTable  |  Paginacion + Export CSV' 
    },
  ];

  for (const mod of modules) {
    drawRect(doc, MARGIN, y - 2.5, CONTENT_W, 22, WHITE, 3);
    doc.setDrawColor(...GRAY_100);
    doc.setLineWidth(0.3);
    doc.roundedRect(MARGIN, y - 2.5, CONTENT_W, 22, 3, 3, 'S');

    // Blue top accent
    drawRect(doc, MARGIN + 1, y - 2.5, CONTENT_W - 2, 2, BLUE, 1);

    // Number badge
    const modIdx = modules.indexOf(mod) + 1;
    drawRect(doc, MARGIN + 3, y - 0.5, 5, 5, BLUE, 2.5);
    addText(doc, '' + modIdx, MARGIN + 4.3, y + 3, { size: 6.5, color: WHITE, style: 'bold' });
    addText(doc, mod.title, MARGIN + 11, y + 3, { size: 9, color: BLUE_DARK, style: 'bold' });
    addWrappedText(doc, mod.desc, MARGIN + 11, y + 7.5, { size: 7.3, color: GRAY_800, maxWidth: CONTENT_W - 16, lineHeight: 3.2 });
    addText(doc, mod.details, MARGIN + 11, y + 17.5, { size: 6.8, color: GRAY_600, style: 'italic' });

    y += 24.5;
  }

  // ─── Bottom section: Conexión en Vivo ───
  y += 1;
  drawRect(doc, MARGIN, y - 2.5, CONTENT_W, 16, BLUE, 3);
  addText(doc, 'CONEXION EN VIVO CON GOOGLE DRIVE', MARGIN + 6, y + 2, { size: 10, color: WHITE, style: 'bold' });
  addWrappedText(doc, 'Los datos se sincronizan automaticamente desde Google Sheets. Cualquier nuevo registro en el Excel de Ordenes o Gastos se refleja en vivo en la plataforma.', 
    MARGIN + 6, y + 7, { size: 7.5, color: [210, 230, 255], maxWidth: CONTENT_W - 12, lineHeight: 3.3 });

  // Footer
  drawRect(doc, 0, H - 16, W, 16, BLUE_DARK);
  addText(doc, 'Canal Ejecutivo  |  Soluciones Tecnologicas Empresariales  |  www.canalejecutivo.pe', W / 2, H - 7, { size: 8, color: WHITE, align: 'center' });
  addText(doc, 'Pagina 3 de 3', W - MARGIN, H - 7, { size: 7, color: [180, 200, 240], align: 'right' });

  // ─── Save ───
  const outputPath = path.join(__dirname, 'INFORME_PLATAFORMA_PACIFIC_CONTROL.pdf');
  const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
  fs.writeFileSync(outputPath, pdfBuffer);
  console.log('✅ PDF generado exitosamente: ' + outputPath);
  console.log('   Tamaño: ' + (pdfBuffer.length / 1024).toFixed(1) + ' KB');
}

generatePDF();

