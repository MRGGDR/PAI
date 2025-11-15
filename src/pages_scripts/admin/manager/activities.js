import actividadesApi from '../../actividades/api.js';
import { mostrarToast, obtenerEmailUsuarioActual } from '../../actividades/utils.js';
import { showLoaderDuring } from '../../../lib/loader.js';
import { ADMIN_LOADER_MESSAGE } from './constants.js';

const REVIEW_STATES_REQUIRING_MESSAGE = new Set(['Corrección']);
const REVIEW_STATES_TRIGGER_EMAIL = new Set(['Corrección', 'En revisión', 'Aprobado', 'Cancelado']);
const REVIEW_STATE_MESSAGE_TEMPLATES = {
  'Sin revisión': 'La actividad volverá al estado inicial sin solicitar acciones adicionales.',
  'En revisión': 'La actividad se encuentra en revisión por parte del equipo administrador. Te informaremos cualquier novedad.',
  'Aprobado': 'La actividad fue aprobada. Gracias por mantener la información actualizada.',
  'Corrección': 'Se solicitarán correcciones al responsable. Detalla los ajustes requeridos para facilitar su gestión.',
  'Cancelado': 'La actividad fue cancelada. No es necesario realizar acciones adicionales.'
};

export const activitiesMethods = {
  async loadActividades(force = false) {
    try {
      const actividades = await showLoaderDuring(
        () => actividadesApi.fetchActividades({ loaderMessage: null }),
        ADMIN_LOADER_MESSAGE,
        'solid',
        400
      );

      const lista = Array.isArray(actividades) ? actividades : [];
      this.state.actividades = lista;
      this.state.actividadesIndex = {};
      lista.forEach(item => {
        const id = this.obtenerActividadId(item);
        if (id) {
          this.state.actividadesIndex[id] = item;
        }
      });

      const termino = force ? this.state.actividadesBusqueda : (this.state.actividadesBusqueda || '');
      this.applyActividadFiltro(termino);
      this.mostrarMensajeActividad('Actividades actualizadas desde el backend.', 'info');
    } catch (error) {
      console.error('[ERROR] Error cargando actividades:', error);
      this.state.actividades = [];
      this.state.actividadesIndex = {};
      this.applyActividadFiltro('');
      this.mostrarMensajeActividad('No fue posible cargar las actividades.', 'error');
      mostrarToast('Error al obtener actividades desde el backend.', 'error');
    }
  },

  applyActividadFiltro(termino) {
    const valor = (termino || '').toString();
    const normalized = valor.trim().toLowerCase();
    this.state.actividadesBusqueda = valor;

    let filtradas = [...this.state.actividades];
    if (normalized) {
      filtradas = filtradas.filter(item => {
        const codigo = (this.obtenerActividadCodigo?.(item) || item.codigo || item.codigo_actividad || item.codigoActividad || '').toString().toLowerCase();
        const descripcion = (item.descripcion_actividad || item.descripcion || item.nombre || '').toString().toLowerCase();
        const area = (item.area || item.area_responsable || item.area_id || '').toString().toLowerCase();
        const estado = (item.estado || item.estado_actividad || '').toString().toLowerCase();
        const estadoRevision = (item.estado_revision || item.estadoRevision || '').toString().toLowerCase();
        const responsable = (item.responsable || item.responsable_nombre || item.responsable_correo || '').toString().toLowerCase();
        return codigo.includes(normalized) || descripcion.includes(normalized) || area.includes(normalized) || estado.includes(normalized) || estadoRevision.includes(normalized) || responsable.includes(normalized);
      });
    }

    this.state.actividadesFiltradas = filtradas;
    this.renderActividadesTabla(filtradas);
  },

  renderActividadesTabla(items) {
    const actividadesDom = this.dom.actividades;
    if (!actividadesDom?.tableBody) return;

    actividadesDom.tableBody.innerHTML = '';
    const estadosDisponibles = this.getReviewStates ? this.getReviewStates() : [];

    if (!items || items.length === 0) {
      const fila = document.createElement('tr');
      fila.innerHTML = `
        <td colspan="6" class="px-4 py-6 text-center text-sm text-gray-500">
          No se encontraron actividades registradas.
        </td>
      `;
      actividadesDom.tableBody.appendChild(fila);
    } else {
      const fragment = document.createDocumentFragment();
      items.forEach((item) => {
        const id = this.obtenerActividadId(item);
        const actividadBackendId = item?.actividad_id || item?.id || '';
        const codigo = this.obtenerActividadCodigo?.(item) || this.obtenerActividadId(item) || 'Sin código';
        const descripcion = item.descripcion_actividad || item.descripcion || item.nombre || 'Sin descripción';
        const area = item.area || item.area_responsable || item.area_id || 'Sin área';
        const estadoGeneral = item.estado || item.estado_actividad || '';
        const estadoRevisionCrudo = item.estado_revision || item.estadoRevision || estadoGeneral || 'Sin revisión';
        const estadoRevisionCanonico = this.normalizarEstadoRevision(estadoRevisionCrudo);
        const estadoGeneralCanonico = this.normalizarEstadoActividad
          ? this.normalizarEstadoActividad(estadoGeneral)
          : estadoGeneral;
        const estadoCanonico = (() => {
          if (estadoRevisionCanonico && estadoRevisionCanonico !== 'Sin revisión') {
            return estadoRevisionCanonico;
          }
          if (estadoGeneralCanonico && estadoGeneralCanonico !== 'Sin revisión') {
            const fallback = this.normalizarEstadoRevision(estadoGeneralCanonico);
            if (fallback && estadosDisponibles.includes(fallback)) {
              return fallback;
            }
          }
          return estadoRevisionCanonico || 'Sin revisión';
        })();
        const responsable = item.responsable || item.responsable_nombre || item.responsable_correo || 'Sin responsable';
        const revisor = item.revision_por || item.revisor || '';
        const fechaRevision = item.revision_fecha || item.actualizado_el || '';
        const fechaRevisionTexto = fechaRevision ? this.formatearFecha(fechaRevision) : '';

        const codigoSeguro = this.escapeHtml(codigo);
        const descripcionSegura = this.escapeHtml(descripcion);
        const areaSegura = this.escapeHtml(area);
        const responsableSeguro = this.escapeHtml(responsable);
        const revisorSeguro = this.escapeHtml(revisor);
        const estadoSeleccionable = estadosDisponibles.includes(estadoCanonico) ? estadoCanonico : '';
        const placeholderSelectedAttr = estadoSeleccionable ? '' : 'selected';
        const opcionesSelect = estadosDisponibles
          .map((estadoOpcion) => `<option value="${estadoOpcion}" ${estadoOpcion === estadoCanonico ? 'selected' : ''}>${estadoOpcion}</option>`)
          .join('');
        const revisionDetalle = [
          revisorSeguro ? `Por ${revisorSeguro}` : '',
          fechaRevisionTexto ? fechaRevisionTexto : ''
        ]
          .filter(Boolean)
          .join(' · ');

        const fila = document.createElement('tr');
        fila.dataset.id = id;
        fila.innerHTML = `
          <td class="px-3 py-2 text-left text-sm text-gray-900">
            <div class="font-mono text-xs uppercase tracking-wide text-indigo-600">${codigoSeguro}</div>
          </td>
          <td class="px-3 py-2 text-sm text-gray-900">${descripcionSegura}</td>
          <td class="px-3 py-2 text-sm text-gray-500">${areaSegura}</td>
          <td class="px-3 py-2 text-sm text-gray-500">
            <div class="flex flex-col gap-1">
              <div class="flex flex-wrap items-center gap-2">
                ${this.renderEstadoRevisionBadge(estadoCanonico)}
              </div>
              ${revisionDetalle ? `<div class="text-xs text-slate-400">${revisionDetalle}</div>` : ''}
            </div>
          </td>
          <td class="px-3 py-2 text-sm text-gray-500">${responsableSeguro}</td>
          <td class="px-3 py-2 text-right">
            <div class="flex flex-col items-end gap-2">
              <select class="actividad-estado-select min-w-[170px] rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                data-role="actividad-estado-select"
                data-id="${id}"
                aria-label="Actualizar estado de ${codigoSeguro}">
                <option value="" ${placeholderSelectedAttr}>Actualizar estado…</option>
                ${opcionesSelect}
              </select>
              <div class="flex flex-wrap items-center justify-end gap-2">
                <button type="button" class="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-600 hover:border-indigo-300 hover:text-indigo-600" data-action="edit" data-id="${id}">
                  <span class="material-icons" style="font-size:14px">edit</span>
                  Editar
                </button>
                <button type="button" class="inline-flex items-center gap-1 rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-500 hover:border-red-300 hover:text-red-600" data-action="delete" data-id="${id}">
                  <span class="material-icons" style="font-size:14px">delete</span>
                  Eliminar
                </button>
              </div>
            </div>
          </td>
        `;
        fila.dataset.id = id;
        fila.dataset.codigo = codigo;
        fila.dataset.estadoRevision = estadoCanonico;
        fila.dataset.estadoGeneral = estadoGeneralCanonico || '';
        fila.dataset.responsable = responsable;
        if (actividadBackendId) {
          fila.dataset.actividadId = actividadBackendId;
        }

        const selectorEstado = fila.querySelector('select[data-role="actividad-estado-select"]');
        if (selectorEstado) {
          selectorEstado.value = estadoSeleccionable || '';
          selectorEstado.dataset.currentValue = estadoSeleccionable;
          selectorEstado.dataset.codigo = codigo;
          selectorEstado.dataset.responsable = responsable;
          if (actividadBackendId) {
            selectorEstado.dataset.actividadId = actividadBackendId;
          }
        }

        fragment.appendChild(fila);
      });
      actividadesDom.tableBody.appendChild(fragment);
    }

    if (actividadesDom.summary) {
      const total = this.state.actividades.length;
      const visibles = items ? items.length : 0;
      actividadesDom.summary.textContent = total === visibles
        ? `${total} actividades`
        : `${visibles} de ${total} actividades`;
    }
  },

  async handleActividadesChange(event) {
    const select = event.target?.closest('select[data-role="actividad-estado-select"]');
    if (!select) return;

    const selectedRaw = select.value || '';
    const previousValue = select.dataset.currentValue || '';

    if (!selectedRaw || selectedRaw === previousValue) {
      select.value = previousValue;
      select.dataset.currentValue = previousValue;
      return;
    }

    const actividadKey = select.dataset.id || select.closest('tr[data-id]')?.dataset.id;
    if (!actividadKey) {
      mostrarToast('No se pudo determinar la actividad seleccionada.', 'error');
      select.value = previousValue;
      select.dataset.currentValue = previousValue;
      return;
    }

    const actividad = this.state.actividadesIndex?.[actividadKey];
    if (!actividad) {
      mostrarToast('La actividad seleccionada no se encuentra en la lista actual.', 'warning');
      select.value = previousValue;
      select.dataset.currentValue = previousValue;
      return;
    }

    const actividadBackendId = (select.dataset.actividadId || actividad?.actividad_id || actividad?.id || '').toString().trim();
    if (!actividadBackendId) {
      mostrarToast('La actividad no cuenta con un identificador de registro válido.', 'error');
      select.value = previousValue;
      select.dataset.currentValue = previousValue;
      return;
    }

    const estadoAnterior = this.normalizarEstadoRevision(previousValue);
    const estadoSeleccionado = this.normalizarEstadoRevision(selectedRaw);

    if (estadoSeleccionado === estadoAnterior) {
      select.value = previousValue;
      select.dataset.currentValue = previousValue;
      return;
    }

    const codigoActividad = (select.dataset.codigo || this.obtenerActividadCodigo?.(actividad) || actividadKey || '').toString();
    const responsableActividad = (select.dataset.responsable || actividad.responsable || actividad.responsable_nombre || actividad.responsable_correo || '').toString();

    const requiereComentario = REVIEW_STATES_REQUIRING_MESSAGE.has(estadoSeleccionado);
    const enviaCorreo = REVIEW_STATES_TRIGGER_EMAIL.has(estadoSeleccionado);
    const mensajeEstado = REVIEW_STATE_MESSAGE_TEMPLATES[estadoSeleccionado] || '';

    const descripcionPartes = [];
    if (mensajeEstado) {
      descripcionPartes.push(`<p>${this.escapeHtml(mensajeEstado)}</p>`);
    }

    if (enviaCorreo) {
      const responsableSeguro = responsableActividad ? `<strong>${this.escapeHtml(responsableActividad)}</strong>` : 'el responsable registrado';
      descripcionPartes.push(`<p>Se enviará una notificación a ${responsableSeguro}.</p>`);
    }

    const notaPartes = [
      'El asunto del correo incluirá el código de la actividad y el estado seleccionado.'
    ];
    if (enviaCorreo) {
      notaPartes.push('La notificación se enviará inmediatamente después de confirmar el cambio.');
    }

    const resultadoDialogo = await this.mostrarDialogoEstado({
      titulo: `Actualizar estado de ${codigoActividad}`,
      estado: estadoSeleccionado,
      estadoSecundarioHtml: estadoAnterior ? `Estado actual: ${this.escapeHtml(estadoAnterior)}` : '',
      descripcionHtml: descripcionPartes.join(''),
      notaHtml: notaPartes.map(texto => `<p>${this.escapeHtml(texto)}</p>`).join(''),
      requiereComentario,
      comentarioInicial: actividad.revision_comentarios || '',
      comentarioLabel: requiereComentario ? 'Comentarios requeridos para el responsable' : 'Mensaje adicional (opcional)',
      comentarioPlaceholder: requiereComentario ? 'Describe las correcciones solicitadas…' : 'Puedes agregar detalles adicionales para el responsable…'
    });

    if (!resultadoDialogo) {
      select.value = previousValue;
      select.dataset.currentValue = previousValue;
      return;
    }

    const revisorEmail = this.state?.usuario?.email || obtenerEmailUsuarioActual();
    const payload = {
      actividad_id: actividadBackendId,
      estado_revision: estadoSeleccionado,
      revisor: revisorEmail
    };

    if (resultadoDialogo.comentario) {
      payload.comentarios = resultadoDialogo.comentario;
    }

    const loaderMensaje = `Actualizando estado (${estadoSeleccionado})…`;
    const mensajeExito = `Actividad ${codigoActividad} actualizada (${estadoSeleccionado}).`;

    select.disabled = true;

    try {
      await showLoaderDuring(
        () => actividadesApi.reviewActividad(payload),
        loaderMensaje,
        'solid',
        320
      );

      mostrarToast('Estado de revisión actualizado correctamente.', 'success');
      this.mostrarMensajeActividad(mensajeExito, 'success');
      select.dataset.currentValue = estadoSeleccionado;
      await this.loadActividades(true);
    } catch (error) {
      console.error('[ERROR] handleActividadesChange:', error);
      const mensaje = error?.message || 'No fue posible actualizar el estado de revisión.';
      mostrarToast(mensaje, 'error');
      this.mostrarMensajeActividad(mensaje, 'error');
      select.value = previousValue;
      select.dataset.currentValue = previousValue;
    } finally {
      select.disabled = false;
    }
  },

  handleActividadesClick(event) {
    if (event.target.closest('select[data-role="actividad-estado-select"]')) {
      return;
    }
    const boton = event.target.closest('[data-action]');
    const fila = event.target.closest('tr[data-id]');
    const id = boton?.dataset.id || fila?.dataset.id;
    if (!id) return;

    const actividad = this.state.actividadesIndex[id];
    if (!actividad) {
      mostrarToast('No se encontró la actividad seleccionada.', 'warning');
      return;
    }

    const accion = boton?.dataset.action || 'edit';

    if (accion === 'delete') {
      this.confirmarEliminarActividad(id, actividad);
      return;
    }

    this.mostrarActividadEnFormulario(actividad);
  },

  mostrarActividadEnFormulario(actividad) {
    const actividadDom = this.dom.actividades;
    if (!actividadDom?.inputs) return;

    const codigo = this.obtenerActividadId(actividad);
    if (actividadDom.inputs.id) actividadDom.inputs.id.value = codigo;
    if (actividadDom.inputs.codigo) actividadDom.inputs.codigo.value = codigo;
    if (actividadDom.inputs.estado) actividadDom.inputs.estado.value = actividad.estado || actividad.estado_actividad || '';
    if (actividadDom.inputs.descripcion) actividadDom.inputs.descripcion.value = actividad.descripcion_actividad || actividad.descripcion || actividad.nombre || '';
    if (actividadDom.inputs.meta) actividadDom.inputs.meta.value = actividad.meta || actividad.meta_anual || '';
    if (actividadDom.inputs.responsable) actividadDom.inputs.responsable.value = actividad.responsable || actividad.responsable_nombre || actividad.responsable_correo || '';
    if (actividadDom.inputs.detalle) {
      try {
        actividadDom.inputs.detalle.value = JSON.stringify(actividad, null, 2);
      } catch (error) {
        actividadDom.inputs.detalle.value = '';
      }
    }

    if (actividadDom.formTitle) {
      actividadDom.formTitle.textContent = 'Editar actividad seleccionada';
    }

    this.mostrarMensajeActividad(`Actividad ${codigo || ''} cargada.`, 'info');
    this.desplazarHacia(actividadDom.form || actividadDom.root);
  },

  async confirmarEliminarActividad(id, actividad) {
    try {
      const nombre = actividad?.descripcion_actividad || actividad?.descripcion || actividad?.nombre || id;
      const confirmado = window.confirm(`¿Eliminar la actividad "${nombre}"?`);
      if (!confirmado) return;

      await showLoaderDuring(
        () => actividadesApi.callBackend('actividades/eliminar', { id }, { loaderMessage: null }),
        'Eliminando actividad',
        'solid',
        400
      );

      mostrarToast('Actividad eliminada correctamente.', 'success');
      this.mostrarMensajeActividad('Actividad eliminada correctamente.', 'success');

      if (this.dom.actividades?.inputs?.id && this.dom.actividades.inputs.id.value === id) {
        this.limpiarActividadFormulario();
      }

      await this.loadActividades(true);
    } catch (error) {
      console.error('[ERROR] Error eliminando actividad:', error);
      const mensaje = error?.message || 'No se pudo eliminar la actividad.';
      this.mostrarMensajeActividad(mensaje, 'error');
      mostrarToast(mensaje, 'error');
    }
  },

  limpiarActividadFormulario() {
    const actividadDom = this.dom.actividades;
    if (!actividadDom) return;

    actividadDom.form?.reset?.();
    if (actividadDom.inputs?.detalle) actividadDom.inputs.detalle.value = '';
    if (actividadDom.inputs?.id) actividadDom.inputs.id.value = '';

    if (actividadDom.formTitle) {
      actividadDom.formTitle.textContent = 'Editar actividad seleccionada';
    }

    this.mostrarMensajeActividad('Formulario listo para nuevas consultas.', 'info');
  },

  mostrarMensajeActividad(mensaje, tipo = 'info') {
    const actividadDom = this.dom.actividades;
    if (!actividadDom?.formStatus) return;
    actividadDom.formStatus.textContent = mensaje || '';
    actividadDom.formStatus.dataset.status = tipo;
  }
};
