import apiService from '../api.js';
import { mostrarToast } from '../utils.js';

function ensureAreaBudgetUI() {
  if (!this.areaBudgetUI) {
    this.areaBudgetUI = {};
  }

  if (this.areaBudgetUI.initialized) {
    return;
  }

  this.areaBudgetUI.totalElement = document.getElementById('area-budget-total');
  this.areaBudgetUI.contextElement = document.getElementById('area-budget-context');
  this.areaBudgetUI.committedElement = document.getElementById('area-budget-committed');
  this.areaBudgetUI.activityCountElement = document.getElementById('area-budget-activity-count');
  this.areaBudgetUI.availableElement = document.getElementById('area-budget-available');
  this.areaBudgetUI.availableAfterElement = document.getElementById('area-budget-available-after');
  this.areaBudgetUI.feedbackElement = document.getElementById('area-budget-feedback');

  this.areaBudgetUI.initialized = true;
}

function obtenerPresupuestoProgramadoActual() {
  const input = document.getElementById('presupuesto_programado');
  if (!input) return 0;
  const value = Number(input.value || 0);
  return Number.isFinite(value) ? value : 0;
}

function resolverVigenciaParaPresupuesto(fechaReferencia) {
  if (fechaReferencia) {
    try {
      const normalized = fechaReferencia.toString().trim();
      if (normalized && /^\d{4}$/.test(normalized)) {
        return normalized;
      }
      const date = new Date(normalized);
      if (!Number.isNaN(date.getTime())) {
        return String(date.getFullYear());
      }
    } catch (error) {
      console.warn('[WARN] resolverVigenciaParaPresupuesto no pudo interpretar la fecha:', error);
    }
  }

  const hoy = new Date();
  return String(hoy.getFullYear());
}

function resetAreaBudgetSummary() {
  ensureAreaBudgetUI.call(this);

  if (!this.areaBudgetUI) return;

  if (!this.state.presupuestoArea) {
    this.state.presupuestoArea = {
      resumen: null,
      actividades: [],
      meta: null,
      metrics: null,
      baseDisponible: null
    };
  } else {
    this.state.presupuestoArea.resumen = null;
    this.state.presupuestoArea.actividades = [];
    this.state.presupuestoArea.meta = null;
    this.state.presupuestoArea.metrics = null;
    this.state.presupuestoArea.baseDisponible = null;
  }

  if (this.areaBudgetUI.totalElement) {
    this.areaBudgetUI.totalElement.textContent = '$0';
  }
  if (this.areaBudgetUI.contextElement) {
    this.areaBudgetUI.contextElement.textContent = 'Vigencia: -';
  }
  if (this.areaBudgetUI.committedElement) {
    this.areaBudgetUI.committedElement.textContent = '$0';
  }
  if (this.areaBudgetUI.activityCountElement) {
    this.areaBudgetUI.activityCountElement.textContent = '0 actividades';
  }
  if (this.areaBudgetUI.availableElement) {
    this.areaBudgetUI.availableElement.textContent = '$0';
    this.areaBudgetUI.availableElement.classList.remove('text-rose-600', 'text-amber-600', 'text-emerald-600');
    this.areaBudgetUI.availableElement.classList.add('text-[var(--text-primary)]');
  }
  if (this.areaBudgetUI.availableAfterElement) {
    this.areaBudgetUI.availableAfterElement.textContent = 'Después de esta actividad: $0';
    this.areaBudgetUI.availableAfterElement.className = 'mt-1 text-xs font-semibold text-[var(--text-secondary)]';
  }
  if (this.areaBudgetUI.feedbackElement) {
    this.areaBudgetUI.feedbackElement.className = 'mt-3 hidden rounded-md border px-3 py-2 text-xs';
    this.areaBudgetUI.feedbackElement.textContent = '';
  }
}

