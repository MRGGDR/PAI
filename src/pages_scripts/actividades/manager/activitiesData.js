import apiService from '../api.js';
import CardsManager from '../cardsManager.js';
import { RIESGO_SEMAFORO_CONFIG } from './constants.js';
import {
  mostrarToast,
  obtenerEmailUsuarioActual,
  normalizarEstadoRevision,
  normalizarEstadoActividad,
  obtenerClaseEstadoRevision,
  obtenerClaseEstadoActividad,
  ESTADOS_REVISION
} from '../utils.js';

function normalizarRespuestaActividades(respuesta) {
  if (Array.isArray(respuesta)) return respuesta;
  if (respuesta?.data && Array.isArray(respuesta.data)) return respuesta.data;
  if (respuesta?.actividades && Array.isArray(respuesta.actividades)) return respuesta.actividades;
  console.warn('[WARN] Formato inesperado de actividades:', respuesta);
  return [];
}

function normalizarMetaValorLocal(valor) {
  if (valor === null || valor === undefined || valor === '') {
    return 0;
  }

  if (typeof valor === 'number') {
    return Number.isFinite(valor) ? Math.round(valor * 100) / 100 : 0;
  }

  let texto = valor.toString().trim();
  if (!texto) return 0;

  texto = texto.replace(/[^0-9,.-]/g, '');
  if (!texto) return 0;

  const tieneComa = texto.includes(',');
  const tienePunto = texto.includes('.');

  if (tieneComa && tienePunto) {
    if (texto.lastIndexOf('.') > texto.lastIndexOf(',')) {
      texto = texto.replace(/,/g, '');
    } else {
      texto = texto.replace(/\./g, '').replace(/,/g, '.');
    }
  } else if (tieneComa) {
    texto = texto.replace(/\./g, '').replace(/,/g, '.');
  }

  const numero = Number(texto);
  if (Number.isNaN(numero) || !Number.isFinite(numero)) {
    return 0;
  }

  return Math.round(numero * 100) / 100;
}

function normalizarRiesgoPorcentajeLocal(valor) {
  if (valor === null || valor === undefined || valor === '') {
    return null;
  }

  const texto = valor.toString().trim();
  if (!texto) {
    return null;
  }

  const sanitized = texto
    .replace(/%/g, '')
    .replace(/\s+/g, '')
    .replace(/,/g, '.')
    .replace(/[^0-9.+-]/g, '');

  if (!sanitized) {
    return null;
  }

  const numero = Number(sanitized);
  if (!Number.isFinite(numero)) {
    return null;
  }

  const bounded = Math.min(100, Math.max(0, numero));
  return Math.round(bounded * 100) / 100;
}

function obtenerConfigRiesgoLocal(valor) {
  const percent = normalizarRiesgoPorcentajeLocal(valor);
  if (percent === null) {
    return {
      id: '',
      label: 'Sin clasificar',
      percent: null,
      rangeLabel: '0% - 100%'
    };
  }

  const config = RIESGO_SEMAFORO_CONFIG.find(item => percent >= item.min && percent <= item.max)
    || RIESGO_SEMAFORO_CONFIG[RIESGO_SEMAFORO_CONFIG.length - 1];

  return {
    ...config,
    percent,
    rangeLabel: `${config.min}% - ${config.max}%`
  };
}

