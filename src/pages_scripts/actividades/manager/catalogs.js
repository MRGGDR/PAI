import apiService from '../api.js';
import { mostrarToast, coincideAreaUsuario, ESTADOS_REVISION } from '../utils.js';

function obtenerCatalogosVacios() {
  return {
    areas: [],
    subprocesos: [],
    objetivos: [],
    estrategias: [],
    lineasTrabajo: [],
    lineas: [],
    indicadores: [],
    planes: [],
    mipg: [],
    bimestres: [],
    fuentes: [],
    estados: this.obtenerEstadosDisponibles(),
    usuarios: []
  };
}

function debeRestringirPorArea() {
  return (
    this.state?.usuario?.rol === 'contribuidor' &&
    typeof this.state?.usuario?.area === 'string' &&
    this.state.usuario.area.trim() !== ''
  );
}

function obtenerAreaAsignadaUsuario() {
  const preferida = this.state?.usuario?.areaNombre || this.state?.usuario?.area || this.state?.usuario?.areaNombreCatalogo || '';
  return typeof preferida === 'string' ? preferida.trim() : '';
}

function obtenerAreaIdAsignada() {
  const id = this.state?.usuario?.areaId || '';
  return id ? String(id).trim() : '';
}

function sincronizarAreaUsuarioConCatalogos() {
  const areaTexto = this.state?.usuario?.area || '';
  if (!this.debeRestringirPorArea()) {
    this.state.usuario.areaId = '';
    this.state.usuario.areaNombre = areaTexto || '';
    this.state.usuario.areaNombreCatalogo = '';
    return;
  }

  const coincidencia = this.state.catalogos.areas.find(item =>
    coincideAreaUsuario(areaTexto, [
      item?.nombre,
      item?.raw?.label,
      item?.raw?.nombre,
      item?.raw?.descripcion,
      item?.raw?.codigo,
      item?.raw?.code,
      item?.id
    ])
  );

  if (coincidencia) {
    this.state.usuario.areaId = String(coincidencia.id);
    this.state.usuario.areaNombreCatalogo = coincidencia.nombre || '';
    this.state.usuario.areaNombre = (typeof areaTexto === 'string' && areaTexto.trim())
      ? areaTexto.trim()
      : (coincidencia.nombre || '');
  } else {
    this.state.usuario.areaId = '';
    this.state.usuario.areaNombre = areaTexto || '';
    this.state.usuario.areaNombreCatalogo = '';
  }
}

function coincideActividadConArea(item) {
  if (!this.debeRestringirPorArea()) return true;
  if (!item) return false;
  const areaUsuario = this.obtenerAreaAsignadaUsuario();
  const areaId = this.obtenerAreaIdAsignada();
  const areaCatalogo = this.state?.usuario?.areaNombreCatalogo || '';

  const candidatosId = [
    item.areaId,
    item.raw?.area_id,
    item.raw?.areaId,
    item.raw?.codigo_area,
    item.raw?.area_codigo,
    item.raw?.id_area
  ]
    .map(valor => (valor === null || valor === undefined ? '' : String(valor).trim()))
    .filter(Boolean);

  if (areaId && candidatosId.length && candidatosId.includes(String(areaId))) {
    return true;
  }

  const candidatos = [
    item.areaNombre,
    item.raw?.area,
    item.raw?.areaNombre,
    item.raw?.area_label,
    item.raw?.area_nombre,
    item.raw?.areaAsignada,
    item.raw?.areaDescripcion,
    item.raw?.area_descripcion
  ];

  if (coincideAreaUsuario(areaUsuario, candidatos)) {
    return true;
  }

  if (areaCatalogo && coincideAreaUsuario(areaCatalogo, candidatos)) {
    return true;
  }

  if (areaId && candidatos.length) {
    return candidatos.some(valor => coincideAreaUsuario(String(areaId), [valor]));
  }

  return false;
}

function normalizarTokenComparacion(valor) {
  if (valor === null || valor === undefined) return '';
  return String(valor).trim().toLowerCase();
}

