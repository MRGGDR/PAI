# Documentación — src/pages_scripts/actividades/manager

Este documento describe los archivos que se encuentran directamente dentro de la carpeta `src/pages_scripts/actividades/manager` (no incluye subcarpetas internas). Para cada archivo se señala propósito, API pública (exports), elementos del DOM implicados, ejemplos de uso extraídos del código y recomendaciones prácticas. Al final se presentan observaciones generales y propuestas de mejora.

Contenido (archivos top-level):
- `constants.js`
- `utils.js`
- `permissions.js`
- `catalogs.js`
- `selectEnhancers.js`
- `datePickers.js`
- `multiSelect.js`
- `uiEnhancers.js`
- `activitiesData.js`
- `description.js`
- `bimestres.js`

---

## `constants.js`

Propósito
- Proveer constantes reutilizables: vocabularios para generador de descripciones, sugerencias ortográficas, mensajes por defecto, configuración de bimestres y formatos de fecha/localización.

Exports clave
- `DESCRIPCION_OPCIONES` — objetos predefinidos (verbos, objetos, finalidades, beneficiarios, temporalidades).
- `SUGERENCIAS_TILDES` — mapeo de palabras sin tilde a su forma correcta.
- `MENSAJE_GENERADOR_DEFAULT` — mensaje informativo para el generador de descripciones.
- `BIMESTRES_CONFIG` — array con 6 bimestres (index, label, periodo, shortLabel, value).
- `DATE_DISPLAY_FORMATTER`, `DATE_MONTH_NAMES_ES`, `DATE_WEEKDAY_LABELS_ES` — para formateo de fechas.

Recomendaciones
- Si se requiere internacionalizar la UI más allá de `es-CO`, extraer la localización a un archivo de configuración por entorno.

---

## `utils.js`

Propósito
- Funciones utilitarias puras para normalización de texto, manejo de fechas, formateo de montos/números, parsing ISO, y utilidades para derivar planes desde datos heterogéneos.

API pública (export)
- `utilsMethods` — objeto que agrupa:
  - `capitalizarFrase`, `normalizarTextoComparacion`, `normalizarSeleccionMultiple`
  - `obtenerTextoLabelCampo`
  - `formatearFechaDisplay`, `parseFechaValor`, `formatearFechaISO`, `obtenerPartesHoy`
  - `formatearMonto`, `formatearNumero`
  - `obtenerPlanesDesdeDato` — heurística compleja para normalizar planes (IDs/nombres desde raw). 

Uso/observaciones
- Muchas funciones son puras y testeables sin DOM. `obtenerTextoLabelCampo` accede al DOM para buscar `label[for=...]`.
- `obtenerPlanesDesdeDato` usa `this.normalizarTextoComparacion` — se espera que el objeto que mezcla estas utilidades las invoque con el contexto correcto (o que se importe directamente cuando se use fuera de `this`).

Ejemplo de uso
```js
import { utilsMethods } from './manager/utils.js';
const { formatearMonto, normalizarSeleccionMultiple } = utilsMethods;
console.log(formatearMonto('1500000'));
```

Recomendaciones
- Añadir tests unitarios (jest + JSDOM) para `normalizarTextoComparacion`, `obtenerPlanesDesdeDato` y `formatearFechaDisplay` con casos edge (null, formatos variados).

---

## `permissions.js`

Propósito
- Métodos que resuelven permisos por clave y aplican cambios UI (ocultar/mostrar botones, deshabilitar formularios). Depende de `this.state` y de `../utils.js`.

API pública (export)
- `permissionMethods` con:
  - `tienePermisoClave` — resolución por clave y fallback a `tienePermiso(rol, clave)`
  - `puedeCrearActividades`, `puedeEditarActividades`, `puedeEliminarActividades`, `puedeCrearAvances`, `puedeGestionarCatalogos`
  - `aplicarPermisosInterfaz` — aplica clases/atributos a `#btn-nueva-actividad`, `#form-actividad`, y el header de acciones en la tabla.

