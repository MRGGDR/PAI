# Documentación - src/pages_scripts/actividades

Este documento describe los archivos que se encuentran directamente dentro de la carpeta `src/pages_scripts/actividades` (no incluye subcarpetas). Para cada archivo se indica su propósito, API pública (funciones/clases exportadas), elementos del DOM que consume o modifica, ejemplos de uso y recomendaciones específicas detectadas en el código.

Contenido cubierto (top-level):
- `utils.js`
- `config.js`
- `api.js`
- `tableManager.js`
- `formHandler.js`
- `actividadesManager.js`
- `index.js`
- `existingTableManager.js`
- `cardsManager.js`

---

## `utils.js`

Propósito
- Utilidades compartidas entre los módulos de `actividades`: extracción de datos del localStorage (email/rol/área), serialización de formularios, conversión de tipos, helpers para coincidencia de áreas y wrappers de UI (toast).

API pública (exports)
- `normalizarRol`, `obtenerPermisosRol`, `tienePermiso`, `esRolAdministrador`, `esRolContribuidor`, `esRolVisualizador`: reexporta funciones desde `src/lib/roles.js`.
- `obtenerEmailUsuarioActual()`: devuelve email desde localStorage o token (base64) con varios fallbacks.
- `serializarFormulario(formulario)`: convierte FormData en objeto (maneja campos repetidos como arrays).
- `mostrarToast(mensaje, tipo, opciones)`: wrapper que intenta usar `toast` de `lib/ui.js` y usa `alert` si no disponible.
- `formatearFecha(fecha)`: formatea a locale `es-CO`.
- `convertirValoresFormulario(valores, esquema)`: convierte tipos (fecha, numero, boolean) según esquema.
- `obtenerRolUsuarioActual()`, `obtenerRolUsuarioNormalizado()`, `obtenerAreaUsuarioActual()`: lecturas desde localStorage.
- `coincideAreaUsuario(areaUsuario, valores)`: heurística que genera variantes del nombre del área y compara tokens.

IDs/dom observados o globales
- Añade a `window` helpers: `window.obtenerEmailUsuarioActual`, `window.obtenerRolUsuarioActual`, `window.obtenerAreaUsuarioActual`.

Notas y recomendaciones
- `obtenerEmailUsuarioActual` intenta decodificar token con atob() y dividir por `|`. Este formato es dependiente del backend; documentar contrato del token o usar un campo explícito (`auth_email`) preferiblemente.
- `mostrarToast` captura fallos y recurre a `alert`, lo cual es útil para robustez pero evita `alert` en la UX final.
- `coincideAreaUsuario` tiene heurísticas útiles (separadores, variantes). Añadir tests unitarios para casos con guiones, barras y alias.

Ejemplo de uso
```js
import { serializarFormulario, obtenerEmailUsuarioActual } from './utils.js';

const form = document.getElementById('actividad-form');
const datos = serializarFormulario(form);
console.log('Usuario actual', obtenerEmailUsuarioActual());
```

---

## `config.js`

Propósito
- Contiene la lógica para resolver la URL del backend (Apps Script o proxy local), y opciones para campos de descripción.

API pública
- `CONFIG_BACKEND`: objeto con `SCRIPT_URL` resuelto a través de `resolveScriptUrl()` (por defecto `/api`).
- `opcionesDescripcion`: configuración para editores (rows, maxlength, placeholder, reglas de validación).
- `shouldUseTextPlain()`: helper legacy que actualmente retorna `false`; se mantiene por compatibilidad.
- `resolveScriptUrl()`: devuelve la URL efectiva consultando `window.APP_CONFIG_OVERRIDE`, `window.APP_CONFIG` y usando `/api` como fallback.

Consideraciones detectadas
- `resolveScriptUrl()` lee `window.APP_CONFIG_OVERRIDE` y `window.APP_CONFIG`. Es útil en desarrollo, pero evitar dejar overrides activos en producción.
- `shouldUseTextPlain()` se conserva para compatibilidad; los headers ahora los controla el proxy `/api`.

Recomendaciones
- Documentar exactamente cómo establecer `APP_CONFIG_OVERRIDE` en entornos de desarrollo. Evitar dejar `USE_LOCAL_PROXY` a `true` en storage sin control.

---

## `api.js`

Propósito
- Servicio HTTP que orquesta las llamadas al backend (Apps Script). Exporta una única instancia `apiService` con métodos para todas las operaciones relacionadas con actividades y avances.