function construirTokenSetArea(areaId, areasDisponibles = []) {
  const tokens = new Set();
  const agregar = (valor) => {
    const token = normalizarTokenComparacion(valor);
    if (token) tokens.add(token);
  };

  agregar(areaId);

  const areaItem = areasDisponibles.find(item => String(item.id) === String(areaId));
  if (areaItem) {
    agregar(areaItem.id);
    const raw = areaItem.raw || {};
    [
      raw.code,
      raw.codigo,
      raw.area_codigo,
      raw.areaCode,
      raw.area_code,
      raw.label,
      raw.nombre,
      raw.descripcion,
      raw.descripcion_larga,
      raw.descripcion_corta,
      raw.alias
    ].forEach(agregar);
  }

  return tokens;
}

function construirTokenSetLineaTrabajo(linea) {
  const tokens = new Set();
  if (!linea) return tokens;

  const agregar = (valor) => {
    const token = normalizarTokenComparacion(valor);
    if (token) tokens.add(token);
  };

  agregar(linea.parent_id);

  const raw = linea.raw || {};
  [
    raw.parent_id,
    raw.parentId,
    raw.parent_code,
    raw.parentCode,
    raw.area_id,
    raw.areaId,
    raw.codigo_area,
    raw.area_codigo,
    raw.areaCode,
    raw.area_code,
    raw.area,
    raw.areaNombre,
    raw.area_nombre,
    raw.area_label,
    raw.areaDescripcion,
    raw.area_descripcion,
    raw.areaAsignada
  ].forEach(agregar);

  return tokens;
}

function construirTokenSetEstrategia(estrategiaId, estrategiasDisponibles = []) {
  const tokens = new Set();
  const agregar = (valor) => {
    const token = normalizarTokenComparacion(valor);
    if (token) tokens.add(token);
  };

  agregar(estrategiaId);

  const estrategiaItem = estrategiasDisponibles.find(item => String(item.id) === String(estrategiaId));
  if (estrategiaItem) {
    agregar(estrategiaItem.id);
    const raw = estrategiaItem.raw || {};
    [
      estrategiaItem.nombre,
      raw.id,
      raw.uuid,
      raw.code,
      raw.codigo,
      raw.parent_id,
      raw.parentId,
      raw.parent_code,
      raw.parentCode
    ].forEach(agregar);
  }

  return tokens;
}

function aplicarRestriccionAreaEnListado(lista = []) {
  if (!this.debeRestringirPorArea()) return Array.isArray(lista) ? [...lista] : [];
  return (Array.isArray(lista) ? lista : []).filter(item => this.coincideActividadConArea(item));
}

function obtenerValorOpcionArea(select) {
  if (!select) return '';
  const opciones = Array.from(select.options || []);
  const areaId = this.obtenerAreaIdAsignada();
  const areaNombre = this.obtenerAreaAsignadaUsuario();
  const areaCatalogo = this.state?.usuario?.areaNombreCatalogo || '';

  if (areaId) {
    const opcionPorId = opciones.find(opt => String(opt.value).trim() === String(areaId));
    if (opcionPorId) return opcionPorId.value;
  }

  if (areaNombre) {
    const opcionPorNombre = opciones.find(opt => coincideAreaUsuario(areaNombre, [opt.value, opt.textContent]));
    if (opcionPorNombre) return opcionPorNombre.value;
  }

  if (areaCatalogo) {
    const opcionPorCatalogo = opciones.find(opt => coincideAreaUsuario(areaCatalogo, [opt.value, opt.textContent]));
    if (opcionPorCatalogo) return opcionPorCatalogo.value;
  }

  return '';
}

