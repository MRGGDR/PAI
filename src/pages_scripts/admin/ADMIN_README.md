# Documentación - src/pages_scripts/admin

Este documento describe los archivos que se encuentran directamente dentro de la carpeta `src/pages_scripts/admin` (no incluye subcarpetas). Para cada archivo se indica propósito, API pública (exports), elementos DOM que consume o modifica, ejemplos de uso y recomendaciones prácticas. Al final se presentan observaciones generales y propuestas de mejora.

Archivos cubiertos (top-level):
- `adminManager.js`
- `api.js`
- `index.js`

---

## `adminManager.js`

Propósito
- Controlador principal del panel de administración. Orquesta la carga y manipulación de catálogos, usuarios, actividades y avances. Compone múltiples mixins desde `manager/` (`utils`, `permissions`, `catalogs`, `users`, `activities`, `avances`).

Estructura y estado
- Constructor inicializa `this.state` (usuario, permisos, catálogos, actividades, usuarios, avances, índices y flags de carga) y `this.dom` con referencias a elementos del DOM usados por el módulo.
- Propiedades clave en `state`: `usuario`, `permisos`, `catalogoActual`, `catalogoItems`, `actividades`, `usuarios`, `avances`, y caches/índices auxiliares.

Referencias DOM (IDs usados)
- Root y controles de catálogo: `app-admin`, `catalogo-tipo`, `catalogo-refrescar`, `catalogo-exportar`, `catalogo-contador`, `catalogo-tabla-body`, `catalogo-form`, `catalogo-form-titulo`, `catalogo-form-status`, `catalogo-form-reset`, `catalogo-eliminar`, `catalogo-id`, `catalogo-id-display`, `catalogo-updated-at`, `catalogo-code`, `catalogo-label`, `catalogo-parent`, `catalogo-sort-order`, `catalogo-activo`.
- Usuarios: `panel-usuarios`, `usuarios-recargar`, `usuarios-buscar`, `usuarios-resumen`, `usuarios-tabla-body`, `usuarios-form`, `usuario-form-titulo`, `usuario-form-status`, `usuario-limpiar`, form submit selector `#usuarios-form button[type="submit"]`, `usuario-email`, `usuario-password`, `usuario-rol`, `usuario-area`.
- Actividades: `actividades-recargar`, `actividades-buscar`, `actividades-resumen`, `actividades-tabla-body`, `actividades-form`, `actividad-form-titulo`, `actividad-form-status`, `actividad-limpiar`, `actividad-id`, `actividad-codigo`, `actividad-estado`, `actividad-descripcion`, `actividad-meta`, `actividad-responsable`, `actividad-detalle`.
- Avances: `avances-recargar`, `avances-buscar`, `avances-resumen`, `avances-tabla-body`, `avances-form`, `avance-form-titulo`, `avance-form-status`, `avance-limpiar`, `avance-id`, `avance-actividad`, `avance-bimestre`, `avance-fecha`, `avance-reportado`, `avance-detalle`.

Comportamiento clave
- On construct: valida si el usuario `puedeGestionarCatalogos()` (vía permiso). Si no, muestra acceso restringido y aborta.
- `init()` aplica permisos, enlaza eventos (`bindEvents`), establece catálogo inicial y dispara carga de usuarios/actividades/avances según permisos.
- `bindEvents()` agrega listeners a selects, botones, forms y tablas para manejar cambios, refrescos, envíos y clicks en filas. Usa múltiples helpers delegados en mixins.
- `establecerCatalogoInicial()` toma el valor actual del select y carga el catálogo.

Dependencias internas
- Mezcla (`Object.assign`) los objetos exportados por: `utilsMethods`, `permissionMethods`, `catalogMethods`, `userMethods`, `activitiesMethods`, `avancesMethods` (archivos dentro de `manager/`).

Ejemplos de uso (extraídos)
```js
// globalmente: la página inicializa el manager si existe #app-admin
// desde consola (debug)
window.adminManager.loadCatalogo(true).then(()=> console.log('Catálogo recargado'));
window.adminManager.loadUsuarios().then(users => console.log('Usuarios:', users.length));
window.adminManager.applyUsuarioFiltro('garcia');
```

