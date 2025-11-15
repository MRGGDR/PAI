/**
 * @fileoverview Utilidades mínimas para mostrar indicadores de carga
 * Este módulo proporciona funciones básicas para gestionar los estados de carga
 * que pueden ser utilizados en toda la aplicación. Pueden ser reemplazados
 * por implementaciones más completas a nivel de UI.
 */

/**
 * Muestra un indicador de carga
 * @param {string} msg - Mensaje a mostrar durante la carga
 * @param {string} style - Estilo del loader ('solid', 'toast', 'inline')
 */
import './debug-filter.js';

const VARIANT_CLASS = {
  solid: 'app-loader--blocking',
  blocking: 'app-loader--blocking',
  fullscreen: 'app-loader--blocking',
  toast: 'app-loader--toast',
  transparent: 'app-loader--toast',
  inline: 'app-loader--inline'
};

function ensureLoaderElement() {
  if (typeof document === 'undefined' || !document.body) return null;
  let el = document.getElementById('appLoader');
  if (!el) {
    el = document.createElement('div');
    el.id = 'appLoader';
    el.className = 'app-loader app-loader--blocking';
    el.innerHTML = `
      <div class="app-loader__backdrop" aria-hidden="true"></div>
      <div class="app-loader__inner" role="status" aria-live="assertive">
        <div class="loader" aria-hidden="true">
          <span class="letter">U</span>
          <span class="letter">N</span>
          <span class="letter">G</span>
          <span class="letter">R</span>
          <span class="letter">D</span>
        </div>
      </div>
    `;
    document.body.appendChild(el);
  }
  return el;
}

function applyVariant(el, style) {
  if (!el) return;
  const normalized = (style || '').toString().toLowerCase();
  const variant = VARIANT_CLASS[normalized] || VARIANT_CLASS.solid;
  el.classList.remove('app-loader--blocking', 'app-loader--toast', 'app-loader--inline');
  el.classList.add(variant);
}

export function showLoader(msg = 'Cargando...', style = 'solid'){
  try {
    const el = ensureLoaderElement();
    if (!el) return;
    applyVariant(el, style);
    const innerEl = el.querySelector('.app-loader__inner');
    if (innerEl) {
      const message = msg && msg.trim() ? msg : 'Cargando...';
      innerEl.setAttribute('aria-label', message);
    }
    if (document?.body) {
      document.body.classList.add('app-loader-visible');
    }
    el.dataset.active = 'true';
    el.style.opacity = '1';
  } catch (e) {
    console.log('[loader]', msg, style, e);
  }
}

/**
 * Muestra un indicador de carga mientras se resuelve una promesa o se ejecuta una función
 * Garantiza un tiempo mínimo de visualización para evitar parpadeos en operaciones rápidas
 * 
 * @param {Promise|Function} promiseOrFunc - Promesa a resolver o función que devuelve una promesa
 * @param {string} msg - Mensaje a mostrar durante la carga
 * @param {string} style - Estilo del loader ('solid', 'toast', etc.)
 * @param {number} minMs - Tiempo mínimo en milisegundos que se mostrará el indicador
 * @returns {Promise<any>} - El resultado de la promesa o función ejecutada
 */
export async function showLoaderDuring(promiseOrFunc, msg = 'Procesando...', style='solid', minMs = 300){
  showLoader(msg, style);
  const start = Date.now();
  let result;
  
  if(typeof promiseOrFunc === 'function'){
    result = await promiseOrFunc();
  } else {
    result = await promiseOrFunc;
  }
  
  // Garantiza un tiempo mínimo de visualización para evitar parpadeos
  const elapsed = Date.now() - start;
  if(elapsed < minMs) await new Promise(r => setTimeout(r, minMs - elapsed));
  // Ocultar loader DOM
  hideLoader();

  return result;
}
export function hideLoader() {
  try {
    const el = document.getElementById('appLoader');
    if (el) {
      el.dataset.active = 'false';
      el.style.opacity = '0';
      if (el.parentNode) {
        el.parentNode.removeChild(el);
      }
    }
    if (typeof document !== 'undefined' && document.body) {
      document.body.classList.remove('app-loader-visible');
    }
  } catch (e) {}
}

if (typeof window !== 'undefined') {
  window.APP_LOADER = window.APP_LOADER || {};
  window.APP_LOADER.showLoader = showLoader;
  window.APP_LOADER.showLoaderDuring = showLoaderDuring;
  window.APP_LOADER.hideLoader = hideLoader;

  // Aliases para compatibilidad con código que espera funciones globales
  if (!window.showLoader) {
    window.showLoader = showLoader;
  }
  if (!window.hideLoader) {
    window.hideLoader = hideLoader;
  }
  if (!window.showLoaderDuring) {
    window.showLoaderDuring = showLoaderDuring;
  }
}