function aplicarRestriccionesDeAreaEnSelects() {
  const areaSelect = document.getElementById('area_id');
  const filtroArea = document.getElementById('filtro-area');

  if (!this.debeRestringirPorArea()) {
    if (areaSelect) {
      areaSelect.disabled = false;
      areaSelect.classList.remove('bg-gray-100', 'cursor-not-allowed', 'opacity-70');
    }
    if (filtroArea) {
      filtroArea.disabled = false;
      filtroArea.classList.remove('bg-gray-100', 'cursor-not-allowed', 'opacity-70');
    }
    return;
  }

  const areaValue = this.obtenerValorOpcionArea(areaSelect) || this.obtenerAreaIdAsignada();

  if (areaSelect) {
    if (areaValue) {
      areaSelect.value = areaValue;
      areaSelect.dispatchEvent(new Event('change'));
    }
    areaSelect.disabled = true;
    areaSelect.classList.add('bg-gray-100', 'cursor-not-allowed', 'opacity-70');
  }

  if (filtroArea) {
    const opciones = Array.from(filtroArea.options || []);
    if (areaValue && !opciones.some(opt => opt.value === areaValue)) {
      const option = document.createElement('option');
      option.value = areaValue;
      option.textContent = this.obtenerAreaAsignadaUsuario() || this.state?.usuario?.areaNombreCatalogo || areaValue;
      filtroArea.appendChild(option);
    }
    if (areaValue) filtroArea.value = areaValue;
    filtroArea.disabled = true;
    filtroArea.classList.add('bg-gray-100', 'cursor-not-allowed', 'opacity-70');
  }
}

function obtenerEstadosDisponibles() {
  return ESTADOS_REVISION.map(nombre => ({ id: nombre, nombre, raw: { label: nombre } }));
}

function obtenerIdCatalogo(item, namespace, index) {
  const candidatos = [
    item.id,
    item.codigo,
    item[`${namespace}_id`],
    item[`${namespace}Id`],
    item[`${namespace}_codigo`],
    item[`${namespace}Codigo`],
    item.code,
    item.value,
    item.key,
    item.identificador,
    item.clave,
    item.uid,
    item.uuid
  ];

  const encontrado = candidatos.find(valor => valor !== null && valor !== undefined && String(valor).trim() !== '');
  if (encontrado !== undefined) {
    return String(encontrado);
  }
  return `${namespace}_${index + 1}`;
}

function obtenerNombreCatalogo(item, namespace, index) {
  const candidatos = [
    item.nombre,
    item.descripcion,
    item.descripcion_larga,
    item.detalle,
    item.titulo,
    item[`${namespace}_nombre`],
    item[`${namespace}Nombre`],
    item[`${namespace}_label`],
    item.label,
    item.name,
    item.plan,
    item.objetivo,
    item.indicador,
    item.area,
    item.subproceso,
    item.descripcion_plan,
    item.descripcion_objetivo
  ];

  let nombre = candidatos.find(valor => typeof valor === 'string' && valor.trim().length > 0);
  const codigo = [item.codigo, item.code, item.sigla, item.abreviatura]
    .find(valor => typeof valor === 'string' && valor.trim().length > 0);

  if (codigo) {
    if (nombre && !nombre.toLowerCase().includes(codigo.toLowerCase())) {
      nombre = `${codigo} - ${nombre}`;
    } else if (!nombre) {
      nombre = codigo;
    }
  }

  if (!nombre) {
    nombre = `${this.capitalizarFrase(namespace)} ${index + 1}`;
  }

  return nombre.trim();
}

function obtenerParentCatalogo(item) {
  const candidatos = [
    item.parent_id,
    item.parentId,
    item.parent_code,
    item.parentCode,
    item.area_id,
    item.areaId,
    item.id_area,
    item.codigo_area,
    item.padre_id
  ];

  const encontrado = candidatos.find(valor => valor !== null && valor !== undefined && String(valor).trim() !== '');
  return encontrado !== undefined ? String(encontrado) : null;
}

function obtenerOrdenCatalogo(item, fallback) {
  const candidatos = [item.orden, item.order, item.posicion, item.position, item.prioridad, item.priority, item.index];
  const encontrado = candidatos.find(valor => valor !== null && valor !== undefined && !Number.isNaN(Number(valor)));
  if (encontrado !== undefined) {
    return Number(encontrado);
  }
  return fallback;
}