API pública (métodos principales)
- `callBackend(endpoint, payload = {}, options = {})`: función base que prepara el payload, agrega `path` y `usuario`, muestra loaders opcionales y delega en `callBackend` de `src/services/apiService.js` para llamar a `/api`.
- `fetchActividades(options)`: llama a `actividades/obtener` y normaliza distintos formatos de respuesta.
- `fetchCatalogo(catalogo, options)`: llama a `getCatalogos` y cachea resultados.
- `saveActividad(actividadData)`: crea o actualiza (endpoints `actividades/crear`, `actividades/actualizar`).
- `deleteActividad(id)`: endpoint `actividades/eliminar`.
- `fetchAvances(actividadId)`, `saveAvance(avanceData)`, `deleteAvance(id)` y métodos de revisión `reviewActividad`, `reviewAvance`.

Comportamiento y detalles importantes
- `callBackend` construye un objeto `data` con `{ path: endpoint, payload: requestPayload, usuario }` y lo envía como JSON mediante el servicio compartido. Conserva validaciones estrictas del parámetro `endpoint`.
- Maneja loaders globales `window.showLoader` / `window.hideLoader` si existen.
- Contiene logging detallado (`console.debug/info/warn/error`) para facilitar depuración.
- Normaliza múltiples formatos de respuesta: array directo, `{actividades: []}` o `{success: true, data: []}`.

Recomendaciones específicas
- El control de `credentials: 'omit'` en fetch puede afectar cookies/credenciales si el backend las requiere; confirmar intención de seguridad CORS.
- Si el backend retorna texto en vez de JSON para errores (p. ej. respuestas 500 con HTML), `response.json()` fallará: ya hay captura de errores pero considera parseo condicional (ej. intentar json, si falla return text).
- Añadir un wrapper de reintentos/backoff para llamadas críticas (p. ej. fetchActividades) si el backend es ruidoso.

Ejemplo (uso rápido)
```js
import apiService from './api.js';

const actividades = await apiService.fetchActividades({ loaderMessage: 'Cargando actividades...' });
console.log('Actividades:', actividades.length);

const resultado = await apiService.saveActividad({ descripcion_actividad: 'Prueba', area_id: 'area_1' });
```

---

## `tableManager.js`

Propósito
- Clase `TableManager` para generar tablas dinámicas (bootstrap) a partir de columnas y datos: soporta búsqueda, ordenación, paginación, formateadores y eventos delegados para filas y botones.

API pública (clase)
- Constructor: `new TableManager(containerId, options)`; las options incluyen `columns`, `data`, `pageSize`, `pagination`, `sortable`, `search`, `tableClass`, `onRender`.
- Métodos: `setData()`, `getData()`, `updateRow(id, newData)`, `deleteRow(id)`, `addRow(rowData)`, `onRowEvent(eventType, handler)`, `onButtonClick(selector, handler)`.

Detalles importantes
- Columns: cada columna tiene { field, title, formatter?, width?, visible? } y puede incluir `formatter` (función) para formateo por celda.
- Renderiza paginación y buscador con IDs derivados de `containerId` (p. ej. `${containerId}-search`, `${containerId}-page-size`, `${containerId}-pagination`).
- El evento `onButtonClick` hace delegación por selector dentro del tbody y resuelve `record` por dataset `data-id`.

Recomendaciones específicas
- Evitar inyecciones: cuando se use `column.formatter` que devuelva HTML, asegurarse de que provenga de fuente confiable o sanitizar.
- Para datasets grandes, se debería implementar virtualización o usar backend paging, ya que el manager paginará en cliente.
- Tests: comprobar sorting, búsqueda y paginación con conjuntos de datos de borde (vacios, muchos duplicados, campos null/undefined).

Ejemplo de inicialización
```js
import TableManager from './tableManager.js';

const columns = [
  { field: 'codigo', title: 'Código' },
  { field: 'descripcion', title: 'Descripción' },
  { field: 'areaNombre', title: 'Área' }
];

const manager = new TableManager('actividades-table-container', { columns, data: [], pageSize: 12 });

manager.onButtonClick('.js-edit', ({ record }) => edit(record));
```

---

## `formHandler.js`

Propósito
- Clase `FormHandler` para construir formularios dinámicos en tiempo de ejecución: soporta múltiples tipos de campo (input, select, textarea, checkbox, radio, date), validación básica y callbacks `onSubmit`/`onCancel`.

API pública (clase)
- Constructor: `new FormHandler(formContainer, options)` donde `options.fields` describe la estructura del formulario.
- Métodos: `setValues(data)`, `getValues()`, `reset()`.

