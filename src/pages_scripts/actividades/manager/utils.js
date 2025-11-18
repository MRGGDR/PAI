import { DATE_DISPLAY_FORMATTER } from './constants.js';

function capitalizarFrase(texto = '') {
  const limpio = texto.trim();
  if (!limpio) return '';
  return limpio.charAt(0).toUpperCase() + limpio.slice(1);
}

function normalizarTextoComparacion(valor) {
  if (valor === null || valor === undefined) return '';
  try {
    return valor
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[_/]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  } catch (error) {
    return valor.toString().toLowerCase().trim();
  }
}

function normalizarSeleccionMultiple(valor) {
  if (Array.isArray(valor)) {
    return valor.map(v => String(v)).filter(v => v && v !== '');
  }
  if (typeof valor === 'string') {
    const texto = valor.trim();
    if (!texto) return [];
    if (texto.includes(',')) {
      return texto
        .split(',')
        .map(item => item.trim())
        .filter(Boolean)
        .map(v => String(v));
    }
    return [String(texto)];
  }
  if (valor) {
    return [String(valor)];
  }
  return [];
}

function obtenerTextoLabelCampo(campoId) {
  if (!campoId) return '';
  const label = document.querySelector(`label[for="${campoId}"]`);
  if (!label) return '';
  return (label.textContent || '')
    .replace(/\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatearFechaDisplay(valor) {
  if (!valor) return '';
  try {
    const texto = typeof valor === 'string' ? valor.trim() : valor.toString().trim();
    if (!texto) return '';
    const iso = texto.length > 10 ? texto.substring(0, 10) : texto;
    const partes = iso.split('-');
    if (partes.length < 3) {
      return texto;
    }
    const [anioStr, mesStr, diaStr] = partes;
    const anio = Number(anioStr);
    const mes = Number(mesStr);
    const dia = Number(diaStr);
    if (!anio || !mes || !dia) {
      return texto;
    }
    const fecha = new Date(Date.UTC(anio, mes - 1, dia));
    if (Number.isNaN(fecha.getTime())) {
      return texto;
    }
    return DATE_DISPLAY_FORMATTER.format(fecha);
  } catch (_error) {
    try {
      return valor.toString();
    } catch {
      return '';
    }
  }
}

function parseFechaValor(valor) {
  if (!valor) return null;
  try {
    const texto = valor.toString().trim();
    if (!texto) return null;
    const match = /^(-?\d{1,4})-(\d{2})-(\d{2})$/.exec(texto);
    if (!match) return null;
    const year = Number(match[1]);
    const monthIndex = Number(match[2]) - 1;
    const day = Number(match[3]);
    if (!Number.isFinite(year) || !Number.isFinite(monthIndex) || !Number.isFinite(day)) {
      return null;
    }
    if (monthIndex < 0 || monthIndex > 11) {
      return null;
    }
    if (day < 1 || day > 31) {
      return null;
    }
    const maxDay = new Date(year, monthIndex + 1, 0).getDate();
    if (day > maxDay) {
      return null;
    }
    return { year, month: monthIndex, day };
  } catch (_error) {
    return null;
  }
}

function formatearFechaISO(partes) {
  if (!partes) return '';
  const { year, month, day } = partes;
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return '';
  }
  const fecha = new Date(year, month, day);
  if (Number.isNaN(fecha.getTime())) {
    return '';
  }
  const anio = String(year).padStart(4, '0');
  const mes = String(month + 1).padStart(2, '0');
  const dia = String(day).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

function obtenerPartesHoy() {
  const hoy = new Date();
  return {
    year: hoy.getFullYear(),
    month: hoy.getMonth(),
    day: hoy.getDate()
  };
}

function formatearMonto(valor = 0, opciones = {}) {
  const numero = Number(valor) || 0;
  const config = {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: opciones.minimumFractionDigits ?? 0,
    maximumFractionDigits: opciones.maximumFractionDigits ?? 2
  };
  try {
    return numero.toLocaleString('es-CO', config);
  } catch (error) {
    const decimales = config.maximumFractionDigits ?? 2;
    return `$${numero.toFixed(decimales)}`;
  }
}

function formatearNumero(valor = 0, opciones = {}) {
  const numero = Number(valor) || 0;
  const config = {
    minimumFractionDigits: opciones.minimumFractionDigits ?? 0,
    maximumFractionDigits: opciones.maximumFractionDigits ?? 2
  };
  try {
    return numero.toLocaleString('es-CO', config);
  } catch (error) {
    const decimales = config.maximumFractionDigits ?? 2;
    return numero.toFixed(decimales);
  }
}

function obtenerPlanesDesdeDato(raw = {}, catalogoPlanes = []) {
  const ids = [];
  const nombres = [];
  const existentesNormalizados = new Set();
  const normalizar = valor => this.normalizarTextoComparacion(valor);

  const agregarPlan = (planItem) => {
    if (!planItem) return;
    const id = String(planItem.id);
    if (!ids.includes(id)) {
      ids.push(id);
    }
    const nombre = planItem.nombre || planItem.raw?.label || planItem.raw?.nombre || '';
    const normalizado = normalizar(nombre);
    if (nombre && !existentesNormalizados.has(normalizado)) {
      existentesNormalizados.add(normalizado);
      nombres.push(nombre);
    }
  };

  const agregarPorId = (valor) => {
    if (!valor && valor !== 0) return;
    const id = String(valor).trim();
    if (!id) return;
    const encontrado = catalogoPlanes.find(item => String(item.id) === id);
    if (encontrado) {
      agregarPlan(encontrado);
    }
  };

  const valoresId = raw.plan_ids || raw.planId || raw.plan_id;
  this.normalizarSeleccionMultiple(valoresId).forEach(agregarPorId);

  const planTexto = raw.plan || raw.planNombre || raw.plan_nombre;
  const nombresTexto = Array.isArray(planTexto)
    ? planTexto
    : typeof planTexto === 'string'
      ? planTexto.split(',').map(item => item.trim()).filter(Boolean)
      : [];

  nombresTexto.forEach(nombre => {
    const normalizado = normalizar(nombre);
    if (!normalizado) return;
    const encontrado = catalogoPlanes.find(item => {
      const comparables = [item.nombre, item.raw?.label, item.raw?.nombre];
      return comparables.some(valor => normalizar(valor) === normalizado);
    });
    if (encontrado) {
      agregarPlan(encontrado);
    } else if (!existentesNormalizados.has(normalizado)) {
      existentesNormalizados.add(normalizado);
      nombres.push(nombre);
    }
  });

  return {
    ids,
    nombres,
    display: nombres.join(', ')
  };
}

export const utilsMethods = {
  capitalizarFrase,
  normalizarTextoComparacion,
  normalizarSeleccionMultiple,
  obtenerTextoLabelCampo,
  formatearFechaDisplay,
  parseFechaValor,
  formatearFechaISO,
  obtenerPartesHoy,
  formatearMonto,
  formatearNumero,
  obtenerPlanesDesdeDato
};