Recomendaciones
- Extraer lógica pura (normalización/mapeo/validación) fuera de métodos que manipulan DOM para facilitar tests unitarios.
- Añadir métodos de teardown para remover listeners si el módulo se desmonta (especialmente útil en SPAs o tests).
- Manejar paginación server-side para tablas de usuarios o actividades si las cantidades crecen.

---

## `api.js`

Propósito
- Cliente HTTP específico para las operaciones del panel de administración: gestión de catálogos y usuarios (y podría ampliarse a actividades/avances si se requiere). Implementa caching por catálogo y wrappers CRUD.

Clase y exports
- `ApiService`: clase con una única instancia exportada por defecto (`apiService`).

API pública (métodos principales)
- `callBackend(endpoint, payload = {}, options = {})`: capa general que arma el payload (incluye `path` y `usuario`), muestra/oculta loaders y delega en `callBackend` de `src/services/apiService.js` para hablar con `/api`.
- Catálogos: `fetchCatalogo(catalogo, options)`, `createCatalogItem(data)`, `updateCatalogItem(id, data)`, `deleteCatalogItem(id)`, `clearCatalogCache(catalogo)`.
- Usuarios: `fetchUsuarios()`, `createUsuario({email,password,role,area})`, `updateUsuario({email,role,area,password})`, `deleteUsuario(email)`.

Detalles importantes
- `callBackend` añade `usuario` al payload si no existe, muestra/oculta loaders cuando están disponibles y lanza errores en caso de respuestas no ok o `result.error`.
- `fetchCatalogo` valida `catalogo` y cachea resultados en `this.catalogosCache`.

Ejemplos de uso
```js
import apiService from './api.js';

const planes = await apiService.fetchCatalogo('planes');
const nuevo = await apiService.createCatalogItem({ catalogo: 'areas', label: 'Área piloto', code: 'AP' });
await apiService.createUsuario({ email: 'test@example.com', password: 'Secreto123', role: 'contribuidor', area: 'area_1' });
```

Recomendaciones
- `callBackend` asume que la respuesta es JSON y lanza si `response.ok` es false; sería útil manejar errores con parseo condicional (si viene texto HTML) para mostrar mensajes más claros.
- Añadir reintentos con backoff para llamadas críticas.
- Asegurar que las operaciones que mutan datos limpien el cache correspondiente (ya se hace parcialmente en create/update/delete).

---

## `index.js`

Propósito
- Punto de entrada que inicializa `AdminManager` al cargar la página (DOMContentLoaded) si existe el contenedor `#app-admin`. Además reexporta `AdminManager`.

Comportamiento
- Registra `window.adminManager = new AdminManager()` para facilitar debugging y uso desde consola.

Ejemplo
```js
// Ejecutado automáticamente si #app-admin existe
// En consola
window.adminManager // instancia disponible
```

---

## Observaciones generales y recomendaciones (subcarpeta `admin`)

- Separación de responsabilidades: la implementación actual mezcla orquestación UI y lógica de negocio. Recomiendo extraer funciones puras (transformaciones/validaciones) en módulos testables dentro de `src/lib` o `src/pages_scripts/admin/lib`.

- Teardown y memory leaks: `bindEvents` añade multitud de listeners; agregar un `destroy()` que quite listeners, observers y referencias a `this.dom` será útil para pruebas y SPAs.

- Manejo de grandes volúmenes: las tablas de usuarios/actividades/avances deberían soportar paginación server-side, filtros y carga incremental si el dataset puede crecer mucho.

- Seguridad y sanitización: cuando se rendericen labels o códigos provenientes del backend, siempre escapar/usar textContent para evitar XSS. Documentar los puntos donde se inyecta HTML.

- UX y feedback: `api.js` usa loaders si existen en `window`. Asegurar mensajes de error amigables y ubicados cerca del formulario correspondiente (en vez de solo console.error).

- Permisos: `AdminManager` verifica `puedeGestionarCatalogos()` y oculta UI si no. Mantener sincronía entre permisos backend y UI, y considerar endpoints que devuelvan lista de permisos para el usuario en la carga inicial.

- Tests: comenzar por tests unitarios para `api.js` (mock fetch), y funciones puras importadas de `manager/*` (JSDOM para manipulación DOM mínima). Priorizar: `catalogs.normalizeCatalogItems`, validaciones de usuario y métodos de `bimestres`/`activities` si aplica.

---

## Créditos

Este documento fue creado por Manolo Rey Garcia.


