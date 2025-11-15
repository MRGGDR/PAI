import { domRefs, avancesState, selectEnhancerContext } from './state.js';
import { normalizeStringLocal, updateURLWithSelection } from './utils.js';
import { renderAvancesTabla, updateActivitySummary, updateSummarySelectionLabel, updateModalActivityContext } from './ui.js';

export function syncFilterStateFromUI() {
  const { filters } = domRefs;
  avancesState.filtros.actividad = filters.actividad?.value || avancesState.filtros.actividad;
  avancesState.actividadSeleccionadaId = avancesState.filtros.actividad;
  avancesState.filtros.year = filters.year?.value || '';
  avancesState.filtros.bimestre = filters.bimestre?.value || '';
}

export function applyAvancesFilters() {
  const { actividad, year, bimestre } = avancesState.filtros;
  const registros = avancesState.avances.filter(item => {
    if (actividad && String(item.actividad_id || '') !== String(actividad)) return false;
    if (year && String(item.anio || item.year || '') !== String(year)) return false;
    if (bimestre) {
      const filtroNormalizado = normalizeStringLocal(bimestre);
      const itemNormalizado = normalizeStringLocal(item.bimestre_label || '');
      if (!itemNormalizado || itemNormalizado !== filtroNormalizado) return false;
    }
    return true;
  });

  renderAvancesTabla(registros);
  updateActivitySummary({ registros });
  updateSummarySelectionLabel();
}

export function setSelectedActivity(activityId, { updateSelect = true, updateURL = true, silent = false } = {}) {
  const id = activityId ? String(activityId) : '';
  avancesState.actividadSeleccionadaId = id;
  avancesState.filtros.actividad = id;

  if (domRefs.filters.actividad) {
    domRefs.filters.actividad.value = id;
    if (updateSelect) {
      selectEnhancerContext.refreshModernSelect.call(selectEnhancerContext, domRefs.filters.actividad.id);
    }
  }

  if (domRefs.modal.actividadSelect) {
    domRefs.modal.actividadSelect.value = id;
    if (updateSelect) {
      selectEnhancerContext.refreshModernSelect.call(selectEnhancerContext, domRefs.modal.actividadSelect.id);
    }
  }

  if (!silent) {
    applyAvancesFilters();
  }

  updateModalActivityContext(id ? avancesState.actividadesIndex.get(id) || null : null);

  if (updateURL) {
    updateURLWithSelection(id);
  }
}

export function clearFilters() {
  setSelectedActivity('', { updateSelect: true, updateURL: true, silent: true });

  avancesState.filtros.year = '';
  avancesState.filtros.bimestre = '';

  const { filters } = domRefs;
  const refreshSelect = typeof selectEnhancerContext.refreshModernSelect === 'function'
    ? (targetId) => selectEnhancerContext.refreshModernSelect.call(selectEnhancerContext, targetId)
    : null;
  if (filters.year) {
    filters.year.value = '';
    if (filters.year.id && refreshSelect) {
      refreshSelect(filters.year.id);
    }
  }
  if (filters.bimestre) {
    filters.bimestre.value = '';
    if (filters.bimestre.id && refreshSelect) {
      refreshSelect(filters.bimestre.id);
    }
  }

  applyAvancesFilters();
}

export function handleFilterChange() {
  const previousActivity = avancesState.actividadSeleccionadaId;
  syncFilterStateFromUI();

  const currentFilterActivity = domRefs.filters.actividad ? domRefs.filters.actividad.value : '';
  if (currentFilterActivity !== previousActivity) {
    setSelectedActivity(currentFilterActivity, { updateSelect: false, updateURL: true, silent: true });
  }

  applyAvancesFilters();
}
