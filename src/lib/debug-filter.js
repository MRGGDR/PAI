/**
 * debug-filter.js
 * Filtra y controla la salida de logs en consola para que los mensajes
 * de debug sólo se muestren cuando el usuario es admin y activa la vista
 * de debug desde el panel de administración.
 */

(function(){
  if (typeof window === 'undefined' || !window.console) return;

  const original = {
    log: console.log?.bind(console) || function() {},
    debug: console.debug?.bind(console) || console.log?.bind(console) || function() {},
    info: console.info?.bind(console) || console.log?.bind(console) || function() {},
    warn: console.warn?.bind(console) || function() {},
    error: console.error?.bind(console) || function() {}
  };

  function obtenerRolStored(){
    try {
      if (typeof window.obtenerRolUsuarioActual === 'function') {
        return window.obtenerRolUsuarioActual() || '';
      }
      const r = localStorage.getItem('auth_role');
      return r || '';
    } catch(e) { return ''; }
  }

  function esAdmin() {
    try {
      const rol = (obtenerRolStored() || '').toString().trim().toLowerCase();
      return rol === 'admin' || rol.includes('admin') || rol.includes('administrador');
    } catch(e) { return false; }
  }

  function isDebugFlagEnabled() {
    try {
      // Sólo permitir si el rol es admin
      if (!esAdmin()) return false;
      const v = localStorage.getItem('admin_debug');
      return v === '1' || v === 'true' || v === 'on';
    } catch(e) { return false; }
  }

  // Exponer administrador simple en window
  window.DebugManager = window.DebugManager || {
    isEnabled: () => !!isDebugFlagEnabled(),
    setEnabledForAdmin: (enabled) => {
      try {
        if (!esAdmin()) {
          original.warn('[DebugManager] Acceso denegado: usuario no es admin');
          return false;
        }
        localStorage.setItem('admin_debug', enabled ? '1' : '0');
        original.info('[DebugManager] Debug ' + (enabled ? 'habilitado' : 'deshabilitado'));
        return true;
      } catch(e) {
        original.error('[DebugManager] Error al cambiar flag de debug:', e);
        return false;
      }
    }
  };

  // Sobrescribir console.debug: sólo mostrar si está habilitado
  console.debug = function(...args){
    try {
      if (isDebugFlagEnabled()) {
        original.debug(...args);
      }
    } catch(e) {}
  };

  // Filtrar console.log que contengan marcadores tipo [DEBUG], [CONFIG], [INFO], [OK], etc.
  // Cualquier mensaje que empiece con un tag entre corchetes y letras mayúsculas
  // se considera 'diagnóstico' y sólo se mostrará si el DebugManager está habilitado.
  const BRACKET_TAG_RE = /^\s*\[[A-Z_][A-Z0-9_-]*\]/;

  console.log = function(...args){
    try {
      const first = args[0];
      if (typeof first === 'string' && BRACKET_TAG_RE.test(first)) {
        if (isDebugFlagEnabled()) {
          original.log(...args);
        }
        return;
      }
      // Passthrough para otros logs
      original.log(...args);
    } catch(e) {}
  };

  // También aplicar la misma política a console.info para mensajes etiquetados
  const originalInfo = original.info;
  console.info = function(...args){
    try {
      const first = args[0];
      if (typeof first === 'string' && BRACKET_TAG_RE.test(first)) {
        if (isDebugFlagEnabled()) {
          originalInfo(...args);
        }
        return;
      }
      originalInfo(...args);
    } catch(e) {
      try { originalInfo(...args); } catch(_) {}
    }
  };

  // Opcional: bloquear otros métodos si se quisiera (no cambia por ahora)
  // console.info/console.warn/console.error se mantienen igual para alertas/errores

})();
