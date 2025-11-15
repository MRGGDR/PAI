import { BIMESTRES_CONFIG } from './constants.js';

function inicializarBimestresSection() {
  if (this.bimestresUI.initialized) return;

  this.bimestresUI.totalElement = document.getElementById('bimestres-total');
  this.bimestresUI.presupuestoElement = document.getElementById('bimestres-presupuesto-total');
  this.bimestresUI.diffElement = document.getElementById('bimestres-diff');
  this.bimestresUI.feedbackElement = document.getElementById('bimestres-feedback');
  this.bimestresUI.metaTotalElement = document.getElementById('bimestres-meta-total');
  this.bimestresUI.metaDistribuidaElement = document.getElementById('bimestres-meta-distribuida');
  this.bimestresUI.metaDiffElement = document.getElementById('bimestres-meta-diff');
  this.bimestresUI.metaFeedbackElement = document.getElementById('bimestres-meta-feedback');
  this.bimestresUI.inputs = [];

  this.bimestresConfig.forEach(config => {
    const presupuestoInput = document.getElementById(`bimestre-presupuesto-${config.index}`);
    const metaInput = document.getElementById(`bimestre-meta-${config.index}`);
    const descripcionInput = document.getElementById(`bimestre-descripcion-${config.index}`);
    const descripcionFeedback = document.getElementById(`bimestre-descripcion-feedback-${config.index}`);

    if (presupuestoInput) {
      presupuestoInput.dataset.bimestreIndex = String(config.index);
      presupuestoInput.addEventListener('input', () => this.actualizarResumenBimestres());
      presupuestoInput.addEventListener('change', () => this.actualizarResumenBimestres());
    }

    if (metaInput) {
      metaInput.dataset.bimestreIndex = String(config.index);
      metaInput.addEventListener('input', () => this.actualizarResumenBimestres());
      metaInput.addEventListener('change', () => this.actualizarResumenBimestres());
    }

    if (descripcionInput) {
      descripcionInput.dataset.bimestreIndex = String(config.index);
      descripcionInput.addEventListener('input', () => this.actualizarResumenBimestres());
      descripcionInput.addEventListener('blur', () => this.actualizarResumenBimestres());
    }

    this.bimestresUI.inputs.push({
      index: config.index,
      presupuesto: presupuestoInput,
      meta: metaInput,
      descripcion: descripcionInput,
      descripcionFeedback
    });
  });

  const presupuestoProgramadoInput = document.getElementById('presupuesto_programado');
  if (presupuestoProgramadoInput) {
    presupuestoProgramadoInput.addEventListener('input', () => this.actualizarResumenBimestres());
    presupuestoProgramadoInput.addEventListener('change', () => this.actualizarResumenBimestres());
  }

  const metaIndicadorInput = document.getElementById('meta_indicador_valor');
  if (metaIndicadorInput) {
    metaIndicadorInput.addEventListener('input', () => this.actualizarResumenBimestres());
    metaIndicadorInput.addEventListener('change', () => this.actualizarResumenBimestres());
  }

  this.bimestresUI.initialized = true;
  this.resetBimestresSection();
  this.actualizarResumenBimestres();
}

function resetBimestresSection() {
  if (!this.bimestresUI?.inputs) return;
  this.bimestresUI.inputs.forEach(({ presupuesto, meta, descripcion, descripcionFeedback }) => {
    if (presupuesto) presupuesto.value = '';
    if (meta) meta.value = '';
    if (descripcion) descripcion.value = '';
    if (descripcionFeedback) {
      descripcionFeedback.textContent = '';
      descripcionFeedback.className = 'mt-1 hidden text-xs font-semibold';
    }
  });
  if (typeof this.resetAreaBudgetSummary === 'function') {
    this.resetAreaBudgetSummary();
  }
  this.actualizarResumenBimestres();
}