function normalizeCatalogItems(items, namespace = 'item') {
  if (!Array.isArray(items)) return [];

  const normalizados = items
    .map((item, index) => {
      if (!item) return null;
      if (typeof item === 'string') {
        return {
          id: String(item),
          nombre: this.capitalizarFrase(item),
          parent_id: null,
          orden: index,
          raw: { label: item }
        };
      }

      const raw = { ...item };
      const id = this.obtenerIdCatalogo(item, namespace, index);
      if (!id) return null;

      const nombre = this.obtenerNombreCatalogo(item, namespace, index);
      const parent = this.obtenerParentCatalogo(item);
      const orden = this.obtenerOrdenCatalogo(item, index);

      return {
        id,
        nombre,
        parent_id: parent,
        orden,
        raw
      };
    })
    .filter(Boolean);

  return normalizados.sort((a, b) => {
    const ordenA = Number.isFinite(a.orden) ? a.orden : Number.MAX_SAFE_INTEGER;
    const ordenB = Number.isFinite(b.orden) ? b.orden : Number.MAX_SAFE_INTEGER;
    if (ordenA !== ordenB) return ordenA - ordenB;
    return a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' });
  });
}

async function cargarCatalogos({ loaderMessage = null } = {}) {
  try {
    const response = await apiService.fetchCatalogo(undefined, { loaderMessage });
    const data = response?.data || response || {};
    if (!data || typeof data !== 'object') {
      console.warn('[WARN] Formato inesperado de catálogos:', data);
      this.state.catalogos = this.obtenerCatalogosVacios();
    } else {
      this.state.catalogos = {
        areas: this.normalizeCatalogItems(data.areas, 'area'),
        subprocesos: this.normalizeCatalogItems(data.subprocesos, 'subproceso'),
        objetivos: this.normalizeCatalogItems(data.objetivos, 'objetivo'),
        estrategias: this.normalizeCatalogItems(data.estrategias, 'estrategia'),
        lineasTrabajo: this.normalizeCatalogItems(
          data.lineas_trabajo || data.lineasTrabajo || data.linea_trabajo || [],
          'linea_trabajo'
        ),
        lineas: this.normalizeCatalogItems(
          data.lineas_accion || data.lineasAccion || data.lineas || [],
          'linea_accion'
        ),
        indicadores: this.normalizeCatalogItems(data.indicadores, 'indicador'),
        planes: this.normalizeCatalogItems(data.planes, 'plan'),
        mipg: this.normalizeCatalogItems(data.mipg, 'mipg'),
        bimestres: this.normalizeCatalogItems(data.bimestres, 'bimestre'),
        fuentes: this.normalizeCatalogItems(data.fuentes, 'fuente'),
        estados: this.obtenerEstadosDisponibles(),
        usuarios: this.normalizeCatalogItems(data.usuarios, 'usuario')
      };
    }

    this.sincronizarAreaUsuarioConCatalogos();
    this.poblarSelectsCatalogos();
  } catch (error) {
    console.error('[ERROR] Error cargando catálogos:', error);
    mostrarToast('Error al cargar los catálogos', 'error');
    this.state.catalogos = this.obtenerCatalogosVacios();
  }
}

