/**
 * Backend.gs - Router Principal del Sistema PAI-UNGRD
 * 
 * Este archivo actúa como punto de entrada único para todas las requests:
 * - Manejo de CORS y headers HTTP
 * - Routing a módulos especializados  
 * - Autenticación y autorización centralizada
 * - Manejo de errores global
 * - Logging y auditoría
 * 
 * Arquitectura modular:
 * - SharedUtils.gs: Configuración y utilidades comunes
 * - CatalogManager.gs: Gestión de catálogos unificados
 * - ActivityManager.gs: Gestión de actividades
 * - AdvancesManager.gs: Gestión de avances (futuro)
 * 
 * @author: Sistema PAI-UNGRD
 * @version: 2.0
 */

// ==================== CONFIGURACIÓN DEL ROUTER PRINCIPAL ====================

/**
 * Rutas disponibles y sus módulos responsables
 */
const API_ROUTES = {
  // Rutas de autenticación (manejadas localmente)
  'auth/login': 'LOCAL',
  'auth/createUser': 'LOCAL',
  'auth/listUsers': 'LOCAL',
  'auth/deleteUser': 'LOCAL',
  'auth/updateUser': 'LOCAL',
  'auth/validate': 'LOCAL',
  
  // Rutas de catálogos (delegadas a CatalogManager)
  'catalog/getAll': 'CATALOG',
  'catalog/getByType': 'CATALOG',
  'catalog/getTypes': 'CATALOG',
  'catalog/getById': 'CATALOG', 
  'catalog/getByCode': 'CATALOG',
  'catalog/getHierarchy': 'CATALOG',
  'catalog/create': 'CATALOG',
  'catalog/update': 'CATALOG',
  'catalog/delete': 'CATALOG',
  'catalog/migrate': 'CATALOG',
  'catalog/validate': 'CATALOG',
  
  // Rutas de actividades (delegadas a ActivityManager)
  'activities/create': 'ACTIVITY',
  'activities/getAll': 'ACTIVITY',
  'activities/getById': 'ACTIVITY',
  'activities/update': 'ACTIVITY',
  'activities/delete': 'ACTIVITY',
  'activities/search': 'ACTIVITY',
  'activities/filter': 'ACTIVITY',
  'activities/report': 'ACTIVITY',
  'activities/export': 'ACTIVITY',
  'activities/validate': 'ACTIVITY',
  'activities/review': 'ACTIVITY',
  
  // Rutas legacy para compatibilidad
  'getCatalogos': 'CATALOG_LEGACY',
  'actividades/crear': 'ACTIVITY_LEGACY',
  'actividades/obtener': 'ACTIVITY_LEGACY',
  'actividades/actualizar': 'ACTIVITY_LEGACY',
  'actividades/eliminar': 'ACTIVITY_LEGACY',
  'actividades/buscar': 'ACTIVITY_LEGACY',

  // Presupuestos de área
  'presupuestos/listar': 'BUDGET',
  'presupuestos/guardar': 'BUDGET',
  'presupuestos/eliminar': 'BUDGET',
  'presupuestos/resumenArea': 'BUDGET',
  
  // Rutas de utilidad
  'ping': 'LOCAL',
  'health': 'LOCAL',
  'debug': 'LOCAL'
};

// ==================== HANDLERS HTTP PRINCIPALES ====================

/**
 * Maneja requests GET - principalmente para compatibilidad y health checks
 * @param {Object} e - Objeto de evento de Google Apps Script
 * @returns {Object} Respuesta HTTP
 */
