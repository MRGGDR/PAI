import { bindDomReferences, domRefs, avancesState, selectEnhancerContext, obtenerEmailUsuarioActualLocal } from './state.js';
import { obtenerContextoPermisos, obtenerAreaAsignadaUsuario } from './permissions.js';
import { AVANCE_PERMISSIONS } from './constants.js';
import { syncFilterStateFromUI, handleFilterChange, setSelectedActivity, clearFilters } from './filters.js';
import { loadActividades, loadAvances } from './data.js';
import { attachModalEvents } from './modal.js';
import { applyInitialSelectionAfterLoad } from './routing.js';
import { UI } from '../../lib/ui.js';

document.addEventListener('DOMContentLoaded', async () => {
  bindDomReferences();
  if (domRefs?.modal?.fechaReporteInput) {
    domRefs.modal.fechaReporteInput.dataset.skipDateEnhance = 'true';
  }
  const { filters, modal, refreshButton } = domRefs;

  const exportBtn = document.querySelector('.export-avances-btn');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      UI.showMessage('La exportación de avances estará disponible próximamente.', 'info', 5000);
    });
  }

  const { rol: rolActual, permisos } = obtenerContextoPermisos();
  const areaAsignada = obtenerAreaAsignadaUsuario();
  const restringirPorArea = rolActual === 'contribuidor' && areaAsignada !== '';

  avancesState.restricciones.restringirPorArea = restringirPorArea;
  avancesState.restricciones.areaAsignada = areaAsignada;

  const filterElements = Object.values(filters).filter((element) => element && element.tagName === 'SELECT');
  filterElements.forEach(select => {
    select.addEventListener('change', handleFilterChange);
  });
  if (filters.clearButton) {
    filters.clearButton.addEventListener('click', () => {
      clearFilters();
    });
  }
  syncFilterStateFromUI();

  if (selectEnhancerContext.aplicarEstilosBaseSelects) {
    selectEnhancerContext.aplicarEstilosBaseSelects.call(selectEnhancerContext);
  }
  if (selectEnhancerContext.aplicarEstilosBaseDatePickers) {
    selectEnhancerContext.aplicarEstilosBaseDatePickers.call(selectEnhancerContext);
  }

  const puedeCrearAvances = Boolean(permisos[AVANCE_PERMISSIONS.CREATE]);
  attachModalEvents({ puedeCrearAvances });

  if (modal.reportadoPorInput) {
    const email = obtenerEmailUsuarioActualLocal();
    if (email) {
      const input = modal.reportadoPorInput;
      input.value = email;
      input.setAttribute('readonly', 'true');
      input.classList.add('bg-gray-50', 'cursor-not-allowed');
    }
  }

  if (refreshButton) {
    refreshButton.addEventListener('click', () => {
      loadAvances({ forceRefresh: true }).catch(error => {
        console.error('No fue posible refrescar los avances:', error);
      });
    });
  }

  try {
  await loadActividades({ restringirPorArea, areaAsignada });
    applyInitialSelectionAfterLoad();
  } catch (error) {
    console.error('No fue posible cargar las actividades:', error);
  }

  try {
    await loadAvances();
  } catch (error) {
    console.error('No fue posible cargar los avances:', error);
  }

  // Garantizar que la actividad seleccionada sincronice filtros iniciales
  if (avancesState.actividadSeleccionadaId) {
    setSelectedActivity(avancesState.actividadSeleccionadaId, { updateSelect: true, updateURL: false, silent: true });
  }
});
