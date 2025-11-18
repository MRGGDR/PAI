/**
 * config.js - Configuración para el módulo de actividades
 */

import '../../lib/debug-filter.js';
import { APP_CONFIG } from '../../lib/config.js';

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
export function shouldUseTextPlain() {
  return false;
}

/**
 * Resuelve la URL del script backend
 * @returns {string} URL del backend
 */
export function resolveScriptUrl() {
  const fallback = '/api';
  if (typeof window === 'undefined') {
    return APP_CONFIG.BASE_URL || fallback;
  }

  if (window.APP_CONFIG_OVERRIDE?.SCRIPT_URL) {
    return window.APP_CONFIG_OVERRIDE.SCRIPT_URL;
  }

  if (window.APP_CONFIG_OVERRIDE?.BASE_URL) {
    return window.APP_CONFIG_OVERRIDE.BASE_URL;
  }

  if (window.APP_CONFIG?.SCRIPT_URL) {
    return window.APP_CONFIG.SCRIPT_URL;
  }

  if (window.APP_CONFIG?.BASE_URL) {
    return window.APP_CONFIG.BASE_URL;
  }

  return APP_CONFIG.BASE_URL || fallback;
}