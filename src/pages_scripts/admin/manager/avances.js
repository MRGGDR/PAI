import actividadesApi from '../../actividades/api.js';
import { mostrarToast, obtenerEmailUsuarioActual } from '../../actividades/utils.js';
import { showLoaderDuring } from '../../../lib/loader.js';
import { ADMIN_LOADER_MESSAGE } from './constants.js';

const REVIEW_STATES_REQUIRING_MESSAGE = new Set(['Corrección']);
const REVIEW_STATES_TRIGGER_EMAIL = new Set(['Corrección', 'En revisión', 'Aprobado', 'Cancelado']);
const REVIEW_STATE_MESSAGE_TEMPLATES = {
  'Sin revisión': 'El avance volverá al estado inicial sin notificar cambios al responsable.',
  'En revisión': 'El avance quedará en revisión mientras el equipo administrador valida la información.',
  'Aprobado': 'El avance será aprobado. Gracias por mantener los reportes actualizados.',
  'Corrección': 'Se solicitarán correcciones sobre el avance registrado. Detalla los ajustes necesarios para el responsable.',
  'Cancelado': 'El avance se marcará como cancelado y no requerirá acciones adicionales.'
};

export const avancesMethods = {
  async loadAvances(force = false) {
    try {
      const respuesta = await showLoaderDuring(
        () => actividadesApi.callBackend('avances/obtener', {}, { loaderMessage: null }),
        ADMIN_LOADER_MESSAGE,
        'solid',
        400
      );

      const lista = respuesta && Array.isArray(respuesta.data)
        ? respuesta.data
        : Array.isArray(respuesta)
          ? respuesta
          : Array.isArray(respuesta?.items)
            ? respuesta.items
            : [];

      this.state.avances = lista;
      this.state.avancesIndex = {};
      lista.forEach(item => {
        const id = this.obtenerAvanceId(item);
        if (id) {
          this.state.avancesIndex[id] = item;
        }
      });

      const termino = force ? this.state.avancesBusqueda : (this.state.avancesBusqueda || '');
      this.applyAvanceFiltro(termino);
      this.mostrarMensajeAvance('Avances actualizados desde el backend.', 'info');
    } catch (error) {
      console.error('[ERROR] Error cargando avances:', error);
      this.state.avances = [];
      this.state.avancesIndex = {};
      this.applyAvanceFiltro('');
      this.mostrarMensajeAvance('No fue posible cargar los avances.', 'error');
      mostrarToast('Error al obtener avances desde el backend.', 'error');
    }
  },

  applyAvanceFiltro(termino) {
    const valor = (termino || '').toString();
    const normalized = valor.trim().toLowerCase();
    this.state.avancesBusqueda = valor;

    let filtrados = [...this.state.avances];
    if (normalized) {
      filtrados = filtrados.filter(item => {
        const codigoActividad = (this.obtenerActividadCodigo?.(item) || item.actividad_codigo || item.codigo || '').toString().toLowerCase();
        const actividad = (item.actividad_id || item.actividad || '').toString().toLowerCase();
        const bimestre = (item.bimestre_id || item.bimestre || '').toString().toLowerCase();
        const responsable = (item.reportado_por || '').toString().toLowerCase();
        const estadoRevision = (item.estado_revision || item.estadoRevision || '').toString().toLowerCase();
        return codigoActividad.includes(normalized) || actividad.includes(normalized) || bimestre.includes(normalized) || responsable.includes(normalized) || estadoRevision.includes(normalized);
      });
    }

    this.state.avancesFiltrados = filtrados;
    this.renderAvancesTabla(filtrados);
  },

  renderAvancesTabla(items) {
    const avancesDom = this.dom.avances;
    if (!avancesDom?.tableBody) return;

    avancesDom.tableBody.innerHTML = '';

    if (!items || items.length === 0) {
      const fila = document.createElement('tr');
      fila.innerHTML = `
        <td colspan="7" class="px-4 py-6 text-center text-sm text-gray-500">
          No se encontraron registros de avance.
        </td>
      `;
      avancesDom.tableBody.appendChild(fila);
    } else {
      const fragment = document.createDocumentFragment();
      items.forEach(item => {
        const id = this.obtenerAvanceId(item);
        let actividad = item.actividad || item.actividad_nombre || item.actividad_id || 'Sin actividad';
        if (actividad && typeof actividad === 'object') {
          actividad = actividad.descripcion_actividad || actividad.descripcion || actividad.nombre || actividad.titulo || actividad.label || actividad.id || actividad.codigo || 'Sin actividad';
        }
        actividad = actividad || 'Sin actividad';
        const codigoActividad = (this.obtenerActividadCodigo?.(item) || item.actividad_codigo || item.codigo || '').toString().trim();
        const bimestre = item.bimestre_nombre || item.bimestre_id || item.bimestre || 'Sin bimestre';
        const responsable = item.reportado_por || item.responsable || 'Sin responsable';
        const estadoRevisionRaw = item.estado_revision || item.estadoRevision || 'Sin revisión';
        const estadoRevision = this.normalizarEstadoRevision ? this.normalizarEstadoRevision(estadoRevisionRaw) : estadoRevisionRaw;
        const estadoHtml = this.renderEstadoRevisionBadge(estadoRevision);
        const fecha = item.fecha_reporte ? this.formatearFecha(item.fecha_reporte) : 'Sin fecha';

        const fila = document.createElement('tr');
        fila.dataset.id = id;
        fila.dataset.codigo = codigoActividad || '';
        fila.dataset.bimestre = bimestre || '';
        fila.dataset.estadoRevision = estadoRevision || '';

        const codigoSafe = this.escapeHtml(codigoActividad || actividad || 'Sin código');
        const actividadSafe = this.escapeHtml(actividad);
        const bimestreSafe = this.escapeHtml(bimestre || 'Sin bimestre');
        const responsableSafe = this.escapeHtml(responsable || 'Sin responsable');
        const fechaSafe = this.escapeHtml(fecha || 'Sin fecha');
        const idSafe = this.escapeHtml(id || 'N/A');

        fila.innerHTML = `
          <td class="px-3 py-2 text-left text-sm font-mono text-gray-700">${idSafe}</td>
          <td class="px-3 py-2 text-sm text-gray-900">
            <div class="font-mono text-xs uppercase tracking-wide text-indigo-600">${codigoSafe}</div>
          </td>
          <td class="px-3 py-2 text-sm text-gray-900">${actividadSafe}</td>
          <td class="px-3 py-2 text-sm text-gray-500">
            <div>${bimestreSafe}</div>
            <div class="mt-1">${estadoHtml}</div>
          </td>
          <td class="px-3 py-2 text-sm text-gray-500">${responsableSafe}</td>
          <td class="px-3 py-2 text-sm text-gray-500">${fechaSafe}</td>
          <td class="px-3 py-2 text-right">
            <div class="flex justify-end gap-2">
              <button type="button" class="inline-flex items-center gap-1 rounded-md border border-green-200 px-2 py-1 text-xs font-medium text-green-600 hover:border-green-300 hover:text-green-700" data-action="approve" data-id="${id}">
                <span class="material-icons" style="font-size:14px">check_circle</span>
                Aprobar
              </button>
              <button type="button" class="inline-flex items-center gap-1 rounded-md border border-amber-200 px-2 py-1 text-xs font-medium text-amber-600 hover:border-amber-300 hover:text-amber-700" data-action="mark-review" data-id="${id}">
                <span class="material-icons" style="font-size:14px">pending</span>
                En revisión
              </button>
              <button type="button" class="inline-flex items-center gap-1 rounded-md border border-orange-200 px-2 py-1 text-xs font-medium text-orange-600 hover:border-orange-300 hover:text-orange-700" data-action="request-changes" data-id="${id}">
                <span class="material-icons" style="font-size:14px">edit_note</span>
                Corrección
              </button>
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

      avancesDom.tableBody.appendChild(fragment);
    }

    if (avancesDom.summary) {
      const total = this.state.avances.length;
      const visibles = items ? items.length : 0;
      avancesDom.summary.textContent = total === visibles
        ? `${total} registros`
        : `${visibles} de ${total} registros`;
    }
  },

  handleAvancesClick(event) {
    const boton = event.target.closest('[data-action]');
    const fila = event.target.closest('tr[data-id]');
    const id = boton?.dataset.id || fila?.dataset.id;
    if (!id) return;

    const avance = this.state.avancesIndex[id];
    if (!avance) {
      mostrarToast('No se encontró el avance seleccionado.', 'warning');
      return;
    }

    const accion = boton?.dataset.action || 'edit';

    if (accion === 'delete') {
      this.confirmarEliminarAvance(id, avance);
      return;
    }

    if (['approve', 'mark-review', 'request-changes'].includes(accion)) {
      this.procesarAccionRevisionAvance(accion, avance);
      return;
    }

    this.mostrarAvanceEnFormulario(avance);
  },

  async procesarAccionRevisionAvance(accion, avance) {
    const avanceId = this.obtenerAvanceId(avance);
    if (!avanceId) {
      mostrarToast('No se pudo determinar el ID del avance.', 'error');
      return;
    }

    const estadoObjetivo = {
      approve: 'Aprobado',
      'mark-review': 'En revisión',
      'request-changes': 'Corrección'
    }[accion];

    if (!estadoObjetivo) {
      return;
    }

    const estadoSeleccionado = this.normalizarEstadoRevision ? this.normalizarEstadoRevision(estadoObjetivo) : estadoObjetivo;
    const estadoActual = this.normalizarEstadoRevision
      ? this.normalizarEstadoRevision(avance?.estado_revision || avance?.estadoRevision || 'Sin revisión')
      : (avance?.estado_revision || avance?.estadoRevision || 'Sin revisión');

    const requiereComentario = REVIEW_STATES_REQUIRING_MESSAGE.has(estadoSeleccionado);
    const enviaCorreo = REVIEW_STATES_TRIGGER_EMAIL.has(estadoSeleccionado);
    const mensajeEstado = REVIEW_STATE_MESSAGE_TEMPLATES[estadoSeleccionado] || '';

    const codigoActividad = this.obtenerActividadCodigo?.(avance) || avance.actividad_codigo || avance.codigo || '';
    const bimestre = avance.bimestre_nombre || avance.bimestre || avance.bimestre_id || '';
    const responsable = avance.reportado_por || avance.responsable || '';
    const referencia = [codigoActividad, bimestre].filter(Boolean).join(' · ') || avanceId;

    const descripcionPartes = [];
    if (mensajeEstado) {
      descripcionPartes.push(`<p>${this.escapeHtml(mensajeEstado)}</p>`);
    }
    if (enviaCorreo) {
      const destinatario = responsable
        ? `<strong>${this.escapeHtml(responsable)}</strong>`
        : 'el responsable registrado';
      descripcionPartes.push(`<p>Se enviará una notificación a ${destinatario} con el resumen del cambio.</p>`);
    }

    const notaPartes = [];
    notaPartes.push('<p>El asunto del correo incluirá el código de la actividad y el bimestre reportado.</p>');
    if (enviaCorreo) {
      notaPartes.push('<p>La notificación se enviará inmediatamente después de confirmar el cambio.</p>');
    }

    const resultadoDialogo = await this.mostrarDialogoEstado({
      titulo: `Actualizar avance ${referencia}`,
      estado: estadoSeleccionado,
      estadoSecundarioHtml: estadoActual ? `Estado actual: ${this.escapeHtml(estadoActual)}` : '',
      descripcionHtml: descripcionPartes.join(''),
      notaHtml: notaPartes.join(''),
      requiereComentario,
      comentarioInicial: avance?.revision_comentarios || '',
      comentarioLabel: requiereComentario ? 'Observaciones para el responsable' : 'Mensaje adicional (opcional)',
      comentarioPlaceholder: requiereComentario ? 'Describe las correcciones solicitadas...' : 'Puedes agregar detalles adicionales para el responsable...',
      autoFocus: true,
      colocarCursorAlFinal: true
    });

    if (!resultadoDialogo) {
      return;
    }

    const revisor = this.state?.usuario?.email || obtenerEmailUsuarioActual();
    const payload = {
      avance_id: avanceId,
      estado_revision: estadoSeleccionado,
      revisor
    };

    if (resultadoDialogo.comentario) {
      payload.comentarios = resultadoDialogo.comentario;
    }

    const loaderMensaje = `Actualizando avance (${estadoSeleccionado})...`;
    const mensajeExito = `Avance ${referencia} actualizado (${estadoSeleccionado}).`;

    try {
      await showLoaderDuring(
        () => actividadesApi.reviewAvance(payload),
        loaderMensaje,
        'solid',
        300
      );

      mostrarToast('Estado de revisión del avance actualizado.', 'success');
      this.mostrarMensajeAvance(mensajeExito, 'success');
      await this.loadAvances(true);
    } catch (error) {
      console.error('[ERROR] procesarAccionRevisionAvance:', error);
      const mensaje = error?.message || 'No fue posible actualizar el estado de revisión.';
      mostrarToast(mensaje, 'error');
      this.mostrarMensajeAvance(mensaje, 'error');
    }
  },

  mostrarAvanceEnFormulario(avance) {
    const avancesDom = this.dom.avances;
    if (!avancesDom?.inputs) return;

    const id = this.obtenerAvanceId(avance);
    if (avancesDom.inputs.id) avancesDom.inputs.id.value = id;
    if (avancesDom.inputs.actividad) avancesDom.inputs.actividad.value = avance.actividad_id || avance.actividad || '';
    if (avancesDom.inputs.bimestre) avancesDom.inputs.bimestre.value = avance.bimestre_id || avance.bimestre || '';
    if (avancesDom.inputs.fecha) avancesDom.inputs.fecha.value = this.formatearFechaISO(avance.fecha_reporte);
    if (avancesDom.inputs.reportado) avancesDom.inputs.reportado.value = avance.reportado_por || '';
    if (avancesDom.inputs.detalle) {
      try {
        avancesDom.inputs.detalle.value = JSON.stringify(avance, null, 2);
      } catch (error) {
        avancesDom.inputs.detalle.value = '';
      }
    }

    if (avancesDom.formTitle) {
      avancesDom.formTitle.textContent = 'Editar avance seleccionado';
    }

    this.mostrarMensajeAvance(`Avance ${id || ''} cargado.`, 'info');
    this.desplazarHacia(avancesDom.form || avancesDom.root);
  },

  async confirmarEliminarAvance(id, avance) {
    try {
      const referencia = avance?.actividad_id || avance?.actividad || id;
      const confirmado = window.confirm(`¿Eliminar el avance asociado a "${referencia}"?`);
      if (!confirmado) return;

      await showLoaderDuring(
        () => actividadesApi.callBackend('avances/eliminar', { id }, { loaderMessage: null }),
        'Eliminando avance',
        'solid',
        400
      );

      mostrarToast('Avance eliminado correctamente.', 'success');
      this.mostrarMensajeAvance('Avance eliminado correctamente.', 'success');

      if (this.dom.avances?.inputs?.id && this.dom.avances.inputs.id.value === id) {
        this.limpiarAvanceFormulario();
      }

      await this.loadAvances(true);
    } catch (error) {
      console.error('[ERROR] Error eliminando avance:', error);
      const mensaje = error?.message || 'No se pudo eliminar el avance.';
      this.mostrarMensajeAvance(mensaje, 'error');
      mostrarToast(mensaje, 'error');
    }
  },

  limpiarAvanceFormulario() {
    const avancesDom = this.dom.avances;
    if (!avancesDom) return;

    avancesDom.form?.reset?.();
    if (avancesDom.inputs?.detalle) avancesDom.inputs.detalle.value = '';
    if (avancesDom.inputs?.id) avancesDom.inputs.id.value = '';

    if (avancesDom.formTitle) {
      avancesDom.formTitle.textContent = 'Editar avance seleccionado';
    }

    this.mostrarMensajeAvance('Formulario listo para nuevas consultas.', 'info');
  },

  mostrarMensajeAvance(mensaje, tipo = 'info') {
    const avancesDom = this.dom.avances;
    if (!avancesDom?.formStatus) return;
    avancesDom.formStatus.textContent = mensaje || '';
    avancesDom.formStatus.dataset.status = tipo;
  }
};
