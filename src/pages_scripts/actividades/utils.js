import '../../lib/debug-filter.js';

import {
  normalizarRol as normalizarRolInterno,
  obtenerPermisosRol as obtenerPermisosRolInterno,
  tienePermiso as tienePermisoInterno,
  esRolAdministrador as esRolAdministradorInterno,
  esRolContribuidor as esRolContribuidorInterno,
  esRolVisualizador as esRolVisualizadorInterno
} from '../../lib/roles.js';
import { toast } from '../../lib/ui.js';

const REVIEW_STATE_ALIASES = {
  'sin revision': 'Sin revisión',
  'revision pendiente': 'Sin revisión',
  'en revision': 'En revisión',
  'revision': 'En revisión',
  'correccion': 'Corrección',
  'correccion requerida': 'Corrección',
  'correccion-requerida': 'Corrección',
  'aprobado': 'Aprobado',
  'aprobada': 'Aprobado',
  'cancelado': 'Cancelado',
  'cancelada': 'Cancelado',
  'rechazado': 'Cancelado',
  'rechazada': 'Cancelado'
};

export const ESTADOS_REVISION = ['Sin revisión', 'En revisión', 'Corrección', 'Aprobado', 'Cancelado'];

const ESTADO_REVISION_CONFIG = {
  'Sin revisión': {
    badge: 'border border-slate-200 bg-slate-100 text-slate-700',
    text: 'text-slate-600',
    dot: 'bg-slate-500'
  },
  'En revisión': {
    badge: 'border border-amber-200 bg-amber-100 text-amber-700',
    text: 'text-amber-600',
    dot: 'bg-amber-500'
  },
  'Corrección': {
    badge: 'border border-orange-200 bg-orange-100 text-orange-700',
    text: 'text-orange-600',
    dot: 'bg-orange-500'
  },
  'Aprobado': {
    badge: 'border border-emerald-200 bg-emerald-100 text-emerald-700',
    text: 'text-emerald-600',
    dot: 'bg-emerald-500'
  },
  'Cancelado': {
    badge: 'border border-rose-200 bg-rose-100 text-rose-700',
    text: 'text-rose-600',
    dot: 'bg-rose-500'
  },
  default: {
    badge: 'border border-gray-200 bg-gray-100 text-gray-700',
    text: 'text-gray-600',
    dot: 'bg-gray-500'
  }
};

export const ACTIVITY_STATE_ALIASES = {
  'planeada': 'Planeada',
  'planificada': 'Planeada',
  'planeado': 'Planeada',
  'planificacion': 'Planeada',
  'en progreso': 'En Progreso',
  'en-progreso': 'En Progreso',
  'progreso': 'En Progreso',
  'ejecucion': 'En Progreso',
  'ejecución': 'En Progreso',
  'en ejecucion': 'En Progreso',
  'completada': 'Completada',
  'completado': 'Completada',
  'finalizada': 'Completada',
  'finalizado': 'Completada',
  'terminada': 'Completada',
  'terminado': 'Completada',
  'suspendida': 'Suspendida',
  'suspendido': 'Suspendida',
  'en pausa': 'Suspendida',
  'pausada': 'Suspendida',
  'pausado': 'Suspendida',
  'cancelada': 'Cancelado',
  'cancelado': 'Cancelado',
  'sin revision': 'Sin revisión'
};

export const ESTADOS_ACTIVIDAD = [
  'Planeada',
  'En Progreso',
  'Completada',
  'Suspendida',
  'Cancelado',
  'Sin revisión'
];

const ESTADO_ACTIVIDAD_CONFIG = {
  Planeada: {
    badge: 'border border-slate-200 bg-white text-slate-600',
    text: 'text-slate-600',
    dot: 'bg-slate-400'
  },
  'En Progreso': {
    badge: 'border border-sky-200 bg-sky-100 text-sky-700',
    text: 'text-sky-600',
    dot: 'bg-sky-500'
  },
  Completada: {
    badge: 'border border-emerald-200 bg-emerald-100 text-emerald-700',
    text: 'text-emerald-600',
    dot: 'bg-emerald-500'
  },
  Suspendida: {
    badge: 'border border-amber-200 bg-amber-100 text-amber-700',
    text: 'text-amber-600',
    dot: 'bg-amber-500'
  },
  Cancelado: ESTADO_REVISION_CONFIG['Cancelado'],
  'Sin revisión': ESTADO_REVISION_CONFIG['Sin revisión'],
  default: ESTADO_REVISION_CONFIG.default
};