function mapActividadParaTabla(raw) {
  const id = raw.id ?? raw.actividad_id ?? raw.codigo ?? '';
  const area = this.obtenerItemCatalogo(this.state.catalogos.areas, raw.area_id, raw.areaNombre || raw.area);
  const subproceso = this.obtenerItemCatalogo(
    this.state.catalogos.subprocesos,
    raw.subproceso_id,
    raw.subprocesoNombre || raw.subproceso
  );
  const indicadorCatalogo = this.obtenerItemCatalogo(
    this.state.catalogos.indicadores,
    raw.indicador_id,
    raw.indicadorNombre || raw.indicador
  );
  const planesInfo = this.obtenerPlanesDesdeDato(raw, this.state.catalogos.planes);
  const planPrincipal = planesInfo.ids.length
    ? this.state.catalogos.planes.find(item => String(item.id) === String(planesInfo.ids[0]))
    : null;
  const estadoRevisionRaw =
    raw.estado_revision ||
    raw.estadoRevision ||
    raw.estado_revision_nombre ||
    raw.estadoRevisionNombre ||
    raw.estadoRevisionDisplay ||
    '';
  const estadoGeneralRaw =
    raw.estado ||
    raw.estadoNombre ||
    raw.estado_actividad ||
    raw.estadoActividad ||
    '';
  const estadoCatalogo = this.obtenerItemCatalogo(
    this.state.catalogos.estados,
    estadoRevisionRaw || estadoGeneralRaw,
    estadoRevisionRaw || estadoGeneralRaw
  );
  const estadoRevisionCanonical = estadoRevisionRaw ? normalizarEstadoRevision(estadoRevisionRaw) : '';
  const estadoActividadCanonical = estadoGeneralRaw ? normalizarEstadoActividad(estadoGeneralRaw) : '';
  const estadoDisplay = (() => {
    const revisionEsSolida = ESTADOS_REVISION.includes(estadoRevisionCanonical) && estadoRevisionCanonical !== 'Sin revisión';
    const actividadEsRevision = ESTADOS_REVISION.includes(estadoActividadCanonical) && estadoActividadCanonical !== 'Sin revisión';

    if (revisionEsSolida) {
      return estadoRevisionCanonical;
    }

    if (actividadEsRevision) {
      return estadoActividadCanonical;
    }

    if (ESTADOS_REVISION.includes(estadoRevisionCanonical)) {
      return estadoRevisionCanonical;
    }

    if (ESTADOS_REVISION.includes(estadoActividadCanonical)) {
      return estadoActividadCanonical;
    }

    if (estadoRevisionCanonical) {
      return estadoRevisionCanonical;
    }

    if (estadoActividadCanonical) {
      return estadoActividadCanonical;
    }

    return 'Sin revisión';
  })();
  const estadoId = estadoCatalogo?.id || estadoDisplay;
  const responsable =
    raw.responsable ||
    raw.responsable_nombre ||
    raw.responsableName ||
    this.state.usuario?.email ||
    obtenerEmailUsuarioActual();

  const fechaInicio = raw.fecha_inicio_planeada || raw.fecha_inicio || '';
  const fechaFin = raw.fecha_fin_planeada || raw.fecha_fin || '';
  const descripcionVerbo = raw.descripcion_verbo || raw.descripcionVerbo || '';
  const descripcionObjeto = raw.descripcion_objeto || raw.descripcionObjeto || '';
  const descripcionFinalidad = raw.descripcion_finalidad || raw.descripcionFinalidad || '';
  const descripcionBeneficiarios = raw.descripcion_beneficiarios || raw.descripcionBeneficiarios || '';
  const descripcionTemporalidad = raw.descripcion_temporalidad || raw.descripcionTemporalidad || '';
  const fechasLabel =
    fechaInicio || fechaFin
      ? `${fechaInicio ? this.formatearFechaDisplay(fechaInicio) : 'Sin fecha inicio'} &rarr; ${fechaFin ? this.formatearFechaDisplay(fechaFin) : 'Sin fecha fin'}`
      : 'Sin definir';
  const indicadorTexto = raw.indicador_detalle || raw.indicador || raw.indicadorNombre || indicadorCatalogo?.nombre || '';
  const metaDescripcionCompleta = (raw.meta_indicador_detalle || raw.meta_texto_completo || '').toString().trim();
  const metaTextoPlano = (raw.meta_texto || raw.metaDescripcion || '').toString().trim();
  const metaDetalle = metaDescripcionCompleta || metaTextoPlano;
  const metaFuente = raw.meta_indicador_valor ?? raw.meta_valor ?? raw.meta ?? raw.metaValor ?? '';
  const metaValor = normalizarMetaValorLocal(metaFuente || metaDetalle);
  const metaValorTexto = metaFuente !== null && metaFuente !== undefined ? metaFuente.toString().trim() : '';
  const metaTexto = metaDetalle || metaValorTexto;
  const metaDisplay = metaDescripcionCompleta || [metaValorTexto, metaTextoPlano].filter(Boolean).join(metaTextoPlano ? ' ' : '').trim();
  const metaTieneDigitos = /\d/.test((metaDetalle || metaFuente || '').toString());
  const riesgoFuente = raw.riesgo_porcentaje ?? raw.riesgoPorcentaje ?? raw.riesgo_percent ?? raw.riesgoPercent ?? null;
  const riesgoPorcentaje = normalizarRiesgoPorcentajeLocal(riesgoFuente);
  const riesgoSemaforo = obtenerConfigRiesgoLocal(riesgoPorcentaje);

  return {
    id: String(id),
    codigo: raw.codigo || '',
    descripcion: raw.descripcion_actividad || raw.descripcion || raw.nombre || 'Sin descripción',
    areaNombre: area?.nombre || raw.areaNombre || raw.area || '',
    areaId: area?.id || raw.area_id || '',
    subprocesoNombre: subproceso?.nombre || raw.subproceso || '',
    indicadorNombre: indicadorTexto,
    indicadorTexto,
    meta: metaTexto || (metaTieneDigitos ? metaValor : ''),
    metaDetalle: metaTexto,
    metaValor,
    metaValorTexto,
    metaTextoPlano,
    metaDisplay,
    responsableNombre: responsable,
    riesgos: raw.riesgos || raw.riesgo || '',
    riesgoPorcentaje,
    riesgoSemaforo,
    riesgoNivel: riesgoSemaforo.id,
    riesgoNivelLabel: riesgoSemaforo.label,
    estadoNombre: estadoDisplay,
    estadoRevisionNombre: estadoRevisionCanonical || estadoDisplay,
    estadoActividadNombre: estadoActividadCanonical,
    estadoRevisionFuente: estadoRevisionRaw,
    estadoActividadFuente: estadoGeneralRaw,
    estadoId,
    planId: planPrincipal?.id || planesInfo.ids[0] || '',
    planIds: planesInfo.ids,
    planesNombres: planesInfo.nombres,
    planDisplay: planesInfo.display,
    fechasLabel,
    fechaInicio,
    fechaFin,
    descripcionVerbo,
    descripcionObjeto,
    descripcionFinalidad,
    descripcionBeneficiarios,
    descripcionTemporalidad,
    bimestres: raw.bimestres || [],
    raw
  };
}

