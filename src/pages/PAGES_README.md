## README — src/pages

Este documento describe cada una de las páginas HTML en `src/pages/` del proyecto PAI_V1. Para cada archivo se indica: propósito, estructura principal, elementos/IDs relevantes que usan los scripts del cliente, scripts importados (dependencias), ejemplos de uso y recomendaciones de mejora.

---

### Resumen de archivos
- `dashboard.html` — Panel principal con indicadores y tablas resumen.
- `login.html` — Página de autenticación (login) y snippet de desarrollo para sobrescribir `BASE_URL`.
- `actividades.html` — Gestor completo de actividades: creación/edición, bimestres, distribución, lista y modal de detalle.
- `avance.html` — Panel de avances bimestrales: registro de avances, exportación y listado editable.
- `admin.html` — Panel de administración: catálogos, usuarios, actividades y avances (herramientas de gestión).

---

## dashboard.html

Propósito
- Vista de control con métricas clave (KPI), filtros y tabla de actividades. Ideal para obtener un panorama rápido del estado del plan.

Estructura y secciones clave
- Contenedor principal: `.layout-with-sidebar` y placeholder `#shared-sidebar` (sidebar inyectable).
- KPI cards: elementos que muestran totales como "Actividades totales", "En ejecución", "% Cumplimiento", etc.
- Filtros: formulario con selects para Año, Área, Subproceso, Plan y Estado. IDs típicos: `#filtro-*` (revisar el DOM para nombres exactos si los scripts usan convenciones distintas).
- Gráficos/visualizaciones: bloques preparados para renderizar gráficos—se usan como contenedores vacíos que se llenan desde `pages_scripts`.
- Tabla de actividades: tabla con filas generadas dinámicamente (buscador, paginación y controles de tamaño de página).

Scripts y dependencias
- `../lib/loader.js` — loader y sistema de carga de módulos.
- `../lib/session-guard.js` — guarda de sesión (verifica token / redirección si no autenticado).
- `../lib/sidebar-component.js` — `renderSidebar('#shared-sidebar')` para montar la navegación.
- `../pages_scripts/dashboard.js` (o nombre equivalente) — lógica específica de la página (filtros, fetch de métricas, pintar tablas y charts).

Ejemplo de uso (desarrollo)
- Abrir en navegador mediante servidor estático (p. ej. `npm run start` que ejecuta `vercel dev`) para que los imports de módulos funcionen correctamente.

Recomendaciones
- Asegurar que las llamadas de datos (fetch) usen la URL base (`config.js`) y manejen errores de red/graceful fallback.
- Añadir pruebas unitarias / de integración para el renderizado de tablas y paginación (puede simularse con JSDOM).
- Mejorar accesibilidad de filtros (aria-labels y roles para controles dinámicos).

---

## login.html

Propósito
- Página de autenticación del sistema. Permite ingresar credenciales y establecer la sesión en localStorage.

Estructura y secciones clave
- Formulario `#loginForm` con campos `#email` y `#password`.
- Snippet de desarrollo: existe un bloque que escribe en `window.APP_CONFIG_OVERRIDE.BASE_URL` para apuntar a un proxy local en desarrollo; usar con precaución en producción.
- Importa módulos de cliente para manejar UI y autenticación.

Scripts y dependencias
- `../lib/config.js` — configuración dinámica de `BASE_URL`.
- `../lib/ui.js` — utilidades de interfaz (toasts, modales, validaciones UI).
- `../lib/auth.js` y `../lib/auth-system.js` — lógica de login, almacenamiento de token y flujo de autenticación.
- `../pages_scripts/login-page.js` — manipula el formulario y llamadas al backend.

Ejemplo de uso (desarrollo)
- Para desarrollo local puede usarse el override incluido en la página: modifica `window.APP_CONFIG_OVERRIDE.BASE_URL` hacia `http://localhost:3000/api` o el proxy que uses.

Recomendaciones
- En producción, remover/ocultar el snippet que sobrescribe `BASE_URL` o protegerlo con una condición (p. ej. solo si hostname es `localhost`).
- Validar y limitar reintentos de login para evitar abusos; mostrar errores claros desde la API.

---

## actividades.html

Propósito
- Interfaz principal para crear y gestionar actividades del plan. Incluye un formulario completo, distribución por bimestres, verificación ortográfica y una vista en tarjetas/lista con paginación.

Estructura y secciones clave
- Formulario de edición/creación: `#actividad-form`, `#form-actividad`, `#btn-nueva-actividad`, `#btn-cerrar-form`.
- Generador de descripción: editor contenteditable `#descripcion_actividad_editor` sincronizado con el textarea oculto `#descripcion_actividad`.
- Panel de verificación ortográfica: botones como `#verificar-ortografia`, contadores `data-orthography-*` y paneles `#descripcion-ortografia-panel`.
- Distribución por bimestres: contenedor `#bimestres-grid` con inputs `#bimestre-meta-1..6` y `#bimestre-presupuesto-1..6` y elementos informativos `#bimestres-presupuesto-total`, `#bimestres-meta-total`.
- Lista / tarjetas: `#actividades-grid`; estado vacío `#actividades-empty` y paginación `#actividades-pagination` con `#page-size-select`.
- Modal detalle: `#modal-detalle-actividad` con múltiples contenedores dinámicos (`#modal-area-container`, `#modal-fecha-inicio-container`, etc.).