function poblarSelectsCatalogos() {
  this.llenarSelect('area_id', this.state.catalogos.areas, { placeholder: 'Seleccionar área...' });
  this.llenarSelect('subproceso_id', this.state.catalogos.subprocesos, { placeholder: 'Seleccionar subproceso...' });
  this.llenarSelect('mipg_codigo', this.state.catalogos.mipg, { placeholder: 'Seleccionar dimensión MIPG...' });
  this.llenarSelect('objetivo_id', this.state.catalogos.objetivos, { placeholder: 'Seleccionar objetivo...' });
  this.llenarSelect('estrategia_id', this.state.catalogos.estrategias, { placeholder: 'Seleccionar estrategia...' });
  this.llenarSelect('linea_trabajo_id', this.state.catalogos.lineasTrabajo, { placeholder: 'Seleccionar línea de trabajo...' });
  this.llenarSelect('linea_accion_id', this.state.catalogos.lineas, { placeholder: 'Seleccionar línea de acción...' });
  this.llenarSelect('fuente_financiacion', this.state.catalogos.fuentes, { placeholder: 'Seleccionar fuente...' });
  this.llenarSelect('plan_id', this.state.catalogos.planes, { placeholder: 'Seleccionar planes...' });
  this.refreshPlanMultiSelect();

  this.llenarSelect('filtro-area', this.state.catalogos.areas, { placeholder: 'Todas las áreas' });
  this.llenarSelect('filtro-plan', this.state.catalogos.planes, { placeholder: 'Todos los planes' });
  this.llenarSelect('filtro-estado', this.state.catalogos.estados, { placeholder: 'Todos los estados' });

  const areaSelect = document.getElementById('area_id');
  const estrategiaSelect = document.getElementById('estrategia_id');
  if (areaSelect) {
    areaSelect.addEventListener('change', () => {
      const areaValue = areaSelect.value;
      const lineaTrabajoSelect = document.getElementById('linea_trabajo_id');
      const lineaTrabajoActual = lineaTrabajoSelect ? lineaTrabajoSelect.value : '';
      this.actualizarSubprocesosPorArea(areaValue);
      this.actualizarLineasTrabajoPorArea(areaValue, lineaTrabajoActual);
      const estrategiaValue = estrategiaSelect ? estrategiaSelect.value : '';
      this.actualizarLineasAccionPorEstrategia(estrategiaValue);
      if (typeof this.onAreaSelectionChange === 'function') {
        this.onAreaSelectionChange(areaValue, {
          presupuestoPlaneado: this.obtenerPresupuestoProgramadoActual(),
          fechaInicio: document.getElementById('fecha_inicio_planeada')?.value
        });
      }
    });
  }

  const areaInicial = areaSelect ? areaSelect.value : '';
  this.actualizarSubprocesosPorArea(areaInicial);
  this.actualizarLineasTrabajoPorArea(areaInicial);
  const estrategiaInicial = estrategiaSelect ? estrategiaSelect.value : '';
  this.actualizarLineasAccionPorEstrategia(estrategiaInicial);
  if (typeof this.onAreaSelectionChange === 'function') {
    this.onAreaSelectionChange(areaInicial, {
      presupuestoPlaneado: this.obtenerPresupuestoProgramadoActual(),
      fechaInicio: document.getElementById('fecha_inicio_planeada')?.value
    });
  }

  if (estrategiaSelect) {
    estrategiaSelect.addEventListener('change', () => {
      this.actualizarLineasAccionPorEstrategia(estrategiaSelect.value);
    });
  }

  this.aplicarRestriccionesDeAreaEnSelects();
}

function actualizarSubprocesosPorArea(areaId, selectedSubprocesoId = '') {
  const subprocesoSelect = document.getElementById('subproceso_id');
  if (!subprocesoSelect) return;

  const subprocesos = this.state.catalogos.subprocesos;
  let disponibles = subprocesos;

  if (areaId) {
    disponibles = subprocesos.filter(sub => sub.parent_id === String(areaId));
  }

  this.llenarSelect('subproceso_id', disponibles, {
    placeholder: 'Seleccionar subproceso...',
    selectedValue: selectedSubprocesoId
  });
}

function actualizarLineasTrabajoPorArea(areaId, selectedLineaId = '') {
  const lineaTrabajoSelect = document.getElementById('linea_trabajo_id');
  if (!lineaTrabajoSelect) return;

  const todasLineas = Array.isArray(this.state.catalogos.lineasTrabajo)
    ? this.state.catalogos.lineasTrabajo
    : [];

  if (!todasLineas.length) {
    this.llenarSelect('linea_trabajo_id', [], {
      placeholder: 'Seleccionar línea de trabajo...'
    });
    return;
  }

  const tokensArea = construirTokenSetArea(areaId, this.state.catalogos.areas || []);
  const debeFiltrar = tokensArea.size > 0;

  const disponibles = debeFiltrar
    ? todasLineas.filter(linea => {
        if (!linea) return false;
        const tokensLinea = construirTokenSetLineaTrabajo(linea);
        if (!tokensLinea.size) return false;
        for (const token of tokensLinea) {
          if (tokensArea.has(token)) {
            return true;
          }
        }
        return false;
      })
    : todasLineas;

  const valorActual = selectedLineaId || lineaTrabajoSelect.value;
  const existeValor = valorActual && disponibles.some(item => String(item.id) === String(valorActual));

  this.llenarSelect('linea_trabajo_id', disponibles, {
    placeholder: 'Seleccionar línea de trabajo...',
    selectedValue: existeValor ? valorActual : ''
  });
}