Detalles y comportamiento
- Genera IDs derivados de `options.id` (ej. `${id}-${field.name}`); importante si se sincroniza con CSS o scripts externos.
- Soporta selects con `allowCustom` (reemplaza select por input + datalist).
- El `handleSubmit` serializa el formulario con `serializarFormulario`, convierte valores con `convertirValoresFormulario` y llama a `options.onSubmit(processedData)` si existe.

Recomendaciones específicas
- `createSelectField` y el manejo de valores seleccionados manipulan `option.selected` directamente; en casos con selects mejorados (Select2, Choices) hay que notificar al componente externo para que re-renderice.
- Los mensajes de error usan `.invalid-feedback`; es compatible con Bootstrap. Si la app usa estilos diferentes, adaptar clases.
- Añadir validación de esquema (ej. con Ajv o zod) en `handleSubmit` antes de llamar a `onSubmit` para evitar enviar payloads malformados.

Ejemplo de definición de formulario
```js
const formHandler = new FormHandler('form-actividad-wrapper', {
  fields: [
    { name: 'descripcion_actividad', type: 'textarea', label: 'Descripción', required: true },
    { name: 'area_id', type: 'select', label: 'Área', options: [{id:'area_1', label:'Area 1'}], required: true }
  ],
  onSubmit: async (data) => { await apiService.saveActividad(data); }
});

formHandler.setValues(existingData);
```

---

## `actividadesManager.js`

Propósito
- Clase principal `ActividadesManager` que orquesta la UI de `actividades.html`: carga catálogos, obtiene actividades, inicializa formularios, bimestres, tabla/ tarjetas, validaciones y permisos.

Responsabilidades clave
- Inicialización del módulo (`init()`): carga catálogos, carga actividades y monta la tabla y componentes.
- Interacción con `apiService` para CRUD (usa `apiService.fetchActividades`, `saveActividad`, `deleteActividad`, `fetchAvances`, etc.).
- Manejo de editores rich-text/orthography (indicador, meta, riesgos), sincronización con campos ocultos y triggers de verificación ortográfica.
- Construcción de payloads (`construirPayloadActividad`) y validaciones específicas (distribución bimestral y normalización de meta/presupuesto).
- Aplicación de filtros complejos (estado, área, plan) con lógica robusta para normalizar y comparar nombres/IDs.

IDs y elementos DOM que utiliza intensamente
- Formulario: `#form-actividad`, `#actividad-form`, `#btn-nueva-actividad`, `#btn-cerrar-form`, `#btn-cancelar`, `#btn-submit-text`, `#codigo_actividad`.
- Descripciones/editores: `#descripcion_actividad_editor`, `#descripcion_actividad` (textarea), `#indicador_editor`, `#indicador_texto`, `#meta_indicador_editor`, `#meta_indicador_detalle`, `#riesgos_editor`, `#riesgos`.
- Bimestres: contenedores e inputs con IDs `bimestre-meta-N`, `bimestre-presupuesto-N`, `#bimestres-presupuesto-total`, `#bimestres-meta-total`, `#bimestre-descripcion-N`.
- Filtros: `#filtro-estado`, `#filtro-area`, `#filtro-plan`, `#actividades-search`, `#actividades-grid`, `#actividades-empty`, `#actividades-pagination`.

Consideraciones detectadas
- La clase mezcla responsabilidades (UI, payload construction, validación y lógica de negocio). Esto facilita desarrollo rápido pero complica pruebas unitarias. Muchas funciones añadidas mediante mixins (`utilsMethods`, `permissionMethods`, `catalogMethods`, `uiEnhancerMethods`, `activitiesDataMethods`, `descriptionMethods`, `bimestresMethods`).
- Usa heurísticas sólidas para normalizar datos entrantes (soporte a estructuras `raw`/legacy y múltiples formatos para el mismo campo).

Recomendaciones específicas
- Separar la lógica puremente de negocio (construcción de payload, normalización y validaciones) en un módulo testable separado para permitir pruebas unitarias sin DOM.
- Validar en backend las mismas reglas (distribución bimestral, sumas); el frontend ya valida pero la seguridad requiere validación server-side.
- Añadir sanitización antes de mostrar contenido HTML derivado de datos. Aunque muchas funciones usan `textContent`, algunos renderizadores generan HTML; revisar sanitización en `cardsManager`.

Ejemplo de flujo
```js
// index.js inicializa el manager si existe #app-actividades
window.actividadesManager.guardarActividad({ descripcion_actividad: 'Prueba', area_id: 'area_1' });
// O desde UI: completar formulario y pulsar guardar (se enlaza en inicializarFormularioActividad)
```

