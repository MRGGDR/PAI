/**
 * @fileoverview Configuracion central del sistema - Gestion de URLs y entornos
 * Determina que endpoint debe usar el frontend para llegar al backend real.
 * Prioridad de resolucion:
 * 1. window.APP_CONFIG_OVERRIDE.BASE_URL (permite inyectar overrides en runtime)
 * 2. En hosts locales/privados se usa, por defecto, el Apps Script desplegado
 *    a menos que el desarrollador pida explicitamente el proxy local
 * 3. En otros entornos (ej. Vercel) se usa '/api' para aprovechar la funcion serverless
 */

const LOCAL_PROXY_FLAG_KEY = 'USE_LOCAL_PROXY';

/** URL de configuracion desde window, si existe (override manual) */
const _fromWindow = (typeof window !== 'undefined'
  && window.APP_CONFIG_OVERRIDE
  && window.APP_CONFIG_OVERRIDE.BASE_URL)
  ? window.APP_CONFIG_OVERRIDE.BASE_URL
  : '';

/** URL del Apps Script desplegado (backend real) */
export const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxgt5fpDd1PDjSd6MQyAij2fUNUFigDVDLf2jCfwq8e9sPBC1hhxQxzDgdKKGasdtixRg/exec';

/** URL del proxy local opcional */
export const LOCAL_PROXY_URL = 'http://localhost:3000/api';

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
    resolvedBase = readLocalProxyFlag() ? LOCAL_PROXY_URL : APPS_SCRIPT_URL;
  } else {
    resolvedBase = '/api';
  }
}

/**
 * Configuracion global consumida por el resto de la app.
 */
export const APP_CONFIG = {
  BASE_URL: resolvedBase,
  APPS_SCRIPT_URL,
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
    APPS_SCRIPT_URL,
    LOCAL_PROXY_URL,
    LOGIN_TIMEOUT_MS: APP_CONFIG.LOGIN_TIMEOUT_MS
  };
}



