/**
 * @fileoverview Sistema de autenticación automático
 * Este módulo implementa un sistema de redirección automática para los usuarios autenticados
 * que acceden a las páginas públicas como login o index. Se ejecuta automáticamente
 * cuando se carga el DOM.
 */

import './debug-filter.js';
import { Auth } from './auth.js';

/**
 * Listener que se ejecuta cuando el DOM está completamente cargado
 * Redirige automáticamente a los usuarios autenticados al dashboard 
 * cuando intentan acceder a páginas públicas (login, index)
 */
document.addEventListener("DOMContentLoaded", () => {
  // Solo redirige usuarios autenticados al dashboard cuando están en
  // la página de login o index. Esto evita redirecciones no deseadas
  // desde otras páginas de la aplicación como admin-sectional.html.
  try {
    // Verifica si el sistema de autenticación está disponible
    if(!Auth) return;
    
    // Comprueba si el usuario está autenticado
    if(Auth.isAuthenticated()){
      // Obtiene la página actual desde la URL
      const current = (location.pathname || '').split('/').pop() || '';
      
      // Lista de páginas desde las que se debe redirigir si el usuario está autenticado
      const redirectFrom = ['login.html', 'index.html', ''];
      
      // Si la página actual está en la lista, redirige al dashboard
      if(redirectFrom.includes(current)){
        window.location.href = "./dashboard.html";
      }
    }
  } catch(e) {
    // Falla silenciosamente para evitar errores si Auth no está listo
    console.warn('auth-system check failed', e);
  }
});