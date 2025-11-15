import { domRefs, avancesState, selectEnhancerContext } from './state.js';
import { normalizeStringLocal, resolveBimestreLocal } from './utils.js';
import { getActivityAnalytics, getBimestreAnalytics } from './analytics.js';
import { resolveActivityByAnyReference } from './activities.js';
import {
  formatCurrency,
  formatDate,
  formatNumber,
  formatPercent,
  evaluateAvancePerformance,
  parseNumericValue
} from './formatters.js';

const META_TOLERANCE = 0.0001;
const PRESUPUESTO_TOLERANCE = 1;
const SALDO_CLASSNAMES = ['text-rose-600', 'text-amber-600', 'text-emerald-600', 'text-slate-500', 'font-semibold'];
const ALERT_STATUS_CLASSES = ['bg-rose-100', 'text-rose-700', 'bg-amber-100', 'text-amber-700'];

export function renderActivityBimestres(activity) {
  const container = domRefs.activitySummary.bimestres;
  if (!container) return;
  container.innerHTML = '';

  if (!activity) {
    const empty = document.createElement('div');
    empty.className = 'rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500';
    empty.textContent = 'Selecciona una actividad para visualizar la planificación por bimestre.';
    container.appendChild(empty);
    return;
  }

  const activeFilter = normalizeStringLocal(avancesState.filtros.bimestre || '');
  const analytics = activity ? getActivityAnalytics(activity.id) : null;
  const fragment = document.createDocumentFragment();

  activity.bimestres.forEach((item, idx) => {
    const card = document.createElement('div');
    const isHighlighted = activeFilter && normalizeStringLocal(item.label || '') === activeFilter;
    const stats = analytics ? getBimestreAnalytics(activity.id, item.index || item.label || idx + 1) : null;
    const planMetaValue = stats?.planMeta ?? parseNumericValue(item.meta);
    const planPresupuestoValue = stats?.planPresupuesto ?? parseNumericValue(item.presupuesto);
    const registradoLogro = stats ? stats.totalLogro : 0;
    const registradoPresupuesto = stats ? stats.totalPresupuesto : 0;
    const metaExceeded = Number.isFinite(planMetaValue) && registradoLogro > planMetaValue + 0.0001;
    const presupuestoExceeded = Number.isFinite(planPresupuestoValue) && registradoPresupuesto > planPresupuestoValue + 1;
    const metaSaldo = Number.isFinite(planMetaValue) ? planMetaValue - registradoLogro : null;
    const presupuestoSaldo = Number.isFinite(planPresupuestoValue) ? planPresupuestoValue - registradoPresupuesto : null;
    const metaPendiente = Number.isFinite(metaSaldo) && metaSaldo > META_TOLERANCE;
    const metaExcedida = Number.isFinite(metaSaldo) && metaSaldo < -META_TOLERANCE;
    const presupuestoPendiente = Number.isFinite(presupuestoSaldo) && presupuestoSaldo > PRESUPUESTO_TOLERANCE;
    const presupuestoExcedido = Number.isFinite(presupuestoSaldo) && presupuestoSaldo < -PRESUPUESTO_TOLERANCE;
    const haySaldoPendiente = metaPendiente || presupuestoPendiente;
    const haySaldoExcedido = metaExcedida || presupuestoExcedido;

    card.className = [
      'rounded-xl border p-4 shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-400 cursor-pointer',
      isHighlighted ? 'border-indigo-300 bg-indigo-50/70' : 'border-slate-200 bg-white hover:border-indigo-200 hover:bg-indigo-50/40'
    ].join(' ');

    card.innerHTML = `
      <div class="flex items-start justify-between gap-3">
        <div>
          <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Bimestre ${idx + 1}</p>
          <h5 class="text-sm font-semibold text-slate-800">${item.label || `Bimestre ${idx + 1}`}</h5>
        </div>
        ${(metaExceeded || presupuestoExceeded) ? '<span class="inline-flex items-center gap-1 rounded-full bg-rose-100 px-3 py-1 text-[11px] font-semibold text-rose-700">Revisión sugerida</span>' : ''}
      </div>
      <div class="mt-3 grid grid-cols-1 gap-2 text-xs text-slate-600">
        <div class="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
          <span>Meta planificada</span>
          <strong class="long-number text-right">${Number.isFinite(planMetaValue) ? formatNumber(planMetaValue) : 'Sin meta'}</strong>
        </div>
        <div class="flex items-center justify-between gap-2 rounded-lg ${metaExceeded ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'} px-3 py-2">
          <span>Logro registrado</span>
          <strong class="long-number text-right">${formatNumber(registradoLogro)}</strong>
        </div>
        <div class="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
          <span>Presupuesto planificado</span>
          <strong class="long-number text-right">${Number.isFinite(planPresupuestoValue) ? formatCurrency(planPresupuestoValue) : 'Sin presupuesto'}</strong>
        </div>
        <div class="flex items-center justify-between gap-2 rounded-lg ${presupuestoExceeded ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'} px-3 py-2">
          <span>Presupuesto ejecutado</span>
          <strong class="long-number text-right">${formatCurrency(registradoPresupuesto)}</strong>
        </div>
        ${(Number.isFinite(metaSaldo) || Number.isFinite(presupuestoSaldo)) ? (() => {
          const detalles = [];
          if (Number.isFinite(metaSaldo) && Math.abs(metaSaldo) > META_TOLERANCE) {
            const etiqueta = metaSaldo > 0 ? 'Meta pendiente' : 'Meta excedida';
            detalles.push(`${etiqueta}: ${formatNumber(Math.abs(metaSaldo))}`);
          }
          if (Number.isFinite(presupuestoSaldo) && Math.abs(presupuestoSaldo) > PRESUPUESTO_TOLERANCE) {
            const etiqueta = presupuestoSaldo > 0 ? 'Presupuesto pendiente' : 'Presupuesto excedido';
            detalles.push(`${etiqueta}: ${formatCurrency(Math.abs(presupuestoSaldo))}`);
          }

          const saldoEstado = (() => {
            if (presupuestoPendiente) return 'presupuesto-pendiente';
            if (haySaldoExcedido) return 'excedido';
            if (metaPendiente) return 'meta-pendiente';
            return 'cubierto';
          })();

          const saldoTituloMap = {
            'presupuesto-pendiente': 'Presupuesto pendiente',
            'meta-pendiente': 'Meta pendiente',
            excedido: 'Saldo excedido',
            cubierto: 'Saldo cubierto'
          };

          const saldoClasesMap = {
            'presupuesto-pendiente': 'bg-rose-50 text-rose-700 border border-rose-200',
            'meta-pendiente': 'bg-amber-50 text-amber-700 border border-amber-200',
            excedido: 'bg-amber-50 text-amber-700 border border-amber-200',
            cubierto: 'bg-emerald-50 text-emerald-700 border border-emerald-200'
          };

          const saldoDescripcion = detalles.length
            ? detalles.join(' · ')
            : saldoEstado === 'presupuesto-pendiente'
              ? 'Aún falta ejecutar el presupuesto planificado.'
              : saldoEstado === 'meta-pendiente'
                ? 'Registra avances para cubrir la meta planificada.'
                : saldoEstado === 'excedido'
                  ? 'Se registró más de lo planificado.'
                  : 'Plan cubierto.';

          const saldoTitulo = saldoTituloMap[saldoEstado] || 'Saldo planificado';
          const saldoClases = saldoClasesMap[saldoEstado] || 'bg-emerald-50 text-emerald-700 border border-emerald-200';

          return `
          <div class="flex flex-col gap-1 rounded-lg ${saldoClases} px-3 py-2 text-[11px]">
            <span class="font-semibold tracking-wide uppercase">${saldoTitulo}</span>
            <strong class="long-number text-right text-[11px]">${saldoDescripcion}</strong>
          </div>
        `;
        })() : ''}
      </div>
      <p class="mt-3 text-xs leading-5 text-slate-600 whitespace-pre-line">${item.descripcion || 'Sin detalle registrado para este bimestre.'}</p>
    `;

    const modalDetail = {
      activityId: activity.id,
      bimestreLabel: item.label || `Bimestre ${idx + 1}`,
      bimestreIndex: item.index || idx + 1
    };

    const triggerModalOpen = () => {
      if (typeof document === 'undefined') return;
      document.dispatchEvent(new CustomEvent('avances:open-modal', {
        detail: {
          activityId: modalDetail.activityId,
          bimestreValue: item,
          bimestreLabel: modalDetail.bimestreLabel,
          bimestreIndex: modalDetail.bimestreIndex
        }
      }));
    };

    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `Registrar avance para ${modalDetail.bimestreLabel}`);
    card.addEventListener('click', triggerModalOpen);
    card.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        triggerModalOpen();
      }
    });

    const actionWrapper = document.createElement('div');
    actionWrapper.className = 'mt-4 flex justify-end';
    const actionButton = document.createElement('button');
    actionButton.type = 'button';
    actionButton.className = 'inline-flex items-center gap-2 rounded-full bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-500';
    actionButton.innerHTML = '<span class="material-symbols-outlined text-base">add_circle</span><span>Registrar avance</span>';
    actionButton.addEventListener('click', event => {
      event.stopPropagation();
      triggerModalOpen();
    });
    actionWrapper.appendChild(actionButton);
    card.appendChild(actionWrapper);

    fragment.appendChild(card);
  });

  container.appendChild(fragment);
}

