const ROLE_KEYS = ['admin', 'contribuidor', 'visualizador'];

const ROLE_ALIASES = {
  admin: ['admin', 'administrador', 'superadmin', 'coordinador', 'gestor', 'manager'],
  contribuidor: ['contribuidor', 'contributor', 'editor', 'colaborador', 'responsable', 'operador', 'contratista'],
  visualizador: ['visualizador', 'viewer', 'consulta', 'consultor', 'lectura', 'read']
};

const ROLE_PERMISSIONS = {
  admin: {
    'activities:create': true,
    'activities:edit': true,
    'activities:delete': true,
    'advances:create': true,
    'advances:edit': true,
    'advances:delete': true,
    'catalogs:manage': true,
    'budgets:manage': true,
    'reports:view': true
  },
  contribuidor: {
    'activities:create': true,
    'activities:edit': false,
    'activities:delete': false,
    'advances:create': true,
    'advances:edit': false,
    'advances:delete': false,
    'catalogs:manage': false,
    'budgets:manage': false,
    'reports:view': true
  },
  visualizador: {
    'activities:create': false,
    'activities:edit': false,
    'activities:delete': false,
    'advances:create': false,
    'advances:edit': false,
    'advances:delete': false,
    'catalogs:manage': false,
    'budgets:manage': false,
    'reports:view': true
  }
};

function normalizarRol(rol) {
  if (!rol) return 'visualizador';
  const normalized = rol.toString().trim().toLowerCase();
  if (!normalized) return 'visualizador';

  for (const key of ROLE_KEYS) {
    const aliases = ROLE_ALIASES[key] || [];
    if (key === normalized || aliases.includes(normalized)) {
      return key;
    }
  }

  return 'visualizador';
}

function obtenerPermisosRol(rol) {
  const key = normalizarRol(rol);
  const permissions = ROLE_PERMISSIONS[key] || ROLE_PERMISSIONS.visualizador;
  return { ...permissions };
}

function tienePermiso(rol, permiso) {
  const key = normalizarRol(rol);
  return Boolean(ROLE_PERMISSIONS[key]?.[permiso]);
}

function esRolAdministrador(rol) {
  return normalizarRol(rol) === 'admin';
}

function esRolContribuidor(rol) {
  return normalizarRol(rol) === 'contribuidor';
}

function esRolVisualizador(rol) {
  return normalizarRol(rol) === 'visualizador';
}

export {
  ROLE_KEYS,
  ROLE_ALIASES,
  ROLE_PERMISSIONS,
  normalizarRol,
  obtenerPermisosRol,
  tienePermiso,
  esRolAdministrador,
  esRolContribuidor,
  esRolVisualizador
};
