import { selectEnhancerMethods } from '../actividades/manager/selectEnhancers.js';
import { datePickerMethods } from '../actividades/manager/datePickers.js';
import { utilsMethods } from '../actividades/manager/utils.js';
import { readInitialSelectionFromURL } from './utils.js';

export const domRefs = {
  tableBody: null,
  emptyState: null,
  summary: null,
  summarySelection: null,
  refreshButton: null,
  filters: {
    actividad: null,
    year: null,
    bimestre: null,
    clearButton: null
  },
  activitySummary: {
    container: null,
    name: null,
    description: null,
    code: null,
    area: null,
    subproceso: null,
    metaPlan: null,
    presupuestoPlan: null,
    metaLogro: null,
    presupuestoEjecutado: null,
    avancesCount: null,
    ultimaFecha: null,
    bimestres: null
  },
  modal: {
    container: null,
    body: null,
    form: null,
    subtitulo: null,
    actividadTitulo: null,
    actividadDescripcion: null,
    actividadCodigo: null,
    actividadArea: null,
    actividadMeta: null,
    actividadPresupuesto: null,
    actividadSelect: null,
    anioSelect: null,
    bimestreSelect: null,
    metaInput: null,
    logroInput: null,
    presupuestoInput: null,
    avancesEditor: null,
    dificultadesEditor: null,
    avancesHidden: null,
    dificultadesHidden: null,
    avancesSpellBtn: null,
    dificultadesSpellBtn: null,
    avancesSpellPanel: null,
    dificultadesSpellPanel: null,
    avanceIdInput: null,
    reportadoPorInput: null,
    evidenciaInput: null,
    fechaReporteInput: null,
    contextCard: null,
    contextNombre: null,
    contextMeta: null,
    contextPresupuesto: null,
    contextDescripcion: null,
    contextAlert: null,
    contextMetaRegistrado: null,
    contextMetaSaldo: null,
    contextPresupuestoRegistrado: null,
    contextPresupuestoSaldo: null,
    closeButton: null,
    cancelButton: null,
    submitButton: null
  }
};

export const avancesState = {
  actividades: [],
  actividadesIndex: new Map(),
  actividadesCodigoIndex: new Map(),
  actividadSeleccionadaId: '',
  avances: [],
  filtros: {
    actividad: '',
    year: '',
    bimestre: ''
  },
  restricciones: {
    restringirPorArea: false,
    areaAsignada: ''
  },
  initialURLSelection: readInitialSelectionFromURL()
};

export const selectEnhancerContext = {
  components: {
    selectEnhancers: new Map(),
    datePickers: new Map()
  },
  ...utilsMethods,
  utils: utilsMethods,
  ...selectEnhancerMethods,
  ...datePickerMethods
};

