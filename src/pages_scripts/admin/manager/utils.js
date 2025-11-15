import {
  normalizarEstadoRevision as normalizarEstadoRevisionFront,
  obtenerConfigEstadoRevision as obtenerConfigEstadoRevisionFront,
  obtenerClaseEstadoRevision as obtenerClaseEstadoRevisionFront,
  normalizarEstadoActividad as normalizarEstadoActividadFront,
  obtenerConfigEstadoActividad as obtenerConfigEstadoActividadFront,
  obtenerClaseEstadoActividad as obtenerClaseEstadoActividadFront,
  ESTADOS_REVISION,
  ESTADOS_ACTIVIDAD
} from '../../actividades/utils.js';

export const utilsMethods = {
  parseBoolean(value) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') {
      return ['true', 'TRUE', '1', 'activo', 'ACTIVO', 'yes', 'si', 'SI'].includes(value.trim());
    }
    return false;
  },

  escapeHtml(valor) {
    if (valor === null || valor === undefined) {
      return '';
    }

    return valor
      .toString()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  getReviewStates() {
    return ESTADOS_REVISION.slice();
  },

  getActivityStates() {
    return ESTADOS_ACTIVIDAD.slice();
  },

  normalizarEstadoRevision(valor) {
    return normalizarEstadoRevisionFront(valor);
  },

  normalizarEstadoActividad(valor) {
    return normalizarEstadoActividadFront(valor);
  },

  obtenerConfigEstadoRevision(estado) {
    return obtenerConfigEstadoRevisionFront(estado);
  },

  obtenerConfigEstadoActividad(estado) {
    return obtenerConfigEstadoActividadFront(estado);
  },

  obtenerClaseEstadoRevision(estado, variante = 'badge') {
    return obtenerClaseEstadoRevisionFront(estado, variante);
  },

  obtenerClaseEstadoActividad(estado, variante = 'badge') {
    return obtenerClaseEstadoActividadFront(estado, variante);
  },

  obtenerActividadId(actividad) {
    if (!actividad || typeof actividad !== 'object') return '';

    const posibles = [
      actividad.id,
      actividad.actividad_id,
      actividad.actividadId,
      actividad.codigo,
      actividad.codigo_actividad,
      actividad.codigoActividad,
      actividad.numero,
      actividad.secuencial
    ]
      .filter(valor => valor !== undefined && valor !== null)
      .map(valor => valor.toString().trim())
      .filter(Boolean);

    if (posibles.length > 0) {
      return posibles[0];
    }

    if (actividad.descripcion_actividad) {
      return actividad.descripcion_actividad.toString().trim().slice(0, 50);
    }

    return '';
  },

  obtenerAvanceId(avance) {
    if (!avance || typeof avance !== 'object') return '';

    const posibles = [
      avance.id,
      avance.avance_id,
      avance.registro_id,
      avance.codigo,
      avance.codigo_avance,
      avance.codigoAvance
    ]
      .filter(valor => valor !== undefined && valor !== null)
      .map(valor => valor.toString().trim())
      .filter(Boolean);

    if (posibles.length > 0) {
      return posibles[0];
    }

    const actividad = avance.actividad_id || avance.actividad;
    const bimestre = avance.bimestre_id || avance.bimestre;
    if (actividad || bimestre) {
      return [actividad, bimestre]
        .filter(Boolean)
        .map(valor => valor.toString().trim())
        .join('-');
    }

    return '';
  },

  obtenerActividadCodigo(registro) {
    if (!registro || typeof registro !== 'object') return '';

    const candidatos = [
      registro.codigo,
      registro.codigo_actividad,
      registro.codigoActividad,
      registro.actividad_codigo,
      registro.actividadCodigo,
      registro.actividad_codigo_formateado,
      registro.actividad_codigo_pai,
      registro.actividad_codigoPai,
      registro.codigo_pai,
      registro.codigoPai
    ];

    if (registro.actividad && typeof registro.actividad === 'object') {
      candidatos.push(
        registro.actividad.codigo,
        registro.actividad.codigo_actividad,
        registro.actividad.codigoActividad,
        registro.actividad.actividad_codigo
      );
    }

    const valores = candidatos
      .filter(valor => valor !== undefined && valor !== null)
      .map(valor => valor.toString().trim())
      .filter(Boolean);

    if (valores.length > 0) {
      return valores[0];
    }

    if (typeof this.obtenerActividadId === 'function') {
      return this.obtenerActividadId(registro);
    }

    return '';
  },

  formatearFechaISO(valor) {
    if (!valor) return '';
    try {
      const date = valor instanceof Date ? valor : new Date(valor);
      if (Number.isNaN(date.getTime())) return '';
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch (error) {
      return '';
    }
  },

  renderEstadoRevisionBadge(estado) {
    const canonical = this.normalizarEstadoRevision ? this.normalizarEstadoRevision(estado) : normalizarEstadoRevisionFront(estado);
    const clases = this.obtenerClaseEstadoRevision
      ? this.obtenerClaseEstadoRevision(canonical, 'badge')
      : obtenerClaseEstadoRevisionFront(canonical, 'badge');

    return `<span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${clases}">${canonical || 'Sin revisión'}</span>`;
  },

  renderEstadoActividadBadge(estado) {
    if (!estado) return '';
    const canonical = this.normalizarEstadoActividad
      ? this.normalizarEstadoActividad(estado)
      : normalizarEstadoActividadFront(estado);
    if (!canonical) return '';
    const clases = this.obtenerClaseEstadoActividad
      ? this.obtenerClaseEstadoActividad(canonical, 'badge')
      : obtenerClaseEstadoActividadFront(canonical, 'badge');
    return `<span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${clases}">${canonical}</span>`;
  },

  ensureEstadoDialog() {
    if (this._estadoDialog && this._estadoDialogRefs) {
      return this._estadoDialog;
    }

    if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
      return null;
    }

    const wrapper = document.createElement('div');
    wrapper.id = 'admin-status-dialog';
    wrapper.className = 'fixed inset-0 z-[60] hidden items-center justify-center px-4 py-8 sm:px-6';
    wrapper.innerHTML = `
      <div data-role="overlay" class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"></div>
      <div data-role="panel" class="relative z-10 w-full max-w-xl px-0">
        <div class="mx-auto overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-slate-900/10" role="dialog" aria-modal="true" aria-labelledby="admin-status-dialog-title">
          <div class="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
            <div>
              <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Actualización de estado</p>
              <h3 id="admin-status-dialog-title" data-role="title" class="text-lg font-semibold text-slate-900">Actualizar estado</h3>
            </div>
            <button type="button" data-action="close" class="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600" aria-label="Cerrar">
              <span class="material-icons" style="font-size:20px">close</span>
            </button>
          </div>
          <div class="space-y-4 px-6 py-5">
            <div class="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <div data-role="estado" class="text-sm font-semibold text-slate-700"></div>
              <div data-role="description" class="mt-1 text-sm text-slate-600 leading-relaxed"></div>
            </div>
            <div data-role="note" class="text-xs text-slate-500"></div>
            <div class="space-y-2">
              <label data-role="textarea-label" for="admin-status-dialog-message" class="text-sm font-medium text-slate-700">Mensaje adicional (opcional)</label>
              <textarea data-role="textarea" id="admin-status-dialog-message" rows="4" class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"></textarea>
              <p class="text-xs text-slate-500">Se incluirá en el correo enviado al responsable.</p>
            </div>
          </div>
          <div class="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
            <button type="button" data-action="cancel" class="inline-flex items-center justify-center rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-700">Cancelar</button>
            <button type="button" data-action="confirm" class="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1">Confirmar</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(wrapper);

    const refs = {
      wrapper,
      overlay: wrapper.querySelector('[data-role="overlay"]'),
      panel: wrapper.querySelector('[data-role="panel"]'),
      title: wrapper.querySelector('[data-role="title"]'),
      estado: wrapper.querySelector('[data-role="estado"]'),
      description: wrapper.querySelector('[data-role="description"]'),
      note: wrapper.querySelector('[data-role="note"]'),
      textarea: wrapper.querySelector('[data-role="textarea"]'),
      textareaLabel: wrapper.querySelector('[data-role="textarea-label"]'),
      confirm: wrapper.querySelector('[data-action="confirm"]'),
      cancel: wrapper.querySelector('[data-action="cancel"]'),
      close: wrapper.querySelector('[data-action="close"]')
    };

    if (refs.textarea) {
      refs.textarea.addEventListener('input', () => {
        refs.textarea.classList.remove('ring-rose-400', 'ring-2', 'ring-offset-1');
      });
    }

    this._estadoDialog = wrapper;
    this._estadoDialogRefs = refs;
    return wrapper;
  },

  mostrarDialogoEstado(config = {}) {
    return new Promise((resolve) => {
      const modal = this.ensureEstadoDialog();
      if (!modal || !this._estadoDialogRefs) {
        resolve(null);
        return;
      }

      const refs = this._estadoDialogRefs;
      const estadoCanonico = this.normalizarEstadoRevision(config.estado || 'Sin revisión');
      const badgeClases = this.obtenerClaseEstadoRevision(estadoCanonico, 'badge');
      const estadoHtml = `<span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${badgeClases}">${estadoCanonico}</span>`;

      refs.title.textContent = config.titulo || 'Actualizar estado';
      refs.estado.innerHTML = `<div class="flex flex-col gap-2 text-sm text-slate-700">${estadoHtml}${config.estadoSecundarioHtml ? `<div class="text-xs text-slate-500">${config.estadoSecundarioHtml}</div>` : ''}</div>`;
      refs.description.innerHTML = config.descripcionHtml || '';
      refs.note.innerHTML = config.notaHtml || '';
      refs.textarea.value = config.comentarioInicial || '';
      refs.textarea.placeholder = config.comentarioPlaceholder || '';
      refs.textarea.required = !!config.requiereComentario;
      refs.textarea.disabled = !!config.textoSoloLectura;
      refs.textarea.classList.remove('ring-rose-400', 'ring-2', 'ring-offset-1');
      if (refs.textareaLabel) {
        refs.textareaLabel.textContent = config.comentarioLabel || 'Mensaje para el responsable (opcional)';
      }

      if (typeof document !== 'undefined' && document.body) {
        document.body.classList.add('overflow-hidden');
      }
      modal.classList.remove('hidden');
      modal.classList.add('flex');

      let resolved = false;

      const cleanup = () => {
        if (!this._estadoDialogRefs) return;
        this._estadoDialogRefs.confirm.onclick = null;
        this._estadoDialogRefs.cancel.onclick = null;
        this._estadoDialogRefs.close.onclick = null;
        this._estadoDialogRefs.overlay.onclick = null;
        modal.onkeydown = null;
        this._estadoDialogRefs.textarea.disabled = false;
      };

      const resolver = (resultado) => {
        if (resolved) return;
        resolved = true;
        cleanup();
        this.ocultarDialogoEstado();
        resolve(resultado);
      };

      const handleCancel = (event) => {
        if (event) event.preventDefault();
        resolver(null);
      };

      refs.confirm.onclick = (event) => {
        event.preventDefault();
        const comentario = refs.textarea.value.trim();
        if (refs.textarea.required && !comentario) {
          refs.textarea.focus();
          refs.textarea.classList.add('ring-rose-400', 'ring-2', 'ring-offset-1');
          return;
        }

        resolver({
          comentario,
          comentarioRaw: refs.textarea.value,
          estado: estadoCanonico
        });
      };

      refs.cancel.onclick = handleCancel;
      refs.close.onclick = handleCancel;
      refs.overlay.onclick = handleCancel;

      modal.onkeydown = (event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          handleCancel(event);
        }
      };

      if (config.autoFocus !== false) {
        window.requestAnimationFrame(() => {
          try {
            refs.textarea.focus();
            if (config.colocarCursorAlFinal) {
              const valor = refs.textarea.value;
              refs.textarea.setSelectionRange(valor.length, valor.length);
            }
          } catch (error) {
            // Ignorar errores de focus.
          }
        });
      }
    });
  },

  ocultarDialogoEstado() {
    if (!this._estadoDialog) return;
    this._estadoDialog.classList.remove('flex');
    this._estadoDialog.classList.add('hidden');
    this._estadoDialog.onkeydown = null;
    if (typeof document !== 'undefined' && document.body) {
      document.body.classList.remove('overflow-hidden');
    }
  },

  desplazarHacia(elemento) {
    if (!elemento) return;

    let target = null;
    if (elemento instanceof Element) {
      target = elemento;
    } else if (typeof elemento === 'string' && typeof document !== 'undefined') {
      target = document.querySelector(elemento);
    }

    if (!target) {
      target = elemento?.current || null;
    }

    try {
      if (target && typeof target.closest === 'function') {
        const detailsParent = target.closest('details');
        if (detailsParent && !detailsParent.open) {
          detailsParent.open = true;
        }
      }
    } catch (error) {
      // Ignorar errores al manipular detalles
    }

    try {
      if (target?.scrollIntoView) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    } catch (error) {
      // Ignorar errores del scrollIntoView
    }

    try {
      const rect = target?.getBoundingClientRect?.();
      if (rect) {
        const top = rect.top + window.scrollY - 80;
        window.scrollTo({ top: top >= 0 ? top : 0, behavior: 'smooth' });
      }
    } catch (error) {
      // Ignorar errores de scroll manual
    }
  },

  formatearFecha(valor, opciones = {}) {
    if (!valor) return '';
    try {
      const date = valor instanceof Date ? valor : new Date(valor);
      if (Number.isNaN(date.getTime())) return '';
      const { includeTime = true } = opciones;
      const formato = {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      };

      if (includeTime) {
        formato.hour = '2-digit';
        formato.minute = '2-digit';
      }

      return date.toLocaleString('es-CO', formato);
    } catch (error) {
      return '';
    }
  }
};
