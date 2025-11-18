/**
 * api.js - Servicios de comunicación con el backend para actividades
 */

import { obtenerEmailUsuarioActual } from './utils.js';
import { callBackend as callApi } from '../../services/apiService.js';

/**
 * Clase para manejar la comunicación con el backend
 */
class ApiService {
  constructor() {
    this.actividadesCache = [];
    this.avancesCache = [];
    this.catalogosCache = {};
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
    const { loaderMessage = 'Cargando...' } = options;

    const sanitizedEndpoint = typeof endpoint === 'string' ? endpoint.trim() : '';
    if (!sanitizedEndpoint) {
      throw new Error('Campo path requerido');
    }

    const basePayload = payload && typeof payload === 'object' ? { ...payload } : {};
    if (!basePayload.usuario) {
      basePayload.usuario = obtenerEmailUsuarioActual();
    }

    const requestBody = {
      payload: basePayload,
      usuario: basePayload.usuario,
      ...basePayload
    };

    try {
      if (typeof window !== 'undefined' && window.showLoader && loaderMessage) {
        window.showLoader(loaderMessage);
      }

      const result = await callApi(sanitizedEndpoint, requestBody);

      if (result && result.error) {
        throw new Error(result.error);
      }

      return result;
    } catch (error) {
      console.error(`[ERROR] Error en callBackend(${sanitizedEndpoint}):`, error);
      throw error;
    } finally {
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
      // Asegurarnos de que endpoint sea una string literal fija
      const endpoint = "actividades/obtener";
      console.log('[DEBUG] fetchActividades llamando a callBackend con endpoint:', endpoint);
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
      const result = await this.callBackend('getCatalogos', {}, { loaderMessage });
      
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