<small>Última revisión: 2025-10-28</small>

# PAI: Plataforma de Administración de Indicadores (PAI_V1)

SPA para planificar actividades institucionales, distribuir metas y presupuesto por bimestres, registrar avances y seguir revisiones. El frontend está escrito con módulos ES y manipulación directa del DOM; el backend vive en Google Apps Script expuesto como Web App y persistente en Google Sheets. Un proxy serverless (`api/index.js`) permite enrutar llamadas desde el navegador con CORS controlado.

Este README es la guía maestra. Condensa la información técnica publicada en los distintos READMEs del repositorio y añade contexto operativo para nuevos colaboradores.

---

## Tabla rápida
- [1. Arquitectura y flujo de petición](#1-arquitectura-y-flujo-de-petición)
- [2. Mapa de documentación](#2-mapa-de-documentación)
- [3. Modelos y dominios clave](#3-modelos-y-dominios-clave)
- [4. Frontend](#4-frontend)
- [5. Backend (Apps Script)](#5-backend-apps-script)
- [6. Proxy serverless (`api/`)](#6-proxy-serverless-api)
- [7. Activos públicos y comprobador ortográfico](#7-activos-públicos-y-comprobador-ortográfico)
- [8. Estilos y diseño](#8-estilos-y-diseño)
- [9. Desarrollo local y despliegue](#9-desarrollo-local-y-despliegue)
- [10. Calidad, validaciones y pruebas](#10-calidad-validaciones-y-pruebas)
- [11. Operación, monitoreo y mantenimiento](#11-operación-monitoreo-y-mantenimiento)
- [12. Árbol de directorios literal](#12-árbol-de-directorios-literal)
- [13. Contacto, licencia y créditos](#13-contacto-licencia-y-créditos)

---

## 1. Arquitectura y flujo de petición

- **Frontend (SPA)**: módulos ES sin framework pesado. `src/pages/*.html` cargan scripts en `src/pages_scripts/**` que inicializan componentes, gestionan formularios complejos (actividades, avances, admin) y consumen `src/lib`.
- **Capa de servicios frontend**: `src/lib/auth.js`, `src/lib/config.js`, `src/lib/ui.js`, `src/lib/loader.js`, etc. centralizan autenticación, configuración dinámica de URLs, toasts, loader y guardas de sesión.
- **Proxy**: `api/index.js` (serverless) recibe `POST` con `{ path, payload }`, reenvía al Apps Script, maneja CORS y puede ejecutarse en Vercel / local (`start-all.js`).
- **Backend Apps Script**: `03_Backend.gs` expone `doGet/doPost/doOptions`, normaliza la ruta (`path`) y delega en *managers* (catálogos, actividades, avances, dashboard).
- **Persistencia**: Google Sheets. `00_SharedUtils.gs` ofrece utilidades de lectura/escritura, validaciones y respuesta estándar `{ success, data, message, errors, meta }`.
- **Autenticación**: `05_Auth.gs` maneja usuarios, hashing y tokens HMAC. En frontend, `src/lib/auth.js` gestiona sesión y tokens (incluye fallback base64 para ambientes sin token firmado, que debe reemplazarse en producción).

**Ciclo de una petición típica** (crear actividad):
1. Usuario llena el formulario (`src/pages/actividades.html` + `actividades/index.js`).
2. `ActividadesManager` arma payload, valida distribución bimestral y llama a `apiService.saveActividad` (`src/pages_scripts/actividades/api.js`).
3. `apiService` invoca `callBackend('actividades/crear', payload)` y la llamada viaja a `/api`; la función serverless reenvía al Apps Script configurado.
4. `03_Backend.gs` resuelve ruta, aplica `requiresAuthentication`, delega a `02_ActivityManager.gs`.
5. Manager valida con `validateActivityData` (`00_SharedUtils.gs`), genera código, escribe en hoja y retorna `formatResponse`.
6. Frontend normaliza respuesta, actualiza tabla/tarjetas con `TableManager` y `CardsManager`, muestra toast vía `UI.toast`.

---

## 2. Mapa de documentación

Cada carpeta clave tiene su README específico. Usa este listado para profundizar:

- `apps_script/APPS_SCRIPT_README.md`: routers, managers y payloads de Google Apps Script.
- `public/PUBLIC_README.md`: demo del checker ortográfico, estructura de diccionarios y Typo.js.
- `src/lib/LIB_README.md`: catálogo completo de utilidades frontend.
- `src/pages/PAGES_README.md`: anatomía de cada HTML.
- `src/pages_scripts/PAGES_SCRIPTS_README.md`: entrypoints por página.
- `src/pages_scripts/actividades/ACTIVIDADES_README.md` y `manager/ACTIVIDADES_MANAGER_README.md`: detalles del gestor de actividades.
- `src/pages_scripts/avances/AVANCES_README.md`: modal, filtros, analytics y trazas.
- `src/pages_scripts/admin/ADMIN_README.md` y `manager/ADMIN_MANAGER_README.md`: panel administrativo.
- `src/styles/STYLES_README.md`: estilos, controles reutilizables y recomendaciones.
- `CHANGELOG.md`: cronología de cambios (2025-09-01 -> 2025-10-28).

---

## 3. Modelos y dominios clave

- **Actividades** (`02_ActivityManager.gs`, `ActividadesManager`): código legible (`AREA-YYYY-###`), descripción generada asistida, metas y presupuesto distribuidos en 6 bimestres, estados de revisión (`planeada`, `en ejecución`, etc.).
- **Catálogos** (`01_CatalogManager.gs`): tipos `area`, `subproceso`, `objetivo`, `estrategia`, `linea`, `plan`, `mipg`, `fuente`, `bimestre`. CRUD completo, jerarquías y migraciones.
- **Avances** (`08_AdvancesManager.gs`, `src/pages_scripts/avances`): registros por bimestre con validations (logro, presupuesto ejecutado, narrativa y dificultades). Modal aplica límites contra metas del plan y genera alertas.
- **Bimestres** (`09_BimestresManager.gs`): normalización de inputs (meta/presupuesto), helpers para descripción y sincronización con planillas.
- **Usuarios y roles** (`05_Auth.gs`, `src/lib/roles.js`): `admin`, `contribuidor`, `visualizador`. Se controlan permisos en frontend (`permissionMethods`) y deben validarse server-side.

---

## 4. Frontend

### 4.1 Biblioteca compartida (`src/lib`)
- `config.js`: detecta ambiente (override en `window.APP_CONFIG_OVERRIDE`, flag local en `localStorage`) y resuelve `BASE_URL`.
- `auth.js`: login/logout, gestión de token, expiración, monitoreo de sesión y uso del servicio `callBackend`.
- `session-guard.js`: listeners de actividad, warnings antes de expirar y redirección al login.
- `sidebar-component.js` + `sidebar.js`: render dinámico de la barra lateral, pin persistente y resaltado de ruta.
- `ui.js`, `loader.js`: toasts, modales simples, loader blocking/inline con `showLoaderDuring`.
- `roles.js`: normalización de roles y matriz de permisos.
- `auth-system.js`, `login-page.js`: redirección post-login, validaciones y carrusel.

### 4.2 Páginas (`src/pages`)
- `dashboard.html`: contenedores para KPIs, filtros y tabla (scripts en `pages_scripts/dashboard.js` -> `avances/index.js`).
- `login.html`: formulario + snippet opcional para override de `BASE_URL` en dev.
- `actividades.html`: formulario extenso, panel de ortografía, distribución bimestral y tarjetas/modal.
- `avance.html`: tabla de avances, filtros, resumen por actividad y modal.
- `admin.html`: secciones para catálogos, usuarios, actividades y avances.

### 4.3 Lógica por página (`src/pages_scripts`)
- Entry shims (`actividades.js`, `admin.js`, `dashboard.js`, `avance.js`, `login-page.js`) delegan en subcarpetas.
- **Actividades** (`actividades/`): `ActividadesManager` combina mixins (`utils`, `catalogs`, `permissions`, `description`, `bimestres`, `activitiesData`) para CRUD, filtros, tarjetas y modal. `TableManager` y `CardsManager` ordenan la UI.
- **Avances** (`avances/`): `state.js` centraliza refs; `modal.js` maneja el workflow de registro con validaciones, `analytics.js` computa métricas, `tracing.js` guarda historia local (`pai_avances_trace_log`).
- **Admin** (`admin/`): `AdminManager` compone mixins para catálogos, usuarios, actividades y avances; usa `api.js` dedicado para caché y operaciones CRUD.

### 4.4 Consideraciones destacadas
- IDs críticos para scripts están documentados en cada README; si se modifican, sincronizar con `bindDomReferences()`.
- Componentes `modern-select`, `modern-date`, `modern-multiselect` son mejorados vía JS; respetar estructura HTML especificada.
- Se incluyen heurísticas robustas para normalizar payloads legacy (backwards compatibility). Mantenerlas mientras existan hojas antiguas.

---

## 5. Backend (Apps Script)

Resumen de módulos (ver detalles en `apps_script/APPS_SCRIPT_README.md`):

- `00_SharedUtils.gs`: `SYSTEM_CONFIG`, generadores de UUID/timestamp, validaciones, formato de respuesta, CORS y logging consistente.
- `01_CatalogManager.gs`: CRUD de catálogos, migraciones, reordenamiento, jerarquías (`catalog/getAll`, `catalog/create`, etc.).
- `02_ActivityManager.gs`: CRUD de actividades, generación de códigos, validaciones (`activities/create`, `activities/update`, `activities/report`).
- `03_Backend.gs`: router central (`doGet/doPost/doOptions`), `API_ROUTES`, autenticación condicional.
- `04_DashboardManager.gs`: cálculos para KPIs, alertas y datos agregados (`dashboard/kpis`, `dashboard/avance_temporal`).
- `05_Auth.gs`: alta/baja de usuarios, hashing, tokens HMAC (`auth/login`, `auth/list`, `auth/createUser`).
- `06_RoutingUtils.gs`: limpieza de rutas, detección de autenticación obligatoria (placeholder `validateAuthentication`).
- `07_LegacyHandlers.gs`: compatibilidad con clientes antiguos (alias de rutas).
- `08_AdvancesManager.gs`: creación y revisión de avances, normalización de payloads.
- `09_BimestresManager.gs`: helpers para estructura de bimestres, normalización de metas/presupuesto.

**Recomendaciones pendientes** (tomadas del README específico):
- Completar `validateAuthentication` con validación real de tokens/roles antes de exponer a producción.
- Optimizar lecturas masivas de Sheets (actualmente `readSheetAsObjects` lee hoja completa).
- Dividir operaciones pesadas para evitar timeouts de Apps Script.

---

## 6. Proxy serverless (`api/`)

- `api/index.js` reenvía peticiones a Apps Script con la misma estructura `{ path, payload, usuario }`.
- Compatible con Vercel (ver `vercel.json`).
- Usa `npm run start` (internamente `vercel dev`) para levantar frontend + proxy en local; `start-all.js` queda como opcion ligera solo para servir HTML sin backend.
- El frontend usa `src/services/apiService.js` para enviar peticiones a `/api`; no hacer fetch directos a Apps Script desde el navegador.
- Ajustar variables de entorno (URL de Apps Script, tokens) directamente en el proxy si se desea evitar exponerlos al cliente.

---

## 7. Activos públicos y comprobador ortográfico

- `public/index.html`: demo de `OrthographyChecker` con panel de sugerencias y contador.
- `public/js/orthography.js`: carga dinámica de Typo.js (`public/vendor/typo.min.js`) y diccionarios Hunspell (`public/dict/es_ES.*`).
- Detecta cualquier elemento con `data-orthography-editor`, permite inicializar bajo demanda (`data-orthography-button`).
- API principal: `createOrthographyChecker(options)` y clase `OrthographyChecker` (`runSpellcheck`, `setText`, `destroy`).
- Recomendado servir la carpeta con HTTP durante desarrollo (`python -m http.server 8000`).

---

## 8. Estilos y diseño

- CSS por feature en `src/styles/*.css`.
- Controles compartidos (`modern-select`, `modern-date`, `modern-multiselect`) se repiten entre `actividades.css` y `avance.css`; el README sugiere consolidarlos.
- `layout.css` maneja el grid con sidebar (`body.sidebar-expanded`, `body.sidebar-pinned`).
- `loader.css` define variantes blocking/toast/inline.
- `login.css` contiene fondos animados con `mix-blend-mode`; revisar rendimiento en equipos modestos.
- Recomendaciones generales:
	- Centralizar tokens de color/tipografía en un archivo común.
	- Asegurar contraste para badges y chips (cumplir WCAG).
	- Documentar contratos CSS<->JS (clases que los scripts esperan).

---

## 9. Desarrollo local y despliegue

### 9.1 Prerrequisitos
- Node.js >= 18 (para scripts y herramientas).
- Acceso al proyecto de Google Apps Script y Google Sheet configurada (`SYSTEM_CONFIG`).
- Permisos para ejecutar el proxy (Vercel/Node local).

### 9.2 Pasos rápidos (PowerShell)
```powershell
# Instalar dependencias (si aplica)
npm install

# Iniciar vercel dev (frontend + /api)
npm run start

# Alternativa manual (puerto fijo)
npx vercel dev --listen 3000
```

### 9.3 Configuración de ambiente
- `vercel dev` expone la app en `http://localhost:3000`. Para forzar otro backend se puede usar `localStorage['USE_LOCAL_PROXY'] = 'true'` o definir `window.APP_CONFIG_OVERRIDE.BASE_URL` en `login.html`.
- Apps Script: guardar `SPREADSHEET_ID` y `HMAC_SECRET` en Script Properties (`00_SharedUtils.gs`).
- Proxy (`api/index.js`): sincronizar URLs y headers CORS con Apps Script.

### 9.4 Despliegue
- Apps Script: desplegar como Web App (`Execute the app as: Me`, `Who has access: Anyone with the link` o restringido según estrategia).
- Proxy: desplegar en Vercel u otra plataforma serverless con `vercel.json`.
- Frontend: alojar assets (por ejemplo en Vercel/Netlify); asegurar que `APP_CONFIG` apunte al proxy.

---

## 10. Calidad, validaciones y pruebas
- **Recomendaciones de testing** (tomadas de los READMEs):
	- Unidades: `coincideAreaUsuario`, `convertirValoresFormulario`, `resolveBimestreLocal`, `parseNumericValue`, `evaluateAvancePerformance`.
	- Integración: flujos de login con `Auth.login`, creación de actividades (mock fetch) y registro de avances (modal completo).
	- UI: montar `modern-select`/`modern-date` en JSDOM o harness ligero.
	- Accesibilidad: revisar focus en modales y componentes custom.
- **Trazas**: `src/pages_scripts/avances/tracing.js` guarda histórico local (`pai_avances_trace_log`) para depurar.
- **CHANGELOG**: registrar alteraciones relevantes en `CHANGELOG.md`.

---

- Monitorizar tiempos de respuesta de Apps Script; dividir operaciones largas para evitar timeouts (6 minutos).
- Revisar tamaño de hojas: `readSheetAsObjects` lee todo el dataset, lo que puede requerir paginación o filtros server-side a futuro.
- Seguridad:
	- Completar `validateAuthentication` en `06_RoutingUtils.gs` con verificación real de `validateToken` (`05_Auth.gs`).
	- Evitar que el frontend genere tokens base64 en producción; exigir token firmado por servidor.
	- Restringir catálogos/actividades por área tanto en backend como en frontend (`catalogMethods.debeRestringirPorArea`).
- Mantenimiento CSS: consolidar estilos compartidos y crear styleguide para detectar regresiones.
- Limpieza de listeners: `AdminManager`, `ActividadesManager`, `attachModalEvents` deberían exponer `destroy()` si se migra a navegación tipo SPA.
- Respaldo de datos: usar exportaciones de catálogo (`exportarCatalogo`) y backups periódicos de la Google Sheet.

---

## 12. Árbol de directorios literal

```
PAI_V1/
|-- api/
|   \-- index.js
|-- apps_script/
|   |-- 00_SharedUtils.gs
|   |-- 01_CatalogManager.gs
|   |-- 02_ActivityManager.gs
|   |-- 03_Backend.gs
|   |-- 04_DashboardManager.gs
|   |-- 05_Auth.gs
|   |-- 06_RoutingUtils.gs
|   |-- 07_LegacyHandlers.gs
|   |-- 08_AdvancesManager.gs
|   \-- 09_BimestresManager.gs
|-- apps_script/APPS_SCRIPT_README.md
|-- public/
|   |-- index.html
|   |-- css/styles.css
|   |-- js/orthography.js
|   |-- vendor/typo.min.js
|   \-- dict/
|       |-- es_ES.aff
|       \-- es_ES.dic
|-- public/PUBLIC_README.md
|-- src/
|   |-- assets/
|   |-- lib/
|   |   |-- auth-system.js
|   |   |-- auth.js
|   |   |-- config.js
|   |   |-- loader.js
|   |   |-- login-page.js
|   |   |-- roles.js
|   |   |-- session-guard.js
|   |   |-- sidebar-component.js
|   |   |-- sidebar.js
|   |   \-- ui.js
|   |-- lib/LIB_README.md
|   |-- pages/
|   |   |-- actividades.html
|   |   |-- admin.html
|   |   |-- avance.html
|   |   |-- dashboard.html
|   |   \-- login.html
|   |-- pages/PAGES_README.md
|   |-- pages_scripts/
|   |   |-- actividades/
|   |   |   |-- ACTIVIDADES_README.md
|   |   |   \-- manager/
|   |   |       \-- ACTIVIDADES_MANAGER_README.md
|   |   |-- avances/
|   |   |   \-- AVANCES_README.md
|   |   |-- admin/
|   |   |   |-- ADMIN_README.md
|   |   |   \-- manager/
|   |   |       \-- ADMIN_MANAGER_README.md
|   |   \-- PAGES_SCRIPTS_README.md
|   \-- styles/
|       |-- STYLES_README.md
|       |-- actividades.css
|       |-- avance.css
|       |-- dashboard.css
|       |-- layout.css
|       |-- loader.css
|       |-- login.css
|       \-- sidebar.css
|-- CHANGELOG.md
|-- package.json
|-- start-all.js
\-- vercel.json
```

---

## 13. Contacto, licencia y créditos

- **Contacto técnico**: Manolo Rey Garcia - manolo.rey@gestiondelriesgo.gov.co / manolorey18@gmail.com
- **Autoría de documentación**: todos los archivos dentro del repositorio (incluido este) fueron creados por Manolo Rey Garcia.


