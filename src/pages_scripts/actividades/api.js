/**
 * api.js - Servicios de comunicación con el backend para actividades
 */

import { shouldUseTextPlain, resolveScriptUrl } from './config.js';
import { obtenerEmailUsuarioActual } from './utils.js';

/**
 * Clase para manejar la comunicación con el backend
 */
class ApiService {
  constructor() {
    // Inicializar con valores por defecto
    this.backendUrl = null; // Se inicializará en la primera llamada
    this.actividadesCache = [];
    this.avancesCache = [];
    this.catalogosCache = {};
    
    // Ya no se usa la detección de entorno local - siempre se conecta al backend real
    console.log('[INFO] ApiService inicializado');
  }
  
  // Mock data removed

  /**
   * Envía una solicitud al backend
   * @param {string} endpoint - Endpoint a llamar
   * @param {Object} payload - Datos a enviar
   * @param {Object} options - Opciones adicionales
   * @returns {Promise<Object>} Respuesta del servidor
   */
  async callBackend(endpoint, payload = {}, options = {}) {
    console.log('[DEBUG] callBackend recibió endpoint:', endpoint, 'tipo:', typeof endpoint);
    
    const { loaderMessage = 'Cargando...', noCredentials = false } = options;
    
    // Validar que endpoint sea un valor válido usando una lógica más estricta y con más debug
    if (!endpoint) {
      console.error('[ERROR] callBackend recibió un endpoint inválido:', endpoint);
      throw new Error('Campo path requerido');
    }
    
    // Endpoint es una string pero necesitamos asegurarnos que realmente tenga contenido
    if (typeof endpoint !== 'string') {
      console.warn('[WARN] callBackend recibió un endpoint que no es string:', endpoint, 'intentando convertir');
      endpoint = String(endpoint);
    }
    
    // Después de las validaciones y conversiones, verificar nuevamente
    if (!endpoint || endpoint.trim() === '') {
      console.error('[ERROR] Después de validación, endpoint sigue siendo inválido');
      throw new Error('Campo path requerido (después de validación)');
    }
    
    // Asegurarse que el endpoint no tenga espacios al inicio o final
    endpoint = endpoint.trim();
    
    // Inicializar backendUrl si no se ha hecho aún
    if (!this.backendUrl) {
      console.log('[INFO] Inicializando backendUrl');
      
      try {
        // Usar la función resolveScriptUrl para obtener la URL del backend
        this.backendUrl = resolveScriptUrl();
        console.log('[INFO] backendUrl inicializada desde resolveScriptUrl:', this.backendUrl);
      } catch (error) {
        console.error('[ERROR] Error resolviendo URL del backend:', error);

        // Si falla, usar el valor predeterminado
  this.backendUrl = 'https://script.google.com/macros/s/AKfycbxgt5fpDd1PDjSd6MQyAij2fUNUFigDVDLf2jCfwq8e9sPBC1hhxQxzDgdKKGasdtixRg/exec';

        console.warn('[WARN] Usando URL de backend por defecto:', this.backendUrl);
      }
    }
    
    try {
      // Mostrar loader si está disponible
      if (typeof window !== 'undefined' && window.showLoader && loaderMessage) {
        window.showLoader(loaderMessage);
      }
      
      // Verificar que backendUrl está definida
      if (!this.backendUrl) {
        this.backendUrl = resolveScriptUrl();
        console.log('[INFO] backendUrl inicializada en preparación de URL:', this.backendUrl);
      }
      
      // Preparar la URL - Para mayor compatibilidad, incluimos el path tanto en la URL como en el payload
      // Esto garantiza que funcione con diferentes versiones del backend
      const url = this.backendUrl;
      
      // Opcionalmente se puede incluir en URL, pero ahora lo principal es enviarlo en el payload
      // const url = this.backendUrl.includes('?') 
      //   ? `${this.backendUrl}&path=${endpoint}`
      //   : `${this.backendUrl}?path=${endpoint}`;
        
      console.log('[DEBUG] URL preparada para fetch:', url);
      
      // Preparar los headers
      const headers = {
        'Content-Type': shouldUseTextPlain(url) ? 'text/plain' : 'application/json',
      };
      
      // Preparar payload estructurado para el backend (path + payload anidado)
      const requestPayload = payload && typeof payload === 'object' ? { ...payload } : {};
      const usuarioActual = requestPayload.usuario || obtenerEmailUsuarioActual();

      if (!requestPayload.usuario) {
        requestPayload.usuario = usuarioActual;
      }

      const data = {
        path: endpoint,
        payload: requestPayload,
        usuario: usuarioActual,
        ...requestPayload
      };
      
      console.log('[DEBUG] Payload preparado para endpoint:', endpoint);
      
      console.log('[DEBUG] Datos a enviar:', data);
      
      // Configurar las opciones de fetch
      const fetchOptions = {
        method: 'POST',
        headers,
        body: shouldUseTextPlain(url) ? JSON.stringify(data) : JSON.stringify(data),
        cache: 'no-store',
        credentials: 'omit' // Cambiamos para evitar problemas de CORS en entorno de desarrollo local
      };
      
      // Ejecutar la solicitud
      console.log('[DEBUG] Enviando fetch a:', url);
      const response = await fetch(url, fetchOptions);
      
      if (!response.ok) {
        console.error('[ERROR] Respuesta HTTP no OK:', response.status, response.statusText);
        const errorText = await response.text();
        console.error('[ERROR] Contenido de error:', errorText);
        throw new Error(`Error HTTP: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('[DEBUG] Respuesta recibida:', result);
      
      // Validar la respuesta
      if (result && result.error) {
        throw new Error(result.error);
      }
      
      return result;
    } catch (error) {
      console.error(`[ERROR] Error en callBackend(${endpoint}):`, error);

      // Intento de fallback automático para entornos de desarrollo locales donde
      // la llamada directa al Apps Script puede fallar por CORS. Si detectamos
      // que la URL apunta a script.google.com, hacemos un segundo intento hacia
      // un proxy local en la misma raíz: /api (por ejemplo, con `vercel dev`).
      try {
        if (typeof window !== 'undefined' && url && url.includes('script.google.com')) {
          const fallbackUrl = window.location.origin + '/api';
          console.warn('[WARN] Intentando fallback a proxy local en:', fallbackUrl);
          const fallbackOptions = { ...fetchOptions, headers: { ...fetchOptions.headers, 'Content-Type': 'application/json' } };
          const fallbackResp = await fetch(fallbackUrl, fallbackOptions);
          if (fallbackResp.ok) {
            const fallbackResult = await fallbackResp.json();
            console.log('[INFO] Fallback a /api exitoso, resultado:', fallbackResult);
            return fallbackResult;
          } else {
            console.warn('[WARN] Fallback a /api devolvió estado:', fallbackResp.status);
          }
        }
      } catch (fbErr) {
        console.warn('[WARN] Fallback a /api falló:', fbErr);
      }

      throw error;
    } finally {
      // Ocultar loader si está disponible
      if (typeof window !== 'undefined' && window.hideLoader) {
        window.hideLoader();
      }
    }
  }

  /**
   * Obtiene las actividades desde el backend
   * @returns {Promise<Array>} Lista de actividades
   */
  async fetchActividades(options = {}) {
    try {
      console.log('[INFO] Iniciando fetchActividades con backendUrl:', this.backendUrl);
      
      // Asegurarnos de que endpoint sea una string literal fija
      const endpoint = "actividades/obtener";
      console.log('[DEBUG] fetchActividades llamando a callBackend con endpoint:', endpoint);
      
      // Forzar inicialización de backendUrl si aún no está inicializada
      if (!this.backendUrl) {
        this.backendUrl = resolveScriptUrl();
        console.log('[INFO] backendUrl inicializada en fetchActividades:', this.backendUrl);
      }
      
      const { loaderMessage = 'Cargando actividades...', filters = null } = options;
      const payload = filters ? { filters } : {};
      const result = await this.callBackend(endpoint, payload, { loaderMessage });
      console.log('[INFO] Resultado completo de actividades/obtener:', result);
      
      // Imprimir información detallada sobre la estructura de la respuesta
      if (result) {
        console.log('[DEBUG] Estructura de respuesta:', {
          esArray: Array.isArray(result),
          tieneData: result.data !== undefined,
          tieneSuccess: result.success !== undefined,
          tieneActividades: result.actividades !== undefined,
          tipoData: result.data ? typeof result.data : 'N/A',
          esDataArray: result.data ? Array.isArray(result.data) : false
        });
      }
      
      // Validar el formato de respuesta del servidor
      if (Array.isArray(result)) {
        this.actividadesCache = result;
        return result;
      } else if (result && Array.isArray(result.actividades)) {
        this.actividadesCache = result.actividades;
        return result.actividades;
      } else if (result && result.success && Array.isArray(result.data)) {
        // Nuevo formato de respuesta: {success: true, data: Array(n), message: string}
        console.log('[INFO] Usando formato de respuesta actualizado');
        this.actividadesCache = result.data;
        return result.data;
      }
      
      console.error('[ERROR] fetchActividades: Formato de respuesta inesperado:', result);
      return [];
    } catch (error) {
      console.error('[ERROR] fetchActividades:', error);
      throw error;
    }
  }

  /**
   * Obtiene un catálogo específico
   * @param {string} catalogo - Nombre del catálogo
   * @returns {Promise<Array>} Elementos del catálogo
   */
  async fetchCatalogo(catalogo, options = {}) {
    try {
      if (!catalogo && this.catalogosCache.__all) {
        return this.catalogosCache.__all;
      }

      if (catalogo && this.catalogosCache[catalogo]) {
        return this.catalogosCache[catalogo];
      }
      
      // Usamos el endpoint correcto según el backend: 'getCatalogos'
      const { loaderMessage = 'Cargando catálogos...' } = options;
      const result = await this.callBackend('getCatalogos', {
        path: 'getCatalogos' // Asegurarnos de que el path esté en el payload también
      }, { loaderMessage });
      
      // La respuesta tiene estructura: {success, data: {areas: [], subprocesos: [], ...}, message, errors, meta}
      // Necesitamos extraer el objeto data que contiene todos los catálogos
      const catalogData = result && result.data ? result.data : result;

      // Si nos piden un catálogo específico, devolvemos solo ese
      if (catalogo) {
        if (catalogData && catalogData[catalogo] && Array.isArray(catalogData[catalogo])) {
          this.catalogosCache[catalogo] = catalogData[catalogo];
          return catalogData[catalogo];
        }
      } else {
        // Si no se especificó un catálogo, guardar snapshot general y devolver todos
        this.catalogosCache.__all = catalogData;
        return catalogData;
      }
      
      console.error('[ERROR] fetchCatalogo: Formato de respuesta inesperado:', result);
      return [];
    } catch (error) {
      console.error(`[ERROR] fetchCatalogo(${catalogo}):`, error);
      throw error;
    }
  }

  /**
   * Guarda una actividad
   * @param {Object} actividadData - Datos de la actividad
   * @returns {Promise<Object>} Resultado de la operación
   */
  async saveActividad(actividadData) {
    try {
      const isNew = !actividadData.id;
      const endpoint = isNew ? 'actividades/crear' : 'actividades/actualizar';
      const message = isNew ? 'Creando actividad...' : 'Actualizando actividad...';
      const payload = isNew
        ? actividadData
        : (() => {
            const { id, ...data } = actividadData;
            return {
              id,
              data
            };
          })();
      
      return await this.callBackend(endpoint, payload, { loaderMessage: message });
    } catch (error) {
      console.error('[ERROR] saveActividad:', error);
      throw error;
    }
  }

  /**
   * Elimina una actividad por ID
   * @param {string|number} id - ID de la actividad
   * @returns {Promise<Object>} Resultado de la operación
   */
  async deleteActividad(id) {
    try {
      return await this.callBackend('actividades/eliminar', { id }, { loaderMessage: 'Eliminando actividad...' });
    } catch (error) {
      console.error('[ERROR] deleteActividad:', error);
      throw error;
    }
  }

  /**
   * Obtiene los avances para una actividad específica
   * @param {string|number} actividadId - ID de la actividad
   * @returns {Promise<Array>} Lista de avances
   */
  async fetchAvances(actividadId) {
    try {
      const result = await this.callBackend('avances/listar', { actividad_id: actividadId }, { loaderMessage: 'Cargando avances...' });
      
      if (Array.isArray(result)) {
        this.avancesCache = result;
        return result;
      } else if (result && Array.isArray(result.avances)) {
        this.avancesCache = result.avances;
        return result.avances;
      }
      
      console.error('[ERROR] fetchAvances: Formato de respuesta inesperado:', result);
      return [];
    } catch (error) {
      console.error('[ERROR] fetchAvances:', error);
      throw error;
    }
  }

  /**
   * Actualiza el estado de revisión de una actividad
   * @param {Object} payload - { actividad_id, estado_revision, comentarios?, revisor? }
   */
  async reviewActividad(payload) {
    try {
      return await this.callBackend('actividades/revisar', payload, { loaderMessage: 'Actualizando estado de revisión...' });
    } catch (error) {
      console.error('[ERROR] reviewActividad:', error);
      throw error;
    }
  }

  /**
   * Actualiza el estado de revisión de un avance
   * @param {Object} payload - { avance_id, estado_revision, comentarios?, revisor? }
   */
  async reviewAvance(payload) {
    try {
      return await this.callBackend('avances/revisar', payload, { loaderMessage: 'Actualizando revisión del avance...' });
    } catch (error) {
      console.error('[ERROR] reviewAvance:', error);
      throw error;
    }
  }

  /**
   * Guarda un avance para una actividad
   * @param {Object} avanceData - Datos del avance
   * @returns {Promise<Object>} Resultado de la operación
   */
  async saveAvance(avanceData) {
    try {
      const isNew = !avanceData.id;
      const endpoint = isNew ? 'avances/crear' : 'avances/actualizar';
      const message = isNew ? 'Registrando avance...' : 'Actualizando avance...';
      
      return await this.callBackend(endpoint, avanceData, { loaderMessage: message });
    } catch (error) {
      console.error('[ERROR] saveAvance:', error);
      throw error;
    }
  }

  /**
   * Elimina un avance por ID
   * @param {string|number} id - ID del avance
   * @returns {Promise<Object>} Resultado de la operación
   */
  async deleteAvance(id) {
    try {
      return await this.callBackend('avances/eliminar', { id }, { loaderMessage: 'Eliminando avance...' });
    } catch (error) {
      console.error('[ERROR] deleteAvance:', error);
      throw error;
    }
  }
}

// Exportar una única instancia del servicio
const apiService = new ApiService();
export default apiService;