export function updateActivitySummary({ registros = null } = {}) {
  const summary = domRefs.activitySummary;
  if (!summary || !summary.container) return;

  const activityId = avancesState.actividadSeleccionadaId || avancesState.filtros.actividad;
  const activity = activityId ? avancesState.actividadesIndex.get(activityId) || null : null;

  if (!activity) {
    if (summary.name) summary.name.textContent = 'Selecciona una actividad';
    if (summary.description) summary.description.textContent = 'Usa los filtros para visualizar los avances relacionados y su planificación.';
  if (summary.code) summary.code.textContent = 'Código: \u2014';
    if (summary.area) summary.area.textContent = 'Área no seleccionada';
    if (summary.subproceso) summary.subproceso.textContent = 'Subproceso no disponible';
    if (summary.metaPlan) summary.metaPlan.textContent = 'N/A';
    if (summary.presupuestoPlan) summary.presupuestoPlan.textContent = 'N/A';
    if (summary.metaLogro) summary.metaLogro.textContent = 'N/A';
    if (summary.presupuestoEjecutado) summary.presupuestoEjecutado.textContent = 'N/A';
    if (summary.avancesCount) summary.avancesCount.textContent = '0 avances visibles';
    if (summary.ultimaFecha) summary.ultimaFecha.textContent = 'Último reporte: N/A';
    renderActivityBimestres(null);
    return;
  }

  if (summary.name) summary.name.textContent = activity.descripcion;
  if (summary.description) {
    const descripcionDetallada = activity.raw?.descripcion_detallada || activity.raw?.detalle || activity.descripcion;
    summary.description.textContent = descripcionDetallada || 'Sin descripción detallada disponible para la actividad.';
  }
  if (summary.code) summary.code.textContent = `Código: ${activity.codigo || activity.id}`;
  if (summary.area) summary.area.textContent = activity.area ? activity.area : 'Área no disponible';
  if (summary.subproceso) summary.subproceso.textContent = activity.subproceso ? activity.subproceso : 'Subproceso no disponible';
  const metaPlanValue = parseNumericValue(activity.metaPlan);
  const presupuestoPlanValue = parseNumericValue(activity.presupuestoPlan);
  if (summary.metaPlan) summary.metaPlan.textContent = Number.isFinite(metaPlanValue) ? formatNumber(metaPlanValue) : 'N/A';
  if (summary.presupuestoPlan) summary.presupuestoPlan.textContent = Number.isFinite(presupuestoPlanValue) ? formatCurrency(presupuestoPlanValue) : 'N/A';

  const registrosFiltrados = Array.isArray(registros) ? registros : avancesState.avances;
  const relacionados = registrosFiltrados.filter(item => String(item.actividad_id) === activity.id);
  const totalMeta = relacionados.reduce((acc, item) => acc + (parseNumericValue(item.meta_programada_bimestre) || 0), 0);
  const totalLogro = relacionados.reduce((acc, item) => acc + (parseNumericValue(item.logro_valor) || 0), 0);
  const totalPresupuesto = relacionados.reduce((acc, item) => acc + (parseNumericValue(item.presupuesto_valor) || 0), 0);
  const ultimaFecha = relacionados.reduce((latest, item) => {
    const fecha = item.fecha_reporte ? new Date(item.fecha_reporte) : null;
    if (!fecha || Number.isNaN(fecha.getTime())) return latest;
    return !latest || fecha > latest ? fecha : latest;
  }, null);

  if (summary.metaLogro) summary.metaLogro.textContent = relacionados.length ? formatNumber(totalLogro) : 'N/A';
  if (summary.presupuestoEjecutado) summary.presupuestoEjecutado.textContent = relacionados.length ? formatCurrency(totalPresupuesto) : 'N/A';
  if (summary.avancesCount) summary.avancesCount.textContent = `${relacionados.length} ${relacionados.length === 1 ? 'avance visible' : 'avances visibles'}`;
  if (summary.ultimaFecha) summary.ultimaFecha.textContent = ultimaFecha ? `Último reporte: ${formatDate(ultimaFecha)}` : 'Último reporte: N/A';

  renderActivityBimestres(activity);
}