IDs/DOM usados
- `btn-nueva-actividad`, `form-actividad`, `#app-actividades table thead tr th:last-child`.

Recomendaciones
- Evitar manipular directamente demasiados elementos en métodos de permiso; preferir emitir un evento o delegar en un renderer para facilitar testing.

---

## `catalogs.js`

Propósito
- Cargando y normalizando catálogos recibidos desde el backend, sincronizando área del usuario con catálogos y poblando selects en el DOM.

API pública (export)
- `catalogMethods` con:
  - `normalizeCatalogItems(items, namespace)` — normalización robusta de elementos (id, nombre, parent_id, orden, raw)
  - `cargarCatalogos()` — usa `apiService.fetchCatalogo()` y setea `this.state.catalogos`
  - `poblarSelectsCatalogos()`, `actualizarSubprocesosPorArea(areaId)` — manipulan selects en DOM
  - helpers: `obtenerCatalogosVacios`, `debeRestringirPorArea`, `coincideActividadConArea`, `aplicarRestriccionAreaEnListado`, `resolverValorCatalogo`, `obtenerItemCatalogo`...

IDs/DOM usados
- Selects: `area_id`, `subproceso_id`, `mipg_codigo`, `objetivo_id`, `estrategia_id`, `linea_trabajo_id`, `linea_accion_id`, `fuente_financiacion`, `plan_id`, `filtro-area`, `filtro-plan`, `filtro-estado`.

Comportamiento relevante
- `cargarCatalogos` normaliza el payload del backend y rellena `this.state.catalogos`. Además llama a `sincronizarAreaUsuarioConCatalogos` y `poblarSelectsCatalogos`.
- `normalizeCatalogItems` tiene heurísticas para crear ids y nombres cuando la fuente es heterogénea (strings, objetos con `nombre`, `label`, `code`, etc.).

Recomendaciones
- Validar que el backend siempre devuelva claves esperadas o documentar contratos. Para migraciones, `normalizeCatalogItems` es útil y se debe cubrir con tests.

---

## `selectEnhancers.js`

Propósito
- Implementa un 'modern select' mejorado (accesible y searchable) que reemplaza selects nativos por un componente custom dentro del DOM, con soporte para placeholder, búsqueda y estados deshabilitados.

API pública (export)
- `selectEnhancerMethods` contiene: `llenarSelect`, `aplicarEstilosBaseSelects`, `initModernSelect`, `refreshModernSelect`.

Comportamiento
- Crea estructuras DOM (wrapper, trigger, dropdown, search, list) y mantiene un estado en `this.components.selectEnhancers`.
- Respalda accesibilidad básica (roles, aria-expanded) y manejos por teclado (Enter, Escape, ArrowDown).

Riesgos y recomendaciones
- El componente genera elementos interactivos y añade listeners; al destruir un componente hay que limpiar listeners/observers si se reutiliza la página dinámicamente.
- Asegurar que `select.dataset.skipEnhance` permita bypass en selects que no deben mejorar.

---

## `datePickers.js`

Propósito
- Implementa un datepicker custom (componente 'modern-date') que envuelve inputs type=date y provee un calendario con navegación y selección accesible.

API pública (export)
- `datePickerMethods` con: `aplicarEstilosBaseDatePickers`, `initModernDatePicker`, `refreshModernDatePicker`.

Comportamiento clave
- Mantiene estado por input en `this.components.datePickers` y atacha listeners para abrir/cerrar dropdown, navegar meses y seleccionar fecha.
- Usa utilidades de `utils.js` (`parseFechaValor`, `formatearFechaISO`, `formatearFechaDisplay`, `obtenerPartesHoy`).

Recomendaciones
- El datepicker crea muchos listeners y un MutationObserver para `disabled` — importante liberar observers si el input se elimina del DOM.
- Asegurar que pruebas E2E cubran la interacción de teclado y fallback a date native cuando `data-skip-date-enhance=true`.

---

## `multiSelect.js`