Scripts y dependencias
- `../lib/loader.js`, `../lib/session-guard.js`, `../lib/sidebar-component.js`.
- `../../public/js/orthography.js` — motor de ortografía (usa diccionarios en `public/dict/`).
- `../pages_scripts/actividades.js` — orquesta el formulario, validaciones, sincronización con el editor contenteditable, bimestres y CRUD.

Consideraciones de integración
- Ortografía: `orthography.js` requiere acceder a `public/dict/*.dic` y `.aff`. Al servir desde un servidor estático, asegúrate que la ruta relativa `../../public/dict/` (o la configurada en `orthography.js`) sea accesible.
- Formularios complejos: el editor contenteditable debe sincronizar su texto al textarea oculto antes del submit; los scripts existentes ya hacen esta sincronización, pero revisa sincronía en navegadores móviles.

Ejemplo rápido (guardar una actividad)
- Rellenar el formulario y pulsar el botón submit; el page-script serializa los campos y hace POST al endpoint de la API (usando `config.BASE_URL`), espera la respuesta y refresca la lista.

Recomendaciones
- Validar límites y tipos (p. ej. suma presupuestos bimestrales = presupuesto total) en el cliente y en el backend.
- Agregar tests de integración que simulen la creación de una actividad y verifiquen la persistencia de la distribución bimestral.
- Considerar debouncing en el buscador `#actividades-search` para mejorar rendimiento.

---

## avance.html

Propósito
- Permite registrar y revisar los avances bimestrales asociados a actividades. Posee filtros, exportación CSV y un modal para registrar/editar avances.

Estructura y secciones clave
- Filtros rápidos: `#filter-actividad`, `#filter-year`, `#filter-bimestre`.
- Card resumen de actividad seleccionada: `#actividad-resumen-nombre`, `#actividad-resumen-meta-plan`, `#actividad-resumen-presupuesto-plan`.
- Tabla de avances: `<table>` con `#avances-body` para el cuerpo dinámico.
- Modal de registro: `#modal-registrar-avance` y formulario `#form-modal-avance` con campos como `actividad_id`, `modal-anio`, `modal-bimestre_id`, `modal-logro_valor`, `modal-presupuesto_ejecutado_bimestre`, y editores contenteditable `#modal-avances-editor` y `#modal-dificultades-editor`.

Scripts y dependencias
- `../lib/loader.js`, `../lib/session-guard.js`, `../lib/sidebar-component.js`.
- `../../public/js/orthography.js` — verificación ortográfica para los editores de texto.
- `../pages_scripts/avances/index.js` — lógica para listar, filtrar, exportar y registrar avances.

Ejemplo de uso
- Abrir la página, seleccionar una actividad en los filtros y pulsar "Registrar avance" para abrir el modal. Completar campos y guardar.

Recomendaciones
- Validar que la suma de logros y presupuestos no exceda los planificados (backend y frontend).
- Exportación CSV: sanitizar campos (e.g., comillas, nuevas líneas) para que la descarga funcione en distintos navegadores.

---

## admin.html

Propósito
- Panel administrativo para operadores con permisos (administradores). Incluye gestión de catálogos, usuarios, actividades y registros de avances.

Estructura y secciones clave
- Panel Catálogo: `#catalogo-tipo`, `#catalogo-refrescar`, tabla `#catalogo-tabla` y formulario `#catalogo-form`.
- Panel Usuarios: `#usuarios-recargar`, tabla `#usuarios-tabla`, y formulario `#usuarios-form` para crear usuarios con rol/área.
- Panel Actividades: `#actividades-recargar`, tabla `#actividades-tabla` y `#actividades-form` para editar.
- Panel Avances: `#avances-recargar` y `#avances-tabla` con edición en `#avances-form`.

Scripts y dependencias
- `../lib/session-guard.js`, `../lib/sidebar-component.js`, `../lib/loader.js`.
- `../pages_scripts/admin.js` — control principal para cargar catálogos, usuarios y acciones administrativas.

Seguridad y recomendaciones
- Asegurar que los endpoints backend autorizan cada operación (roles/permiso) — el frontend asume que el backend controla la autorización.
- Evitar exponer listas completas de usuarios con datos sensibles; paginar y filtrar en el backend cuando la tabla sea grande.
- Asegurar que la creación de usuarios haga hashing y salting correctamente (mencionado en la UI), y preferir enviar la contraseña temporal por canales seguros.

---

## Contratos y práctica recomendada
- Todas las páginas usan `config.js` para resolver `BASE_URL` y deben usar `fetch` con rutas relativas basadas en esa configuración.
- Para desarrollo local se recomienda usar `npm run start` (internamente `vercel dev`) o ejecutar `npx vercel dev --listen 3000` para contar con proxy y estáticos.

Edge cases a considerar
- Formularios con campos numéricos vacíos o NaN.
- Intentos concurrentes de edición (dos usuarios editando la misma actividad).
- Fallos en la carga de diccionarios de ortografía (cargar fallback o deshabilitar el checker si los recursos no están disponibles).

---

## Créditos

Este documento fue creado por Manolo Rey Garcia.