function doGet(e) {
  try {
    // Log básico sin funciones complejas
    console.log('GET Request recibida');
    
    // Si hay parámetros, procesarlos como si fuera POST
    if (e && e.parameter && e.parameter.path) {
      const path = e.parameter.path;
      let payload = {};
      
      // Parsear payload de manera segura
      if (e.parameter.payload) {
        try {
          payload = JSON.parse(e.parameter.payload);
        } catch (parseError) {
          payload = {};
        }
      }
      
      return processRequest({ path: path, payload: payload });
    }
    
    // Request GET sin parámetros - health check básico
    const healthResponse = {
      success: true,
      message: 'Google Apps Script funcionando correctamente',
      version: '2.0',
      timestamp: new Date().toISOString()
    };
    
    return jsonResponseWithCORS(200, healthResponse);
    
  } catch (error) {
    console.error('Error en doGet:', error);
    const errorResponse = {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
    return jsonResponseWithCORS(500, errorResponse);
  }
}

/**
 * Maneja requests POST - endpoint principal para operaciones
 * @param {Object} e - Objeto de evento de Google Apps Script
 * @returns {Object} Respuesta HTTP
 */
function doPost(e) {
  try {
    console.log('POST Request recibida');
    
    // Manejar requests vacías (preflight o health check)
    if (!e || !e.postData || !e.postData.contents) {
      const healthResponse = {
        success: true,
        message: 'Google Apps Script backend ready',
        version: '2.0',
        timestamp: new Date().toISOString()
      };
      return jsonResponseWithCORS(200, healthResponse);
    }
    
    // Parsear body JSON de manera segura
    let body;
    try {
      body = JSON.parse(e.postData.contents);
    } catch (parseError) {
      const errorResponse = {
        success: false,
        error: 'JSON inválido en request body',
        timestamp: new Date().toISOString()
      };
      return jsonResponseWithCORS(400, errorResponse);
    }
    
    if (!body || !body.path) {
      const errorResponse = {
        success: false,
        error: 'Campo path requerido',
        timestamp: new Date().toISOString()
      };
      return jsonResponseWithCORS(400, errorResponse);
    }
    
    return processRequest(body);
    
  } catch (error) {
    console.error('Error en doPost:', error);
    const errorResponse = {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
    return jsonResponseWithCORS(500, errorResponse);
  }
}

/**
 * Maneja requests OPTIONS para CORS preflight
 * @param {Object} e - Objeto de evento
 * @returns {Object} Respuesta OPTIONS
 */
function doOptions(e) {
  console.log('[INFO] OPTIONS request (CORS preflight) recibida');
  
  // Crear respuesta vacía con headers CORS completos
  const output = ContentService.createTextOutput('')
    .setMimeType(ContentService.MimeType.TEXT);

  // Default CORS headers
  const defaultCors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
    'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '3600'
  };

  const corsFromConfig = (typeof SYSTEM_CONFIG !== 'undefined' && SYSTEM_CONFIG.API && SYSTEM_CONFIG.API.CORS_HEADERS)
    ? SYSTEM_CONFIG.API.CORS_HEADERS
    : {};

  const headers = Object.assign({}, defaultCors, corsFromConfig);

  try {
    output.setHeaders(headers);
  } catch (err) {
    console.warn('doOptions: setHeaders falló:', err && err.message);
  }

  return output;
}

// ==================== PROCESAMIENTO DE REQUESTS ====================

/**
 * Procesa una request routing al módulo correspondiente
 * @param {Object} request - Request con path y payload
 * @returns {Object} Respuesta procesada
 */
function processRequest(request) {
  try {
    let { path, payload = {} } = request;

    // Normalizar la ruta: si por algún motivo la "path" contiene
    // una querystring (ej: "getCatalogos?path=getCatalogos") o barras
    // sobrantes, limpiarla para que el router la reconozca.
    if (typeof path === 'string') {
      // Quitar querystring si existe
      if (path.indexOf('?') !== -1) {
        path = path.split('?')[0];
      }
      // Quitar barras iniciales/finales y espacios
      path = path.toString().trim().replace(/^\/+|\/+$/g, '');
    }

    console.log('Procesando request:', path);

    let response;
    const handlerType = API_ROUTES[path];

    if (handlerType) {
      response = routeToHandler(handlerType, path, payload);
    } else if (path.startsWith('actividades/')) {
      // Compatibilidad para rutas legacy no registradas explícitamente
      response = handleLegacyActivityRoutes({ path: path, payload: payload });
    } else if (path.startsWith('avances/')) {
      // Enrutamiento mínimo para avances. Implementación completa en AdvancesManager
      response = handleAdvancesRoutes({ path: path, payload: payload });
    } else {
      response = {
        success: false,
        error: `Endpoint '${path}' no reconocido`,
        timestamp: new Date().toISOString()
      };
    }
    
    // Envolver respuesta con CORS de manera simple
    return jsonResponseWithCORS(200, response);
    
  } catch (error) {
    console.error('Error procesando request:', error);
    const errorResponse = {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
    return jsonResponseWithCORS(500, errorResponse);
  }
}

/**
 * Enruta a handler específico según el tipo
 * @param {string} handlerType - Tipo de handler
 * @param {string} path - Path de la request
 * @param {Object} payload - Payload de la request
 * @returns {Object} Respuesta del handler
 */
function routeToHandler(handlerType, path, payload) {
  try {
    const requestBody = { path: path, payload: payload };
    
    switch (handlerType) {
      case 'LOCAL':
        return handleLocalRoutes(requestBody);
      
      case 'CATALOG':
        return handleCatalogRequest(requestBody);
      
      case 'ACTIVITY':
        return handleActivityRequest(requestBody);
      
      case 'CATALOG_LEGACY':
        return handleLegacyCatalogRoutes(requestBody);
      
      case 'ACTIVITY_LEGACY':
        return handleLegacyActivityRoutes(requestBody);

      case 'BUDGET':
        return handleBudgetRoutes(requestBody);
      
      default:
        return formatResponse(false, null, '', `Handler '${handlerType}' no implementado`);
    }
    
  } catch (error) {
    console.error(`Error en handler ${handlerType}:`, error);
    return handleError(error, `routeToHandler-${handlerType}`);
  }
}

// ==================== HANDLERS LOCALES ====================

/**
 * Maneja rutas locales (auth, ping, debug, etc.)
 * @param {Object} request - Request body
 * @returns {Object} Respuesta
 */
function handleLocalRoutes(request) {
  const { path, payload = {} } = request;
  
  switch (path) {
    case 'auth/login':
    case 'login':
      return handleLogin(payload);
    
    case 'auth/createUser':  
    case 'createUser':
      return handleCreateUser(payload);

    case 'auth/listUsers':
      return handleListUsers(payload);

    case 'auth/deleteUser':
      return handleDeleteUser(payload);
    
    case 'auth/updateUser':
      return handleUpdateUser(payload);

    case 'auth/validate':
      return handleValidateAuth(payload);
    
    case 'ping':
      return handlePing();
    
    case 'health':
      return handleHealthCheck();
    
    case 'debug':
      return handleDebug();
    
    default:
      return formatResponse(false, null, '', `Ruta local '${path}' no reconocida`);
  }
}

/**
 * Maneja login de usuarios
 * @param {Object} payload - Datos de login
 * @returns {Object} Respuesta de autenticación
 */
function handleLogin(payload) {
  try {
    const { email, password } = payload;
    
    if (!email || !password) {
      return formatResponse(false, null, '', 'Email y contraseña requeridos');
    }
    
    const cleanEmail = email.toString().trim().toLowerCase();
    const auth = loginUser(cleanEmail, password.toString());
    
    if (!auth.ok) {
      return formatResponse(false, null, '', auth.error || 'Credenciales inválidas');
    }
    
    const token = makeToken(cleanEmail);
    
    return formatResponse(true, {
      email: auth.email,
      role: auth.role,
      area: auth.area || '',
      token: token
    }, 'Login exitoso');
    
  } catch (error) {
    return handleError(error, 'handleLogin');
  }
}

/**
 * Maneja creación de usuarios
 * @param {Object} payload - Datos del nuevo usuario
 * @returns {Object} Respuesta
 */
function handleCreateUser(payload) {
  try {
  const { email, password, role = 'contribuidor', area = '' } = payload;
    
    if (!email || !password) {
      return formatResponse(false, null, '', 'Email y contraseña requeridos');
    }
    
    const result = createUser(email, password, role, area);
    
    if (!result.ok) {
      return formatResponse(false, null, '', result.error);
    }
    
  return formatResponse(true, { email: result.email, area: result.area || '', role: result.role || role }, 'Usuario creado exitosamente');
    
  } catch (error) {
    return handleError(error, 'handleCreateUser');
  }
}

/**
 * Valida token de autenticación
 * @param {Object} payload - Payload con token
 * @returns {Object} Resultado de validación
 */
function handleValidateAuth(payload) {
  try {
    const { token } = payload;
    
    if (!token) {
      return formatResponse(false, null, '', 'Token requerido');
    }
    
    const validation = validateToken(token);
    
    return formatResponse(validation.valid, validation.data, validation.message, validation.error);
    
  } catch (error) {
    return handleError(error, 'handleValidateAuth');
  }
}

/**
 * Respuesta de ping para verificar conectividad
 * @returns {Object} Respuesta de ping
 */
function handlePing() {
  return formatResponse(true, {
    message: 'Sistema PAI-UNGRD funcionando correctamente',
    timestamp: getCurrentTimestamp(),
    version: SYSTEM_CONFIG.API.VERSION,
    modules: {
      sharedUtils: 'OK',
      catalogManager: 'OK',
      activityManager: 'OK'
    }
  }, 'Ping exitoso');
}

/**
 * Health check detallado del sistema
 * @returns {Object} Estado del sistema
 */
function handleHealthCheck() {
  try {
    const health = {
      status: 'healthy',
      timestamp: getCurrentTimestamp(),
      version: SYSTEM_CONFIG.API.VERSION,
      spreadsheet: {
        id: SYSTEM_CONFIG.SPREADSHEET_ID,
        accessible: false
      },
      modules: {
        auth: 'OK',
        catalog: 'OK', 
        activities: 'OK'
      }
    };
    
    // Verificar acceso a spreadsheet
    try {
      const ss = openSystemSpreadsheet();
      health.spreadsheet.accessible = true;
      health.spreadsheet.name = ss.getName();
    } catch (error) {
      health.status = 'degraded';
      health.spreadsheet.error = error.message;
    }
    
    return formatResponse(true, health, 'Health check completado');
    
  } catch (error) {
    return handleError(error, 'handleHealthCheck');
  }
}

/**
 * Información de debug del sistema
 * @returns {Object} Información de debug
 */
function handleDebug() {
  try {
    const debugInfo = {
      timestamp: getCurrentTimestamp(),
      version: SYSTEM_CONFIG.API.VERSION,
      config: {
        spreadsheetId: SYSTEM_CONFIG.SPREADSHEET_ID,
        sheets: SYSTEM_CONFIG.SHEETS
      },
      routes: Object.keys(API_ROUTES),
      environment: {
        scriptId: PropertiesService.getScriptProperties().getProperty('SCRIPT_ID') || 'unknown'
      }
    };
    
    return formatResponse(true, debugInfo, 'Información de debug obtenida');
    
  } catch (error) {
    return handleError(error, 'handleDebug');
  }
}

// Legacy compatibility handlers were moved to apps_script/07_LegacyHandlers.gs
// The router still calls handleLegacyCatalogRoutes and handleLegacyActivityRoutes
// which are now defined in that module to keep this file focused on routing.

// Routing utilities (cleanPath, parsePayloadParameter, parseRequestBody,
// getRouteHandler, requiresAuthentication, validateAuthentication)
// were moved to apps_script/06_RoutingUtils.gs. Use those helpers from
// the new module to keep routing logic centralized.

// Response helpers (jsonResponseWithCORS, wrapResponseWithCORS, createErrorResponse)
// are implemented in apps_script/00_SharedUtils.gs. This file uses those global
// helpers from the shared utilities module instead of duplicating them here.

/**
 * Crea respuesta de health check
 * @returns {Object} Respuesta de health check
 */
function createHealthCheckResponse() {
  const healthData = {
    status: 'OK',
    message: 'Sistema PAI-UNGRD funcionando correctamente', 
    version: SYSTEM_CONFIG.API.VERSION,
    timestamp: getCurrentTimestamp(),
    cors: 'enabled'
  };
  
  return jsonResponseWithCORS(200, formatResponse(true, healthData, 'Sistema operativo'));
}

/**
 * Crea respuesta de error estandardizada
 * @param {number} statusCode - Código de estado HTTP
 * @param {string} message - Mensaje de error
 * @param {string} details - Detalles adicionales
 * @returns {Object} Respuesta de error
 */
function createErrorResponse(statusCode, message, details = null) {
  const errorData = formatResponse(false, null, message, details ? [details] : null);
  return jsonResponseWithCORS(statusCode, errorData);
}

/**
 * Envuelve respuesta con headers CORS
 * @param {Object} response - Respuesta a envolver
 * @returns {Object} Respuesta con CORS
 */
function wrapResponseWithCORS(response) {
  // Si la respuesta ya es un ContentService, devolverla tal como está
  if (response && typeof response.setMimeType === 'function') {
    return response;
  }
  
  // Si no, envolver en jsonResponseWithCORS
  return jsonResponseWithCORS(200, response);
}

// Authentication helpers (openSheet, getCredentialsSheet, makeSalt, sha256,
// makeHash, makeToken, validateToken, findUserRow, loginUser, createUser)
// were moved to apps_script/05_Auth.gs. Use those implementations from
// the new module to avoid duplication.

// ==================== FUNCIONES DE COMPATIBILIDAD ====================

/**
 * Obtiene catálogos agrupados por tipo para compatibilidad con frontend
 * @returns {Object} Catálogos agrupados por tipo
 */
function getCatalogosAgrupados() {
  console.log('[DEBUG] Iniciando getCatalogosAgrupados()');
  try {
    console.log('[DEBUG] Obteniendo datos reales de catálogos desde hojas de cálculo');
    
    // Obtener todos los catálogos activos desde la hoja
    const catalogos = getAllCatalogs(null, false);
    
    if (!catalogos.success) {
      throw new Error('Error obteniendo catálogos: ' + catalogos.error);
    }
    
  console.log('[DEBUG] Datos obtenidos del catálogo unificado:', catalogos.data.length, 'items');
    
    // Agrupar por tipo de catálogo
    const grouped = {
      areas: [],
      subprocesos: [],
      objetivos: [],
      estrategias: [],
      lineas_trabajo: [],
      lineas: [],
      indicadores: [],
      planes: [],
      bimestres: [],
      mipg: [],
      fuentes: []
    };
    
    // Procesar cada item del catálogo unificado
    catalogos.data.forEach(item => {
      const mappedItem = mapCatalogItemToLegacyFormat(item);
      
      switch(item.catalogo) {
        case 'area':
          grouped.areas.push(mappedItem);
          break;
        case 'subproceso':
          grouped.subprocesos.push(mappedItem);
          break;
        case 'objetivo':
          grouped.objetivos.push(mappedItem);
          break;
        case 'estrategia':
          grouped.estrategias.push(mappedItem);
          break;
        case 'linea_trabajo':
          grouped.lineas_trabajo.push(mappedItem);
          break;
        case 'linea_accion':
        case 'linea':
          grouped.lineas.push(mappedItem);
          break;
        case 'indicador':
          grouped.indicadores.push(mappedItem);
          break;
        case 'plan':
          grouped.planes.push(mappedItem);
          break;
        case 'bimestre':
          grouped.bimestres.push(mappedItem);
          break;
        case 'mipg':
          grouped.mipg.push(mappedItem);
          break;
        case 'fuente':
          grouped.fuentes.push(mappedItem);
          break;
      }
    });

    grouped.lineasTrabajo = grouped.lineas_trabajo;
    grouped.lineasAccion = grouped.lineas;
    grouped.lineas_accion = grouped.lineas;
    
  console.log('[DEBUG] Catálogos agrupados preparados desde datos reales');
  console.log('[DEBUG] Resumen de elementos por catálogo:');
    Object.keys(grouped).forEach(key => {
      console.log(`   - ${key}: ${grouped[key].length} elementos`);
    });
    
    const response = formatResponse(true, grouped, 'Catálogos agrupados obtenidos desde hojas de cálculo');
  console.log('[DEBUG] Respuesta final de getCatalogosAgrupados:', response);
    return response;
    
  } catch (error) {
    console.error('Error en getCatalogosAgrupados:', error);
    return handleError(error, 'getCatalogosAgrupados');
  }
}

/**
 * Mapea un item del catálogo unificado al formato legacy
 * @param {Object} item - Item del catálogo unificado
 * @returns {Object} Item en formato legacy
 */
function mapCatalogItemToLegacyFormat(item) {
  const type = item.catalogo;
  const mapped = {};
  
  // Mapear campos comunes - usar code como ID principal
  mapped[`${type}_id`] = item.code;
  mapped[`${type}_nombre`] = item.label;
  
  // Agregar parent_code si existe (para filtrado jerárquico)
  if (item.parent_code) {
    mapped.parent_code = item.parent_code;
  }
  
  // Mapeos específicos por tipo basados en tu estructura
  switch(type) {
    case 'area':
      mapped.area_codigo = item.code;
      break;
      
    case 'subproceso':
      mapped.subproceso_codigo = item.code;
      // Para subprocesos, parent_code debería apuntar al área
      if (item.parent_code) {
        mapped.area_id = item.parent_code; // Compatibilidad con código legacy
      }
      break;
      
    case 'objetivo':
      mapped.objetivo_codigo = item.code;
      break;
      
    case 'estrategia':
      mapped.estrategia_codigo = item.code;
      // Para estrategias, parent_code debería apuntar al objetivo
      if (item.parent_code) {
        mapped.objetivo_id = item.parent_code;
      }
      break;
      
    case 'linea_trabajo':
      mapped.linea_trabajo_id = item.code;
      mapped.linea_trabajo_codigo = item.code;
      if (item.parent_code) {
        mapped.estrategia_id = item.parent_code;
      }
      break;

    case 'linea_accion':
    case 'linea':
      mapped.linea_accion_id = item.code;
      mapped.linea_codigo = item.code;
      mapped.linea_accion_codigo = item.code;
      // Para líneas de acción, parent_code apunta a la estrategia
      if (item.parent_code) {
        mapped.estrategia_id = item.parent_code;
      }
      break;
      
    case 'mipg':
      mapped.mipg_codigo = item.code;
      break;
      
    case 'indicador':
      mapped.indicador_codigo = item.code;
      // Agregar campos adicionales si están en el catálogo
      mapped.unidad = item.unidad || 'Número';
      mapped.formula_tipo = item.formula_tipo || 'Conteo';
      break;
      
    case 'plan':
      mapped.plan_codigo = item.code;
      break;
      
    case 'fuente':
      mapped.fuente_codigo = item.code;
      break;
      
    case 'bimestre':
      mapped.bimestre_codigo = item.code;
      break;
  }
  
  return mapped;
}

/**
 * Devuelve la lista de usuarios existentes
 * @returns {Object} Respuesta con listado de usuarios
 */
function handleListUsers(payload) {
  try {
    const usuarios = listUsers();
    return formatResponse(true, usuarios, 'Usuarios obtenidos correctamente');
  } catch (error) {
    return handleError(error, 'handleListUsers');
  }
}

/**
 * Elimina un usuario existente
 * @param {Object} payload - { email }
 * @returns {Object} Resultado de la operación
 */
function handleDeleteUser(payload) {
  try {
    const email = payload?.email || payload?.correo;
    if (!email) {
      return formatResponse(false, null, '', 'Email requerido para eliminar usuario');
    }

    const resultado = deleteUser(email);

    if (!resultado.ok) {
      return formatResponse(false, null, '', resultado.error || 'No se pudo eliminar el usuario');
    }

    return formatResponse(true, { email: email.toString().trim().toLowerCase() }, 'Usuario eliminado correctamente');
  } catch (error) {
    return handleError(error, 'handleDeleteUser');
  }
}

/**
 * Actualiza la información de un usuario existente
 * @param {Object} payload - { email, role?, area?, password? }
 * @returns {Object} Resultado de la operación
 */
function handleUpdateUser(payload) {
  try {
    const email = payload?.email || payload?.correo;
    if (!email) {
      return formatResponse(false, null, '', 'Email requerido para actualizar usuario');
    }

    const updates = {
      role: payload?.role || payload?.rol,
      area: payload?.area,
      password: payload?.password || payload?.nuevaContrasena || payload?.newPassword
    };

    const resultado = updateUser(email, updates);

    if (!resultado.ok) {
      return formatResponse(false, null, '', resultado.error || 'No se pudo actualizar el usuario');
    }

    return formatResponse(true, {
      email: resultado.email,
      role: resultado.role,
      area: resultado.area,
      passwordUpdated: resultado.passwordUpdated === true
    }, 'Usuario actualizado correctamente');
  } catch (error) {
    return handleError(error, 'handleUpdateUser');
  }
}