Propósito
- Implementa un multi-select específico para el selector `plan_id` con UI custom (checkbox list, resumen, búsquedas y contador), sincronizando con el select nativo.

API pública (export)
- `multiSelectMethods` con: `initPlanMultiSelect`, `refreshPlanMultiSelect`.

Comportamiento
- Convierte el select `plan_id` en multiple, construye lista de opciones con checkboxes y mantiene estado en `this.components.multiSelectPlanes`.

Recomendaciones
- Mantener sincronía entre el select nativo y la UI (ya implementada). Revisar performance si la lista de planes es muy grande: podría necesitar paginación o búsqueda server-side.

---

## `uiEnhancers.js`

Propósito
- Exporta una composición de los métodos de UI: `selectEnhancerMethods`, `datePickerMethods` y `multiSelectMethods` para disponer de un único objeto `uiEnhancerMethods` que se mezcla en el manager.

API pública
- `uiEnhancerMethods` (spread de las tres colecciones anteriores).

---

## `activitiesData.js`

Propósito
- Contiene la lógica para normalizar actividades, mapear para tablas/tarjetas, renderizar badges, cargar actividades desde API, inicializar la vista (CardsManager) y manejar atajos a registro de avances.

API pública (export)
- `activitiesDataMethods` con:
  - `normalizarRespuestaActividades`, `mapActividadParaTabla`, `renderBadge`
  - `cargarActividades`, `inicializarTabla`, `configurarEventosTabla`, `configurarEventosModal`, `abrirAtajoRegistroAvance`.

Interacciones con otros módulos
- Usa `apiService` (../api.js) y `CardsManager` (../cardsManager.js). También depende de utilidades y de `this.state.catalogos`.

Comportamiento clave
- `mapActividadParaTabla` consolida campos desde distintos formatos raw (soporta `actividad_id`, `codigo`, `raw.*`), extrae responsable y normaliza meta/presupuesto.
- `cargarActividades` normaliza respuesta, mapea y aplica restricción por área (`aplicarRestriccionAreaEnListado`) y actualiza `this.state.actividades`.
- `inicializarTabla` crea `CardsManager` si no existe, configura botones (editar/eliminar) según permisos y registra callbacks para abrir modal/editar/eliminar.

IDs/DOM relevantes
- Modal y botones: `btn-cerrar-modal`, `modal-detalle-actividad`, además dependencias en `CardsManager` (IDs de grid, pagination, etc.).

Ejemplo de flujo (extraído)
```js
// cargar y mostrar
await this.cargarActividades({ loaderMessage: 'Cargando actividades...' });
this.inicializarTabla();

// abrir atajo a avances desde una tarjeta
this.abrirAtajoRegistroAvance({ actividad: actividadItem.raw, bimestreIndex: 2 });
```

Recomendaciones
- Segregar la lógica de mapeo/normalización (pura) fuera de la clase que maneja UI para facilitar tests unitarios.
- Considerar reintentos en `cargarActividades` si `apiService.fetchActividades` puede fallar intermitentemente.

---

## `description.js`

Propósito
- Proporciona el generador de descripciones compuesto por selects (verbo, objeto, finalidad, beneficiarios, temporalidad) y funciones para generar, limpiar, verificar ortografía y sincronizar el textarea/editor asociado.

API pública (export)
- `descriptionMethods` con: `inicializarGeneradorDescripcion`, `poblarSelectsDescripcion`, `generarDescripcionEstandar`, `limpiarGeneradorDescripcion`, `getDescripcionTexto`, `setDescripcionTexto`, `verificarOrtografiaDescripcion`, `establecerValoresGeneradorDescripcion`, etc.

Detalles importantes
- El módulo interactúa con elementos: `descripcion_actividad`, `descripcion_actividad_editor`, `descripcion_verbo`, `descripcion_objeto`, `descripcion_finalidad`, `descripcion_beneficiarios`, `descripcion_temporalidad`, `verificar-ortografia`, `limpiar-descripcion`, y `descripcion-feedback`.
- Tiene heurísticas para detectar if `edicionManual` y confirmar reemplazos automáticos.
- Usa un checker ortográfico si está vinculado a `editor.__orthographyChecker`.