export const normalizarRol = normalizarRolInterno;
export const obtenerPermisosRol = obtenerPermisosRolInterno;
export const tienePermiso = tienePermisoInterno;
export const esRolAdministrador = esRolAdministradorInterno;
export const esRolContribuidor = esRolContribuidorInterno;
export const esRolVisualizador = esRolVisualizadorInterno;

/**
 * Obtiene el email del usuario autenticado actual
 * @returns {string} Email del usuario o fallback
 */
export function obtenerEmailUsuarioActual() {
  try {
    console.log('[DEBUG] obtenerEmailUsuarioActual: Buscando email del usuario...');

    const storageEmail = localStorage.getItem('auth_email');
    console.log('[DEBUG] auth_email en localStorage:', storageEmail);

    if (storageEmail && storageEmail.includes('@') && storageEmail !== 'null' && storageEmail !== 'undefined') {
      console.log('[OK] Email obtenido desde localStorage:', storageEmail);
      return storageEmail;
    }

    const token = localStorage.getItem('auth_token');
    console.log('[DEBUG] auth_token en localStorage:', token ? 'existe' : 'no existe');

    if (token && token !== 'null') {
      try {
        const decoded = atob(token);
        const parts = decoded.split('|');
        if (parts.length >= 1 && parts[0].includes('@')) {
          console.log('[OK] Email obtenido desde token:', parts[0]);
          return parts[0];
        }
      } catch (tokenError) {
        console.warn('[WARN] Error decodificando token:', tokenError);
      }
    }

    console.warn('[WARN] No se pudo obtener email del usuario, usando fallback');
    return 'usuario@gestiondelriesgo.gov.co';
  } catch (error) {
    console.error('[ERROR] Error obteniendo email del usuario:', error);
    return 'usuario@gestiondelriesgo.gov.co';
  }
}

/**
 * Serializa un formulario a objeto
 */
export function serializarFormulario(formulario) {
  const formData = new FormData(formulario);
  const objeto = {};
  const processedKeys = new Set();

  for (const key of formData.keys()) {
    if (processedKeys.has(key)) continue;
    const values = formData.getAll(key);
    objeto[key] = values.length > 1 ? values : values[0];
    processedKeys.add(key);
  }

  return objeto;
}

/**
 * Muestra un mensaje toast simple
 */
export function mostrarToast(mensaje, tipo = 'info', opciones = {}) {
  console.log(`[TOAST] ${tipo}: ${mensaje}`);
  try {
    const normalizedOptions = typeof opciones === 'number' ? { duration: opciones } : opciones || {};
    toast(tipo, mensaje, normalizedOptions);
  } catch (error) {
    console.error('[ERROR] No se pudo mostrar el toast mediante UI:', error);
    if (typeof window !== 'undefined' && window.alert) {
      window.alert(`${(tipo || 'info').toUpperCase()}: ${mensaje}`);
    }
  }
}

export function normalizarEstadoRevision(estado) {
  if (estado === null || estado === undefined) {
    return ESTADOS_REVISION[0];
  }

  try {
    const raw = estado.toString().trim();
    if (!raw) {
      return ESTADOS_REVISION[0];
    }

    const key = raw
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (REVIEW_STATE_ALIASES[key]) {
      return REVIEW_STATE_ALIASES[key];
    }

    const directMatch = ESTADOS_REVISION.find(item => item.toLowerCase() === raw.toLowerCase());
    return directMatch || raw;
  } catch (error) {
    return typeof estado === 'string' ? estado : ESTADOS_REVISION[0];
  }
}

export function obtenerConfigEstadoRevision(estado) {
  const canonical = normalizarEstadoRevision(estado);
  return ESTADO_REVISION_CONFIG[canonical] || ESTADO_REVISION_CONFIG.default;
}

export function obtenerClaseEstadoRevision(estado, variante = 'badge') {
  const config = obtenerConfigEstadoRevision(estado);
  if (variante === 'text') {
    return config.text;
  }
  if (variante === 'dot') {
    return config.dot;
  }
  return config.badge;
}

export function normalizarEstadoActividad(estado) {
  if (estado === null || estado === undefined) {
    return '';
  }

  try {
    const raw = estado.toString().trim();
    if (!raw) {
      return '';
    }

    const key = raw
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (ACTIVITY_STATE_ALIASES[key]) {
      return ACTIVITY_STATE_ALIASES[key];
    }

    const directMatch = ESTADOS_ACTIVIDAD.find(item => item.toLowerCase() === raw.toLowerCase());
    if (directMatch) {
      return directMatch;
    }

    const reviewMatch = normalizarEstadoRevision(raw);
    if (reviewMatch) {
      return reviewMatch;
    }

    return raw;
  } catch (error) {
    return typeof estado === 'string' ? estado : '';
  }
}

