# src/lib: Librería de utilidades del frontend

Este documento describe en detalle los archivos contenidos en `src/lib`. Cada sección explica el propósito del archivo, las funciones principales, contratos (entradas/salidas), ejemplos de uso y consideraciones operativas o de seguridad.

Archivo creado para servir de referencia técnica para desarrolladores que trabajen en el frontend del proyecto.

---

## Resumen de la carpeta

Archivos documentados:
- `config.js`: resolución de URLs y configuración global de entorno.
- `ui.js`: utilidades de interfaz (toasts, modales, mensajes).
- `auth.js`: cliente de autenticación y helpers de sesión (login/logout/isAuthenticated).
- `auth-system.js`: redirección automática según estado de autenticación (auto-run).
- `loader.js`: indicador de carga global y helper `showLoaderDuring`.
- `session-guard.js`: monitoreo de sesión e inactividad en páginas protegidas.
- `sidebar.js`: comportamiento de la barra lateral (expand/collapse/pinning/highlight).
- `sidebar-component.js`: renderer reutilizable de sidebar y wiring de logout.
- `login-page.js`: controlador de la UI de la página de login (validaciones, carrusel).
- `roles.js`: normalización de roles, permisos y utilidades relacionadas.

---

## `config.js`

Propósito
- Centraliza la resolución de la URL base que usará el frontend para llamar al backend. Soporta overrides en `window.APP_CONFIG_OVERRIDE` y un modo para usar proxy local durante desarrollo.

Exportaciones
- `LOCAL_PROXY_URL`: URL del proxy local (dev).
- `APP_CONFIG`: objeto final con `BASE_URL`, `API_URL`, `LOCAL_PROXY_URL`, `LOGIN_TIMEOUT_MS`.
- `getConfig()`: helper asíncrono que devuelve un objeto con la configuración (retro-compatible).

Comportamiento
- Prioridad de resolución de `BASE_URL`:
  1. `window.APP_CONFIG_OVERRIDE.BASE_URL` (override runtime).
  2. Si el host es local (localhost/10.x/192.168.x/172.16-31.*) usa `LOCAL_PROXY_URL` cuando `localStorage[USE_LOCAL_PROXY] === 'true'`; en caso contrario usa `/api`.
  3. En otros casos devuelve `/api` para integrarse con la función serverless.

Ejemplo de override en la consola del navegador (runtime):

```javascript
window.APP_CONFIG_OVERRIDE = { BASE_URL: 'http://localhost:3000/api' };
// luego recargar o re-evaluar import/uso de getConfig()
```

Recomendaciones
- Para desarrollo activo, usar el flag `LOCAL_PROXY_FLAG_KEY` almacenado en `localStorage` para alternar el proxy local sin editar código fuente.
- Evitar hardcodear URLs; consumir `APP_CONFIG.BASE_URL` o importar `callBackend` desde `src/services/apiService.js`.

---

## `ui.js`

Propósito
- Provee utilidades para notificaciones tipo toast, abrir/cerrar modales y una API mínima (`UI`) usada por otras partes del frontend.

API principal
- `toast(type, message, opts)`: muestra una notificación y retorna { dismiss, element }.
- `dismissAllToasts()`: elimina todas las notificaciones.
- `openModal(id)`, `closeModal(id)`: controlan el modal por id.
- `showMessage(message, type, ms)`: compatibilidad con API simplificada.

Comportamiento
- Se asegura de crear un contenedor `#toastContainer` con roles ARIA apropiados.
- Soporta temas (`success`, `error`, `warning`, `info`) y opciones como `duration`, `dismissible`, `showProgress`.

Ejemplo de uso

```javascript
import { UI } from './lib/ui.js';

UI.toast('success', 'Operación completada', { duration: 3000 });
// o
UI.showMessage('Error al guardar', 'error', 5000);
```

Consideraciones
- `toast` intenta ser resiliente en ambientes no DOM (SSR): si `document` no existe, hace un `console.info` como fallback.
- Para accesibilidad, cada toast tiene `role="alert"` y `aria-live` según la severidad.

---

## `auth.js`

Propósito
- Cliente de autenticación en el frontend. Implementa `login`, `logout`, `isAuthenticated`, `currentEmail`, `currentRole`, `getSessionTimeRemaining`, `renewToken`, `startSessionMonitoring`.

Comportamiento y contrato
- `login(email, password)` usa `callBackend('auth/login', payload)` para hablar con `/api` y espera la estructura `{ success, data: {...}, message }`.
- Cuando el backend responde con un `token` en `data.token`, lo guarda en `localStorage.auth_token`. Si no hay token, genera un token local básico (base64) para permitir flujos de UI.
- `isAuthenticated()` decodifica el token local (espera formato base64 `email|timestamp`) y valida expiración (1 hora). Si expira borra sesión y retorna false.