function actualizarLineasAccionPorEstrategia(estrategiaId, selectedLineaAccionId = '') {
  const lineaAccionSelect = document.getElementById('linea_accion_id');
  if (!lineaAccionSelect) return;

  const todasLineas = Array.isArray(this.state.catalogos.lineas)
    ? this.state.catalogos.lineas
    : [];

  if (!todasLineas.length) {
    this.llenarSelect('linea_accion_id', [], {
      placeholder: 'Seleccionar línea de acción...',
      selectedValue: ''
    });
    return;
  }

  const tokensEstrategia = construirTokenSetEstrategia(estrategiaId, this.state.catalogos.estrategias || []);
  const debeFiltrar = tokensEstrategia.size > 0;

  const disponibles = debeFiltrar
    ? todasLineas.filter(item => {
        if (!item) return false;
        const raw = item.raw || {};
        const candidatos = [
          item.parent_id,
          raw.parent_id,
          raw.parentId,
          raw.parent_code,
          raw.parentCode,
          raw.estrategia_id,
          raw.estrategiaId,
          raw.estrategia_codigo,
          raw.estrategiaCodigo
        ].map(normalizarTokenComparacion).filter(Boolean);
        if (!candidatos.length) return false;
        for (const token of candidatos) {
          if (tokensEstrategia.has(token)) {
            return true;
          }
        }
        return false;
      })
    : todasLineas;

  const valorActual = selectedLineaAccionId || lineaAccionSelect.value;
  const existeValor = valorActual && disponibles.some(item => String(item.id) === String(valorActual));

  this.llenarSelect('linea_accion_id', disponibles, {
    placeholder: 'Seleccionar línea de acción...',
    selectedValue: existeValor ? valorActual : ''
  });
}

function resolverValorCatalogo(lista, valorId, valorNombre) {
  if (!Array.isArray(lista)) return '';
  if (valorId && lista.some(item => String(item.id) === String(valorId))) {
    return String(valorId);
  }
  if (valorNombre) {
    const encontrado = lista.find(
      item =>
        item.nombre === valorNombre ||
        item.raw?.label === valorNombre ||
        item.raw?.nombre === valorNombre
    );
    if (encontrado) {
      return String(encontrado.id);
    }
  }
  return '';
}

function obtenerItemCatalogo(lista, valorId, valorNombre) {
  const id = this.resolverValorCatalogo(lista, valorId, valorNombre);
  if (!id) return null;
  return lista.find(item => String(item.id) === String(id)) || null;
}

export const catalogMethods = {
  obtenerCatalogosVacios,
  debeRestringirPorArea,
  obtenerAreaAsignadaUsuario,
  obtenerAreaIdAsignada,
  sincronizarAreaUsuarioConCatalogos,
  coincideActividadConArea,
  aplicarRestriccionAreaEnListado,
  obtenerValorOpcionArea,
  aplicarRestriccionesDeAreaEnSelects,
  obtenerEstadosDisponibles,
  obtenerIdCatalogo,
  obtenerNombreCatalogo,
  obtenerParentCatalogo,
  obtenerOrdenCatalogo,
  normalizeCatalogItems,
  cargarCatalogos,
  poblarSelectsCatalogos,
  actualizarSubprocesosPorArea,
  actualizarLineasTrabajoPorArea,
  actualizarLineasAccionPorEstrategia,
  resolverValorCatalogo,
  obtenerItemCatalogo
};