function renderAreaBudgetSummary(context = {}) {
  ensureAreaBudgetUI.call(this);

  const resumen = this.state?.presupuestoArea?.resumen;
  const actividades = this.state?.presupuestoArea?.actividades || [];
  const metadata = this.state?.presupuestoArea?.meta || {};

  if (!resumen) {
    resetAreaBudgetSummary.call(this);
    return;
  }

  const presupuestoProgramado = context.presupuestoProgramado !== undefined
    ? Number(context.presupuestoProgramado) || 0
    : obtenerPresupuestoProgramadoActual();

  const total = Number(resumen.presupuesto_total) || 0;
  const comprometido = Number(resumen.presupuesto_comprometido) || 0;
  const disponible = Number(resumen.presupuesto_disponible) || 0;
  const baseDisponible = Number.isFinite(this.state?.presupuestoArea?.baseDisponible)
    ? Number(this.state.presupuestoArea.baseDisponible)
    : disponible;
  const disponibleEstimado = context.presupuestoDisponibleEstimado !== undefined
    ? Number(context.presupuestoDisponibleEstimado) || 0
    : (Number(resumen.presupuesto_disponible_estimado) || Number(baseDisponible - presupuestoProgramado));

  const actividadesContadas = Number(metadata.totalActividades) || actividades.length;

  if (!this.state.presupuestoArea.metrics) {
    this.state.presupuestoArea.metrics = {};
  }
  this.state.presupuestoArea.metrics = {
    total,
    comprometido,
    disponible,
    baseDisponible,
    disponibleEstimado,
    presupuestoProgramado
  };

  if (this.areaBudgetUI.totalElement) {
    this.areaBudgetUI.totalElement.textContent = this.formatearMonto(total);
  }

  if (this.areaBudgetUI.contextElement) {
    const versionText = resumen.version ? ` · Versión ${resumen.version}` : '';
    const estadoText = resumen.estado ? ` · ${resumen.estado}` : '';
    this.areaBudgetUI.contextElement.textContent = `Vigencia: ${resumen.vigencia || '-'}${versionText}${estadoText}`;
  }

  if (this.areaBudgetUI.committedElement) {
    this.areaBudgetUI.committedElement.textContent = this.formatearMonto(comprometido);
  }

  if (this.areaBudgetUI.activityCountElement) {
    const label = actividadesContadas === 1 ? 'actividad' : 'actividades';
    this.areaBudgetUI.activityCountElement.textContent = `${actividadesContadas} ${label}`;
  }

  if (this.areaBudgetUI.availableElement) {
    this.areaBudgetUI.availableElement.textContent = this.formatearMonto(disponible);
    this.areaBudgetUI.availableElement.classList.remove('text-rose-600', 'text-amber-600', 'text-[var(--text-primary)]', 'text-emerald-600');
    if (disponible < 0) {
      this.areaBudgetUI.availableElement.classList.add('text-rose-600');
    } else if (disponible === 0) {
      this.areaBudgetUI.availableElement.classList.add('text-amber-600');
    } else {
      this.areaBudgetUI.availableElement.classList.add('text-emerald-600');
    }
  }

  if (this.areaBudgetUI.availableAfterElement) {
    this.areaBudgetUI.availableAfterElement.textContent = `Después de esta actividad: ${this.formatearMonto(disponibleEstimado)}`;
    this.areaBudgetUI.availableAfterElement.className = 'mt-1 text-xs font-semibold';
    if (disponibleEstimado < 0) {
      this.areaBudgetUI.availableAfterElement.classList.add('text-rose-600');
    } else if (disponibleEstimado === 0) {
      this.areaBudgetUI.availableAfterElement.classList.add('text-amber-600');
    } else {
      this.areaBudgetUI.availableAfterElement.classList.add('text-[var(--text-secondary)]');
    }
  }

  if (this.areaBudgetUI.feedbackElement) {
    const feedback = this.areaBudgetUI.feedbackElement;
    let message = '';
    let styleClasses = ['mt-3', 'rounded-md', 'border', 'px-3', 'py-2', 'text-xs'];

    if (total <= 0) {
      message = 'No hay un presupuesto vigente configurado para esta área.';
      styleClasses = [...styleClasses, 'border-amber-200', 'bg-amber-50', 'text-amber-700'];
    } else if (disponible < 0) {
      message = `El presupuesto comprometido excede el tope del área por ${this.formatearMonto(Math.abs(disponible))}.`;
      styleClasses = [...styleClasses, 'border-rose-200', 'bg-rose-50', 'text-rose-700'];
    } else if (disponibleEstimado < 0) {
      message = `Esta actividad supera el saldo disponible del área en ${this.formatearMonto(Math.abs(disponibleEstimado))}.`;
      styleClasses = [...styleClasses, 'border-rose-200', 'bg-rose-50', 'text-rose-700'];
    } else if (disponible === 0) {
      message = 'El presupuesto del área se encuentra completamente asignado.';
      styleClasses = [...styleClasses, 'border-amber-200', 'bg-amber-50', 'text-amber-700'];
    }

    if (message) {
      feedback.className = styleClasses.join(' ');
      feedback.textContent = message;
    } else {
      feedback.className = 'mt-3 hidden rounded-md border px-3 py-2 text-xs';
      feedback.textContent = '';
    }
  }
}

function handlePresupuestoProgramadoChange() {
  if (!this.state?.presupuestoArea?.resumen) return;
  const presupuestoProgramado = this.obtenerPresupuestoProgramadoActual();
  const baseDisponible = Number.isFinite(this.state?.presupuestoArea?.baseDisponible)
    ? Number(this.state.presupuestoArea.baseDisponible)
    : Number(this.state?.presupuestoArea?.resumen?.presupuesto_disponible) || 0;
  const disponibleEstimado = Number(baseDisponible - presupuestoProgramado);

  this.renderAreaBudgetSummary({
    presupuestoProgramado,
    presupuestoDisponibleEstimado: disponibleEstimado
  });
}