// Extrae el último número de un código tipo 'GTH-2025-001' => 1
function extraerNumeroFinalDeCodigo(codigo) {
  if (!codigo) return null;
  try {
    const m = String(codigo).trim().match(/(\d+)\s*$/);
    return m ? parseInt(m[1].replace(/^0+/, '') || m[1], 10) : null;
  } catch (e) {
    return null;
  }
}

// Ordena actividades por área (prefiere prefijo del código) y luego por número final
function ordenarPorAreaYNumero(actividades) {
  if (!Array.isArray(actividades)) return actividades;
  return actividades.slice().sort((a, b) => {
    const prefijoA = (a.codigo && a.codigo.split('-')[0]) || a.areaNombre || '';
    const prefijoB = (b.codigo && b.codigo.split('-')[0]) || b.areaNombre || '';
    const keyA = String(prefijoA || '').toLowerCase();
    const keyB = String(prefijoB || '').toLowerCase();
    if (keyA !== keyB) return keyA.localeCompare(keyB);

    const numA = extraerNumeroFinalDeCodigo(a.codigo) ?? Number.MIN_SAFE_INTEGER;
    const numB = extraerNumeroFinalDeCodigo(b.codigo) ?? Number.MIN_SAFE_INTEGER;
    if (numA !== numB) return numA - numB;

    // Fallback: ordenar por código completo y luego por id
    const codeA = String(a.codigo || '').toLowerCase();
    const codeB = String(b.codigo || '').toLowerCase();
    if (codeA !== codeB) return codeA.localeCompare(codeB);
    return String(a.id || '').localeCompare(String(b.id || ''));
  });
}