---

## `index.js`

Propósito
- Punto de entrada: crea `window.actividadesManager = new ActividadesManager()` cuando el DOM contiene `#app-actividades`.
- Re-exporta `ActividadesManager`, `TableManager` y `FormHandler` para uso externo.

Observación
- Módulo ligero; su función es inicializar y exponer objetos para debugging y testing manual.

---

## `existingTableManager.js`

Propósito
- Variante de tabla pensada para trabajar con una tabla HTML ya definida en el DOM (tbody); útil para páginas con tablas server-rendered o legacy.

API pública (clase)
- `new ExistingTableManager(tbodyId, options)`: opciones similares a `TableManager` pero orientadas a una tabla existente. Soporta búsqueda, paginación y sorting mediante manipulación del DOM existente.

Recomendaciones
- Ideal para migraciones incrementales donde no se quiere reemplazar markup existente. Para nuevos componentes preferir `TableManager` que genera su propia estructura.

---

## `cardsManager.js`

Propósito
- `CardsManager` renderiza la vista en tarjetas de `actividades` (grid de tarjetas, paginación, búsqueda, modal de detalle con bimestres y shortcut para registrar avances).

API pública (clase)
- Constructor: `new CardsManager(containerId, options)`; espera que el DOM contenga `#actividades-grid`, `#actividades-empty`, `#actividades-search`, `#actividades-count`, `#actividades-pagination`, `#pagination-info`, `#pagination-controls`, `#page-size-select`.
- Métodos: `setData`, `onCardClick(callback)`, `openModal(item)`, `closeModal()`, `setEditCallback`, `setAvanceShortcut(options)`, `onButtonClick(selector, callback)`.

Detalles importantes
- `populateModal` llena el `#modal-detalle-actividad` con datos: header, bimestres, indicadores, presupuestos y botones para acciones.
- Maneja el enlace entre bimestres y el shortcut de registrar avance (`avanceShortcut`) que permite pasar un handler para registrar avances directamente desde el modal.

Recomendaciones específicas
- Sanitizar textos antes de inyectarlos como HTML (muchas plantillas usan interpolation sin sanitizar en `createCard` y `populateModal`). El archivo incluye `escapeHtml` y lo usa en varios sitios; asegurar uso consistente para evitar XSS.
- Para datasets grandes, preferir server-side paging o cargar tarjetas por demanda.

Ejemplo de uso
```js
const cards = new CardsManager('actividades-grid', { data: actividades, pageSize: 12 });
cards.onCardClick(item => { cards.openModal(item); });
cards.setAvanceShortcut({ enabled: true, onTrigger: ({ actividad, bimestreIndex }) => openAvanceModal(actividad, bimestreIndex) });
```

---

## Observaciones generales y recomendaciones finales (subcarpeta `actividades`)

- Cobertura DOM: Los módulos dependen de una serie de IDs concretos presentes en `actividades.html`. Si se cambia la estructura del HTML, se necesita actualizar múltiples módulos. Recomiendo documentar en un único lugar (o crear una pequeña capa de mapeo) la lista de IDs requeridos por el módulo.
- Separación de responsabilidades: `actividadesManager.js` es el núcleo pero mezcla UI y lógica; extraer validaciones/normalizaciones a utilidades puras mejorará testabilidad.
- Seguridad: evitar inyectar HTML sin sanitizar; aunque hay `escapeHtml` en `cardsManager`, hay zonas donde `innerHTML` usa datos sin escaping. Revisar y reforzar sanitización.
- Resiliencia red: `api.js` ya maneja distintos formatos de respuesta y show/hide loader; añadir retry/backoff en endpoints críticos facilitará robustez.
- Pruebas: Priorizar tests unitarios para `utils.js` (serializar, convertir valores, coincideAreaUsuario), `api.js` (mock fetch), `tableManager` y `formHandler` (JSDOM). Para `actividadesManager`, empezar con pruebas de unidades para los métodos puros (normalizarMetaValor, construirPayloadActividad, validarDistribucionBimestres) antes de probar interacciones DOM.
- Rendimiento: para listas grandes (miles de actividades), la paginación cliente y renderizado de tarjetas/tabla puede consumir memoria; considerar server-side paging o virtualización.
- Accesibilidad: botones y controles interactivos deberían tener roles/aria-labels consistentes (por ejemplo los botones de bimestre ya usan aria-pressed). Revisar foco y navegación por teclado en modales y en controles dinámicos.

---

## Créditos

Este documento fue creado por Manolo Rey Garcia.


