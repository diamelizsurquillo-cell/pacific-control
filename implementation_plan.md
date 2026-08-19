# Plan de Trabajo: Dashboard Pacific Control (Conexión en Vivo & Catálogos Dinámicos)

Actualización del plan de desarrollo para el **Dashboard Operativo y Financiero de Pacific Control S.A.C.**, integrando las nuevas especificaciones:
1. **Pestaña `ID Lugar`**: Mapeo dinámico de códigos de lugar a nombres de localidad/provincia.
2. **Pestaña `ID Inspector`**: Mapeo dinámico de códigos de inspector a nombres completos de inspectores.
3. **Columna `descripción`**: Campo de texto libre sin diccionario cerrado (búsqueda textual y visualización directa).
4. **Conexión en Vivo a Google Sheets**: Sincronización en tiempo real, refresco automático configurable, botón de actualización inmediata y estado de conexión en vivo.

---

## 1. Arquitectura de Datos y Conexión en Vivo

```
  ┌─────────────────────────────────────────────────────────────┐
  │                    GOOGLE SHEETS (EN VIVO)                  │
  │  ├── SERVICIOS: Órdenes de servicio y muestreo               │
  │  ├── 'Gastos Operativos GO 2026': Rendiciones y presupuestos│
  │  ├── 'ID Lugar': Código Lugar ➔ Nombre/Provincia           │
  │  └── 'ID Inspector': Código Inspector ➔ Nombre Inspector    │
  └──────────────────────────────┬──────────────────────────────┘
                                 │ Google Sheets API v4
                                 ▼
  ┌─────────────────────────────────────────────────────────────┐
  │                 BACKEND / VERCEL SERVERLESS                 │
  │  ├── /lib/google-sheets.js: Lectura multi-rango en paralelo │
  │  │   - SERVICIOS!A3:W                                       │
  │  │   - 'ID Lugar'!C3:D100                                   │
  │  │   - 'ID Inspector'!C3:D150                               │
  │  │   - 'Gastos Operativos GO 2026'!A1:Q                     │
  │  ├── /lib/data-maps.js: Parser de maestros + Fallbacks      │
  │  ├── /lib/cache.js: Caché TTL corto (60s) + Bypass ?refresh │
  │  └── /api/dashboard.js: Cruce relacional + KPIs en vivo     │
  └──────────────────────────────┬──────────────────────────────┘
                                 │ JSON API
                                 ▼
  ┌─────────────────────────────────────────────────────────────┐
  │                 FRONTEND DASHBOARD (EN VIVO)                │
  │  ├── Auto-refresco en vivo (Polling configurable 30s/60s)   │
  │  ├── Botón "Sincronizar ahora" con feedback visual          │
  │  ├── Indicador de estado: 🟢 En vivo / Última sinc.         │
  │  ├── Buscador de texto libre para campo "Descripción"       │
  │  ├── Visualización de KPIs, Gráficos (Chart.js), Mapa Perú  │
  │  └── Tabla interactiva de órdenes y gastos con filtros      │
  └─────────────────────────────────────────────────────────────┘
```

---

## 2. Cambios y Tareas Propuestas

### A. Backend & Integración de Google Sheets

#### [MODIFY] [`lib/google-sheets.js`](file:///c:/Qwen/DASHBOARD%20PACIFIC%20CONTROL/lib/google-sheets.js)
- Agregar función `readMultipleRanges(spreadsheetId, ranges)` con `batchGet` para consultar simultáneamente:
  1. `SERVICIOS!A3:W2000` (Órdenes de servicio)
  2. `'ID Lugar'!C3:D100` (Catálogo dinámico de lugares)
  3. `'ID Inspector'!C3:D150` (Catálogo dinámico de inspectores)
  4. `'Código de Producto'!B3:C50` (Catálogo de productos)
- Implementar parsers para maestros de hojas:
  - `parseIdLugar(rows)`: Mapea código numérico/texto normalizado a nombre de lugar/provincia.
  - `parseIdInspector(rows)`: Mapea código numérico/texto normalizado a nombre del inspector, limpiando prefijos numéricos si vienen combinados.

#### [MODIFY] [`lib/data-maps.js`](file:///c:/Qwen/DASHBOARD%20PACIFIC%20CONTROL/lib/data-maps.js)
- Mantener diccionarios base como **fallback de seguridad** y soporte para coordenadas de mapa (`COORDS_PROVINCIA`).
- Añadir función para fusionar diccionarios dinámicos leídos del Sheet con los estáticos: `mergeCatalogues(dynamicPlaces, dynamicInspectors)`.
- Ajustar `resolverInspectores(codigo, mapInspectores)` para recibir y consultar el mapa dinámico en tiempo real.
- Modificar el tratamiento de `descripción`: No forzar categorías cerradas; mantener el texto original íntegro y extraer etiquetas sugeridas solo como badges opcionales.