function resolverIndiceBimestre(descriptor = '') {
  if (!descriptor) return null;
  const normalizado = descriptor.toString().trim().toLowerCase();
  const coincidencia = this.bimestresConfig.find(cfg => {
    const value = cfg.value.toLowerCase();
    const periodo = cfg.periodo.toLowerCase();
    const label = cfg.label.toLowerCase();
    return value === normalizado || periodo === normalizado || label === normalizado;
  });
  return coincidencia ? coincidencia.index : null;
}

function setValoresBimestres(bimestres = []) {
  if (!this.bimestresUI?.inputs) return;
  const mapa = new Map();

  if (Array.isArray(bimestres)) {
    bimestres.forEach(item => {
      if (!item) return;
      let idx = Number(item.index);
      if (Number.isNaN(idx)) {
        idx = this.resolverIndiceBimestre(item.bimestre || item.periodo || item.label);
      }
      if (idx >= 1 && idx <= this.bimestresConfig.length) {
        mapa.set(idx, item);
      }
    });
  }

  this.bimestresUI.inputs.forEach(({ index, presupuesto, meta, descripcion }) => {
    const data = mapa.get(index) || {};
    if (presupuesto) {
      const valor = data.presupuesto !== undefined && data.presupuesto !== null ? Number(data.presupuesto) : '';
      presupuesto.value = Number.isFinite(valor) ? valor : '';
    }
    if (meta) {
      const metaValor = data.meta !== undefined && data.meta !== null ? Number(data.meta) : '';
      meta.value = Number.isFinite(metaValor) ? metaValor : '';
    }
    if (descripcion) {
      const descripcionValor = data.descripcion !== undefined && data.descripcion !== null
        ? data.descripcion
        : (data.detalle || data.descripcion_detalle || data.desglose || '');
      descripcion.value = descripcionValor ? descripcionValor.toString() : '';
    }
  });

  this.actualizarResumenBimestres();
}

function extraerCantidadesDescripcion(texto) {
  if (!texto) return [];
  const base = texto.toString();
  const coincidencias = base.match(/\d+(?:[.,]\d+)?/g);
  if (!coincidencias) return [];
  return coincidencias
    .map(valor => Number(valor.replace(/\./g, '').replace(/,/g, '.')))
    .filter(numero => !Number.isNaN(numero) && Number.isFinite(numero) && numero >= 0)
    .map(numero => Math.round(numero * 100) / 100);
}

function sumarCantidadesDescripcion(texto) {
  const cantidades = extraerCantidadesDescripcion(texto);
  if (!cantidades.length) {
    return 0;
  }
  const total = cantidades.reduce((acc, numero) => acc + numero, 0);
  return Math.round(total * 100) / 100;
}

function obtenerBimestresFormulario() {
  return this.bimestresConfig.map(config => {
    const presupuestoInput = document.getElementById(`bimestre-presupuesto-${config.index}`);
    const metaInput = document.getElementById(`bimestre-meta-${config.index}`);
    const descripcionInput = document.getElementById(`bimestre-descripcion-${config.index}`);
    const valor = presupuestoInput ? Number(presupuestoInput.value || 0) : 0;
    const metaValor = metaInput ? Number(metaInput.value || 0) : 0;
    const descripcionValor = descripcionInput ? descripcionInput.value || '' : '';
    const descripcion = typeof descripcionValor === 'string'
      ? descripcionValor.replace(/\r\n/g, '\n').trim()
      : '';
    const descripcionCantidadTotal = sumarCantidadesDescripcion(descripcion);
    return {
      index: config.index,
      bimestre: config.value,
      presupuesto: Number.isFinite(valor) ? valor : 0,
      meta: Number.isFinite(metaValor) ? metaValor : 0,
      descripcion: descripcion,
      descripcionCantidadTotal
    };
  });
}