function obtenerReferenciaActividadParaAvances(actividad) {
  if (!actividad) return '';

  const candidatos = [
    actividad.id,
    actividad.raw?.actividad_id,
    actividad.raw?.id,
    actividad.codigo,
    actividad.raw?.codigo
  ];

  for (const candidato of candidatos) {
    if (candidato !== undefined && candidato !== null) {
      const valor = String(candidato).trim();
      if (valor) return valor;
    }
  }

  return '';
}

function renderBadge(valor) {
  const candidatos = Array.isArray(valor) ? valor : [valor];
  const raw = candidatos.find(item => typeof item === 'string' && item.trim()) || 'Sin revisión';
  const revisionCanonical = normalizarEstadoRevision(raw);
  const actividadCanonical = normalizarEstadoActividad(raw);
  const esRevision = ESTADOS_REVISION.includes(revisionCanonical);
  const display = esRevision
    ? revisionCanonical
    : actividadCanonical || revisionCanonical || raw || 'Sin revisión';
  const classes = esRevision
    ? obtenerClaseEstadoRevision(display, 'badge')
    : obtenerClaseEstadoActividad(display, 'badge');

  return `<span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${classes}">${display}</span>`;
}

async function cargarActividades({ loaderMessage = null } = {}) {
  try {
    const respuesta = await apiService.fetchActividades({ loaderMessage });
    const actividades = this.normalizarRespuestaActividades(respuesta);
    const mapeadas = actividades.map(item => this.mapActividadParaTabla(item));
    this.state.actividades = this.aplicarRestriccionAreaEnListado(mapeadas);
    // Ordenar visualmente por área/prefijo de código y luego por el número final del código
    try {
      this.state.actividades = ordenarPorAreaYNumero(this.state.actividades);
    } catch (e) {
      console.warn('[WARN] No fue posible ordenar las actividades por área/numero:', e);
    }
    if (this.components.tablaActividades) {
      this.components.tablaActividades.setData(this.state.actividades);
    }
    this.aplicarPermisosInterfaz();
    console.log('[INFO] Actividades cargadas:', this.state.actividades.length);
    return this.state.actividades;
  } catch (error) {
    console.error('[ERROR] Error cargando actividades:', error);
    mostrarToast('No fue posible obtener las actividades', 'error');
    this.state.actividades = [];
    if (this.components.tablaActividades) {
      this.components.tablaActividades.setData([]);
    }
    return [];
  }
}

function inicializarTabla() {
  const mostrarEditar = this.puedeEditarActividades();
  const mostrarEliminar = this.puedeEliminarActividades();
  const puedeRegistrarAvances = this.puedeCrearAvances();

  const registerShortcutConfig = {
    enabled: puedeRegistrarAvances,
    label: 'Registrar avance',
    helperText: 'Abriremos una nueva pestaña con el módulo de avances listo para este bimestre.',
    deniedMessage: puedeRegistrarAvances ? '' : 'Tu rol no permite registrar avances.',
    onTrigger: (context) => this.abrirAtajoRegistroAvance(context)
  };

  if (this.components.tablaActividades) {
    this.components.tablaActividades.setData(this.state.actividades);
    this.components.tablaActividades.setAvanceShortcut(registerShortcutConfig);
    return;
  }

  this.components.tablaActividades = new CardsManager('actividades-grid', {
    data: this.state.actividades,
    pageSize: 12,
    search: true,
    pagination: true
  });

  // Configurar acciones de las tarjetas
  this.components.tablaActividades.setCardActions((item) => {
    const botones = [];
    if (mostrarEditar) {
      botones.push(`
        <button type="button" class="js-edit-actividad inline-flex items-center rounded-lg border border-indigo-200 bg-indigo-50 p-1.5 text-indigo-700 hover:bg-indigo-100 hover:border-indigo-300 transition-all duration-200" title="Editar actividad">
          <span class="material-symbols-outlined text-sm">edit</span>
        </button>
      `);
    }
    if (mostrarEliminar) {
      botones.push(`
        <button type="button" class="js-delete-actividad inline-flex items-center rounded-lg border border-red-200 bg-red-50 p-1.5 text-red-700 hover:bg-red-100 hover:border-red-300 transition-all duration-200" title="Eliminar actividad">
          <span class="material-symbols-outlined text-sm">delete</span>
        </button>
      `);
    }
    return botones.join('');
  });

  this.components.tablaActividades.setAvanceShortcut(registerShortcutConfig);

  // Configurar evento de click en tarjetas para abrir modal
  this.components.tablaActividades.onCardClick((item) => {
    this.components.tablaActividades.openModal(item);
  });

  // Configurar callback de edición desde el modal
  this.components.tablaActividades.setEditCallback((item) => {
    this.editarActividad(item.raw || item);
  });

  // Configurar eventos de cierre del modal
  this.configurarEventosModal();

  this.configurarEventosTabla();
}

