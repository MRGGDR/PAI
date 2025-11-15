import apiService from '../api.js';
import { mostrarToast } from '../../actividades/utils.js';
import { showLoaderDuring } from '../../../lib/loader.js';
import { AREA_BUDGET_STATES } from './constants.js';

const DEFAULT_CURRENCY = 'COP';
const BUDGET_LOADER_MESSAGE = 'Consultando presupuestos por área...';

function formatCurrency(value, currency = DEFAULT_CURRENCY) {
  const amount = Number(value) || 0;
  try {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: currency || DEFAULT_CURRENCY,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  } catch (error) {
    return `${currency || DEFAULT_CURRENCY} ${amount.toLocaleString('es-CO')}`;
  }
}

function getTodayISO() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const budgetMethods = {
  async initializeBudgetModule(force = false) {
    if (!this.puedeGestionarPresupuestos()) {
      return;
    }

    if (this.presupuestosPanelInicializado && !force) {
      return;
    }

    try {
      await this.ensureBudgetAreasCatalog(force);
      await this.loadPresupuestosArea(true);
      this.presupuestosPanelInicializado = true;
    } catch (error) {
      console.error('[ERROR] No se pudo inicializar el módulo de presupuestos:', error);
      mostrarToast('No fue posible inicializar los presupuestos por área.', 'error');
    }
  },

  async ensureBudgetAreasCatalog(force = false) {
    if (!this.puedeGestionarPresupuestos()) return;
    if (!force && this.presupuestosCatalogoCargado && this.state.presupuestoAreasCatalog.length) {
      return;
    }

    try {
      const areas = await apiService.fetchCatalogo('area', { forceRefresh: force });
      const lista = Array.isArray(areas) ? areas : [];
      this.state.presupuestoAreasCatalog = lista;
      this.presupuestosCatalogoCargado = true;
      this.renderBudgetAreaOptions(lista);
    } catch (error) {
      console.warn('[WARN] No se pudieron obtener las áreas para presupuestos:', error);
      mostrarToast('No fue posible cargar el catálogo de áreas.', 'warning');
    }
  },

  renderBudgetAreaOptions(areas = []) {
    const filterSelect = this.dom.presupuestos?.areaFilter;
    const formSelect = this.dom.presupuestos?.inputs?.areaId;
    const previousFilter = filterSelect?.value || '';
    const previousForm = formSelect?.value || '';

    const map = {};

    const ordered = Array.isArray(areas)
      ? [...areas].sort((a, b) => {
          const labelA = (a?.label || a?.nombre || a?.descripcion || a?.area || a?.code || '').toString();
          const labelB = (b?.label || b?.nombre || b?.descripcion || b?.area || b?.code || '').toString();
          return labelA.localeCompare(labelB, 'es', { sensitivity: 'base' });
        })
      : [];

    if (filterSelect) {
      filterSelect.innerHTML = '';
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'Todas las áreas';
      filterSelect.appendChild(option);
    }

    if (formSelect) {
      formSelect.innerHTML = '';
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'Selecciona un área...';
      formSelect.appendChild(option);
    }

    ordered.forEach(item => {
      const code = (item?.code || item?.codigo || item?.id || '').toString().trim();
      if (!code) return;
      const id = (item?.id || '').toString().trim();
      const label = (item?.label || item?.nombre || item?.descripcion || item?.area || code).toString().trim();

      if (code) map[code] = label;
      if (id && id !== code) map[id] = label;

      if (filterSelect) {
        const opt = document.createElement('option');
        opt.value = code;
        opt.textContent = label;
        filterSelect.appendChild(opt);
      }

      if (formSelect) {
        const opt = document.createElement('option');
        opt.value = code;
        opt.textContent = label;
        formSelect.appendChild(opt);
      }
    });

    if (filterSelect && previousFilter && map[previousFilter]) {
      filterSelect.value = previousFilter;
    }

    if (formSelect && previousForm) {
      if (map[previousForm]) {
        formSelect.value = previousForm;
      } else if (previousForm) {
        const fallback = document.createElement('option');
        fallback.value = previousForm;
        fallback.textContent = previousForm;
        formSelect.appendChild(fallback);
        formSelect.value = previousForm;
      }
    }

    this.state.presupuestoAreasMap = map;
  },

  obtenerEtiquetaAreaPresupuesto(areaId) {
    if (!areaId) return 'Sin área';
    const key = areaId.toString().trim();
    if (!key) return 'Sin área';
    return this.state.presupuestoAreasMap[key] || key;
  },

  buildBudgetFiltersPayload() {
    const filtros = this.state.presupuestosFiltros || {};
    const payload = {};

    if (filtros.area) {
      payload.area_id = filtros.area;
    }
    if (filtros.vigencia) {
      payload.vigencia = filtros.vigencia;
    }
    if (filtros.estado) {
      payload.estado = filtros.estado;
    }
    if (filtros.esActual) {
      payload.es_actual = true;
    }

    return payload;
  },

  async loadPresupuestosArea(force = false) {
    if (!this.puedeGestionarPresupuestos()) return;

    try {
      const payload = this.buildBudgetFiltersPayload();
      const { items, meta } = await showLoaderDuring(
        () => apiService.fetchPresupuestosArea(payload),
        BUDGET_LOADER_MESSAGE,
        'solid',
        400
      );

      const lista = Array.isArray(items) ? items : [];
      this.state.presupuestosArea = lista;
      this.state.presupuestosAreaIndex = {};
      lista.forEach(item => {
        const id = (item?.presupuesto_id || '').toString().trim();
        if (id) {
          this.state.presupuestosAreaIndex[id] = item;
        }
      });
      this.state.presupuestosMeta = meta || {};

      this.applyPresupuestoFiltro();
      if (force) {
        this.setPresupuestoFormStatus('Presupuestos actualizados.', 'info');
      }
    } catch (error) {
      console.error('[ERROR] No se pudieron cargar los presupuestos:', error);
      this.state.presupuestosArea = [];
      this.state.presupuestosAreaIndex = {};
      this.state.presupuestosMeta = {};
      this.applyPresupuestoFiltro();
      const mensaje = error?.message || 'No fue posible obtener los presupuestos por área.';
      mostrarToast(mensaje, 'error');
    }
  },

  applyPresupuestoBusqueda(valor) {
    this.state.presupuestosBusqueda = (valor || '').toString();
    this.applyPresupuestoFiltro();
  },

  handlePresupuestoFilterChange() {
    const presupuestosDom = this.dom.presupuestos;
    if (!presupuestosDom) return;

    this.state.presupuestosFiltros = {
      area: presupuestosDom.areaFilter?.value?.trim() || '',
      vigencia: presupuestosDom.vigenciaFilter?.value?.trim() || '',
      estado: presupuestosDom.estadoFilter?.value?.trim() || '',
      esActual: Boolean(presupuestosDom.actualFilter?.checked)
    };

    this.applyPresupuestoFiltro();
  },

  resetPresupuestoFiltros() {
    const presupuestosDom = this.dom.presupuestos;
    if (!presupuestosDom) return;

    if (presupuestosDom.areaFilter) presupuestosDom.areaFilter.value = '';
    if (presupuestosDom.vigenciaFilter) presupuestosDom.vigenciaFilter.value = '';
    if (presupuestosDom.estadoFilter) presupuestosDom.estadoFilter.value = '';
    if (presupuestosDom.actualFilter) presupuestosDom.actualFilter.checked = false;
    if (presupuestosDom.searchInput) presupuestosDom.searchInput.value = '';

    this.state.presupuestosFiltros = {
      area: '',
      vigencia: '',
      estado: '',
      esActual: false
    };
    this.state.presupuestosBusqueda = '';

    this.applyPresupuestoFiltro();
    this.loadPresupuestosArea(true);
  },

  applyPresupuestoFiltro() {
    const filtros = this.state.presupuestosFiltros || {};
    const busqueda = (this.state.presupuestosBusqueda || '').trim().toLowerCase();

    const filtrados = (this.state.presupuestosArea || []).filter(item => {
      if (!item) return false;
      const areaId = (item.area_id || '').toString().trim();
      const vigencia = (item.vigencia || '').toString().trim();
      const estado = (item.estado || '').toString().trim();
      const esActual = this.parseBoolean ? this.parseBoolean(item.es_actual) : Boolean(item.es_actual);

      if (filtros.area && areaId !== filtros.area) return false;
      if (filtros.vigencia && vigencia !== filtros.vigencia) return false;
      if (filtros.estado && estado.toLowerCase() !== filtros.estado.toLowerCase()) return false;
      if (filtros.esActual && !esActual) return false;

      if (!busqueda) return true;

      const areaLabel = this.obtenerEtiquetaAreaPresupuesto(areaId).toLowerCase();
      const id = (item.presupuesto_id || '').toString().toLowerCase();
      const monto = (item.presupuesto_asignado || '').toString().toLowerCase();

      return (
        areaLabel.includes(busqueda) ||
        vigencia.toLowerCase().includes(busqueda) ||
        estado.toLowerCase().includes(busqueda) ||
        id.includes(busqueda) ||
        monto.includes(busqueda)
      );
    });

    this.state.presupuestosAreaFiltrados = filtrados;
    this.renderPresupuestosTabla(filtrados);
  },

  renderPresupuestosTabla(items) {
    const presupuestosDom = this.dom.presupuestos;
    if (!presupuestosDom?.tableBody) return;

    presupuestosDom.tableBody.innerHTML = '';

    if (!items || items.length === 0) {
      const fila = document.createElement('tr');
      fila.innerHTML = `
        <td colspan="9" class="px-4 py-6 text-center text-sm text-gray-500">
          No se encontraron presupuestos con los criterios actuales.
        </td>
      `;
      presupuestosDom.tableBody.appendChild(fila);
    } else {
      const fragment = document.createDocumentFragment();
      items.forEach(item => {
        const id = (item?.presupuesto_id || '').toString().trim();
        const area = this.obtenerEtiquetaAreaPresupuesto(item?.area_id);
        const vigencia = (item?.vigencia || '').toString().trim() || '-';
        const version = item?.version !== undefined && item?.version !== null ? Number(item.version) : '';
        const moneda = (item?.moneda || DEFAULT_CURRENCY).toString().trim().toUpperCase() || DEFAULT_CURRENCY;
        const monto = formatCurrency(item?.presupuesto_asignado, moneda);
        const estado = this.renderPresupuestoEstado(item?.estado);
        const vigenciaTexto = this.renderPresupuestoVigencia(item?.valido_desde, item?.valido_hasta);
        const actual = this.renderPresupuestoActualFlag(item?.es_actual);

        const fila = document.createElement('tr');
        fila.dataset.id = id;
        fila.innerHTML = `
          <td class="px-3 py-2 text-left text-[13px] font-mono uppercase tracking-wide text-indigo-600">${id || 'N/A'}</td>
          <td class="px-3 py-2 text-sm text-gray-900">${area}</td>
          <td class="px-3 py-2 text-sm text-gray-500">${vigencia}</td>
          <td class="px-3 py-2 text-sm text-gray-500">${version || 'Auto'}</td>
          <td class="px-3 py-2 text-sm text-gray-900">${monto}</td>
          <td class="px-3 py-2 text-sm text-gray-500">${estado}</td>
          <td class="px-3 py-2 text-xs text-gray-500">${vigenciaTexto}</td>
          <td class="px-3 py-2 text-sm">${actual}</td>
          <td class="px-3 py-2 text-right">
            <div class="flex justify-end gap-2">
              <button type="button" class="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-600 hover:border-indigo-300 hover:text-indigo-600" data-action="edit" data-id="${id}">
                <span class="material-icons" style="font-size:14px">edit</span>
                Editar
              </button>
              <button type="button" class="inline-flex items-center gap-1 rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-500 hover:border-red-300 hover:text-red-600" data-action="delete" data-id="${id}">
                <span class="material-icons" style="font-size:14px">delete</span>
                Eliminar
              </button>
            </div>
          </td>
        `;
        fragment.appendChild(fila);
      });
      presupuestosDom.tableBody.appendChild(fragment);
    }

    if (presupuestosDom.summary) {
      const total = this.state.presupuestosArea.length;
      const visibles = items ? items.length : 0;
      presupuestosDom.summary.textContent = total === visibles
        ? `${total} presupuestos`
        : `${visibles} de ${total} presupuestos`;
    }
  },

  renderPresupuestoEstado(estado) {
    const value = (estado || 'Sin estado').toString();
    const normalized = value.toLowerCase();
    let classes = 'bg-gray-200 text-gray-600';

    if (normalized.includes('aprob')) {
      classes = 'bg-emerald-100 text-emerald-700';
    } else if (normalized.includes('modific')) {
      classes = 'bg-amber-100 text-amber-700';
    } else if (normalized.includes('suspend')) {
      classes = 'bg-orange-100 text-orange-700';
    } else if (normalized.includes('cerr')) {
      classes = 'bg-rose-100 text-rose-700';
    } else if (normalized.includes('propu')) {
      classes = 'bg-indigo-100 text-indigo-700';
    }

    return `<span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${classes}">${value}</span>`;
  },

  renderPresupuestoVigencia(desde, hasta) {
    const inicio = desde ? this.formatearFecha(desde, { includeTime: false }) : 'Sin fecha inicial';
    const fin = hasta ? this.formatearFecha(hasta, { includeTime: false }) : 'Abierto';
    return `${inicio} — ${fin}`;
  },

  renderPresupuestoActualFlag(flag) {
    const isActive = this.parseBoolean ? this.parseBoolean(flag) : Boolean(flag);
    return isActive
      ? '<span class="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">Vigente</span>'
      : '<span class="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">Histórico</span>';
  },

  handlePresupuestoTablaClick(event) {
    const boton = event.target.closest('button[data-action]');
    if (!boton) return;

    const id = boton.dataset.id;
    if (!id) return;

    const presupuesto = this.state.presupuestosAreaIndex[id];
    if (!presupuesto) {
      mostrarToast('No se encontró el presupuesto seleccionado.', 'warning');
      return;
    }

    if (boton.dataset.action === 'delete') {
      this.confirmarEliminarPresupuesto(presupuesto);
      return;
    }

    this.mostrarPresupuestoEnFormulario(presupuesto);
  },

  mostrarPresupuestoEnFormulario(item) {
    const presupuestosDom = this.dom.presupuestos;
    if (!presupuestosDom?.inputs) return;

    const inputs = presupuestosDom.inputs;
    const areaId = (item?.area_id || '').toString().trim();
    const vigencia = (item?.vigencia || '').toString().trim();
    const version = item?.version !== undefined && item?.version !== null ? Number(item.version) : '';
    const monto = item?.presupuesto_asignado !== undefined && item?.presupuesto_asignado !== null ? Number(item.presupuesto_asignado) : '';
    const moneda = (item?.moneda || DEFAULT_CURRENCY).toString().trim().toUpperCase();
    const estado = (item?.estado || 'Propuesto').toString();
    const esActual = this.parseBoolean ? this.parseBoolean(item?.es_actual) : Boolean(item?.es_actual);

    if (inputs.id) inputs.id.value = (item?.presupuesto_id || '').toString().trim();
    if (inputs.idDisplay) inputs.idDisplay.value = (item?.presupuesto_id || '').toString().trim();

    if (inputs.areaId) {
      if (!this.state.presupuestoAreasMap[areaId] && areaId) {
        const opt = document.createElement('option');
        opt.value = areaId;
        opt.textContent = areaId;
        inputs.areaId.appendChild(opt);
        this.state.presupuestoAreasMap[areaId] = areaId;
      }
      inputs.areaId.value = areaId || '';
    }

    if (inputs.vigencia) inputs.vigencia.value = vigencia || '';
    if (inputs.version) inputs.version.value = Number.isFinite(version) && version > 0 ? version : '';
    if (inputs.asignado) inputs.asignado.value = Number.isFinite(monto) ? monto : '';
    if (inputs.moneda) inputs.moneda.value = moneda || DEFAULT_CURRENCY;
    if (inputs.fuente) inputs.fuente.value = (item?.fuente_presupuestal || '').toString();
    if (inputs.estado) {
      if (!AREA_BUDGET_STATES.includes(estado)) {
        const opt = document.createElement('option');
        opt.value = estado;
        opt.textContent = estado;
        inputs.estado.appendChild(opt);
      }
      inputs.estado.value = estado;
    }
    if (inputs.esActual) inputs.esActual.checked = Boolean(esActual);
    if (inputs.validoDesde) inputs.validoDesde.value = this.formatearFechaISO?.(item?.valido_desde) || (item?.valido_desde || '');
    if (inputs.validoHasta) inputs.validoHasta.value = this.formatearFechaISO?.(item?.valido_hasta) || (item?.valido_hasta || '');
    if (inputs.doc) inputs.doc.value = (item?.doc_soporte_url || '').toString();
    if (inputs.motivo) inputs.motivo.value = (item?.motivo_cambio || '').toString();
    if (inputs.observaciones) inputs.observaciones.value = (item?.observaciones || '').toString();
    if (inputs.registradoPor) inputs.registradoPor.value = (item?.registrado_por || '').toString();
    if (inputs.registradoEn) inputs.registradoEn.value = item?.registrado_en ? this.formatearFecha(item.registrado_en) : '';

    if (presupuestosDom.formTitle) {
      presupuestosDom.formTitle.textContent = 'Editar presupuesto de área';
    }

    this.state.presupuestoEditando = item;
    this.togglePresupuestoEliminar(true);
    this.setPresupuestoFormStatus('Editando presupuesto seleccionado.', 'info');
    this.desplazarHacia(presupuestosDom.form);
  },

  resetPresupuestoFormulario() {
    const presupuestosDom = this.dom.presupuestos;
    if (!presupuestosDom?.inputs) return;

    const inputs = presupuestosDom.inputs;
    if (presupuestosDom.form) {
      presupuestosDom.form.reset();
    }

    if (inputs.id) inputs.id.value = '';
    if (inputs.idDisplay) inputs.idDisplay.value = '';
    if (inputs.areaId) inputs.areaId.value = '';
    if (inputs.vigencia) inputs.vigencia.value = '';
    if (inputs.version) inputs.version.value = '';
    if (inputs.asignado) inputs.asignado.value = '';
    if (inputs.moneda) inputs.moneda.value = DEFAULT_CURRENCY;
    if (inputs.fuente) inputs.fuente.value = '';
    if (inputs.estado) inputs.estado.value = 'Propuesto';
    if (inputs.esActual) inputs.esActual.checked = false;
    if (inputs.validoDesde) inputs.validoDesde.value = getTodayISO();
    if (inputs.validoHasta) inputs.validoHasta.value = '';
    if (inputs.doc) inputs.doc.value = '';
    if (inputs.motivo) inputs.motivo.value = '';
    if (inputs.observaciones) inputs.observaciones.value = '';
    if (inputs.registradoPor) inputs.registradoPor.value = '';
    if (inputs.registradoEn) inputs.registradoEn.value = '';

    if (presupuestosDom.formTitle) {
      presupuestosDom.formTitle.textContent = 'Registrar presupuesto de área';
    }

    this.state.presupuestoEditando = null;
    this.togglePresupuestoEliminar(false);
    this.setPresupuestoFormStatus('Formulario listo para registrar un nuevo presupuesto.', 'info');
  },

  setPresupuestoFormStatus(mensaje, tipo = 'info') {
    const presupuestosDom = this.dom.presupuestos;
    if (!presupuestosDom?.formStatus) return;
    presupuestosDom.formStatus.textContent = mensaje || '';
    presupuestosDom.formStatus.dataset.status = tipo;
  },

  togglePresupuestoEliminar(visible) {
    const deleteButton = this.dom.presupuestos?.deleteButton;
    if (!deleteButton) return;
    if (visible) {
      deleteButton.classList.remove('hidden');
    } else {
      deleteButton.classList.add('hidden');
    }
  },

  getPresupuestoFormData() {
    const inputs = this.dom.presupuestos?.inputs;
    if (!inputs) return null;

    const areaId = inputs.areaId?.value?.trim() || '';
    const areaNombre = areaId && inputs.areaId?.selectedOptions?.length
      ? inputs.areaId.selectedOptions[0].textContent.trim()
      : '';

    const data = {
      presupuesto_id: inputs.id?.value?.trim() || undefined,
      area_id: areaId,
      area_nombre: areaNombre,
      vigencia: inputs.vigencia?.value?.trim() || '',
      version: inputs.version?.value ? Number(inputs.version.value) : undefined,
      presupuesto_asignado: inputs.asignado?.value ? Number(inputs.asignado.value) : 0,
      moneda: inputs.moneda?.value?.trim().toUpperCase() || DEFAULT_CURRENCY,
      fuente_presupuestal: inputs.fuente?.value?.trim() || undefined,
      estado: inputs.estado?.value?.trim() || 'Propuesto',
      es_actual: Boolean(inputs.esActual?.checked),
      valido_desde: inputs.validoDesde?.value?.trim() || undefined,
      valido_hasta: inputs.validoHasta?.value?.trim() || undefined,
      doc_soporte_url: inputs.doc?.value?.trim() || undefined,
      motivo_cambio: inputs.motivo?.value?.trim() || undefined,
      observaciones: inputs.observaciones?.value?.trim() || undefined
    };

    if (!data.presupuesto_id) delete data.presupuesto_id;
    if (!data.version || Number.isNaN(data.version)) delete data.version;
    if (!data.fuente_presupuestal) delete data.fuente_presupuestal;
    if (!data.doc_soporte_url) delete data.doc_soporte_url;
    if (!data.motivo_cambio) delete data.motivo_cambio;
    if (!data.observaciones) delete data.observaciones;
    if (!data.valido_desde) delete data.valido_desde;
    if (!data.valido_hasta) delete data.valido_hasta;

    return data;
  },

  validarPresupuestoData(data) {
    const errores = [];

    if (!data.area_id) {
      errores.push('Selecciona un área para el presupuesto.');
    }

    if (!data.vigencia || !/^\d{4}$/.test(data.vigencia)) {
      errores.push('La vigencia debe tener el formato YYYY.');
    }

    if (!Number.isFinite(data.presupuesto_asignado) || data.presupuesto_asignado <= 0) {
      errores.push('El presupuesto asignado debe ser un número mayor a cero.');
    }

    if (data.valido_desde && data.valido_hasta) {
      const inicio = new Date(data.valido_desde);
      const fin = new Date(data.valido_hasta);
      if (fin < inicio) {
        errores.push('La fecha "Válido hasta" debe ser posterior a "Válido desde".');
      }
    }

    return errores;
  },

  async handlePresupuestoSubmit(event) {
    event.preventDefault();

    const data = this.getPresupuestoFormData();
    if (!data) {
      mostrarToast('No se pudieron obtener los datos del formulario.', 'error');
      return;
    }

    const errores = this.validarPresupuestoData(data);
    if (errores.length) {
      const mensaje = errores.join(' ');
      this.setPresupuestoFormStatus(mensaje, 'error');
      mostrarToast(errores[0], 'warning');
      return;
    }

    try {
      this.setPresupuestoFormStatus('Guardando presupuesto...', 'info');
      await this.guardarPresupuestoArea(data);
      mostrarToast('Presupuesto guardado correctamente.', 'success');
      await this.loadPresupuestosArea(true);
      this.resetPresupuestoFormulario();
    } catch (error) {
      console.error('[ERROR] No se pudo guardar el presupuesto:', error);
      const mensaje = error?.message || 'No fue posible guardar el presupuesto.';
      this.setPresupuestoFormStatus(mensaje, 'error');
      mostrarToast(mensaje, 'error');
    }
  },

  async guardarPresupuestoArea(data) {
    await apiService.savePresupuestoArea(data);
  },

  confirmarEliminarPresupuesto(item = null) {
    const presupuesto = item || this.state.presupuestoEditando;
    if (!presupuesto) {
      mostrarToast('Selecciona un presupuesto para eliminar.', 'warning');
      return;
    }

    const id = (presupuesto.presupuesto_id || '').toString().trim();
    const area = this.obtenerEtiquetaAreaPresupuesto(presupuesto.area_id);
    const vigencia = presupuesto.vigencia || '';

    const confirmado = window.confirm(`¿Eliminar el presupuesto ${id || ''} (${area} - ${vigencia})? Esta acción no se puede deshacer.`);
    if (!confirmado) return;

    this.eliminarPresupuestoArea(id);
  },

  async eliminarPresupuestoArea(presupuestoId) {
    if (!presupuestoId) return;

    try {
      await apiService.deletePresupuestoArea(presupuestoId);
      mostrarToast('Presupuesto eliminado correctamente.', 'success');
      await this.loadPresupuestosArea(true);
      this.resetPresupuestoFormulario();
    } catch (error) {
      console.error('[ERROR] No se pudo eliminar el presupuesto:', error);
      const mensaje = error?.message || 'No fue posible eliminar el presupuesto.';
      mostrarToast(mensaje, 'error');
      this.setPresupuestoFormStatus(mensaje, 'error');
    }
  }
};