export function obtenerConfigEstadoActividad(estado) {
  const canonical = normalizarEstadoActividad(estado);
  return ESTADO_ACTIVIDAD_CONFIG[canonical] || ESTADO_ACTIVIDAD_CONFIG.default;
}

export function obtenerClaseEstadoActividad(estado, variante = 'badge') {
  const config = obtenerConfigEstadoActividad(estado);
  if (variante === 'text') {
    return config.text;
  }
  if (variante === 'dot') {
    return config.dot;
  }
  return config.badge;
}

/**
 * Formatea una fecha a string legible
 */
export function formatearFecha(fecha) {
  if (!fecha) return '';
  try {
    const date = new Date(fecha);
    return date.toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch (error) {
    console.error('[ERROR] Error formateando fecha:', error);
    return fecha.toString();
  }
}

/**
 * Convierte valores de formulario aplicando un esquema básico de tipos
 */
export function convertirValoresFormulario(valores, esquema = {}) {
  if (!valores) return {};

  const resultado = { ...valores };
  Object.keys(resultado).forEach(key => {
    const valor = resultado[key];
    if (esquema[key]?.tipo === 'fecha' || esquema[key]?.tipo === 'datetime') {
      if (valor && typeof valor === 'string') {
        try {
          resultado[key] = new Date(valor);
        } catch (e) {
          console.warn(`[WARN] Error convirtiendo fecha ${key}:`, e);
        }
      }
    } else if (esquema[key]?.tipo === 'numero' || esquema[key]?.tipo === 'decimal') {
      if (valor !== null && valor !== undefined && valor !== '') {
        resultado[key] = Number(valor);
      }
    } else if (esquema[key]?.tipo === 'boolean' || esquema[key]?.tipo === 'checkbox') {
      if (typeof valor === 'string') {
        resultado[key] = ['true', 'si', 'yes', '1', 'on'].includes(valor.toLowerCase());
      }
    }
  });

  return resultado;
}

/**
 * Obtiene el rol almacenado del usuario autenticado
 */
export function obtenerRolUsuarioActual() {
  try {
    const storedRole = localStorage.getItem('auth_role');
    if (storedRole && storedRole !== 'null' && storedRole !== 'undefined') {
      return storedRole.trim();
    }
    return '';
  } catch (error) {
    console.error('[ERROR] Error obteniendo rol del usuario:', error);
    return '';
  }
}

/**
 * Retorna el rol normalizado usando la tabla de permisos
 */
export function obtenerRolUsuarioNormalizado() {
  return normalizarRolInterno(obtenerRolUsuarioActual());
}

/**
 * Obtiene el área asociada al usuario autenticado
 * @returns {string} Área del usuario o cadena vacía si no se encuentra
 */
export function obtenerAreaUsuarioActual() {
  try {
    const storedArea = localStorage.getItem('auth_area');
    if (storedArea && storedArea !== 'null' && storedArea !== 'undefined') {
      return storedArea.trim();
    }
    return '';
  } catch (error) {
    console.error('[ERROR] Error obteniendo área del usuario:', error);
    return '';
  }
}

function normalizarTextoBasico(valor) {
  if (valor === null || valor === undefined) return '';
  try {
    return valor
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[_/]+/g, ' ')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  } catch (error) {
    return valor.toString().toLowerCase().trim();
  }
}

function generarVariantesArea(valor) {
  const base = normalizarTextoBasico(valor);
  if (!base) return [];

  const variantes = new Set([base]);
  const separadores = ['-', '|'];
  separadores.forEach(separador => {
    if (base.includes(separador)) {
      base.split(separador)
        .map(segmento => segmento.trim())
        .filter(Boolean)
        .forEach(segmento => variantes.add(segmento));
    }
  });

  return Array.from(variantes);
}

export function coincideAreaUsuario(areaUsuario, valores = []) {
  const variantesUsuario = generarVariantesArea(areaUsuario);
  if (!variantesUsuario.length) return false;

  const listaValores = Array.isArray(valores) ? valores : [valores];
  for (const valor of listaValores) {
    const variantesValor = generarVariantesArea(valor);
    if (!variantesValor.length) continue;
    if (variantesValor.some(token => variantesUsuario.includes(token))) {
      return true;
    }
  }

  return false;
}

if (typeof window !== 'undefined') {
  window.obtenerEmailUsuarioActual = window.obtenerEmailUsuarioActual || obtenerEmailUsuarioActual;
  window.obtenerRolUsuarioActual = window.obtenerRolUsuarioActual || obtenerRolUsuarioActual;
  window.obtenerAreaUsuarioActual = window.obtenerAreaUsuarioActual || obtenerAreaUsuarioActual;
}