function configurarEventosTabla() {
  if (!this.components.tablaActividades) return;
  const puedeEditar = this.puedeEditarActividades();
  const puedeEliminar = this.puedeEliminarActividades();
  if (!puedeEditar && !puedeEliminar) return;

  if (puedeEditar) {
    this.components.tablaActividades.onButtonClick('.js-edit-actividad', (_, { record }) => {
      this.editarActividad(record?.raw || record);
    });
  }

  if (puedeEliminar) {
    this.components.tablaActividades.onButtonClick('.js-delete-actividad', (_, { record }) => {
      const raw = record?.raw || record;
      this.confirmarEliminarActividad(raw);
    });
  }
}

function configurarEventosModal() {
  // Botones de cerrar modal
  const btnCerrarModal = document.getElementById('btn-cerrar-modal');
  
  if (btnCerrarModal) {
    btnCerrarModal.addEventListener('click', () => {
      if (this.components.tablaActividades) {
        this.components.tablaActividades.closeModal();
      }
    });
  }
  
  // Cerrar modal con ESC
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const modal = document.getElementById('modal-detalle-actividad');
      if (modal && !modal.classList.contains('hidden')) {
        if (this.components.tablaActividades) {
          this.components.tablaActividades.closeModal();
        }
      }
    }
  });
  
  // Cerrar modal al hacer click fuera
  const modal = document.getElementById('modal-detalle-actividad');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        if (this.components.tablaActividades) {
          this.components.tablaActividades.closeModal();
        }
      }
    });
  }
}

function abrirAtajoRegistroAvance({ actividad = null, bimestreIndex = null, bimestreLabel = '' } = {}) {
  if (!this.puedeCrearAvances()) {
    mostrarToast('Tu rol no permite registrar avances.', 'warning');
    return;
  }

  if (typeof window === 'undefined' || !window.location) {
    console.warn('[WARN] El acceso directo a avances no está disponible fuera del navegador.');
    return;
  }

  try {
    const referencia = obtenerReferenciaActividadParaAvances(actividad);
    const targetUrl = new URL('avance.html', window.location.href);

    if (referencia) {
      targetUrl.searchParams.set('actividad', referencia);
    }

    targetUrl.searchParams.set('modal', 'avance');
    targetUrl.searchParams.set('nuevo', '1');

    const indexNumber = Number.parseInt(bimestreIndex, 10);
    if (!Number.isNaN(indexNumber) && indexNumber >= 0) {
      targetUrl.searchParams.set('bimestre', String(indexNumber + 1));
    } else if (bimestreLabel) {
      targetUrl.searchParams.set('bimestre', bimestreLabel);
    }

    targetUrl.searchParams.set('origen', 'actividades');

    const nuevaVentana = window.open(targetUrl.toString(), '_blank', 'noopener,noreferrer');
    if (!nuevaVentana) {
      mostrarToast('Tu navegador bloqueó la nueva pestaña; redirigiendo en esta ventana.', 'warning');
      window.location.href = targetUrl.toString();
    }
  } catch (error) {
    console.error('[ERROR] No fue posible abrir el módulo de avances desde actividades:', error);
    mostrarToast('No fue posible abrir el módulo de avances. Intenta nuevamente.', 'error');
  }
}

export const activitiesDataMethods = {
  normalizarRespuestaActividades,
  mapActividadParaTabla,
  renderBadge,
  cargarActividades,
  inicializarTabla,
  configurarEventosTabla,
  configurarEventosModal,
  abrirAtajoRegistroAvance
};