export function updateSummarySelectionLabel() {
  if (!domRefs.summarySelection) return;
  const filtros = avancesState.filtros;
  const partes = [];
  if (filtros.actividad) partes.push('Actividad seleccionada');
  if (filtros.year) partes.push(`Año ${filtros.year}`);
  if (filtros.bimestre) partes.push(`Bimestre ${filtros.bimestre}`);

  domRefs.summarySelection.textContent = partes.length
    ? `Filtros activos: ${partes.join(' · ')}`
    : 'Sin filtros adicionales aplicados';
}

export function updateModalActivityContext(activity) {
  const modal = domRefs.modal;
  if (!modal || !modal.container) return;

  if (!activity) {
    if (modal.actividadTitulo) modal.actividadTitulo.textContent = 'Selecciona una actividad';
    if (modal.actividadDescripcion) modal.actividadDescripcion.textContent = 'Visualiza aquí la descripción y métricas planificadas de la actividad.';
  if (modal.actividadCodigo) modal.actividadCodigo.textContent = 'Código: N/A';
  if (modal.actividadArea) modal.actividadArea.textContent = 'Área: N/A';
  if (modal.actividadMeta) modal.actividadMeta.textContent = 'Meta anual: N/A';
  if (modal.actividadPresupuesto) modal.actividadPresupuesto.textContent = 'Presupuesto programado: N/A';
    renderActivityBimestres(null);
    return;
  }

  if (modal.actividadTitulo) modal.actividadTitulo.textContent = activity.descripcion;
  if (modal.actividadDescripcion) {
    const descripcionDetallada = activity.raw?.descripcion_detallada || activity.raw?.detalle || activity.descripcion;
    modal.actividadDescripcion.textContent = descripcionDetallada;
  }
  const actividadMetaPlan = parseNumericValue(activity.metaPlan);
  const actividadPresupuestoPlan = parseNumericValue(activity.presupuestoPlan);
  if (modal.actividadCodigo) modal.actividadCodigo.textContent = `Código: ${activity.codigo || activity.id}`;
  if (modal.actividadArea) modal.actividadArea.textContent = `Área: ${activity.area || 'N/A'}`;
  if (modal.actividadMeta) modal.actividadMeta.textContent = `Meta anual: ${Number.isFinite(actividadMetaPlan) ? formatNumber(actividadMetaPlan) : 'N/A'}`;
  if (modal.actividadPresupuesto) modal.actividadPresupuesto.textContent = `Presupuesto: ${Number.isFinite(actividadPresupuestoPlan) ? formatCurrency(actividadPresupuestoPlan) : 'N/A'}`;

  renderActivityBimestres(activity);
}

