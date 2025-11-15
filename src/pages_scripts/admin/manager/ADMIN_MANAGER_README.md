# Documentación — src/pages_scripts/admin/manager

Este documento describe los archivos que se encuentran directamente en `src/pages_scripts/admin/manager` (sin entrar en subcarpetas). Para cada archivo se indica propósito, las funciones/métodos exportados, los elementos DOM que usan y ejemplos de uso extraídos del código.

Archivos cubiertos:
- `constants.js`
- `utils.js`
- `permissions.js`
- `catalogs.js`
- `users.js`
- `activities.js`
- `avances.js`

---

## `constants.js`

Propósito
- Proveer etiquetas y mensajes reutilizables en el panel de administración.

Exports
- `CATALOG_LABELS` — mapeo de tipos de catálogo a etiquetas (ej. `area: 'Áreas'`).
- `ADMIN_LOADER_MESSAGE` — mensaje por defecto para operaciones que muestran loader.

Recomendación
- Extraer a una capa de i18n si se requiere soportar varios idiomas o personalizaciones por cliente.

---

## `utils.js`

Propósito
- Colección de utilidades orientadas al panel admin: parsing booleano, heurísticas para extraer IDs/códigos de actividades/avances, formateo de fechas y helpers UI (badges, scroll).

API pública (objeto `utilsMethods`)
- `parseBoolean(value)`
- `obtenerActividadId(actividad)`, `obtenerAvanceId(avance)`, `obtenerActividadCodigo(registro)`
- `formatearFechaISO(valor)`, `formatearFecha(valor, opciones)`
- `renderEstadoRevisionBadge(estado)` — devuelve HTML de badge según estado de revisión.
- `desplazarHacia(elemento)` — hace scroll y abre `<details>` padres.

Notas y consideraciones
- Las heurísticas para extraer IDs/códigos cubren múltiples formatos legacy — ideal para normalizar datos entrantes.
- `renderEstadoRevisionBadge` devuelve HTML; cuando se inserte en el DOM, preferir asignarlo a un contenedor seguro o usar textContent si no se desea HTML.

Ejemplo
```js
const id = this.obtenerActividadId(actividadRaw);
const badgeHtml = this.renderEstadoRevisionBadge(actividadRaw.estado_revision);
container.innerHTML = badgeHtml; // asegúrate que `container` sea de confianza
```

Recomendación de pruebas
- Unit tests para las heurísticas (`obtenerActividadId`, `obtenerAvanceId`) con entradas varias: objetos con varios nombres de campo, strings, valores nulos.

---

## `permissions.js`

Propósito
- Reglas para verificar permisos y aplicar guardas en la UI del admin.

API pública (objeto `permissionMethods`)
- `puedeGestionarCatalogos()`, `puedeGestionarUsuarios()`
- `mostrarAccesoRestringido()` — reemplaza el contenido de `#app-admin` o muestra toast si no hay root.
- `applyPermissionGuards()` — deshabilita paneles/controles según permisos (panel-usuarios, panel-actividades, panel-avances).

DOM impactado
- `panel-usuarios`, `panel-actividades`, `panel-avances` y los inputs/buttons dentro de ellos.

Recomendaciones
- En lugar de manipular directamente muchos elementos DOM desde aquí, considerar exponer flags (por ejemplo `this.state.uiLockedForUsuarios = true`) y dejar que el renderer (catalogs/users modules) aplique los cambios — mejora testabilidad.

---

## `catalogs.js`

Propósito
- Gestiona carga, visualización y edición de catálogos desde el panel: fetch, render tabla, formulario CRUD, exportar a JSON.

API pública (objeto `catalogMethods`)
- `obtenerEtiquetaCatalogo(tipo)`, `setCatalogoActual(tipo)`, `loadCatalogo(force)`
- `renderCatalogoTabla(items)`, `actualizarResumen()`, `handleTablaClick(event)`
- `mostrarEnFormulario(item)`, `limpiarFormulario()`, `obtenerDatosFormulario()`, `validarDatos(datos)`
- `handleSubmitFormulario(event)`, `confirmarEliminacion(item)`, `eliminarCatalogo(id)`, `exportarCatalogo()`

