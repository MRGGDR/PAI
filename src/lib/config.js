/**
 * @fileoverview Configuracion central del sistema - Gestion de URLs y entornos
 * Determina que endpoint debe usar el frontend para llegar al backend real.
 * Prioridad de resolucion:
 * 1. window.APP_CONFIG_OVERRIDE.BASE_URL (permite inyectar overrides en runtime)
 * 2. En hosts locales/privados se puede optar por un proxy local apuntando a /api
 * 3. En otros entornos se usa '/api' (servidor serverless) como puerta de enlace única
 */

const LOCAL_PROXY_FLAG_KEY = 'USE_LOCAL_PROXY';

/** URL de configuracion desde window, si existe (override manual) */
const _fromWindow = (typeof window !== 'undefined'
  && window.APP_CONFIG_OVERRIDE
  && window.APP_CONFIG_OVERRIDE.BASE_URL)
  ? window.APP_CONFIG_OVERRIDE.BASE_URL
  : '';

/** URL del proxy local opcional */
export const LOCAL_PROXY_URL = 'http://localhost:3000/api';

const DEFAULT_API_URL = '/api';

function isLocalHost() {
  try {
    if (typeof window === 'undefined' || !window.location) return false;
    const h = window.location.hostname || '';
    if (h === 'localhost' || h === '127.0.0.1') return true;
    if (/^10\./.test(h)) return true;
    if (/^192\.168\./.test(h)) return true;
    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(h)) return true;
  } catch (err) {
    // Ignorar y considerar que no es host local
  }
  return false;
}

function readLocalProxyFlag() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    return window.localStorage.getItem(LOCAL_PROXY_FLAG_KEY) === 'true';
  } catch (err) {
    return false;
  }
}

let resolvedBase = _fromWindow;

if (!resolvedBase) {
  if (isLocalHost()) {
    resolvedBase = readLocalProxyFlag() ? LOCAL_PROXY_URL : DEFAULT_API_URL;
  } else {
    resolvedBase = DEFAULT_API_URL;
  }
}

/**
 * Configuracion global consumida por el resto de la app.
 */
export const APP_CONFIG = {
  BASE_URL: resolvedBase,
  API_URL: resolvedBase,
  LOCAL_PROXY_URL,
  LOCAL_PROXY_FLAG_KEY,
  LOGIN_TIMEOUT_MS: 15000
};

// Exponer configuracion en window para scripts que no usan modulos ES
if (typeof window !== 'undefined') {
  window.APP_CONFIG = APP_CONFIG;
}

/**
 * Helper asincrono para obtener la configuracion (API retro-compatible)
 */
export async function getConfig() {
  return {
    SCRIPT_URL: APP_CONFIG.BASE_URL,
    LOCAL_PROXY_URL,
    LOGIN_TIMEOUT_MS: APP_CONFIG.LOGIN_TIMEOUT_MS
  };
}