function actualizarResumenBimestres() {
  if (!this.bimestresUI?.inputs) return;

  const presupuestoInput = document.getElementById('presupuesto_programado');
  const presupuestoTotal = presupuestoInput ? Number(presupuestoInput.value || 0) : 0;
  const metaIndicadorInput = document.getElementById('meta_indicador_valor');
  const metaTotal = metaIndicadorInput ? Number(metaIndicadorInput.value || 0) : 0;
  const registros = this.obtenerBimestresFormulario();
  const suma = registros.reduce((acc, item) => acc + (Number(item.presupuesto) || 0), 0);
  const diferencia = Number((suma - presupuestoTotal).toFixed(2));
  const metaDistribuida = registros.reduce((acc, item) => acc + (Number(item.meta) || 0), 0);
  const metaDiferencia = Number((metaDistribuida - metaTotal).toFixed(2));

  if (this.bimestresUI.presupuestoElement) {
    this.bimestresUI.presupuestoElement.textContent = this.formatearMonto(presupuestoTotal);
  }

  if (this.bimestresUI.totalElement) {
    this.bimestresUI.totalElement.textContent = this.formatearMonto(suma);
  }

  if (this.bimestresUI.diffElement) {
    const diffEl = this.bimestresUI.diffElement;
    diffEl.className = 'mt-1 text-xs font-semibold';
    if (Math.abs(diferencia) < 0.01) {
      diffEl.classList.add('text-emerald-600');
      diffEl.textContent = 'Distribución equilibrada';
    } else if (diferencia < 0) {
      diffEl.classList.add('text-amber-600');
      diffEl.textContent = `Faltan ${this.formatearMonto(Math.abs(diferencia))}`;
    } else {
      diffEl.classList.add('text-rose-600');
      diffEl.textContent = `Exceso de ${this.formatearMonto(diferencia)}`;
    }
  }

  if (this.bimestresUI.feedbackElement) {
    const feedback = this.bimestresUI.feedbackElement;
    if (Math.abs(diferencia) < 0.01) {
      feedback.className = 'mt-3 hidden rounded-md border px-3 py-2 text-xs';
      feedback.textContent = '';
    } else {
      const estilosBase = ['mt-3', 'rounded-md', 'border', 'px-3', 'py-2', 'text-xs'];
      const estilosEstado = diferencia < 0
        ? ['border-amber-200', 'bg-amber-50', 'text-amber-700']
        : ['border-rose-200', 'bg-rose-50', 'text-rose-700'];
      feedback.className = [...estilosBase, ...estilosEstado].join(' ');
      feedback.textContent = diferencia < 0
        ? 'La suma de los bimestres es menor al presupuesto programado. Debes completar el total.'
        : 'La suma de los bimestres supera el presupuesto programado. Ajusta los valores antes de guardar.';
    }
  }

  if (this.bimestresUI.metaTotalElement) {
    this.bimestresUI.metaTotalElement.textContent = this.formatearNumero(metaTotal, { maximumFractionDigits: 2 });
  }

  if (this.bimestresUI.metaDistribuidaElement) {
    this.bimestresUI.metaDistribuidaElement.textContent = this.formatearNumero(metaDistribuida, { maximumFractionDigits: 2 });
  }

  if (this.bimestresUI.metaDiffElement) {
    const metaDiffEl = this.bimestresUI.metaDiffElement;
    metaDiffEl.className = 'mt-1 text-xs font-semibold';
    if (Math.abs(metaDiferencia) < 0.01) {
      metaDiffEl.classList.add('text-emerald-600');
      metaDiffEl.textContent = 'Meta equilibrada';
    } else if (metaDiferencia < 0) {
      metaDiffEl.classList.add('text-amber-600');
      metaDiffEl.textContent = `Faltan ${this.formatearNumero(Math.abs(metaDiferencia), { maximumFractionDigits: 2 })}`;
    } else {
      metaDiffEl.classList.add('text-rose-600');
      metaDiffEl.textContent = `Exceso de ${this.formatearNumero(metaDiferencia, { maximumFractionDigits: 2 })}`;
    }
  }

  if (this.bimestresUI.metaFeedbackElement) {
    const metaFeedback = this.bimestresUI.metaFeedbackElement;
    if (Math.abs(metaDiferencia) < 0.01) {
      metaFeedback.className = 'mt-3 hidden rounded-md border px-3 py-2 text-xs';
      metaFeedback.textContent = '';
    } else {
      const estilosBase = ['mt-3', 'rounded-md', 'border', 'px-3', 'py-2', 'text-xs'];
      const estilosEstado = metaDiferencia < 0
        ? ['border-amber-200', 'bg-amber-50', 'text-amber-700']
        : ['border-rose-200', 'bg-rose-50', 'text-rose-700'];
      metaFeedback.className = [...estilosBase, ...estilosEstado].join(' ');
      metaFeedback.textContent = metaDiferencia < 0
        ? `La suma de la meta programada por bimestre es menor a la meta del indicador por ${this.formatearNumero(Math.abs(metaDiferencia), { maximumFractionDigits: 2 })}.`
        : `La suma de la meta programada por bimestre excede la meta del indicador en ${this.formatearNumero(metaDiferencia, { maximumFractionDigits: 2 })}.`;
    }
  }

  if (typeof this.renderAreaBudgetSummary === 'function' && this.state?.presupuestoArea?.resumen) {
    const resumenArea = this.state.presupuestoArea.resumen;
    const baseDisponible = Number.isFinite(this.state.presupuestoArea.baseDisponible)
      ? Number(this.state.presupuestoArea.baseDisponible)
      : Number(resumenArea.presupuesto_disponible) || 0;
    const presupuestoProgramado = presupuestoTotal;
    const disponibleEstimadoLocal = Number(baseDisponible - presupuestoProgramado);

    resumenArea.presupuesto_disponible_estimado = disponibleEstimadoLocal;

    this.renderAreaBudgetSummary({
      presupuestoProgramado,
      presupuestoDisponibleEstimado: disponibleEstimadoLocal
    });
  }

  if (Array.isArray(this.bimestresUI.inputs)) {
    for (let i = 0; i < this.bimestresUI.inputs.length; i++) {
      const entrada = this.bimestresUI.inputs[i];
      const registro = registros[i];
      if (!entrada || !registro || !entrada.descripcion) {
        continue;
      }

      const metaValor = Number(registro.meta) || 0;
      const descripcionTotal = Number(registro.descripcionCantidadTotal) || 0;
      const descripcionTexto = registro.descripcion || '';
      const feedbackEl = entrada.descripcionFeedback;

      if (entrada.descripcion) {
        entrada.descripcion.setCustomValidity('');
      }

      if (!feedbackEl) {
        continue;
      }

      let estadoClase = 'mt-1 hidden text-xs font-semibold';
      let mensaje = '';

      if (!descripcionTexto) {
        feedbackEl.className = estadoClase;
        feedbackEl.textContent = '';
        continue;
      }

      if (descripcionTotal === 0 && metaValor > 0) {
        estadoClase = 'mt-1 text-xs font-semibold text-amber-600';
        mensaje = `Describe cómo se distribuyen los ${this.formatearNumero(metaValor, { maximumFractionDigits: 2 })} entregables.`;
      } else if (metaValor <= 0 && descripcionTotal > 0) {
        estadoClase = 'mt-1 text-xs font-semibold text-rose-600';
        mensaje = `La meta es 0 pero la descripción incluye ${this.formatearNumero(descripcionTotal, { maximumFractionDigits: 2 })} entregables.`;
        if (entrada.descripcion) {
          entrada.descripcion.setCustomValidity('La descripción no puede incluir entregables cuando la meta es 0.');
        }
      } else if (descripcionTotal > metaValor + 0.01) {
        estadoClase = 'mt-1 text-xs font-semibold text-rose-600';
        mensaje = `Excediste la meta: ${this.formatearNumero(descripcionTotal, { maximumFractionDigits: 2 })} > ${this.formatearNumero(metaValor, { maximumFractionDigits: 2 })}.`;
        if (entrada.descripcion) {
          entrada.descripcion.setCustomValidity('La suma de entregables de la descripción excede la meta del bimestre.');
        }
      } else if (descripcionTotal < metaValor - 0.01) {
        estadoClase = 'mt-1 text-xs font-semibold text-amber-600';
        const restante = metaValor - descripcionTotal;
        mensaje = `Has detallado ${this.formatearNumero(descripcionTotal, { maximumFractionDigits: 2 })} de ${this.formatearNumero(metaValor, { maximumFractionDigits: 2 })} entregables. Faltan ${this.formatearNumero(restante, { maximumFractionDigits: 2 })}.`;
      } else {
        estadoClase = 'mt-1 text-xs font-semibold text-emerald-600';
        mensaje = `Descripción completa: ${this.formatearNumero(descripcionTotal, { maximumFractionDigits: 2 })} de ${this.formatearNumero(metaValor, { maximumFractionDigits: 2 })} entregables.`;
      }

      feedbackEl.className = estadoClase;
      feedbackEl.textContent = mensaje;
    }
  }
}