export function bindDomReferences() {
  domRefs.tableBody = document.getElementById('avances-body');
  domRefs.emptyState = document.getElementById('avances-empty');
  domRefs.summary = document.getElementById('avances-summary');
  domRefs.summarySelection = document.getElementById('avances-summary-selection');
  domRefs.refreshButton = document.getElementById('refrescar-avances');

  domRefs.filters.actividad = document.getElementById('filter-actividad');
  domRefs.filters.year = document.getElementById('filter-year');
  domRefs.filters.bimestre = document.getElementById('filter-bimestre');
  domRefs.filters.clearButton = document.getElementById('filter-clear');

  domRefs.activitySummary.container = document.getElementById('actividad-resumen-card');
  domRefs.activitySummary.name = document.getElementById('actividad-resumen-nombre');
  domRefs.activitySummary.description = document.getElementById('actividad-resumen-resumen');
  domRefs.activitySummary.code = document.getElementById('actividad-resumen-codigo');
  domRefs.activitySummary.area = document.getElementById('actividad-resumen-area');
  domRefs.activitySummary.subproceso = document.getElementById('actividad-resumen-subproceso');
  domRefs.activitySummary.metaPlan = document.getElementById('actividad-resumen-meta-plan');
  domRefs.activitySummary.presupuestoPlan = document.getElementById('actividad-resumen-presupuesto-plan');
  domRefs.activitySummary.metaLogro = document.getElementById('actividad-resumen-meta-logro');
  domRefs.activitySummary.presupuestoEjecutado = document.getElementById('actividad-resumen-presupuesto-ejecutado');
  domRefs.activitySummary.avancesCount = document.getElementById('actividad-resumen-avances-count');
  domRefs.activitySummary.ultimaFecha = document.getElementById('actividad-resumen-ultima-fecha');
  domRefs.activitySummary.bimestres = document.getElementById('actividad-resumen-bimestres');

  domRefs.modal.container = document.getElementById('modal-registrar-avance');
  domRefs.modal.body = document.getElementById('modal-registrar-avance-body');
  domRefs.modal.form = document.getElementById('form-modal-avance');
  domRefs.modal.subtitulo = document.getElementById('modal-actividad-subtitulo');
  domRefs.modal.actividadTitulo = document.getElementById('modal-actividad-nombre');
  domRefs.modal.actividadDescripcion = document.getElementById('modal-actividad-descripcion');
  domRefs.modal.actividadCodigo = document.getElementById('modal-actividad-codigo');
  domRefs.modal.actividadArea = document.getElementById('modal-actividad-area');
  domRefs.modal.actividadMeta = document.getElementById('modal-actividad-meta-anual');
  domRefs.modal.actividadPresupuesto = document.getElementById('modal-actividad-presupuesto');
  domRefs.modal.actividadSelect = document.getElementById('modal-actividad_id');
  domRefs.modal.anioSelect = document.getElementById('modal-anio');
  domRefs.modal.bimestreSelect = document.getElementById('modal-bimestre_id');
  domRefs.modal.metaInput = document.getElementById('modal-meta_programada_bimestre');
  domRefs.modal.logroInput = document.getElementById('modal-logro_valor');
  domRefs.modal.presupuestoInput = document.getElementById('modal-presupuesto_ejecutado_bimestre');
  domRefs.modal.avancesEditor = document.getElementById('modal-avances-editor');
  domRefs.modal.dificultadesEditor = document.getElementById('modal-dificultades-editor');
  domRefs.modal.avancesHidden = document.getElementById('modal-avances_texto');
  domRefs.modal.dificultadesHidden = document.getElementById('modal-dificultades_texto');
  domRefs.modal.avancesSpellBtn = document.getElementById('btn-verificar-avances');
  domRefs.modal.dificultadesSpellBtn = document.getElementById('btn-verificar-dificultades');
  domRefs.modal.avancesSpellPanel = document.getElementById('modal-avances-ortografia-panel');
  domRefs.modal.dificultadesSpellPanel = document.getElementById('modal-dificultades-ortografia-panel');
  domRefs.modal.avanceIdInput = document.getElementById('modal-avance_id');
  domRefs.modal.reportadoPorInput = document.getElementById('modal-reportado_por');
  domRefs.modal.evidenciaInput = document.getElementById('modal-evidencia_url');
  domRefs.modal.fechaReporteInput = document.getElementById('modal-fecha_reporte');
  domRefs.modal.contextCard = document.getElementById('modal-bimestre-context');
  domRefs.modal.contextNombre = document.getElementById('modal-bimestre-context-nombre');
  domRefs.modal.contextMeta = document.getElementById('modal-bimestre-context-meta');
  domRefs.modal.contextPresupuesto = document.getElementById('modal-bimestre-context-presupuesto');
  domRefs.modal.contextDescripcion = document.getElementById('modal-bimestre-context-descripcion');
  domRefs.modal.contextAlert = document.getElementById('modal-bimestre-context-alert');
  domRefs.modal.contextMetaRegistrado = document.getElementById('modal-bimestre-context-meta-registrado');
  domRefs.modal.contextMetaSaldo = document.getElementById('modal-bimestre-context-meta-saldo');
  domRefs.modal.contextPresupuestoRegistrado = document.getElementById('modal-bimestre-context-presupuesto-registrado');
  domRefs.modal.contextPresupuestoSaldo = document.getElementById('modal-bimestre-context-presupuesto-saldo');
  domRefs.modal.closeButton = document.getElementById('btn-cerrar-modal-avance');
  domRefs.modal.cancelButton = document.getElementById('btn-cancelar-modal-avance');
  domRefs.modal.submitButton = document.getElementById('btn-guardar-modal-avance');

  return domRefs;
}

export function obtenerEmailUsuarioActualLocal() {
  try {
    const storedEmail = localStorage.getItem('auth_email');
    if (storedEmail && storedEmail.includes('@') && storedEmail !== 'null' && storedEmail !== 'undefined') {
      return storedEmail.trim();
    }

    const token = localStorage.getItem('auth_token');
    if (token && token !== 'null' && token !== 'undefined') {
      try {
        const decoded = atob(token);
        const parts = decoded.split('|');
        const emailCandidate = parts[0];
        if (emailCandidate && emailCandidate.includes('@')) {
          return emailCandidate.trim();
        }
      } catch (error) {
        console.warn('[WARN] No fue posible decodificar el token de autenticación:', error);
      }
    }
  } catch (error) {
    console.warn('[WARN] No se pudo obtener el email del usuario autenticado:', error);
  }

  return '';
}