Elementos DOM clave
- `catalogo-tipo`, `catalogo-refrescar`, `catalogo-exportar`, `catalogo-contador`, `catalogo-tabla-body`, `catalogo-form`, `catalogo-form-titulo`, `catalogo-form-status`, `catalogo-form-reset`, `catalogo-eliminar`, inputs: `catalogo-id`, `catalogo-id-display`, `catalogo-updated-at`, `catalogo-code`, `catalogo-label`, `catalogo-parent`, `catalogo-sort-order`, `catalogo-activo`.

Comportamiento y detalles
- `loadCatalogo` usa `apiService.fetchCatalogo` envuelto por `showLoaderDuring` y normaliza `state.catalogoItems` e índice por id.
- `renderCatalogoTabla` crea filas con botones `data-action="edit"|"delete"` — `handleTablaClick` delega y llama a `mostrarEnFormulario` o `confirmarEliminacion`.
- `handleSubmitFormulario` valida con `validarDatos` y llama a `apiService.createCatalogItem` o `apiService.updateCatalogItem` según si `id` está presente.
- `exportarCatalogo` crea un blob JSON y dispara descarga.

Ejemplo de flujo
```js
// Forzar recarga del catálogo actual
await this.loadCatalogo(true);
// Mostrar un item en el formulario
this.mostrarEnFormulario(this.state.catalogoItems[0]);
```

Recomendaciones
- Sanitizar/escapar valores antes de insertarlos en `innerHTML` si provienen de fuentes no confiables.
- Añadir confirmación adicional o soft-delete si el backend marca como inactivo en vez de borrar verdaderamente.

---

## `users.js`

Propósito
- Cargar y gestionar usuarios: listado, filtro, render tabla, creación/actualización/borrado mediante `apiService`.

API pública (objeto `userMethods`)
- `cargarAreasParaUsuarios()`, `actualizarOpcionesArea(valores)`
- `obtenerEtiquetaRol(rol)`
- `loadUsuarios(force)`, `applyUsuarioFiltro(termino)`, `renderUsuariosTabla(items)`
- `limpiarUsuarioFormulario()`, `handleUsuarioSubmit(event)`, `handleUsuariosClick(event)`, `confirmarEliminarUsuario(email)`, `prepararEdicionUsuario(email)`

Elementos DOM clave (dentro de `this.dom.usuarios` en AdminManager)
- `panel-usuarios`, `usuarios-recargar`, `usuarios-buscar`, `usuarios-resumen`, `usuarios-tabla-body`, `usuarios-form`, `usuario-form-titulo`, `usuario-form-status`, `usuario-limpiar`, submit button `#usuarios-form button[type="submit"]`, inputs: `usuario-email`, `usuario-password`, `usuario-rol`, `usuario-area`.

Comportamiento notable
- `loadUsuarios` guarda `state.usuarios` y `state.usuariosIndex` (indexado por email), además actualiza `areaOptionsCache` con los valores de area detectados.
- `handleUsuarioSubmit` valida (password mínimo 8 chars para creación), llama a `apiService.createUsuario` o `apiService.updateUsuario`, y recarga la lista.
- `confirmarEliminarUsuario` impide eliminar la propia cuenta y evita dejar sin administradores activos.

Ejemplo
```js
await this.loadUsuarios(true);
this.applyUsuarioFiltro('garcia');
// Preparar edición
this.prepararEdicionUsuario('juan.perez@example.com');
```

Recomendaciones
- Proteger comunicación de contraseñas (no exponer en logs). El UI sugiere compartir la contraseña por canal seguro — considerar flujo de restablecimiento por email en vez de mostrar/crear contraseñas temporales en el panel.

---

## `activities.js`