async function onAreaSelectionChange(areaId, options = {}) {
  ensureAreaBudgetUI.call(this);

  const sanitizedId = (areaId || '').toString().trim();
  if (!this.state.presupuestoArea) {
    this.state.presupuestoArea = {
      resumen: null,
      actividades: [],
      meta: null,
      metrics: null,
      baseDisponible: null
    };
  }

  if (!sanitizedId) {
    resetAreaBudgetSummary.call(this);
    return;
  }

  const actividadId = (options.actividadId || this.state.actividadActual?.actividad_id || this.state.actividadActual?.id || '').toString().trim();
  const presupuestoPlaneado = options.presupuestoPlaneado !== undefined
    ? Number(options.presupuestoPlaneado) || 0
    : obtenerPresupuestoProgramadoActual();
  const fechaReferencia = options.fechaInicio || document.getElementById('fecha_inicio_planeada')?.value || '';
  const vigencia = options.vigencia || resolverVigenciaParaPresupuesto.call(this, fechaReferencia);

  try {
    const payload = {
      area_id: sanitizedId,
      presupuesto_planeado: presupuestoPlaneado
    };
    if (actividadId) {
      payload.actividad_id = actividadId;
    }
    if (vigencia) {
      payload.vigencia = vigencia;
    }

    const response = await apiService.callBackend('presupuestos/resumenArea', payload, { loaderMessage: null });
    if (!response || response.success === false) {
      const errorMessage = (response && (response.errors?.[0] || response.message || response.error)) || 'No fue posible consultar el presupuesto del área.';
      throw new Error(errorMessage);
    }

    const resultado = response.data || response.resumen || response;
    const resumen = resultado.resumen || response.data?.resumen || response.resumen || null;
    const actividades = resultado.actividades || response.data?.actividades || [];
    const meta = resultado.meta || response.data?.meta || null;

    this.state.presupuestoArea = {
      resumen,
      actividades,
      meta,
      metrics: null,
      baseDisponible: resumen ? Number(resumen.presupuesto_disponible) || 0 : null
    };

    renderAreaBudgetSummary.call(this, {
      presupuestoProgramado: presupuestoPlaneado,
      presupuestoDisponibleEstimado: resumen
        ? Number(resumen.presupuesto_disponible_estimado) || Number(((this.state.presupuestoArea.baseDisponible ?? (resumen.presupuesto_disponible || 0)) - presupuestoPlaneado))
        : 0
    });

    if (typeof this.actualizarResumenBimestres === 'function') {
      this.actualizarResumenBimestres();
    }
  } catch (error) {
    console.error('[ERROR] onAreaSelectionChange:', error);
    mostrarToast(error?.message || 'No fue posible obtener el presupuesto del área.', 'error');
    resetAreaBudgetSummary.call(this);
  }
}

function validarPresupuestoAreaParaActividad(payload = {}) {
  if (!payload || typeof payload !== 'object') return;

  const areaId = (payload.area_id || '').toString().trim();
  if (!areaId) return;

  const resumen = this.state?.presupuestoArea?.resumen;
  if (!resumen) return;

  if (resumen.area_id && resumen.area_id !== areaId) {
    return;
  }

  const total = Number(resumen.presupuesto_total) || 0;
  const programado = Number(payload.presupuesto_programado) || 0;
  const metrics = this.state?.presupuestoArea?.metrics || {};
  const baseDisponible = Number.isFinite(this.state?.presupuestoArea?.baseDisponible)
    ? Number(this.state.presupuestoArea.baseDisponible)
    : Number(metrics.baseDisponible ?? resumen.presupuesto_disponible ?? 0) || 0;
  const disponible = Number(metrics.disponible ?? resumen.presupuesto_disponible) || 0;
  const disponibleEstimado = Number.isFinite(metrics.disponibleEstimado)
    ? Number(metrics.disponibleEstimado)
    : Number(baseDisponible - programado);

  if (total <= 0 && programado > 0) {
    throw new Error('El área seleccionada no tiene un presupuesto vigente configurado. Ajusta el presupuesto global del área desde Administración antes de programar recursos.');
  }

  if (baseDisponible <= 0 && programado > 0) {
    throw new Error('El presupuesto del área ya se encuentra comprometido en su totalidad.');
  }

  if (disponibleEstimado < 0) {
    const exceso = typeof this.formatearMonto === 'function'
      ? this.formatearMonto(Math.abs(disponibleEstimado))
      : Math.abs(disponibleEstimado).toLocaleString('es-CO', { style: 'currency', currency: 'COP' });
    throw new Error(`El presupuesto programado excede el saldo disponible del área por ${exceso}. Reduce el monto o ajusta el presupuesto del área en Administración.`);
  }
}

export const budgetMethods = {
  ensureAreaBudgetUI,
  resetAreaBudgetSummary,
  renderAreaBudgetSummary,
  onAreaSelectionChange,
  resolverVigenciaParaPresupuesto,
  obtenerPresupuestoProgramadoActual,
  handlePresupuestoProgramadoChange,
  validarPresupuestoAreaParaActividad
};