export function updateModalBimestreContext(bimestreValue, { forcePrefill = false } = {}) {
  const modal = domRefs.modal;
  if (!modal || !modal.contextCard) return;

  const resetSaldoNode = node => {
    if (!node) return;
    SALDO_CLASSNAMES.forEach(cls => node.classList.remove(cls));
    node.textContent = '\u2014';
    node.dataset.saldoStatus = '';
  };

  const applySaldoStatus = (node, saldo, type) => {
    if (!node) return;
    SALDO_CLASSNAMES.forEach(cls => node.classList.remove(cls));
    const formatter = type === 'meta' ? formatNumber : formatCurrency;
    const tolerance = type === 'meta' ? META_TOLERANCE : PRESUPUESTO_TOLERANCE;
    const labels = type === 'meta'
      ? { sinPlan: 'Sin meta', pendiente: 'Meta pendiente', excedido: 'Meta excedida', cubierto: 'Meta cubierta' }
      : { sinPlan: 'Sin presupuesto', pendiente: 'Presupuesto pendiente', excedido: 'Presupuesto excedido', cubierto: 'Presupuesto cubierto' };

    if (!Number.isFinite(saldo)) {
      node.textContent = labels.sinPlan;
      node.classList.add('text-slate-500');
      node.dataset.saldoStatus = 'sin-plan';
      return;
    }

    const pendienteClass = type === 'presupuesto' ? 'text-rose-600' : 'text-amber-600';
    const pendienteStatus = type === 'presupuesto' ? 'presupuesto-pendiente' : 'meta-pendiente';

    if (saldo > tolerance) {
      node.textContent = `${labels.pendiente}: ${formatter(saldo)}`;
      node.classList.add(pendienteClass, 'font-semibold');
      node.dataset.saldoStatus = pendienteStatus;
      return;
    }

    if (saldo < -tolerance) {
      node.textContent = `${labels.excedido} por ${formatter(Math.abs(saldo))}`;
      node.classList.add('text-amber-600', 'font-semibold');
      node.dataset.saldoStatus = 'excedido';
      return;
    }

    node.textContent = labels.cubierto;
    node.classList.add('text-emerald-600', 'font-semibold');
    node.dataset.saldoStatus = 'cubierto';
  };

  const activityId = modal.actividadSelect?.value || avancesState.filtros.actividad || avancesState.actividadSeleccionadaId;
  const activity = resolveActivityByAnyReference(activityId);

  if (!bimestreValue || !activity) {
    modal.contextCard.classList.add('hidden');
    if (modal.contextNombre) modal.contextNombre.textContent = 'Selecciona un bimestre para ver su distribución planificada.';
    if (modal.contextMeta) modal.contextMeta.textContent = 'Meta: N/A';
    if (modal.contextPresupuesto) modal.contextPresupuesto.textContent = 'Presupuesto: N/A';
    if (modal.contextMetaRegistrado) modal.contextMetaRegistrado.textContent = '\u2014';
    resetSaldoNode(modal.contextMetaSaldo);
    if (modal.contextPresupuestoRegistrado) modal.contextPresupuestoRegistrado.textContent = '\u2014';
    resetSaldoNode(modal.contextPresupuestoSaldo);
    if (modal.contextAlert) {
      modal.contextAlert.classList.add('hidden');
      modal.contextAlert.classList.remove(...ALERT_STATUS_CLASSES);
      modal.contextAlert.textContent = 'Revisión sugerida';
    }
    if (modal.contextDescripcion) modal.contextDescripcion.textContent = '';
    return;
  }

  const resolved = resolveBimestreLocal(bimestreValue);
  const normalizedLabel = normalizeStringLocal(resolved.label || bimestreValue);
  const bimestre = activity.bimestres.find(item => {
    if (!item) return false;
    if (resolved.index && item.index === String(resolved.index)) return true;
    if (normalizedLabel && normalizeStringLocal(item.label || '') === normalizedLabel) return true;
    return false;
  }) || null;

  const stats = getBimestreAnalytics(activity.id, bimestreValue) || null;
  const planMeta = stats?.planMeta ?? parseNumericValue(bimestre?.meta);
  const planPresupuesto = stats?.planPresupuesto ?? parseNumericValue(bimestre?.presupuesto);
  const acumuladoLogro = stats ? stats.totalLogro : 0;
  const acumuladoPresupuesto = stats ? stats.totalPresupuesto : 0;
  const saldoMeta = Number.isFinite(planMeta) ? planMeta - acumuladoLogro : null;
  const saldoPresupuesto = Number.isFinite(planPresupuesto) ? planPresupuesto - acumuladoPresupuesto : null;
  const metaPendiente = Number.isFinite(saldoMeta) && saldoMeta > META_TOLERANCE;
  const metaExcedida = Number.isFinite(saldoMeta) && saldoMeta < -META_TOLERANCE;
  const presupuestoPendiente = Number.isFinite(saldoPresupuesto) && saldoPresupuesto > PRESUPUESTO_TOLERANCE;
  const presupuestoExcedido = Number.isFinite(saldoPresupuesto) && saldoPresupuesto < -PRESUPUESTO_TOLERANCE;

  modal.contextCard.classList.remove('hidden');
  if (modal.contextNombre) modal.contextNombre.textContent = bimestre ? bimestre.label : (resolved.label || bimestreValue);
  if (modal.contextMeta) modal.contextMeta.textContent = `Meta: ${Number.isFinite(planMeta) ? formatNumber(planMeta) : 'N/A'}`;
  if (modal.contextPresupuesto) modal.contextPresupuesto.textContent = `Presupuesto: ${Number.isFinite(planPresupuesto) ? formatCurrency(planPresupuesto) : 'N/A'}`;
  if (modal.contextMetaRegistrado) modal.contextMetaRegistrado.textContent = formatNumber(acumuladoLogro);
  applySaldoStatus(modal.contextMetaSaldo, saldoMeta, 'meta');
  if (modal.contextPresupuestoRegistrado) modal.contextPresupuestoRegistrado.textContent = formatCurrency(acumuladoPresupuesto);
  applySaldoStatus(modal.contextPresupuestoSaldo, saldoPresupuesto, 'presupuesto');
  if (modal.contextAlert) {
    modal.contextAlert.classList.remove(...ALERT_STATUS_CLASSES);
    if (metaExcedida || presupuestoExcedido) {
      modal.contextAlert.textContent = 'Revisión sugerida';
      modal.contextAlert.classList.remove('hidden');
      modal.contextAlert.classList.add('bg-rose-100', 'text-rose-700');
    } else if (presupuestoPendiente) {
      modal.contextAlert.textContent = 'Presupuesto pendiente por ejecutar';
      modal.contextAlert.classList.remove('hidden');
      modal.contextAlert.classList.add('bg-rose-100', 'text-rose-700');
    } else if (metaPendiente) {
      modal.contextAlert.textContent = 'Meta pendiente por registrar';
      modal.contextAlert.classList.remove('hidden');
      modal.contextAlert.classList.add('bg-amber-100', 'text-amber-700');
    } else {
      modal.contextAlert.classList.add('hidden');
    }
  }
  if (modal.contextDescripcion) modal.contextDescripcion.textContent = bimestre && bimestre.descripcion ? bimestre.descripcion : 'Sin detalle adicional para este bimestre.';

  if (modal.metaInput) {
    const prefillValue = Number.isFinite(planMeta) ? planMeta : '';
    if (forcePrefill || !modal.metaInput.value || modal.metaInput.dataset.prefilled === 'true') {
      modal.metaInput.value = prefillValue !== '' ? prefillValue : '';
      modal.metaInput.dataset.prefilled = prefillValue !== '' ? 'true' : 'false';
    }
    if (Number.isFinite(planMeta)) {
      modal.metaInput.setAttribute('max', planMeta);
      modal.metaInput.dataset.planValue = planMeta;
      modal.metaInput.dataset.acumulado = stats ? stats.totalMetaProgramada : '';
    } else {
      modal.metaInput.removeAttribute('max');
      modal.metaInput.dataset.planValue = '';
      modal.metaInput.dataset.acumulado = '';
    }
  }

  if (modal.logroInput) {
    if (Number.isFinite(planMeta)) {
      modal.logroInput.setAttribute('max', planMeta);
      modal.logroInput.dataset.planValue = planMeta;
      modal.logroInput.dataset.acumulado = acumuladoLogro;
      const restante = Math.max(planMeta - acumuladoLogro, 0);
      modal.logroInput.placeholder = restante > 0
        ? `Hasta ${formatNumber(restante)}`
        : 'Meta cubierta';
    } else {
      modal.logroInput.removeAttribute('max');
      modal.logroInput.dataset.planValue = '';
      modal.logroInput.dataset.acumulado = '';
      modal.logroInput.placeholder = 'Valor logrado';
    }
  }

  if (modal.presupuestoInput) {
    if (Number.isFinite(planPresupuesto)) {
      modal.presupuestoInput.setAttribute('max', planPresupuesto);
      modal.presupuestoInput.dataset.planValue = planPresupuesto;
      modal.presupuestoInput.dataset.acumulado = acumuladoPresupuesto;
      const restante = Math.max(planPresupuesto - acumuladoPresupuesto, 0);
      modal.presupuestoInput.placeholder = restante > 0
        ? `Hasta ${formatCurrency(restante)}`
        : 'Presupuesto agotado';
    } else {
      modal.presupuestoInput.removeAttribute('max');
      modal.presupuestoInput.dataset.planValue = '';
      modal.presupuestoInput.dataset.acumulado = '';
      modal.presupuestoInput.placeholder = '$0';
    }
  }
}

