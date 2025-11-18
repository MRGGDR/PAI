# Registro de cambios

Este archivo sigue las recomendaciones de [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y la especificación de [Conventional Commits](https://www.conventionalcommits.org/es/v1.0.0/). Para generar o actualizar el historial de manera automática usa:

```bash
npm install
npm run changelog
```

> El script `changelog` utiliza `conventional-changelog-cli` para analizar el historial de commits y actualizar este archivo sin sobrescribir entradas existentes.

---

## [Unreleased]

### Added
- _Pendiente_

### Changed
- _Pendiente_

### Fixed
- _Pendiente_

---

## [2025-10-28] - Documentación integral y lineamientos

### Added
- README maestro en la raíz con arquitectura, flujos, guías de operación y referencias cruzadas a toda la documentación interna.
- READMEs dedicados por carpeta (`api`, `apps_script`, `src/lib`, `src/pages`, `src/pages_scripts`, `src/pages_scripts/actividades`, `src/pages_scripts/admin`, `src/pages_scripts/avances`, `src/styles`) que describen contratos, IDs críticos del DOM, utilidades y recomendaciones.

### Changed
- Auditoría ligera del código: se documentó el estado de la carpeta `src/pages_scripts/avances/manager` como área obsoleta pendiente de limpieza.
- Se añadieron recomendaciones operativas (consolidar CSS compartido, extracción de lógica pura, backoff en `apiService`, métodos `destroy()` en widgets y revisiones de accesibilidad).

### Notes
- Estas mejoras facilitan el onboarding, la trazabilidad de cambios y la auditoría del sistema documental.

---

## [2025-10-20] - Utilidades compartidas y resiliencia del cliente

### Added
- Nuevos helpers en `src/lib/` (`config.js`, `auth-system.js`, `loader.js`, entre otros) para centralizar configuración, autenticación ligera y gestión de loaders.

### Changed
- `apiService` ahora normaliza múltiples formatos de respuesta (`{ success, data }`, `{ data }`, arrays planos) para tolerar divergencias del backend.
- Mejoras en mensajes y errores mostrados al usuario (toasts y alerts más claros) que simplifican el debugging en desarrollo local.

---

## [2025-10-10] - Reorganización por features y flujo de avances

### Added
- Estructura modular en `src/pages_scripts/` diferenciando `actividades/`, `avances/` y `admin/`, con entrypoints delgados que delegan en managers especializados.
- Modal de registro de avances con validaciones (`AVANCE_REQUIRED_FIELDS`), parseo numérico robusto (`parseNumericValue`) y comprobación de límites por bimestre.
- Sistema de trazabilidad local (`pai_avances_trace_log`) para auditar eventos de creación, edición y revisión de avances.

---

## [2025-09-30] - Backend Apps Script y proxy serverless

### Added
- Módulos base en `apps_script/` (`00_SharedUtils.gs`, `01_CatalogManager.gs`, `02_ActivityManager.gs`, `04_DashboardManager.gs`, `05_Auth.gs`, `08_AdvancesManager.gs`, etc.) con router central (`03_Backend.gs`) que procesa payloads `{ path, payload }`.
- Servicio proxy en `api/index.js` para reenviar solicitudes al Web App de Apps Script, manejar CORS y exponer un punto único de acceso desde la SPA.

### Notes
- Con esta iteración se obtuvo persistencia sobre Google Sheets y un flujo seguro de comunicación cliente-servidor.

---

## [2025-09-15] - Componentes UI y ortografía cliente

### Added
- Estilos por página en `src/styles/` (`actividades.css`, `avance.css`, `login.css`, `sidebar.css`, `loader.css`, `layout.css`) junto a componentes enriquecidos (`modern-select`, `modern-date`, `modern-multiselect`).
- Motor de ortografía (`public/js/orthography.js`) con diccionarios Hunspell (`public/dict/es_ES.aff`, `public/dict/es_ES.dic`) y `vendor/typo.min.js` para validar contenido editable.

### Notes
- Estas piezas mejoraron la experiencia de edición, aunque quedó pendiente consolidar reglas CSS repetidas.

---

## [2025-09-01] - Inicio del proyecto

### Added
- Estructura inicial del repositorio: carpetas `src/`, `public/`, `apps_script/`, `api/` y páginas base (`login.html`, `dashboard.html`, `actividades.html`, `avance.html`, `admin.html`).
- `package.json` mínimo y scripts de apoyo (`npm run start` via `vercel dev`, `start-all.js`) para servir la SPA y trabajar con un proxy local.

### Notes
- Punto de partida del proyecto; aún no se conectaba a fuentes de datos reales.

---