#### [MODIFY] [`lib/cache.js`](file:///c:/Qwen/DASHBOARD%20PACIFIC%20CONTROL/lib/cache.js)
- Ajustar TTL por defecto para tiempo real (ej. 60 segundos) para evitar demoras mientras se previene saturación de cuota de API de Google.
- Soporte para invalidación inmediata cuando se solicita `?refresh=true`.

#### [MODIFY] [`api/dashboard.js`](file:///c:/Qwen/DASHBOARD%20PACIFIC%20CONTROL/api/dashboard.js)
- Consumir los rangos de `SERVICIOS`, `ID Lugar`, `ID Inspector` y `Gastos Operativos`.
- Cruzar los datos usando los catálogos dinámicos recién obtenidos del Sheet.
- Incluir metadatos de sincronización: `lastSyncedAt`, `rowCount`, `cacheStatus`.
- Exponer el campo `descripcion` como texto enriquecido en la respuesta JSON.

---

### B. Frontend & Visualización en Tiempo Real

#### [NEW] [`public/index.html`](file:///c:/Qwen/DASHBOARD%20PACIFIC%20CONTROL/public/index.html)
- Estructura moderna y responsiva con layout de dashboard ejecutivo.
- **Barra Superior de Control en Vivo**:
  - Badge de estado: `🟢 En vivo` / `🟡 Actualizando...`
  - Timestamp "Última sincronización: hace X seg"
  - Switch de auto-refresco (cada 30s / 60s / desactivado)
  - Botón de refresco manual instantáneo
- **Sección de KPIs Principales**:
  - Total Órdenes de Servicio
  - Clientes Únicos
  - Gasto Operativo Total (Solicitado vs Real)
  - % Desviación Presupuestal
  - Cobertura Geográfica
- **Sección de Gráficos Interactivos**:
  - Evolución mensual de servicios y gastos
  - Distribución por Inspector (con nombres resueltos desde pestaña `ID Inspector`)
  - Distribución por Ubicación (con nombres resueltos desde pestaña `ID Lugar`)
  - Distribución por Unidad de Negocio / Tipo de Inspección
- **Mapa Geográfico Interactivo del Perú (Leaflet)**:
  - Marcadores interactivos por provincia con volumen de operaciones y montos.
- **Tabla Maestra de Órdenes y Servicios**:
  - Buscador global por texto libre (especialmente en campo `descripción` y `cliente`).
  - Filtros multifacéticos por Inspector, Ubicación, Mes, Unidad de Negocio.
  - Paginación rápida, ordenamiento por columnas y vista de detalle de cada orden (desglose de pasajes, viáticos, movilidad, etc.).

#### [NEW] [`public/js/api.js`](file:///c:/Qwen/DASHBOARD%20PACIFIC%20CONTROL/public/js/api.js)
- Capa de consumo API con manejo de `?refresh=true`, polling en segundo plano e indicadores de latencia.

#### [NEW] [`public/js/charts.js`](file:///c:/Qwen/DASHBOARD%20PACIFIC%20CONTROL/public/js/charts.js)
- Inicialización y actualización reactiva de gráficos con Chart.js respetando la paleta "Deep Ocean & Warm Coral".

#### [NEW] [`public/js/map.js`](file:///c:/Qwen/DASHBOARD%20PACIFIC%20CONTROL/public/js/map.js)
- Visualización de Leaflet con mapa base oscuro y popups detallados por sede.

#### [NEW] [`public/js/app.js`](file:///c:/Qwen/DASHBOARD%20PACIFIC%20CONTROL/public/js/app.js)
- Controlador principal de la aplicación: gestión de estado de filtros, eventos en vivo, renderizado de tablas y exportación de datos.

---

## 3. Plan de Verificación

### Pruebas de Integración y Datos
1. **Verificación de Mapeo `ID Lugar`**:
   - Validar que códigos como `01` ➔ `LIMA`, `73` ➔ `PIURA (PAITA)`, `84` ➔ `CUSCO`, etc., se resuelvan dinámicamente desde la pestaña correspondiente.
2. **Verificación de Mapeo `ID Inspector`**:
   - Validar que códigos como `05` ➔ `Ernesto Sandoval`, `06` ➔ `Junior Nima`, `103` ➔ `Edgar Velasquez`, `108` ➔ `Henrry Huasasquiche`, etc., se resuelvan con los nombres del Sheet.
3. **Verificación de Campo `descripción`**:
   - Comprobar que cualquier texto libre ingresado en la columna `J` de `SERVICIOS` se preserve íntegro y sea filtrable por palabras clave en la UI.
4. **Verificación de Conexión en Vivo**:
   - Probar endpoint local/API con y sin caché (`?refresh=true`).
   - Comprobar el refresco automático y el feedback del botón de actualización en la interfaz web.
