/**
 * config.js - Configuración para el módulo de actividades
 */

import '../../lib/debug-filter.js';

// URLs y puntos de configuración
export const CONFIG_BACKEND = {
  SCRIPT_URL: resolveScriptUrl()
};

/**
 * Opciones para los campos de descripción en formularios
 * @type {Object}
 */
export const opcionesDescripcion = {
  rows: 4,
  maxLength: 500,
  placeholder: 'Ingrese una descripción detallada...',
  validationRules: {
    required: true,
    minLength: 10
  }
};

/**
 * Determina si se debe usar Content-Type text/plain para un URL
 * @param {string} url - URL a evaluar
 * @returns {boolean} Verdadero si debe usar text/plain
 */
export function shouldUseTextPlain(url) {
  try {
    if (!url) return false;
    if (!/^https?:\/\//.test(url)) return false;
    const parsed = new URL(url, window.location.href);
    const host = parsed.hostname || '';
    return host.endsWith('script.google.com') || host.endsWith('googleusercontent.com');
  } catch (err) {
    return false;
  }
}

/**
 * Resuelve la URL del script backend
 * @returns {string} URL del backend
 */
export function resolveScriptUrl() {
  const DEFAULT_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxgt5fpDd1PDjSd6MQyAij2fUNUFigDVDLf2jCfwq8e9sPBC1hhxQxzDgdKKGasdtixRg/exec';
  const DEFAULT_DEV_URL = 'http://localhost:3000/api';
  let scriptUrl = null;

  try {
    console.log('[CONFIG] Resolviendo URL del backend...');
    
    // Verificar que window existe
    if (typeof window === 'undefined') {
      console.warn('[CONFIG] window no está definido, usando URL por defecto');
      return DEFAULT_SCRIPT_URL;
    }
    
    // Intentar obtener desde configuración global
    if (window.APP_CONFIG_OVERRIDE?.SCRIPT_URL) {
      console.log('[CONFIG] Usando URL de APP_CONFIG_OVERRIDE');
      scriptUrl = window.APP_CONFIG_OVERRIDE.SCRIPT_URL;
    } else if (window.APP_CONFIG?.SCRIPT_URL) {
      console.log('[CONFIG] Usando URL de APP_CONFIG');
      scriptUrl = window.APP_CONFIG.SCRIPT_URL;
    } else {
      // Verificar si estamos en entorno local
      try {
        const host = window.location?.hostname;
        if (['localhost', '127.0.0.1'].includes(host)) {
          console.log('[CONFIG] Detectado entorno local');
          
          // Verificar si se debe usar el proxy local
          let useLocalProxy = false;
          try {
            useLocalProxy = localStorage.getItem('USE_LOCAL_PROXY') === 'true';
          } catch (storageErr) {
            console.warn('[CONFIG] Error accediendo a localStorage:', storageErr);
          }
          
          if (useLocalProxy) {
            console.log('[CONFIG] Usando proxy de desarrollo local');
            scriptUrl = DEFAULT_DEV_URL;
          }
        }
      } catch (locationErr) {
        console.warn('[CONFIG] Error detectando hostname:', locationErr);
      }
    }
    
    // Si aún no se ha establecido, usar valor por defecto
    if (!scriptUrl) {
      console.log('[CONFIG] Usando URL de script por defecto');
      scriptUrl = DEFAULT_SCRIPT_URL;
    }
    
    console.log('[CONFIG] URL del backend resuelta:', scriptUrl);
    return scriptUrl;
    
  } catch (error) {
    console.error('[ERROR] Error resolviendo URL de script:', error);
    return DEFAULT_SCRIPT_URL;
  }
}