Propósito
- Interactúa con el API de `actividades` (cliente en `src/pages_scripts/actividades/api.js`), carga, filtra, renderiza y permite acciones de revisión y eliminación de actividades desde el panel admin.

API pública (objeto `activitiesMethods`)
- `loadActividades(force)`, `applyActividadFiltro(termino)`, `renderActividadesTabla(items)`
- `handleActividadesClick(event)`, `procesarAccionRevisionActividad(accion, actividad)`, `mostrarActividadEnFormulario(actividad)`, `confirmarEliminarActividad(id, actividad)`, `limpiarActividadFormulario()`, `mostrarMensajeActividad(mensaje, tipo)`

Comportamiento y elementos DOM
- Usa `this.dom.actividades` (refresh button, search input, tableBody, form, inputs como `actividad-id`, `actividad-codigo`, `actividad-estado`, `actividad-descripcion`, `actividad-meta`, `actividad-responsable`, `actividad-detalle`).
- `renderActividadesTabla` crea botones con `data-action` para `approve`, `mark-review`, `request-changes`, `edit`, `delete`.
- `procesarAccionRevisionActividad` confirma con el usuario y llama `actividadesApi.reviewActividad` (requiere comentarios en `request-changes`).

Ejemplo de uso
```js
// Marcar una actividad en revisión (desde botón en la tabla)
this.procesarAccionRevisionActividad('mark-review', actividadObj);
```

Recomendaciones
- Confirmaciones y prompts (`window.confirm`/`window.prompt`) funcionan, pero podrías sustituirlos por modales propios para una mejor UX y accesibilidad.

---

## `avances.js`

Propósito
- Similar a `activities.js` pero para registros de avance: carga, filtrado, render y acciones de revisión/edición/eliminación.

API pública (objeto `avancesMethods`)
- `loadAvances(force)`, `applyAvanceFiltro(termino)`, `renderAvancesTabla(items)`
- `handleAvancesClick(event)`, `procesarAccionRevisionAvance(accion, avance)`, `mostrarAvanceEnFormulario(avance)`, `confirmarEliminarAvance(id, avance)`, `limpiarAvanceFormulario()`, `mostrarMensajeAvance(mensaje, tipo)`

Comportamiento y detalles
- `loadAvances` consume `actividadesApi.callBackend('avances/obtener')` y normaliza distintas formas de respuesta (`data`, `items`, array directo).
- `renderAvancesTabla` genera filas con botones `approve/mark-review/request-changes/edit/delete` y muestra badge de revisión.

Recomendaciones
- Igual que con actividades: usar modales propios para comentarios y confirmaciones mejora UX. Validar fuentes de datos externas antes de mostrarlas en `innerHTML`.

---

## Observaciones generales (subcarpeta `admin/manager`)

- Consistencia y normalización: los módulos contienen muchas heurísticas para normalizar datos entrantes (IDs, códigos, campos legacy). Esto es bueno para resiliencia pero conviene documentar el contrato ideal del backend.

- Separación de responsabilidades: actualmente cada mixin combina lógica de negocio, manipulación DOM y llamadas a API. Recomiendo extraer las funciones puras (normalización, validación, parsing) a módulos testables y mantener en los mixins solo la orquestación UI y llamados a la API.

- Manejo de listeners y memoria: `bindEvents` en `AdminManager` agrega muchos listeners; sería útil implementar `destroy()` para quitar listeners y evitar fugas si la SPA recrea secciones.

- Tests: Priorizar pruebas unitarias para `utils.js`, validaciones en `catalogs.validarDatos`, y flujos API (mock fetch) en `users.handleUsuarioSubmit` / `catalogs.handleSubmitFormulario`.

- Seguridad: evitar insertar HTML sin escapar. `renderEstadoRevisionBadge` y otras funciones devuelven HTML; usar con cuidado y preferir `textContent` cuando sea apropiado.

- UX: reemplazar `window.confirm` y `window.prompt` por modales controlados para consistencia visual y mejor accesibilidad.

---