export function resetModalForm() {
  const modal = domRefs.modal;
  if (!modal || !modal.form) return;

  modal.form.reset();
  if (modal.metaInput) {
    modal.metaInput.dataset.prefilled = 'false';
  }

  const hiddenAvances = document.getElementById('modal-avances_texto');
  if (hiddenAvances) hiddenAvances.value = '';
  const hiddenDificultades = document.getElementById('modal-dificultades_texto');
  if (hiddenDificultades) hiddenDificultades.value = '';

  [modal.avancesEditor, modal.dificultadesEditor].forEach(editor => {
    if (!editor) return;
    if (editor.__orthographyChecker) {
      editor.__orthographyChecker.setText('');
    } else {
      editor.textContent = '';
    }
  });

  if (modal.contextCard) modal.contextCard.classList.add('hidden');
  if (modal.contextMeta) modal.contextMeta.textContent = 'Meta: N/A';
  if (modal.contextPresupuesto) modal.contextPresupuesto.textContent = 'Presupuesto: N/A';
  if (modal.contextDescripcion) modal.contextDescripcion.textContent = '';
}

export function getEstadoChipClass(estado) {
  const base = 'inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium';
  if (!estado) return `${base} bg-gray-100 text-gray-600`;

  const normalized = normalizeStringLocal(estado);
  if (normalized.includes('aprob') || normalized.includes('complet')) {
    return `${base} bg-emerald-50 text-emerald-700`;
  }
  if (normalized.includes('pend') || normalized.includes('revision') || normalized.includes('revisión')) {
    return `${base} bg-amber-50 text-amber-700`;
  }
  if (normalized.includes('rechaz') || normalized.includes('riesgo')) {
    return `${base} bg-rose-50 text-rose-700`;
  }
  return `${base} bg-slate-100 text-slate-600`;
}