Ejemplo de login (simple):

```javascript
import { Auth } from './lib/auth.js';

const res = await Auth.login('juan@gestiondelriesgo.gov.co', 'miPassword');
if(res.success) { console.log('Logged in!'); }
else { console.error('Login failed:', res.message); }
```

Consideraciones de seguridad y mejoras recomendadas
- Actualmente el token local es base64 con timestamp cuando el backend no devuelve token firmado; esto es un fallback de UX. En producción siempre debe usarse un token firmado por el servidor (JWT o HMAC) y validarse correctamente.
- Toda la comunicación pasa por `/api` con `callBackend`; no debe exponerse la URL real del Apps Script en el navegador.
- Manejar errores de red: `login` incorpora timeout con un helper que envuelve la promesa de `callBackend`.

---

## `auth-system.js`

Propósito
- Módulo autoejecutable que, en `DOMContentLoaded`, redirige a usuarios autenticados desde páginas públicas (`login.html`, `index.html`) al `dashboard.html`.

Comportamiento
- Comprueba `Auth.isAuthenticated()` y la ruta actual; si corresponde, redirige.

Notas
- Es seguro dejarlo cargado en páginas públicas porque hace una verificación simple y falla silenciosamente si `Auth` no está listo.

---

## `loader.js`

Propósito
- Provee un spinner/blocking UI mínimo y el helper `showLoaderDuring` que ejecuta promesas mostrando el loader y asegurando un tiempo mínimo visible para evitar parpadeos.

API
- `showLoader(msg, style)`: muestra un loader con estilo (`solid`, `toast`, `inline`).
- `showLoaderDuring(promiseOrFunc, msg, style, minMs)`: muestra loader, ejecuta la promesa o función y lo oculta garantizando un mínimo `minMs` visible.
- `hideLoader()`: oculta y remueve el loader.

Ejemplo

```javascript
import { showLoaderDuring } from './lib/loader.js';

const resp = await showLoaderDuring(fetch('/api', { method: 'GET' }), 'Cargando datos...', 'transparent', 500);
```

Consideraciones
- `ensureLoaderElement` manipula el DOM y añade markup; si se desea un diseño distinto, reemplazar las clases o inyectar estilos en CSS del proyecto.

---

## `session-guard.js`

Propósito
- Proteger páginas no públicas, monitorizar inactividad del usuario y redirigir al login cuando la sesión expire. Incluye advertencias antes de la expiración y control de listeners de actividad.

Comportamiento
- Crea una instancia `SessionGuard` que:
  - Verifica `Auth.isAuthenticated()` al inicio.
  - Escucha eventos de actividad (mousemove, keypress, scroll, etc.) para resetear último tiempo de actividad.
  - Cada 30s verifica tiempo restante y muestra advertencias si faltan pocos minutos.
  - Redirige a `login.html` cuando la sesión expira.

Uso
- Se auto-inicializa en DOMContentLoaded en páginas distintas a `login.html`/`index.html`. También exporta la clase `SessionGuard` para inicialización manual.

Consideraciones
- La heurística de inactividad y tiempos (45 min inactividad, alerta a 5 min) puede ajustarse a políticas de seguridad de la organización.
- Si la aplicación necesita persistir actividad entre pestañas, considerar usar BroadcastChannel o storage events más completos.

---

## `sidebar.js`

Propósito
- Implementa la lógica de comportamiento de la barra lateral: expand/collapse, pin/unpin persistente en `localStorage`, nudge/offset de layout y resaltado del link activo.

Funciones exportadas
- `initSidebar(target, options)`: inicializa comportamiento en un elemento o selector.
- `ensureInitForElement(el)`: helper pequeño para inicializar un sidebar específico.

Características técnicas
- Usa `requestAnimationFrame` para aplicar transiciones suavemente.
- Persiste el estado `pinned` en `localStorage` bajo una `storageKey` configurable.
- Observa el DOM con `MutationObserver` para inicializar sidebars insertados dinámicamente.

Ejemplo de inicialización (manual):

```javascript
import { initSidebar } from './lib/sidebar.js';
initSidebar('#my-sidebar', { storageKey: 'myAppSidebarPinned' });
```

Recomendaciones
- Mantener estilos CSS (variables `--sidebar-expanded-w` / `--sidebar-collapsed-w`) coherentes con las clases que `initSidebar` manipula.