function validarDistribucionBimestres(payload) {
  const total = Number(payload.presupuesto_programado) || 0;
  const registros = Array.isArray(payload.bimestres) ? payload.bimestres : [];

  if (registros.length !== this.bimestresConfig.length) {
    throw new Error('Debes ingresar la información de los 6 bimestres.');
  }

  const tieneNegativos = registros.some(item => Number(item.presupuesto) < 0 || Number(item.meta) < 0);
  if (tieneNegativos) {
    throw new Error('El presupuesto o la meta por bimestre no pueden ser negativos.');
  }

  const suma = registros.reduce((acc, item) => acc + (Number(item.presupuesto) || 0), 0);
  const diferencia = Number((suma - total).toFixed(2));

  if (Math.abs(diferencia) > 0.01) {
    if (diferencia < 0) {
      throw new Error(`La distribución por bimestres es menor al presupuesto programado por ${this.formatearMonto(Math.abs(diferencia))}.`);
    }
    throw new Error(`La distribución por bimestres excede el presupuesto programado en ${this.formatearMonto(diferencia)}.`);
  }

  const metaTotal = Number(payload.meta_indicador_valor ?? payload.meta_valor) || 0;
  const metaSuma = registros.reduce((acc, item) => acc + (Number(item.meta) || 0), 0);
  const metaDiferencia = Number((metaSuma - metaTotal).toFixed(2));

  registros.forEach(item => {
    const descripcion = item.descripcion || '';
    const descripcionTotal = sumarCantidadesDescripcion(descripcion);
    const meta = Number(item.meta) || 0;

    if (meta <= 0 && descripcionTotal > 0) {
      throw new Error(`La meta del ${item.bimestre || `bimestre ${item.index}`} es 0 pero la descripción incluye ${this.formatearNumero(descripcionTotal, { maximumFractionDigits: 2 })} entregables.`);
    }

    if (descripcionTotal > meta + 0.01) {
      throw new Error(`La descripción del ${item.bimestre || `bimestre ${item.index}`} excede la meta programada: ${this.formatearNumero(descripcionTotal, { maximumFractionDigits: 2 })} > ${this.formatearNumero(meta, { maximumFractionDigits: 2 })}.`);
    }
  });

  if (Math.abs(metaDiferencia) > 0.01) {
    if (metaDiferencia < 0) {
      throw new Error(`La suma de la meta programada por bimestre es menor a la meta del indicador por ${this.formatearNumero(Math.abs(metaDiferencia), { maximumFractionDigits: 2 })}.`);
    }
    throw new Error(`La suma de la meta programada por bimestre excede la meta del indicador en ${this.formatearNumero(metaDiferencia, { maximumFractionDigits: 2 })}.`);
  }
}

export const bimestresMethods = {
  inicializarBimestresSection,
  resetBimestresSection,
  resolverIndiceBimestre,
  setValoresBimestres,
  obtenerBimestresFormulario,
  actualizarResumenBimestres,
  validarDistribucionBimestres
};