export function renderAvancesTabla(items) {
  const cuerpo = domRefs.tableBody;
  if (!cuerpo) return;

  cuerpo.innerHTML = '';

  const escapeHtml = (value) => {
    if (value === null || value === undefined) return '';
    return String(value).replace(/[&<>"']/g, (char) => {
      switch (char) {
        case '&': return '&amp;';
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '"': return '&quot;';
        case "'": return '&#39;';
        default: return char;
      }
    });
  };

  if (!Array.isArray(items) || !items.length) {
    if (domRefs.emptyState) domRefs.emptyState.classList.remove('hidden');
    if (domRefs.summary) domRefs.summary.textContent = '0 avances encontrados';
    return;
  }

  if (domRefs.emptyState) domRefs.emptyState.classList.add('hidden');

  const fragment = document.createDocumentFragment();
  let totalMeta = 0;
  let totalLogro = 0;
  let metasConsideradas = 0;

  items.forEach(item => {
    const fila = document.createElement('tr');
    fila.className = 'border-b last:border-b-0 bg-white';

    const metaValue = parseNumericValue(item.meta_programada_bimestre);
    const logroValue = parseNumericValue(item.logro_valor);
    const presupuestoValue = parseNumericValue(item.presupuesto_valor);
    const performance = evaluateAvancePerformance(metaValue, logroValue);

    const actividadCodigo = item.actividad_codigo || item.actividad_id || 'Sin código';
    const actividadTooltip = escapeHtml(item.actividad_label || 'Sin descripción disponible');
    const actividadHtml = `
      <span class="block text-sm font-semibold text-gray-900 font-mono" title="${actividadTooltip}">${escapeHtml(actividadCodigo)}</span>
    `;

    if (Number.isFinite(metaValue) && metaValue > 0) {
      metasConsideradas += 1;
      totalMeta += metaValue;
      totalLogro += Number.isFinite(logroValue) ? logroValue : 0;
    }

    const ratioValue = Number.isFinite(performance.ratio) ? performance.ratio : null;
    const ratioDisplay = ratioValue !== null
      ? formatPercent(ratioValue)
      : 'N/A';
    const diffDisplay = Number.isFinite(performance.diff)
      ? formatNumber(performance.diff)
      : 'N/A';

    const performanceHtml = `
      <div class="avance-performance avance-performance--${performance.status}">
        <div class="avance-performance__header">
          <span class="avance-performance__ratio">${ratioDisplay}</span>
          <span class="avance-performance__label">${performance.label}</span>
        </div>
        <div class="avance-performance__bar">
          <span class="avance-performance__bar-fill" style="width:${Math.min(Math.max(((ratioValue || 0) * 100), 0), 160)}%;"></span>
        </div>
        <p class="avance-performance__meta">&Delta; ${diffDisplay}</p>
      </div>
    `;

    const estadoLabel = item.estado_label || 'Sin estado';
    const estadoChipClass = getEstadoChipClass(estadoLabel);
    const bimestreLabel = escapeHtml(item.bimestre_label || 'N/A');

    fila.innerHTML = `
      <td class="px-6 py-3">${actividadHtml}</td>
      <td class="px-6 py-3 text-sm text-gray-500">${bimestreLabel}</td>
  <td class="px-6 py-3 text-sm text-gray-500 long-number">${Number.isFinite(metaValue) ? formatNumber(metaValue) : 'N/A'}</td>
  <td class="px-6 py-3 text-sm text-gray-500 long-number">${Number.isFinite(logroValue) ? formatNumber(logroValue) : 'N/A'}</td>
      <td class="px-6 py-3 text-sm text-gray-500">${performanceHtml}</td>
  <td class="px-6 py-3 text-sm text-gray-500 long-number">${Number.isFinite(presupuestoValue) ? formatCurrency(presupuestoValue) : 'N/A'}</td>
  <td class="px-6 py-3"><span class="${estadoChipClass}">${escapeHtml(estadoLabel)}</span></td>
  <td class="px-6 py-3 text-sm text-gray-500">${escapeHtml(item.reportado_por || 'N/A')}</td>
    `;

    fragment.appendChild(fila);
  });

  cuerpo.appendChild(fragment);

  if (domRefs.summary) {
    const base = `${items.length} ${items.length === 1 ? 'avance' : 'avances'} encontrados`;
    if (metasConsideradas > 0 && totalMeta > 0) {
      const ratioGlobal = totalLogro / totalMeta;
  domRefs.summary.innerHTML = `${base} · Cumplimiento promedio <strong class="long-number">${formatPercent(ratioGlobal)}</strong>`;
    } else {
      domRefs.summary.textContent = base;
    }
  }
}

export function refreshModalActivitySelect(activityId) {
  if (!domRefs.modal.actividadSelect) return;
  domRefs.modal.actividadSelect.value = activityId || '';
  selectEnhancerContext.refreshModernSelect.call(selectEnhancerContext, domRefs.modal.actividadSelect.id);
}