---

## `sidebar-component.js`

Propósito
- Renderiza dinámicamente un `aside.sidebar` canónico con navegación y wiring para logout; es reutilizable para integrar el sidebar en páginas que no tienen markup estático.

Funciones
- `renderSidebar(target, options)`: crea e inserta el `aside` en `target` (selector o elemento). Opcional `logoutHandler` permite inyectar lógica de cierre de sesión.

Comportamiento
- Resuelve rutas relativas según si la app está sirviendo archivos `.html` o rutas SPA.
- Determina el rol actual leyendo `localStorage.auth_role` y filtra items del menú según permisos.
- Intenta conectar un logout: preferir `options.logoutHandler`, luego `window.Auth.logout`, y como fallback intenta importar dinámicamente `./auth.js` para llamar `logout()`.

Ejemplo de uso

```javascript
import { renderSidebar } from './lib/sidebar-component.js';
renderSidebar('#shared-sidebar', { logoutHandler: () => { console.log('logout'); /* opcional: llamar API */ } });
```

Consideraciones
- El componente depende de `roles.js` para normalizar rol y de `session-guard.js` para protección automática. Evitar cargas redundantes si la página ya inicializa dichos módulos.

---

## `login-page.js`

Propósito
- Controlador de la UI de login: validaciones de formulario, envío de credenciales, manejo de respuesta y UX del carrusel de información.

Clase principal
- `LoginPage`: se inicializa al `DOMContentLoaded`, gestiona evento `submit`, valida email y contraseña y usa `Auth.login` + `showLoaderDuring` para el proceso.

Comportamiento
- Valida que el email tenga formato y que la contraseña tenga al menos 3 caracteres.
- Durante el login deshabilita campos, muestra loaders y mensajes usando `UI`.

Ejemplo de integración

```html
<!-- markup esperado en login.html -->
<form id="loginForm">
  <input id="email" />
  <div id="emailError"></div>
  <input id="password" type="password" />
  <div id="passwordError"></div>
  <button type="submit">Iniciar Sesión</button>
</form>
```

Notas
- Validaciones son intencionadamente simples; para requisitos más estrictos integrar con una librería de validación (ej. yup) o patrón unificado.

---

## `roles.js`

Propósito
- Normalizar roles, mapear aliases y proporcionar verificación de permisos basada en una tabla simple `ROLE_PERMISSIONS`.

Funciones exportadas
- `normalizarRol(rol)`: devuelve `admin|contribuidor|visualizador`.
- `obtenerPermisosRol(rol)`: devuelve permisos como objeto booleano.
- `tienePermiso(rol, permiso)`: shortcut boolean.
- `esRolAdministrador`, `esRolContribuidor`, `esRolVisualizador`.

Ejemplo

```javascript
import { normalizarRol, tienePermiso } from './lib/roles.js';
const rol = normalizarRol('Administrador'); // 'admin'
if (tienePermiso(rol, 'activities:create')) { /* mostrar botón Crear */ }
```

Consideraciones
- La matriz `ROLE_ALIASES` permite compatibilidad con strings informales; si el sistema central de usuarios cambia, mantener sincronizada esta tabla o delegar autorización al backend.

---

## Consideraciones generales para `src/lib`

- Centralización de estado: varios módulos (Auth, roles, sidebar) dependen de `localStorage` para persistencia de sesión/estado. Evitar inconsistencias cuando múltiples pestañas pueden modificar el mismo estado; considerar BroadcastChannel o `storage` event handlers para sincronizar entre pestañas.
- Tokens y seguridad: el flujo actual admite un token creado localmente como fallback; en producción asegurarse de que el backend devuelva tokens firmados y que el frontend valide su expiración/firmas (o al menos delegue validación al backend en cada operación sensible).
- Testing: estos módulos son fáciles de unit-testear si se abstraen dependencias del DOM y `localStorage`. Recomiendo añadir pequeñas pruebas unitarias que mockeen `localStorage`, `fetch` y `document` para validar flujos críticos (login, session expiration, sidebar pinning).
- Accesibilidad (a11y): `ui.js` y `loader.js` ya añaden roles ARIA; mantener estas prácticas al modificar la UI y validar con herramientas de accesibilidad.
- Rendimiento: `sidebar.js` y `session-guard.js` usan listeners y `MutationObserver`; asegurarse de que no se añadan múltiples instancias por error para evitar memory leaks. Los módulos ya intentan idempotencia (`dataset.sidebarInit`), pero es importante respetar esa convención.

---

## Créditos

Este documento fue creado por Manolo Rey Garcia.
