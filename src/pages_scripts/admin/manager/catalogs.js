import apiService from '../api.js';
import { mostrarToast } from '../../actividades/utils.js';
import { showLoaderDuring } from '../../../lib/loader.js';
import { CATALOG_LABELS, ADMIN_LOADER_MESSAGE } from './constants.js';

export const catalogMethods = {
  initializeCatalogModule() {
    this.loadCatalogTypes(true).then(() => {
      if (!this.state.catalogoActual) {
        const first = this.state.catalogoTipos?.[0]?.catalogo;
        if (first) {
          this.state.catalogoActual = first;
          if (this.dom.catalogSelect) {
            this.dom.catalogSelect.value = first;
          }
        }
      } else if (this.dom.catalogSelect) {
        this.dom.catalogSelect.value = this.state.catalogoActual;
      }

      if (this.state.catalogoActual) {
        this.loadCatalogo(true);
      } else {
        this.renderCatalogoTabla([]);
        this.actualizarResumen();
      }
    });
  },

  async loadCatalogTypes(force = false) {
    if (this.state.catalogoTiposLoading && !force) {
      return this.state.catalogoTipos;
    }

    try {
      this.state.catalogoTiposLoading = true;
      const tipos = await apiService.fetchCatalogTypes();
      const parsed = Array.isArray(tipos) ? tipos : [];

      this.state.catalogoTipos = parsed
        .map((item) => {
          const key = item?.catalogo || item?.type || '';
          if (!key) return null;
          const label = (item?.label || item?.descripcion || '').toString().trim() || this.formatearEtiquetaTipo(key);
          return {
            catalogo: key,
            label,
            count: Number.isFinite(item?.count) ? Number(item.count) : 0,
            isCustom: !Object.prototype.hasOwnProperty.call(CATALOG_LABELS, key)
          };
        })
        .filter(Boolean)
        .sort((a, b) => a.label.localeCompare(b.label, 'es', { sensitivity: 'base' }));

      this.state.catalogoEtiquetas = this.state.catalogoTipos.reduce((acc, item) => {
        acc[item.catalogo] = item.label;
        return acc;
      }, {});

      const finalValue = this.renderCatalogTypeOptions(this.state.catalogoActual);
      if (finalValue !== undefined) {
        this.state.catalogoActual = finalValue;
      }

      this.actualizarResumen();

      return this.state.catalogoTipos;
    } catch (error) {
      console.error('[ERROR] Error cargando tipos de catálogo:', error);
      mostrarToast('No se pudieron cargar los tipos de catálogo.', 'error');
      return [];
    } finally {
      this.state.catalogoTiposLoading = false;
    }
  },

  renderCatalogTypeOptions(selectedValue = null) {
    if (!this.dom.catalogSelect) {
      return this.state.catalogoActual || '';
    }

    const select = this.dom.catalogSelect;
    const previousSelection = (selectedValue || '').trim();
    const currentSelection = this.state.catalogoActual || '';

    select.innerHTML = '';

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Selecciona tipo...';
    select.appendChild(placeholder);

    const tipos = Array.isArray(this.state.catalogoTipos) ? this.state.catalogoTipos : [];
    tipos.forEach((tipo) => {
      if (!tipo || !tipo.catalogo) return;
      const option = document.createElement('option');
      option.value = tipo.catalogo;
      option.textContent = tipo.label || this.formatearEtiquetaTipo(tipo.catalogo);
      if (tipo.isCustom) {
        option.dataset.custom = 'true';
      }
      if (Number.isFinite(tipo.count)) {
        option.dataset.count = String(tipo.count);
      }
      select.appendChild(option);
    });

    let finalValue = '';
    if (previousSelection && this.hasCatalogType(previousSelection)) {
      finalValue = previousSelection;
    } else if (currentSelection && this.hasCatalogType(currentSelection)) {
      finalValue = currentSelection;
    } else {
      const firstOption = select.querySelector('option[value]:not([value=""])');
      finalValue = firstOption ? firstOption.value : '';
    }

    if (finalValue) {
      select.value = finalValue;
    } else {
      select.value = '';
    }

    return finalValue;
  },

  hasCatalogType(tipo) {
    if (!tipo) return false;
    return this.state.catalogoTipos.some(item => item.catalogo === tipo);
  },

  normalizarIdentificadorTipo(valor) {
    if (!valor && valor !== 0) return '';
    return valor
      .toString()
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_\-\s]/g, '')
      .replace(/[-\s]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .substr(0, 40);
  },

  formatearEtiquetaTipo(valor) {
    if (!valor && valor !== 0) return 'Catálogo';
    return valor
      .toString()
      .replace(/[_\-]+/g, ' ')
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/\b\w/g, (match) => match.toUpperCase());
  },

  crearTipoCatalogoInteractivo() {
    const identificadorEntrada = window.prompt(
      'Identificador técnico para el catálogo (usa letras minúsculas, números y guion bajo):'
    );

    if (identificadorEntrada === null) {
      return;
    }

    const slug = this.normalizarIdentificadorTipo(identificadorEntrada);
    if (!slug) {
      mostrarToast('Debes especificar un identificador válido.', 'warning');
      return;
    }

    if (this.hasCatalogType(slug)) {
      mostrarToast('Ya existe un catálogo con ese identificador.', 'warning');
      return;
    }

    const nombreSugerido = this.formatearEtiquetaTipo(slug);
    const nombreEntrada = window.prompt('Nombre visible para el catálogo:', nombreSugerido);
    const etiqueta = (nombreEntrada || '').trim() || nombreSugerido;

    const nuevoTipo = {
      catalogo: slug,
      label: etiqueta,
      count: 0,
      isCustom: true
    };

    this.state.catalogoTipos = [...this.state.catalogoTipos, nuevoTipo].sort((a, b) => a.label.localeCompare(b.label, 'es', { sensitivity: 'base' }));
    this.state.catalogoEtiquetas = {
      ...this.state.catalogoEtiquetas,
      [slug]: etiqueta
    };

    const seleccionado = this.renderCatalogTypeOptions(slug) || slug;
    this.state.catalogoActual = seleccionado;

    if (this.dom.catalogSelect) {
      this.dom.catalogSelect.value = seleccionado;
    }

    this.state.catalogoItems = [];
    this.state.catalogoIndex = {};
    this.renderCatalogoTabla([]);
    this.actualizarResumen();
    this.limpiarFormulario();
    this.mostrarMensajeFormulario(`Tipo "${etiqueta}" listo. Registra la primera entrada.`, 'info');
    this.toggleBotonEliminar(false);
    mostrarToast('Nuevo tipo creado. Guarda al menos una entrada para conservarlo.', 'info');
  },

  obtenerEtiquetaCatalogo(tipo) {
    if (!tipo) return 'catálogo';
    if (this.state.catalogoEtiquetas && this.state.catalogoEtiquetas[tipo]) {
      return this.state.catalogoEtiquetas[tipo];
    }
    if (Object.prototype.hasOwnProperty.call(CATALOG_LABELS, tipo)) {
      return CATALOG_LABELS[tipo];
    }
    return this.formatearEtiquetaTipo(tipo);
  },

  setCatalogoActual(tipo) {
    const nuevoTipo = (tipo || '').trim();
    if (this.state.catalogoActual === nuevoTipo) {
      return;
    }

    this.state.catalogoActual = nuevoTipo;
    if (!nuevoTipo) {
      this.state.catalogoItems = [];
      this.state.catalogoIndex = {};
      this.renderCatalogoTabla([]);
    }
    this.actualizarResumen();
    this.limpiarFormulario();
  },

  async loadCatalogo(force = false) {
    if (!this.state.catalogoActual) {
      return;
    }

    if (this.state.isLoading && !force) {
      return;
    }

    try {
      this.state.isLoading = true;
      const items = await showLoaderDuring(
        () => apiService.fetchCatalogo(this.state.catalogoActual, { forceRefresh: force }),
        ADMIN_LOADER_MESSAGE,
        'solid',
        400
      );

      const datosNormalizados = Array.isArray(items) ? items : [];
      this.state.catalogoItems = datosNormalizados;
      this.state.catalogoIndex = {};
      datosNormalizados.forEach(item => {
        if (item && item.id) {
          this.state.catalogoIndex[item.id] = item;
        }
      });

      this.renderCatalogoTabla(datosNormalizados);
      this.actualizarResumen();
      this.mostrarMensajeFormulario('Catálogo actualizado', 'info');
    } catch (error) {
      console.error('[ERROR] Error cargando catálogo:', error);
      this.renderCatalogoTabla([]);
      this.actualizarResumen();
      this.mostrarMensajeFormulario('No fue posible cargar el catálogo. Reintenta más tarde.', 'error');
      mostrarToast('Error al obtener el catálogo seleccionado.', 'error');
    } finally {
      this.state.isLoading = false;
    }
  },

  renderCatalogoTabla(items) {
    if (!this.dom.tableBody) return;

    this.dom.tableBody.innerHTML = '';

    if (!items || items.length === 0) {
      const fila = document.createElement('tr');
      const mensaje = this.state.catalogoActual
        ? `No hay registros para ${this.obtenerEtiquetaCatalogo(this.state.catalogoActual)}.`
        : 'Selecciona un tipo de catálogo para comenzar.';
      fila.innerHTML = `
        <td colspan="7" class="px-4 py-6 text-center text-sm text-gray-500">
          ${mensaje}
        </td>
      `;
      this.dom.tableBody.appendChild(fila);
      return;
    }

    const fragment = document.createDocumentFragment();

    items.forEach((item) => {
      const fila = document.createElement('tr');
      fila.dataset.id = item.id || '';

      const activo = this.parseBoolean(item.is_active);
      const updatedAt = this.formatearFecha(item.updated_at, { includeTime: false });
      const parentCode = item.parent_code || item.parentCode || '';

      fila.innerHTML = `
        <td class="px-4 py-3 whitespace-nowrap text-[13px] text-gray-700 font-mono">${item.code || 'N/A'}</td>
        <td class="px-4 py-3 text-sm text-gray-900">${item.label || item.nombre || 'N/A'}</td>
        <td class="px-4 py-3 text-sm text-gray-500">${parentCode || 'N/A'}</td>
        <td class="px-4 py-3 text-sm text-gray-500 text-center">${item.sort_order ?? 'N/A'}</td>
        <td class="px-4 py-3 text-sm">${activo ? '<span class="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">Activo</span>' : '<span class="inline-flex items-center rounded-full bg-gray-200 px-2.5 py-0.5 text-xs font-medium text-gray-600">Inactivo</span>'}</td>
        <td class="px-4 py-3 text-xs text-gray-500">${updatedAt || 'N/A'}</td>
        <td class="px-4 py-3 text-right">
          <div class="flex justify-end gap-2">
            <button type="button" class="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-600 hover:border-indigo-300 hover:text-indigo-600" data-action="edit" data-id="${item.id}">
              <span class="material-icons" style="font-size:14px">edit</span>
              Editar
            </button>
            <button type="button" class="inline-flex items-center gap-1 rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-500 hover:border-red-300 hover:text-red-600" data-action="delete" data-id="${item.id}">
              <span class="material-icons" style="font-size:14px">delete</span>
              Eliminar
            </button>
          </div>
        </td>
      `;

      fragment.appendChild(fila);
    });

    this.dom.tableBody.appendChild(fragment);
  },

  actualizarResumen() {
    if (!this.dom.counter) return;

    const total = this.state.catalogoItems.length;
    const etiqueta = this.obtenerEtiquetaCatalogo(this.state.catalogoActual);
    this.dom.counter.textContent = total === 1
      ? '1 elemento'
      : `${total} elementos`;

    if (this.dom.catalogSelect && !this.dom.catalogSelect.value && this.state.catalogoActual) {
      this.dom.catalogSelect.value = this.state.catalogoActual;
    }

    if (this.dom.formTitle) {
      this.dom.formTitle.textContent = `Agregar entrada en ${etiqueta}`;
    }
  },

  handleTablaClick(event) {
    const boton = event.target.closest('button[data-action]');
    if (!boton) return;

    const id = boton.dataset.id;
    if (!id) return;

    const item = this.state.catalogoIndex[id];
    if (!item) {
      mostrarToast('No se pudo localizar el elemento seleccionado.', 'warning');
      return;
    }

    if (boton.dataset.action === 'edit') {
      this.mostrarEnFormulario(item);
    } else if (boton.dataset.action === 'delete') {
      this.confirmarEliminacion(item);
    }
  },

  mostrarEnFormulario(item) {
    if (!this.dom.inputs) return;

    this.dom.inputs.id.value = item.id || '';
    this.dom.inputs.idDisplay.value = item.id || '';
    this.dom.inputs.updatedAt.value = this.formatearFecha(item.updated_at, { includeTime: false }) || '';
  this.dom.inputs.code.value = (item.code || '').toString();
    this.dom.inputs.label.value = item.label || item.nombre || '';
    this.dom.inputs.parent.value = item.parent_code || item.parentCode || '';
    this.dom.inputs.sortOrder.value = item.sort_order !== undefined && item.sort_order !== null ? item.sort_order : '';
    this.dom.inputs.active.checked = this.parseBoolean(item.is_active);

    if (this.dom.formTitle) {
      this.dom.formTitle.textContent = `Editar entrada (${this.obtenerEtiquetaCatalogo(this.state.catalogoActual)})`;
    }

    this.mostrarMensajeFormulario(`Editando ${item.code || item.label}`, 'info');
    this.toggleBotonEliminar(true);
    this.desplazarHacia(this.dom.form);
  },

  limpiarFormulario() {
    if (!this.dom.form) return;

    this.dom.form.reset();
    if (this.dom.inputs) {
      this.dom.inputs.id.value = '';
      this.dom.inputs.idDisplay.value = '';
      this.dom.inputs.updatedAt.value = '';
      if (this.dom.inputs.active) this.dom.inputs.active.checked = true;
    }

    if (this.dom.formTitle) {
      this.dom.formTitle.textContent = `Agregar entrada en ${this.obtenerEtiquetaCatalogo(this.state.catalogoActual)}`;
    }
    this.mostrarMensajeFormulario('Formulario listo para una nueva entrada.', 'info');
    this.toggleBotonEliminar(false);
  },

  toggleBotonEliminar(visible) {
    if (!this.dom.formDelete) return;
    if (visible) {
      this.dom.formDelete.classList.remove('hidden');
    } else {
      this.dom.formDelete.classList.add('hidden');
    }
  },

  mostrarMensajeFormulario(mensaje, tipo = 'info') {
    if (!this.dom.formStatus) return;
    this.dom.formStatus.textContent = mensaje || '';
    this.dom.formStatus.dataset.status = tipo;
  },

  obtenerDatosFormulario() {
    if (!this.dom.inputs) return null;

    const datos = {
      id: (this.dom.inputs.id.value || '').trim(),
      catalogo: this.state.catalogoActual,
  code: (this.dom.inputs.code.value || '').trim(),
      label: (this.dom.inputs.label.value || '').trim(),
      parent_code: (this.dom.inputs.parent.value || '').trim(),
      sort_order: this.dom.inputs.sortOrder.value ? parseInt(this.dom.inputs.sortOrder.value, 10) : null,
      is_active: Boolean(this.dom.inputs.active?.checked)
    };

    if (Number.isNaN(datos.sort_order)) {
      datos.sort_order = null;
    }

    return datos;
  },

  validarDatos(datos) {
    const errores = [];

    if (!datos.catalogo) {
      errores.push('Selecciona un tipo de catálogo.');
    }

    if (!datos.label) {
      errores.push('El campo "Nombre" es obligatorio.');
    }

    return errores;
  },

  async handleSubmitFormulario(event) {
    event.preventDefault();

    const datos = this.obtenerDatosFormulario();
    if (!datos) {
      mostrarToast('No se pudieron obtener los datos del formulario.', 'error');
      return;
    }

    const errores = this.validarDatos(datos);
    if (errores.length > 0) {
      this.mostrarMensajeFormulario(errores.join(' '), 'error');
      mostrarToast(errores.join('\n'), 'warning');
      return;
    }

    try {
      this.mostrarMensajeFormulario('Guardando cambios...', 'info');
      const esNuevo = !datos.id;

      if (esNuevo) {
        await showLoaderDuring(() => apiService.createCatalogItem(datos), 'Creando entrada...', 'solid', 400);
        mostrarToast('Entrada creada correctamente.', 'success');
      } else {
        const { id, ...payload } = datos;
        await showLoaderDuring(() => apiService.updateCatalogItem(id, payload), 'Actualizando entrada...', 'solid', 400);
        mostrarToast('Entrada actualizada correctamente.', 'success');
      }

      await this.loadCatalogo(true);
      this.limpiarFormulario();
    } catch (error) {
      console.error('[ERROR] No se pudo guardar el elemento de catálogo:', error);
      const mensaje = error?.message || 'No se pudo guardar el registro.';
      this.mostrarMensajeFormulario(mensaje, 'error');
      mostrarToast(mensaje, 'error');
    }
  },

  confirmarEliminacion(item = null) {
    const registro = item || (this.dom.inputs?.id.value ? this.state.catalogoIndex[this.dom.inputs.id.value] : null);
    if (!registro || !registro.id) {
      mostrarToast('Selecciona un registro para eliminar.', 'warning');
      return;
    }

    const etiqueta = registro.label || registro.code || registro.id;
    const confirmado = window.confirm(`¿Eliminar "${etiqueta}"? El elemento se marcará como inactivo.`);
    if (!confirmado) return;

    this.eliminarCatalogo(registro.id);
  },

  async eliminarCatalogo(id) {
    if (!id) return;

    try {
      this.mostrarMensajeFormulario('Eliminando registro...', 'info');
      await showLoaderDuring(() => apiService.deleteCatalogItem(id), 'Eliminando entrada...', 'solid', 400);
      mostrarToast('Entrada eliminada correctamente.', 'success');
      await this.loadCatalogo(true);
      this.limpiarFormulario();
    } catch (error) {
      console.error('[ERROR] Error eliminando catálogo:', error);
      const mensaje = error?.message || 'No se pudo eliminar el registro.';
      this.mostrarMensajeFormulario(mensaje, 'error');
      mostrarToast(mensaje, 'error');
    }
  },

  async exportarCatalogo() {
    if (!this.state.catalogoActual) {
      mostrarToast('Selecciona un catálogo para exportar.', 'warning');
      return;
    }

    if (!this.state.catalogoItems.length) {
      mostrarToast('No hay datos para exportar.', 'info');
      return;
    }

    try {
      const data = JSON.stringify(this.state.catalogoItems, null, 2);
      const blob = new Blob([data], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);

      const enlace = document.createElement('a');
      enlace.href = url;
      const etiqueta = this.obtenerEtiquetaCatalogo(this.state.catalogoActual).toLowerCase().replace(/\s+/g, '-');
      enlace.download = `catalogo-${etiqueta}.json`;
      enlace.click();

      URL.revokeObjectURL(url);
      mostrarToast('Catálogo exportado correctamente.', 'success');
    } catch (error) {
      console.error('[ERROR] Error exportando catálogo:', error);
      mostrarToast('No se pudo exportar el catálogo.', 'error');
    }
  }
};