Recomendaciones
- Verificar integración con el comprobador ortográfico (assets en `public/dict`) y definir comportamiento claro cuando no existe el checker (actualmente hace fallback suave).
- Exponer métodos para tests (ej. permitir inyectar un checker falso para probar `verificarOrtografiaDescripcion`).

---

## `bimestres.js`

Propósito
- Gestiona la sección de bimestres: inicialización de inputs, cálculo de sumas, validaciones (presupuesto y metas), extracción de cantidades desde textos y generación de mensajes/feedback para el usuario.

API pública (export)
- `bimestresMethods` con: `inicializarBimestresSection`, `resetBimestresSection`, `resolverIndiceBimestre`, `setValoresBimestres`, `obtenerBimestresFormulario`, `actualizarResumenBimestres`, `validarDistribucionBimestres`.

Comportamiento clave
- `inicializarBimestresSection` liga listeners a inputs con IDs `bimestre-presupuesto-{index}`, `bimestre-meta-{index}`, `bimestre-descripcion-{index}` y mantiene `this.bimestresUI`.
- `actualizarResumenBimestres` calcula diferencias entre suma de bimestres y `presupuesto_programado`, y entre suma de metas y `meta_indicador_valor`, mostrando mensajes con clases de estado (emerald/amber/rose).
- `validarDistribucionBimestres(payload)` lanza errores cuando hay inconsistencias (negativos, suma distinta, descripción incompatible con meta).

Recomendaciones
- `validarDistribucionBimestres` lanza errores para frenar guardado; asegurar que el UI capture y muestre esos mensajes de forma amigable (toasts o feedback cerca del formulario).
- Extraer la lógica de parsing de cantidades (`extraerCantidadesDescripcion`) a utilidades testables.

---

## Observaciones generales y recomendaciones finales (subcarpeta `manager`)

- Testabilidad: muchos métodos son puros y podrían separarse en módulos utilitarios independientes (por ejemplo: normalización de catalogos, mapeo de actividades, parsing de cantidades, validaciones de bimestres). Esto facilitará tests unitarios con Jest + JSDOM.

- Separación UI / Lógica: `activitiesData.js` y `catalogs.js` mezclan lógica de negocio y manipulación DOM. Recomiendo:
  1) Extraer funciones puras (normalización, mapeo, validación) a `lib/` o `manager/utils` para poder testear sin DOM.
  2) Mantener en los métodos del manager solo la orquestación y manipulación DOM.

- Gestión de memoria: componentes UI (`selectEnhancers`, `datePickers`, `multiSelect`) crean listeners y observers; si la aplicación recrea secciones dinámicamente (mount/unmount), añadir hooks de teardown para remover listeners, observers y referencias en `this.components`.

- Seguridad/sanitización: el código genera HTML (por ejemplo badges y templates en CardsManager y `activitiesData.mapActividadParaTabla` genera `fechasLabel` y `metaDisplay`). Asegurar uso consistente de `escapeHtml` al inyectar contenido.

- Resiliencia red: `cargarCatalogos` y `cargarActividades` manejan errores pero no implementan reintentos. Para endpoints críticos, agregar retries con backoff y mostrar mensajes adecuados.

- Accesibilidad: los componentes custom (modern-select, modern-date, multiselect) tienen varias mejoras ARIA, pero conviene hacer pruebas con NVDA/VoiceOver y verificación de foco en modales (asegurar trap focus y retorno del foco al cerrar).

- Rendimiento: para catálogos o listados muy grandes (planes, usuarios, actividades), preferir server-side paging o virtualización en lugar de renderizado/filtrado completamente en cliente.

- Documentación del contrato backend: `catalogs.js`, `activitiesData.js` y otros esperan formatos variados desde backend (arrays directos, {data:...}, {actividades:...}). Es recomendable estandarizar y documentar la estructura de respuesta esperada para simplificar el cliente.

---


