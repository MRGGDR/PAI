/**
 * actividadesManager.js - Clase principal para gestionar actividades
 */

import apiService from './api.js';
import {
  serializarFormulario,
  mostrarToast,
  obtenerEmailUsuarioActual,
  coincideAreaUsuario,
  normalizarRol,
  obtenerPermisosRol
} from './utils.js';
import { BIMESTRES_CONFIG, RIESGO_SEMAFORO_CONFIG } from './manager/constants.js';
import { utilsMethods } from './manager/utils.js';
import { permissionMethods } from './manager/permissions.js';
import { catalogMethods } from './manager/catalogs.js';
import { uiEnhancerMethods } from './manager/uiEnhancers.js';
import { activitiesDataMethods } from './manager/activitiesData.js';
import { descriptionMethods } from './manager/description.js';
import { bimestresMethods } from './manager/bimestres.js';
import { budgetMethods } from './manager/presupuestos.js';

function normalizeNumericSegment(input) {
  if (input === null || input === undefined) return null;
  let sanitized = input
    .toString()
    .trim()
    .replace(/[\s\u00A0$]/g, '')
    .replace(/[^0-9,.-]/g, '');

  if (!sanitized) return null;

  const lastComma = sanitized.lastIndexOf(',');
  const lastDot = sanitized.lastIndexOf('.');

  if (lastComma > -1 && lastDot > -1) {
    if (lastComma > lastDot) {
      sanitized = sanitized.replace(/\./g, '').replace(/,/g, '.');
    } else {
      sanitized = sanitized.replace(/,/g, '');
    }
  } else if (lastComma > -1) {
    sanitized = sanitized.replace(/\./g, '').replace(/,/g, '.');
  } else {
    const dotCount = (sanitized.match(/\./g) || []).length;
    const thousandsPattern = /^-?\d{1,3}(\.\d{3})+$/;
    if (dotCount > 1 || thousandsPattern.test(sanitized)) {
      sanitized = sanitized.replace(/\./g, '');
    }
    sanitized = sanitized.replace(/,/g, '');
  }

  const num = Number(sanitized);
  return Number.isFinite(num) ? num : null;
}

function isLikelyYearSegment(rawSegment, parsedValue, currentYear, index, totalSegments) {
  if (!Number.isInteger(parsedValue)) return false;
  if (parsedValue < 1900 || parsedValue > currentYear + 10) return false;
  const rawText = rawSegment ? rawSegment.toString().trim() : '';
  if (!rawText) return false;
  const core = rawText.replace(/^[^0-9-]+|[^0-9-]+$/g, '');
  if (!/^\d{4}$/.test(core)) return false;
  if (totalSegments > 1 && index === totalSegments - 1) {
    return true;
  }
  return /\b(?:ano|año|vigencia|periodo|período)\b/i.test(rawText);
}

class ActividadesManager {
  constructor() {
    this.state = {
      usuario: this.obtenerUsuarioInicial(),
      permisos: {},
      catalogos: this.obtenerCatalogosVacios(),
      filtros: {
        estado: '',
        area: '',
        plan: ''
      },
      actividades: [],
      actividadActual: null,
      presupuestoArea: {
        resumen: null,
        actividades: [],
        meta: null
      }
    };

    this.state.permisos = this.obtenerPermisosDesdeUsuario(this.state.usuario);

    this.components = {
      tablaActividades: null,
      formActividad: null,
      selectEnhancers: new Map(),
      datePickers: new Map(),
      multiSelectPlanes: null
    };

    this.descripcionElements = null;
    this.descripcionFeedbackElement = null;
    this.descripcionEstado = {
      edicionManual: false,
      ultimaGenerada: '',
      actualizacionProgramatica: false
    };

    this.bimestresConfig = BIMESTRES_CONFIG;
    this.bimestresUI = {
      initialized: false,
      inputs: [],
      totalElement: null,
      presupuestoElement: null,
      diffElement: null,
      feedbackElement: null,
      metaTotalElement: null,
      metaDistribuidaElement: null,
      metaDiffElement: null,
      metaFeedbackElement: null
    };

    this.areaBudgetUI = null;

    this.cargandoDatos = false;

    this.init();
  }

  obtenerUsuarioInicial() {
    let email = obtenerEmailUsuarioActual();
    if (!email) {
      email = 'usuario@gestiondelriesgo.gov.co';
    }

    let rolRaw = '';
    let area = '';
    let nombre = '';

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        rolRaw = window.localStorage.getItem('auth_role') || '';
        area = window.localStorage.getItem('auth_area') || '';
        nombre = window.localStorage.getItem('auth_name') || '';
      } catch (error) {
        console.warn('[WARN] No se pudo leer información del usuario desde localStorage:', error);
      }
    }

    const rol = normalizarRol(rolRaw);

    return {
      email,
      nombre,
      rol,
      rolOriginal: rolRaw,
      area,
      areaNombre: area,
      areaNombreCatalogo: '',
      areaId: ''
    };
  }

  obtenerPermisosDesdeUsuario(usuario) {
    if (!usuario) return {};
    try {
      return obtenerPermisosRol(usuario.rol);
    } catch (error) {
      console.warn('[WARN] No fue posible derivar permisos del usuario:', error);
      return {};
    }
  }

  async init() {
    try {
      this.inicializarFormularioActividad();
      this.inicializarEventos();
      this.aplicarEstilosBaseCampos();

      await this.cargarCatalogos({ loaderMessage: 'Cargando catálogos...' });
      this.aplicarEstilosBaseCampos();

      await this.cargarActividades({ loaderMessage: 'Cargando actividades...' });
      this.inicializarTabla();
      this.aplicarPermisosInterfaz();
      this.aplicarFiltros();
    } catch (error) {
      console.error('[ERROR] Error inicializando el módulo de actividades:', error);
      mostrarToast('No fue posible inicializar el módulo de actividades.', 'error');
    }
  }

  aplicarEstilosBaseCampos() {
    this.aplicarEstilosBaseSelects();
    this.aplicarEstilosBaseDatePickers();
    this.initPlanMultiSelect();
  }

  setIndicadorTexto(texto = '') {
    const indicadorHidden = document.getElementById('indicador_texto');
    if (indicadorHidden) {
      indicadorHidden.value = texto || '';
    }

    const indicadorEditor = document.getElementById('indicador_editor');
    if (!indicadorEditor) return;

    const checker = indicadorEditor.__orthographyChecker;
    if (checker && typeof checker.setText === 'function') {
      checker.setText(texto || '');
    } else {
      indicadorEditor.textContent = texto || '';
      if (indicadorHidden) {
        indicadorHidden.value = texto || '';
      }
    }

    indicadorEditor.classList.remove('border-green-500', 'border-red-500');
  }

  getIndicadorTexto() {
    const indicadorHidden = document.getElementById('indicador_texto');
    if (indicadorHidden && typeof indicadorHidden.value === 'string') {
      return indicadorHidden.value;
    }

    const indicadorEditor = document.getElementById('indicador_editor');
    if (!indicadorEditor) return '';

    return indicadorEditor.innerText || indicadorEditor.textContent || '';
  }

  resetIndicadorOrtografiaPanel({ showPending = false, cleanupEditor = true } = {}) {
    const countNode = document.getElementById('indicador-ortografia-count');
    if (countNode) {
      countNode.textContent = showPending
        ? 'Ortografía pendiente de revisar'
        : 'Ortografía: 0 errores';
    }

    const firstNode = document.getElementById('indicador-ortografia-first');
    if (firstNode) {
      firstNode.textContent = showPending
        ? 'Presiona "Verificar ortografía" para revisar el texto.'
        : 'Sin errores.';
    }

    const indicadorEditor = document.getElementById('indicador_editor');
    if (!indicadorEditor) return;

    if (cleanupEditor) {
      const checker = indicadorEditor.__orthographyChecker;
      if (checker && typeof checker.setText === 'function') {
        const textoActual = typeof checker.getPlainText === 'function'
          ? checker.getPlainText()
          : (indicadorEditor.textContent || '');
        checker.errors = [];
        if (typeof checker.hideMenu === 'function') {
          checker.hideMenu();
        }
        checker.setText(textoActual);
      } else {
        indicadorEditor.querySelectorAll('.orthography-error').forEach((nodo) => {
          nodo.replaceWith(document.createTextNode(nodo.textContent || ''));
        });
      }
    }

    indicadorEditor.classList.remove('border-green-500', 'border-red-500');
  }

  normalizarMetaValor(valor) {
    if (valor === null || valor === undefined || valor === '') {
      return 0;
    }

    if (typeof valor === 'number') {
      return Number.isFinite(valor) ? Math.round(valor * 100) / 100 : 0;
    }

    const texto = valor.toString();
    if (!texto.trim()) return 0;

    const segmentosCrudos = texto.match(/-?\d[\d.,]*/g) || [];
    const segmentos = segmentosCrudos
      .map((segmento, index) => {
        const parsed = normalizeNumericSegment(segmento);
        return parsed === null ? null : { raw: segmento, parsed, index };
      })
      .filter(Boolean);

    let seleccionado = null;
    if (segmentos.length) {
      const currentYear = new Date().getFullYear();
      const filtrados = segmentos.filter((segmento, idx) => !isLikelyYearSegment(
        segmento.raw,
        segmento.parsed,
        currentYear,
        idx,
        segmentos.length
      ));
      seleccionado = (filtrados.length ? filtrados[0] : segmentos[0]) || null;
    } else {
      const parsedTextoCompleto = normalizeNumericSegment(texto);
      if (parsedTextoCompleto !== null) {
        seleccionado = { parsed: parsedTextoCompleto };
      }
    }

    if (!seleccionado) {
      return 0;
    }

    return Math.round(seleccionado.parsed * 100) / 100;
  }

  setMetaTexto(texto = '') {
    const metaDetalleHidden = document.getElementById('meta_indicador_detalle');
    if (metaDetalleHidden) {
      metaDetalleHidden.value = texto || '';
    }

    const metaEditor = document.getElementById('meta_indicador_editor');
    if (!metaEditor) return;

    const checker = metaEditor.__orthographyChecker;
    if (checker && typeof checker.setText === 'function') {
      checker.setText(texto || '');
    } else {
      metaEditor.textContent = texto || '';
      if (metaDetalleHidden) {
        metaDetalleHidden.value = texto || '';
      }
    }

    const metaValorHidden = document.getElementById('meta_indicador_valor');
    const metaNormalizado = this.normalizarMetaValor(texto);
    if (metaValorHidden) {
      metaValorHidden.value = metaNormalizado ? String(metaNormalizado) : '';
    }

    if (metaValorHidden) {
      metaValorHidden.dispatchEvent(new Event('input', { bubbles: true }));
      metaValorHidden.dispatchEvent(new Event('change', { bubbles: true }));
    }

    metaEditor.classList.remove('border-green-500', 'border-red-500');
  }

  getMetaTexto() {
    const metaDetalleHidden = document.getElementById('meta_indicador_detalle');
    if (metaDetalleHidden && typeof metaDetalleHidden.value === 'string') {
      return metaDetalleHidden.value;
    }

    const metaEditor = document.getElementById('meta_indicador_editor');
    if (!metaEditor) return '';

    return metaEditor.innerText || metaEditor.textContent || '';
  }

  resetMetaOrtografiaPanel({ showPending = false, cleanupEditor = true } = {}) {
    const countNode = document.getElementById('meta-ortografia-count');
    if (countNode) {
      countNode.textContent = showPending
        ? 'Ortografía pendiente de revisar'
        : 'Ortografía: 0 errores';
    }

    const firstNode = document.getElementById('meta-ortografia-first');
    if (firstNode) {
      firstNode.textContent = showPending
        ? 'Presiona "Verificar ortografía" para revisar el texto.'
        : 'Sin errores.';
    }

    const metaEditor = document.getElementById('meta_indicador_editor');
    if (!metaEditor) return;

    if (cleanupEditor) {
      const checker = metaEditor.__orthographyChecker;
      if (checker && typeof checker.setText === 'function') {
        const textoActual = typeof checker.getPlainText === 'function'
          ? checker.getPlainText()
          : (metaEditor.textContent || '');
        checker.errors = [];
        if (typeof checker.hideMenu === 'function') {
          checker.hideMenu();
        }
        checker.setText(textoActual);
      } else {
        metaEditor.querySelectorAll('.orthography-error').forEach((nodo) => {
          nodo.replaceWith(document.createTextNode(nodo.textContent || ''));
        });
      }
    }

    metaEditor.classList.remove('border-green-500', 'border-red-500');
  }

  setRiesgosTexto(texto = '') {
    const riesgosHidden = document.getElementById('riesgos');
    if (riesgosHidden) {
      riesgosHidden.value = texto || '';
    }

    const indicadorEditor = document.getElementById('indicador_editor');
    if (indicadorEditor) {
      indicadorEditor.addEventListener('input', () => {
        const indicadorHidden = document.getElementById('indicador_texto');
        const contenido = indicadorEditor.innerText || indicadorEditor.textContent || '';
        if (indicadorHidden) {
          indicadorHidden.value = contenido;
        }
        this.resetIndicadorOrtografiaPanel({
          showPending: Boolean(contenido.trim()),
          cleanupEditor: false
        });
      });
    }

    const btnVerificarIndicador = document.getElementById('verificar-ortografia-indicador');
    if (btnVerificarIndicador) {
      btnVerificarIndicador.addEventListener('click', (event) => {
        const texto = (this.getIndicadorTexto() || '').trim();

        if (!texto) {
          event.preventDefault();
          event.stopImmediatePropagation();
          this.resetIndicadorOrtografiaPanel({ showPending: false });
          if (indicadorEditor) {
            indicadorEditor.classList.add('border-red-500');
            if (typeof indicadorEditor.focus === 'function') {
              indicadorEditor.focus();
            }
          }
          mostrarToast('Redacta el indicador antes de ejecutar la verificación ortográfica.', 'warning');
          return;
        }

        this.resetIndicadorOrtografiaPanel({ showPending: true });
        if (indicadorEditor) {
          indicadorEditor.classList.remove('border-red-500');
        }
      });
    }

    const metaEditor = document.getElementById('meta_indicador_editor');
    if (metaEditor) {
      metaEditor.addEventListener('input', () => {
        const metaDetalleHidden = document.getElementById('meta_indicador_detalle');
        const metaValorHidden = document.getElementById('meta_indicador_valor');
        const contenido = metaEditor.innerText || metaEditor.textContent || '';
        if (metaDetalleHidden) {
          metaDetalleHidden.value = contenido;
        }
        if (metaValorHidden) {
          const metaNormalizado = this.normalizarMetaValor(contenido);
          metaValorHidden.value = metaNormalizado ? String(metaNormalizado) : '';
          metaValorHidden.dispatchEvent(new Event('input', { bubbles: true }));
          metaValorHidden.dispatchEvent(new Event('change', { bubbles: true }));
        }
        this.resetMetaOrtografiaPanel({
          showPending: Boolean(contenido.trim()),
          cleanupEditor: false
        });
      });
    }

    const btnVerificarMeta = document.getElementById('verificar-ortografia-meta');
    if (btnVerificarMeta) {
      btnVerificarMeta.addEventListener('click', (event) => {
        const texto = (this.getMetaTexto() || '').trim();

        if (!texto) {
          event.preventDefault();
          event.stopImmediatePropagation();
          this.resetMetaOrtografiaPanel({ showPending: false });
          if (metaEditor) {
            metaEditor.classList.add('border-red-500');
            if (typeof metaEditor.focus === 'function') {
              metaEditor.focus();
            }
          }
          mostrarToast('Redacta la meta antes de ejecutar la verificación ortográfica.', 'warning');
          return;
        }

        this.resetMetaOrtografiaPanel({ showPending: true });
        if (metaEditor) {
          metaEditor.classList.remove('border-red-500');
        }
      });
    }

    const riesgosEditor = document.getElementById('riesgos_editor');
    if (!riesgosEditor) return;

    const checker = riesgosEditor.__orthographyChecker;
    if (checker && typeof checker.setText === 'function') {
      checker.setText(texto || '');
    } else {
      riesgosEditor.textContent = texto || '';
      if (riesgosHidden) {
        riesgosHidden.value = texto || '';
      }
    }

    riesgosEditor.classList.remove('border-green-500', 'border-red-500');
  }

  getRiesgosTexto() {
    const riesgosHidden = document.getElementById('riesgos');
    if (riesgosHidden && typeof riesgosHidden.value === 'string') {
      return riesgosHidden.value;
    }

    const riesgosEditor = document.getElementById('riesgos_editor');
    if (!riesgosEditor) return '';

    if (riesgosEditor instanceof HTMLTextAreaElement || riesgosEditor instanceof HTMLInputElement) {
      return riesgosEditor.value || '';
    }

    return riesgosEditor.innerText || riesgosEditor.textContent || '';
  }

  resetRiesgosOrtografiaPanel({ showPending = false, cleanupEditor = true } = {}) {
    const countNode = document.getElementById('riesgos-ortografia-count');
    if (countNode) {
      countNode.textContent = showPending
        ? 'Ortografía pendiente de revisar'
        : 'Ortografía: 0 errores';
    }

    const firstNode = document.getElementById('riesgos-ortografia-first');
    if (firstNode) {
      firstNode.textContent = showPending
        ? 'Presiona "Verificar ortografía" para revisar el texto.'
        : 'Sin errores.';
    }

    const riesgosEditor = document.getElementById('riesgos_editor');
    if (riesgosEditor && cleanupEditor) {
      const checker = riesgosEditor.__orthographyChecker;
      if (checker && typeof checker.setText === 'function') {
        const textoActual = typeof checker.getPlainText === 'function'
          ? checker.getPlainText()
          : (riesgosEditor.textContent || '');
        checker.errors = [];
        if (typeof checker.hideMenu === 'function') {
          checker.hideMenu();
        }
        checker.setText(textoActual);
      } else {
        riesgosEditor.querySelectorAll('.orthography-error').forEach((nodo) => {
          nodo.replaceWith(document.createTextNode(nodo.textContent || ''));
        });
      }
    }

    if (riesgosEditor) {
      riesgosEditor.classList.remove('border-green-500', 'border-red-500');
    }
  }

  normalizarRiesgoPorcentaje(valor) {
    if (valor === null || valor === undefined) {
      return null;
    }

    const texto = valor.toString().trim();
    if (!texto) {
      return null;
    }

    const sanitized = texto
      .replace(/%/g, '')
      .replace(/\s+/g, '')
      .replace(/,/g, '.')
      .replace(/[^0-9.+-]/g, '');

    if (!sanitized) {
      return null;
    }

    const numero = Number(sanitized);
    if (!Number.isFinite(numero)) {
      return null;
    }

    const bounded = Math.min(100, Math.max(0, numero));
    return Math.round(bounded * 100) / 100;
  }

  obtenerConfigRiesgo(valor) {
    const percent = this.normalizarRiesgoPorcentaje(valor);
    if (percent === null) {
      return {
        id: '',
        label: 'Sin clasificar',
        percent: null,
        min: 0,
        max: 100,
        rangeLabel: '0% - 100%',
        chipClass: 'riesgo-chip--neutral',
        helperClass: 'riesgo-porcentaje-helper--neutral'
      };
    }

    const config = RIESGO_SEMAFORO_CONFIG.find(item => percent >= item.min && percent <= item.max)
      || RIESGO_SEMAFORO_CONFIG[RIESGO_SEMAFORO_CONFIG.length - 1];

    return {
      ...config,
      percent,
      rangeLabel: `${config.min}% - ${config.max}%`,
      chipClass: `riesgo-chip--${config.id}`,
      helperClass: `riesgo-porcentaje-helper--${config.id}`
    };
  }

  actualizarRiesgoSemaforoUI(valor) {
    const porcentajeInput = document.getElementById('riesgo_porcentaje');
    const chip = document.getElementById('riesgo-porcentaje-chip');
    const chipLabel = chip ? chip.querySelector('.riesgo-chip__label') : null;
    const helper = document.getElementById('riesgo-porcentaje-helper');
    const opcionesContainer = document.getElementById('riesgo-semaforo-opciones');
    const clearButton = document.getElementById('riesgo-rubrica-clear');

    const info = this.obtenerConfigRiesgo(valor);
    const percent = info.percent;

    if (porcentajeInput) {
      if (percent === null) {
        porcentajeInput.value = '';
      } else {
        porcentajeInput.value = String(percent);
      }
    }

    if (chip) {
      const chipClasses = [
        'riesgo-chip--neutral',
        'riesgo-chip--bajo',
        'riesgo-chip--moderado',
        'riesgo-chip--alto',
        'riesgo-chip--critico'
      ];
      chipClasses.forEach(clase => chip.classList.remove(clase));
      chip.classList.add(info.chipClass || 'riesgo-chip--neutral');
      if (chipLabel) {
        chipLabel.textContent = info.label;
      }
    }

    if (helper) {
      const helperClasses = [
        'riesgo-porcentaje-helper--neutral',
        'riesgo-porcentaje-helper--bajo',
        'riesgo-porcentaje-helper--moderado',
        'riesgo-porcentaje-helper--alto',
        'riesgo-porcentaje-helper--critico'
      ];
      helperClasses.forEach(clase => helper.classList.remove(clase));
      helper.classList.add(info.helperClass || 'riesgo-porcentaje-helper--neutral');
      helper.textContent = percent === null
        ? 'Ingresa un valor entre 0 y 100.'
        : `${info.label}: ${percent}% (${info.rangeLabel})`;
    }

    if (opcionesContainer) {
      const opciones = opcionesContainer.querySelectorAll('[data-riesgo-option]');
      opciones.forEach(opcion => {
        const nivel = opcion.getAttribute('data-nivel');
        const esSeleccionada = info.percent !== null && nivel === info.id;
        opcion.setAttribute('aria-checked', esSeleccionada ? 'true' : 'false');
      });
    }

    if (clearButton) {
      const disabled = info.percent === null;
      clearButton.disabled = disabled;
      clearButton.style.opacity = disabled ? '0.5' : '';
      clearButton.style.pointerEvents = disabled ? 'none' : '';
    }
  }

  inicializarRiesgoSemaforo() {
    const opcionesContainer = document.getElementById('riesgo-semaforo-opciones');
    const porcentajeInput = document.getElementById('riesgo_porcentaje');
    const clearButton = document.getElementById('riesgo-rubrica-clear');

    if (opcionesContainer) {
      const opciones = opcionesContainer.querySelectorAll('[data-riesgo-option]');
      opciones.forEach(opcion => {
        opcion.setAttribute('tabindex', '0');
        opcion.addEventListener('click', () => {
          const percent = this.normalizarRiesgoPorcentaje(opcion.getAttribute('data-percent'));
          this.actualizarRiesgoSemaforoUI(percent);
        });
        opcion.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            opcion.click();
          }
        });
      });
    }

    if (porcentajeInput) {
      porcentajeInput.addEventListener('input', () => {
        this.actualizarRiesgoSemaforoUI(porcentajeInput.value);
      });
      porcentajeInput.addEventListener('blur', () => {
        const normalizado = this.normalizarRiesgoPorcentaje(porcentajeInput.value);
        this.actualizarRiesgoSemaforoUI(normalizado);
      });
    }

    if (clearButton) {
      clearButton.addEventListener('click', () => {
        this.actualizarRiesgoSemaforoUI(null);
      });
    }

    this.actualizarRiesgoSemaforoUI(porcentajeInput ? porcentajeInput.value : null);
  }

  inicializarFormularioActividad() {
    const formWrapper = document.getElementById('form-actividad');
    const form = document.getElementById('actividad-form');

    if (!formWrapper || !form) {
      console.warn('[WARN] No se encontró el formulario de actividades en el DOM');
      return;
    }

    let inputId = form.querySelector('input[name="id"]');
    if (!inputId) {
      inputId = document.createElement('input');
      inputId.type = 'hidden';
      inputId.name = 'id';
      form.appendChild(inputId);
    }

    this.inicializarGeneradorDescripcion(form);

    const normalizarFecha = (valor) => {
      if (!valor) return '';
      try {
        return valor.toString().substring(0, 10);
      } catch {
        return valor;
      }
    };

    this.components.formActividad = {
      reset: () => {
        form.reset();
        inputId.value = '';
        const codigoInput = document.getElementById('codigo_actividad');
        if (codigoInput) {
          codigoInput.value = '';
        }
        this.actualizarSubprocesosPorArea('', '');
        this.actualizarLineasTrabajoPorArea('', '');
        this.actualizarLineasAccionPorEstrategia('', '');
        this.limpiarGeneradorDescripcion();
        const responsableInput = document.getElementById('responsable');
        if (responsableInput) {
          responsableInput.value = this.state.usuario?.email || obtenerEmailUsuarioActual();
        }
        this.setIndicadorTexto('');
        this.resetIndicadorOrtografiaPanel();
        this.setMetaTexto('');
        this.resetMetaOrtografiaPanel();
        this.setRiesgosTexto('');
        this.resetRiesgosOrtografiaPanel();
        const riesgoPorcentajeInput = document.getElementById('riesgo_porcentaje');
        if (riesgoPorcentajeInput) {
          riesgoPorcentajeInput.value = '';
        }
        this.actualizarRiesgoSemaforoUI(null);
        const planSelect = document.getElementById('plan_id');
        if (planSelect) {
          [...planSelect.options].forEach(option => {
            option.selected = false;
          });
          this.refreshPlanMultiSelect();
        }
        this.refreshModernDatePicker('fecha_inicio_planeada');
        this.refreshModernDatePicker('fecha_fin_planeada');
        const estadoSelect = document.getElementById('estado');
        if (estadoSelect) {
          estadoSelect.value = 'Planeada';
        }
        this.resetBimestresSection();
      },
      setValues: (data = {}) => {
        const areaId = this.resolverValorCatalogo(
          this.state.catalogos.areas,
          data.area_id || data.areaCodigo,
          data.area || data.area_nombre
        );

        const planInfo = this.obtenerPlanesDesdeDato(
          {
            plan_ids: data.plan_ids || data.planIds || data.raw?.plan_ids || data.raw?.planId || data.raw?.plan_id,
            plan: data.planDisplay || data.plan || data.plan_nombre || data.planName || data.raw?.plan
          },
          this.state.catalogos.planes
        );

        const valores = {
          id: data.id || data.actividad_id || '',
          codigo: data.codigo || data.codigoActividad || data.idCodigo || data.raw?.codigo || '',
          descripcion_actividad: data.descripcion_actividad || data.descripcion || '',
          area_id: areaId,
          subproceso_id: this.resolverValorCatalogo(
            this.state.catalogos.subprocesos,
            data.subproceso_id,
            data.subproceso || data.subproceso_nombre
          ),
          mipg: this.resolverValorCatalogo(this.state.catalogos.mipg, data.mipg, data.mipg_nombre),
          objetivo_id: this.resolverValorCatalogo(this.state.catalogos.objetivos, data.objetivo_id, data.objetivo || data.objetivo_nombre),
          estrategia_id: this.resolverValorCatalogo(this.state.catalogos.estrategias, data.estrategia_id, data.estrategia || data.estrategia_nombre),
          linea_trabajo_id: this.resolverValorCatalogo(
            this.state.catalogos.lineasTrabajo,
            data.linea_trabajo_id || data.linea_trabajo_codigo,
            data.linea_trabajo || data.linea_trabajo_nombre
          ),
          linea_accion_id: this.resolverValorCatalogo(
            this.state.catalogos.lineas,
            data.linea_accion_id || data.linea_id,
            data.linea_accion || data.linea || data.linea_nombre
          ),
          indicador_texto: data.indicador_detalle || data.indicador_texto || data.indicador || data.indicador_nombre || data.raw?.indicador || '',
          meta_indicador_valor: data.meta_indicador_valor ?? data.meta_valor ?? data.meta ?? '',
          meta_indicador_detalle: data.meta_indicador_detalle || data.meta_texto_completo || data.meta_detalle || data.meta_texto || data.metaDescripcion || data.raw?.meta_indicador_detalle || '',
          presupuesto_programado: data.presupuesto_programado || '',
          fuente: this.resolverValorCatalogo(this.state.catalogos.fuentes, data.fuente || data.fuente_id, data.fuente_nombre),
          plan_ids: planInfo.ids,
          plan_display: planInfo.display,
          responsable: data.responsable || this.state.usuario?.email || obtenerEmailUsuarioActual(),
          fecha_inicio_planeada: normalizarFecha(data.fecha_inicio_planeada || data.fecha_inicio),
          fecha_fin_planeada: normalizarFecha(data.fecha_fin_planeada || data.fecha_fin),
          estado: data.estado || data.estadoNombre || 'Planeada',
          riesgos: data.riesgos || data.riesgo || data.raw?.riesgos || '',
          riesgo_porcentaje: this.normalizarRiesgoPorcentaje(
            data.riesgo_porcentaje ?? data.riesgoPorcentaje ?? data.raw?.riesgo_porcentaje ?? ''
          )
        };

        inputId.value = valores.id;

        const asignarValor = (campoId, valor) => {
          const elemento = document.getElementById(campoId);
          if (!elemento) return;
          if (elemento.multiple) {
            const valoresSeleccion = Array.isArray(valor)
              ? valor.map(item => String(item))
              : valor
                ? [String(valor)]
                : [];
            [...elemento.options].forEach(option => {
              if (option.value === '') {
                option.selected = false;
                return;
              }
              option.selected = valoresSeleccion.includes(option.value);
            });
          } else {
            elemento.value = valor ?? '';
          }

          if (elemento.type === 'date') {
            this.refreshModernDatePicker(campoId);
          } else if (elemento.tagName === 'SELECT') {
            if (elemento.id === 'plan_id') {
              this.refreshPlanMultiSelect();
            } else {
              this.refreshModernSelect(campoId);
            }
          }
        };

        asignarValor('area_id', valores.area_id);
        this.actualizarSubprocesosPorArea(valores.area_id, valores.subproceso_id);
        this.actualizarLineasTrabajoPorArea(valores.area_id, valores.linea_trabajo_id);
        this.actualizarLineasAccionPorEstrategia(valores.estrategia_id, valores.linea_accion_id);
        asignarValor('subproceso_id', valores.subproceso_id);
        asignarValor('mipg_codigo', valores.mipg);
        asignarValor('objetivo_id', valores.objetivo_id);
          asignarValor('estrategia_id', valores.estrategia_id);
          asignarValor('linea_trabajo_id', valores.linea_trabajo_id);
          asignarValor('linea_accion_id', valores.linea_accion_id);
        asignarValor('presupuesto_programado', valores.presupuesto_programado);
        asignarValor('fuente_financiacion', valores.fuente);
        asignarValor('plan_id', valores.plan_ids);
        asignarValor('responsable', valores.responsable);
        asignarValor('fecha_inicio_planeada', valores.fecha_inicio_planeada);
        asignarValor('fecha_fin_planeada', valores.fecha_fin_planeada);
        asignarValor('estado', valores.estado);
          asignarValor('riesgo_porcentaje', valores.riesgo_porcentaje);
          this.actualizarRiesgoSemaforoUI(valores.riesgo_porcentaje);
  this.setIndicadorTexto(valores.indicador_texto);
  this.resetIndicadorOrtografiaPanel({ showPending: Boolean(valores.indicador_texto) });
  const metaNumeroFuente = valores.meta_indicador_valor ?? valores.meta_valor;
  const metaTexto = valores.meta_indicador_detalle || (metaNumeroFuente ? String(metaNumeroFuente) : '');
  this.setMetaTexto(metaTexto);
  this.resetMetaOrtografiaPanel({ showPending: Boolean(metaTexto) });
  this.setRiesgosTexto(valores.riesgos);
  this.resetRiesgosOrtografiaPanel({ showPending: Boolean(valores.riesgos) });

        const codigoInput = document.getElementById('codigo_actividad');
        if (codigoInput) {
          codigoInput.value = valores.codigo || '';
        }

        const bimestresValores = Array.isArray(data.bimestres) && data.bimestres.length
          ? data.bimestres
          : (Array.isArray(data.raw?.bimestres) ? data.raw.bimestres : []);
        this.setValoresBimestres(bimestresValores);

        if (typeof this.onAreaSelectionChange === 'function') {
          this.onAreaSelectionChange(valores.area_id, {
            actividadId: valores.id,
            presupuestoPlaneado: valores.presupuesto_programado,
            fechaInicio: valores.fecha_inicio_planeada
          });
        }

        const descripcionComponentes = {
          descripcion_verbo: data.descripcion_verbo || data.descripcionVerbo || '',
          descripcion_objeto: data.descripcion_objeto || data.descripcionObjeto || '',
          descripcion_finalidad: data.descripcion_finalidad || data.descripcionFinalidad || '',
          descripcion_beneficiarios: data.descripcion_beneficiarios || data.descripcionBeneficiarios || '',
          descripcion_temporalidad: data.descripcion_temporalidad || data.descripcionTemporalidad || ''
        };

        this.establecerValoresGeneradorDescripcion(descripcionComponentes, valores.descripcion_actividad);
      },
      getValues: () => {
        const datos = serializarFormulario(form);
        datos.id = inputId.value;
        return datos;
      }
    };

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!form.reportValidity()) {
        return;
      }
      const datos = this.components.formActividad.getValues();
      await this.guardarActividad(datos);
    });

    const fechaInicioInput = document.getElementById('fecha_inicio_planeada');
    if (fechaInicioInput) {
      fechaInicioInput.addEventListener('change', () => {
        if (typeof this.onAreaSelectionChange === 'function') {
          const areaSelect = document.getElementById('area_id');
          this.onAreaSelectionChange(areaSelect ? areaSelect.value : '', {
            fechaInicio: fechaInicioInput.value,
            presupuestoPlaneado: this.obtenerPresupuestoProgramadoActual()
          });
        }
      });
    }

    const btnCancelar = document.getElementById('btn-cancelar');
    if (btnCancelar) {
      btnCancelar.addEventListener('click', () => this.cerrarFormularioActividad());
    }

    const btnCerrarForm = document.getElementById('btn-cerrar-form');
    if (btnCerrarForm) {
      btnCerrarForm.addEventListener('click', () => this.cerrarFormularioActividad());
    }

    const riesgosEditor = document.getElementById('riesgos_editor');
    if (riesgosEditor) {
      riesgosEditor.addEventListener('input', () => {
        const riesgosHidden = document.getElementById('riesgos');
        const contenido = riesgosEditor.innerText || riesgosEditor.textContent || '';
        if (riesgosHidden) {
          riesgosHidden.value = contenido;
        }
        this.resetRiesgosOrtografiaPanel({
          showPending: Boolean(contenido.trim()),
          cleanupEditor: false
        });
      });
    }

    const btnVerificarRiesgos = document.getElementById('verificar-ortografia-riesgos');
    if (btnVerificarRiesgos) {
      btnVerificarRiesgos.addEventListener('click', (event) => {
        const texto = (this.getRiesgosTexto() || '').trim();

        if (!texto) {
          event.preventDefault();
          event.stopImmediatePropagation();
          this.resetRiesgosOrtografiaPanel({ showPending: false });
          if (riesgosEditor) {
            riesgosEditor.classList.add('border-red-500');
            if (typeof riesgosEditor.focus === 'function') {
              riesgosEditor.focus();
            }
          }
          mostrarToast('Ingresa los riesgos antes de ejecutar la verificación ortográfica.', 'warning');
          return;
        }

        this.resetRiesgosOrtografiaPanel({ showPending: true });
        if (riesgosEditor) {
          riesgosEditor.classList.remove('border-red-500');
        }
      });
    }

    this.inicializarRiesgoSemaforo();
    this.inicializarBimestresSection();
    this.components.formActividad.reset();
  }

  nuevaActividad() {
    if (!this.puedeCrearActividades()) {
      mostrarToast('No tienes permisos para crear actividades.', 'warning');
      return;
    }

    this.state.actividadActual = null;

    if (this.components.formActividad) {
      this.components.formActividad.reset();
    }

    this.aplicarRestriccionesDeAreaEnSelects();

    const formWrapper = document.getElementById('form-actividad');
    if (formWrapper) {
      formWrapper.classList.remove('hidden');
      formWrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    const titulo = document.getElementById('form-title');
    if (titulo) {
      titulo.textContent = 'Nueva Actividad';
    }

    const submitText = document.getElementById('btn-submit-text');
    if (submitText) {
      submitText.textContent = 'Guardar Actividad';
    }
  }

  editarActividad(actividad) {
    if (!this.puedeEditarActividades()) {
      mostrarToast('No tienes permisos para editar actividades.', 'warning');
      return;
    }

    if (!actividad) return;
    this.state.actividadActual = actividad;

    const titulo = document.getElementById('form-title');
    if (titulo) {
      titulo.textContent = 'Editar Actividad';
    }

    const submitText = document.getElementById('btn-submit-text');
    if (submitText) {
      submitText.textContent = 'Actualizar Actividad';
    }

    if (this.components.formActividad) {
      this.components.formActividad.setValues(actividad);
    }

    this.aplicarRestriccionesDeAreaEnSelects();

    const formWrapper = document.getElementById('form-actividad');
    if (formWrapper) {
      formWrapper.classList.remove('hidden');
      formWrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  cerrarFormularioActividad() {
    const formWrapper = document.getElementById('form-actividad');
    if (formWrapper) {
      formWrapper.classList.add('hidden');
    }

    if (this.components.formActividad) {
      this.components.formActividad.reset();
    }

    this.aplicarRestriccionesDeAreaEnSelects();

    this.state.actividadActual = null;
  }

  construirPayloadActividad(datos) {
    const fuenteSelect = document.getElementById('fuente_financiacion');
    const fuenteValor = datos.fuente || '';
    let fuenteNombreSeleccionada = '';
    if (fuenteSelect) {
      const opcionSeleccionada = fuenteSelect.options[fuenteSelect.selectedIndex];
      if (opcionSeleccionada && fuenteValor) {
        fuenteNombreSeleccionada = (opcionSeleccionada.textContent || opcionSeleccionada.label || '').trim();
      }
    }

    const indicadorTexto = (datos.indicador || datos.indicador_texto || '').toString().trim();
    const metaDetalle = (datos.meta_indicador_detalle || '').toString().trim();
    const metaValorFuente = datos.meta_indicador_valor ?? datos.meta_valor;
    const metaFuenteTexto = (metaValorFuente !== undefined && metaValorFuente !== null && metaValorFuente !== '')
      ? metaValorFuente
      : metaDetalle;
    const metaTieneDigitos = /\d/.test((metaFuenteTexto || '').toString());
    const metaNormalizada = this.normalizarMetaValor(metaFuenteTexto);
    const metaValorFinal = metaTieneDigitos ? metaNormalizada : '';
    const riesgoPorcentaje = this.normalizarRiesgoPorcentaje(datos.riesgo_porcentaje);

    const lineaTrabajoId = datos.linea_trabajo_id || datos.linea_trabajo || '';
    const lineaAccionId = datos.linea_accion_id || datos.linea_id || '';
    const lineaTrabajoItem = this.obtenerItemCatalogo(
      this.state.catalogos.lineasTrabajo,
      lineaTrabajoId,
      datos.linea_trabajo || datos.linea_trabajo_nombre
    );
    const lineaAccionItem = this.obtenerItemCatalogo(
      this.state.catalogos.lineas,
      lineaAccionId,
      datos.linea_accion || datos.linea || datos.linea_nombre
    );
    const lineaTrabajoNombre = lineaTrabajoItem?.nombre || datos.linea_trabajo || '';
    const lineaAccionNombre = lineaAccionItem?.nombre || datos.linea_accion || datos.linea || '';

    const payload = {
      id: datos.id || undefined,
      descripcion_actividad: datos.descripcion_actividad?.trim() || '',
      area_id: datos.area_id || '',
      subproceso_id: datos.subproceso_id || '',
      mipg: datos.mipg || datos.mipg_codigo || '',
      objetivo_id: datos.objetivo_id || '',
      estrategia_id: datos.estrategia_id || '',
      linea_trabajo_id: lineaTrabajoId || '',
      linea_trabajo: lineaTrabajoNombre,
      linea_accion_id: lineaAccionId || '',
      linea_accion: lineaAccionNombre,
      linea_id: lineaAccionId || '',
      linea: lineaAccionNombre,
      indicador: indicadorTexto,
  indicador_id: '',
      meta_indicador_valor: metaValorFinal,
      meta_indicador_detalle: metaDetalle,
      presupuesto_programado:
        datos.presupuesto_programado !== undefined && datos.presupuesto_programado !== ''
          ? Number(datos.presupuesto_programado)
          : 0,
      fuente: fuenteValor,
      fuente_nombre: fuenteNombreSeleccionada,
      plan_ids: this.normalizarSeleccionMultiple(datos.plan_id),
      responsable: datos.responsable || this.state.usuario?.email || obtenerEmailUsuarioActual(),
      fecha_inicio_planeada: datos.fecha_inicio_planeada || '',
      fecha_fin_planeada: datos.fecha_fin_planeada || '',
      estado: datos.estado || 'Planeada',
      riesgo_porcentaje: riesgoPorcentaje !== null ? riesgoPorcentaje : '',
    riesgos: datos.riesgos?.trim() || '',
      descripcion_verbo: datos.descripcion_verbo?.trim() || '',
      descripcion_objeto: datos.descripcion_objeto?.trim() || '',
      descripcion_finalidad: datos.descripcion_finalidad?.trim() || '',
      descripcion_beneficiarios: datos.descripcion_beneficiarios?.trim() || '',
      descripcion_temporalidad: datos.descripcion_temporalidad?.trim() || ''
    };

    payload.meta_valor = metaValorFinal;

    if (payload.plan_ids.length === 1) {
      payload.plan_id = payload.plan_ids[0];
    } else if (!payload.plan_ids.length) {
      payload.plan_id = '';
    }

    payload.bimestres = this.obtenerBimestresFormulario();

    if (!payload.id) delete payload.id;

    return payload;
  }

  async guardarActividad(datosFormulario) {
    try {
      if (!datosFormulario.descripcion_actividad?.trim()) {
        throw new Error('La descripción de la actividad es obligatoria');
      }
      if (!datosFormulario.area_id) {
        const areaResuelta = typeof this.obtenerAreaIdParaFormulario === 'function'
          ? this.obtenerAreaIdParaFormulario()
          : '';
        if (areaResuelta) {
          // Reinyecta el área asignada cuando el select está bloqueado para el usuario.
          datosFormulario.area_id = areaResuelta;
        }
      }
      if (!datosFormulario.area_id) {
        throw new Error('Debe seleccionar un área');
      }

      const payload = this.construirPayloadActividad(datosFormulario);
      const esNueva = !payload.id;
      const puedeCrear = this.puedeCrearActividades();
      const puedeEditar = this.puedeEditarActividades();

      if (esNueva && !puedeCrear) {
        mostrarToast('No tienes permisos para crear actividades.', 'warning');
        return;
      }

      if (!esNueva && !puedeEditar) {
        mostrarToast('No tienes permisos para editar actividades.', 'warning');
        return;
      }

      this.validarDistribucionBimestres(payload);

      mostrarToast(esNueva ? 'Creando actividad...' : 'Actualizando actividad...', 'info');
      const resultado = await apiService.saveActividad(payload);

      if (resultado?.success === false) {
        throw new Error(resultado.error || 'No fue posible guardar la actividad');
      }

      mostrarToast(esNueva ? 'Actividad creada correctamente' : 'Actividad actualizada correctamente', 'success');
      await this.cargarActividades();
      this.aplicarFiltros();
      this.cerrarFormularioActividad();
    } catch (error) {
      console.error('[ERROR] Error guardando actividad:', error);
      mostrarToast(error.message || 'Ocurrió un error al guardar la actividad', 'error');
    }
  }

  confirmarEliminarActividad(actividad) {
    if (!this.puedeEliminarActividades()) {
      mostrarToast('No tienes permisos para eliminar actividades.', 'warning');
      return;
    }

    if (!actividad) return;
    const descripcion = actividad.descripcion_actividad || actividad.descripcion || actividad.nombre || actividad.id;
    const confirmed = window.confirm(`¿Está seguro de eliminar la actividad "${descripcion}"?`);
    if (confirmed) {
      this.eliminarActividad(actividad.id || actividad.actividad_id);
    }
  }

  async eliminarActividad(id) {
    if (!this.puedeEliminarActividades()) {
      mostrarToast('No tienes permisos para eliminar actividades.', 'warning');
      return;
    }

    if (!id) return;
    try {
      mostrarToast('Eliminando actividad...', 'info');
      const resultado = await apiService.deleteActividad(id);
      if (resultado?.success === false) {
        throw new Error(resultado.error || 'No fue posible eliminar la actividad');
      }
      mostrarToast('Actividad eliminada', 'success');
      await this.cargarActividades();
      this.aplicarFiltros();
    } catch (error) {
      console.error('[ERROR] Error eliminando actividad:', error);
      mostrarToast(error.message || 'Ocurrió un error al eliminar la actividad', 'error');
    }
  }

  inicializarEventos() {
    const btnNuevaActividad = document.getElementById('btn-nueva-actividad');
    if (btnNuevaActividad) {
      btnNuevaActividad.addEventListener('click', () => this.nuevaActividad());
    }

    const btnLimpiarFiltros = document.getElementById('btn-limpiar-filtros');
    if (btnLimpiarFiltros) {
      btnLimpiarFiltros.addEventListener('click', () => this.limpiarFiltros());
    }

    ['filtro-estado', 'filtro-area', 'filtro-plan'].forEach((id) => {
      const select = document.getElementById(id);
      if (select) {
        select.addEventListener('change', () => this.aplicarFiltros());
      }
    });
  }

  aplicarFiltros() {
    if (!this.components.tablaActividades) return;

    const filtroEstado = document.getElementById('filtro-estado');
    const filtroArea = document.getElementById('filtro-area');
    const filtroPlan = document.getElementById('filtro-plan');

    const areaSelectedLabel = filtroArea && filtroArea.options && filtroArea.selectedIndex >= 0
      ? (filtroArea.options[filtroArea.selectedIndex]?.textContent || '').trim()
      : '';

    this.state.filtros = {
      estado: filtroEstado ? filtroEstado.value : '',
      area: filtroArea ? filtroArea.value : '',
      areaLabel: areaSelectedLabel,
      plan: filtroPlan ? filtroPlan.value : ''
    };

    const dataset = this.aplicarRestriccionAreaEnListado(this.state.actividades);
    const normalizar = (valor) => (typeof this.normalizarTextoComparacion === 'function'
      ? this.normalizarTextoComparacion(valor)
      : (valor === null || valor === undefined ? '' : valor.toString().toLowerCase().trim()));
    const normalizarId = (valor) => (valor === null || valor === undefined ? '' : valor.toString().toLowerCase().trim());
    const toLista = (valor) => {
      if (!valor && valor !== 0) return [];
      if (Array.isArray(valor)) return valor;
      return [valor];
    };

    const filtradas = dataset.filter(item => {
      const filtros = this.state.filtros || {};

      if (filtros.estado) {
        const estadoFiltroNormalizado = normalizar(filtros.estado);
        const estadoCoincide = [
          item.estadoId,
          item.estadoRevisionNombre,
          item.estadoNombre,
          item.raw?.estado_revision,
          item.raw?.estadoRevision,
          item.raw?.estado_revision_nombre,
          item.raw?.estado,
          item.raw?.estadoNombre,
          item.raw?.estado_id,
          item.raw?.estadoCodigo
        ].some(valor => estadoFiltroNormalizado && normalizar(valor) === estadoFiltroNormalizado);

        if (!estadoCoincide) {
          return false;
        }
      }

      if (filtros.area) {
        const areaIdSeleccionada = String(filtros.area);
        const areaCatalogo = Array.isArray(this.state.catalogos?.areas)
          ? this.state.catalogos.areas.find(area => normalizarId(area.id) === normalizarId(areaIdSeleccionada))
          : null;

        const areaLabelSeleccionada = filtros.areaLabel || areaCatalogo?.nombre || '';
        const areaLabelNormalizado = normalizar(areaLabelSeleccionada);
        const areaNombreNormalizado = normalizar(item.areaNombre);

        const obtenerTokensArea = (valor) => {
          const normalizado = normalizar(valor);
          if (!normalizado) return [];
          return normalizado
            .split(/\s*[\-|/]+\s*/)
            .map(segmento => segmento.trim())
            .filter(Boolean);
        };

        const candidatosId = [
          item.areaId,
          item.raw?.area_id,
          item.raw?.areaId,
          item.raw?.codigo_area,
          item.raw?.areaCodigo
        ];

        const coincidePorId = candidatosId.some(valor => normalizarId(valor) === normalizarId(areaIdSeleccionada));
        const tieneIdCandidato = candidatosId.some(valor => normalizarId(valor));

        const candidatosNombre = [
          item.areaNombre,
          item.raw?.areaNombre,
          item.raw?.area_label,
          item.raw?.area_nombre,
          item.raw?.area,
          item.raw?.areaDisplay,
          item.raw?.area_descripcion,
          item.raw?.areaDescripcion,
          item.raw?.areaDetalle,
          item.raw?.detalle_area
        ].filter(Boolean);

        const referenciasNombre = [
          areaLabelSeleccionada,
          areaCatalogo?.nombre,
          areaCatalogo?.raw?.nombre,
          areaCatalogo?.raw?.label,
          areaCatalogo?.raw?.detalle,
          areaCatalogo?.raw?.area
        ].filter(Boolean);

        const coincidePorNombreDirecto = Boolean(areaLabelNormalizado && areaNombreNormalizado && areaLabelNormalizado === areaNombreNormalizado);

        const coincidePorNombreCatalogo = referenciasNombre.some(ref => {
          const refNormalizado = normalizar(ref);
          if (!refNormalizado) return false;
          return candidatosNombre.some(nombre => normalizar(nombre) === refNormalizado);
        });

        const coincidePorSegmento = referenciasNombre.some(ref => {
          const tokensRef = obtenerTokensArea(ref);
          if (!tokensRef.length) return false;
          return tokensRef.some(tokenRef => {
            return candidatosNombre.some(nombre => obtenerTokensArea(nombre).includes(tokenRef));
          });
        });

        const coincidePorAfinidad = (!coincidePorId && !coincidePorNombreDirecto && !coincidePorNombreCatalogo && !coincidePorSegmento && !tieneIdCandidato)
          ? referenciasNombre.some(ref => coincideAreaUsuario(ref, candidatosNombre))
          : false;

        if (!coincidePorId && !coincidePorNombreDirecto && !coincidePorNombreCatalogo && !coincidePorSegmento && !coincidePorAfinidad) {
          return false;
        }
      }

      if (filtros.plan) {
        const filtroPlanValor = String(filtros.plan);
        const filtroPlanNormalizado = normalizar(filtros.plan);

        const coincidePlanPorId = Array.isArray(item.planIds)
          ? item.planIds.some(planId => String(planId) === filtroPlanValor)
          : (item.planId !== undefined && item.planId !== null && String(item.planId) === filtroPlanValor);

        const planNombreCoincide = [
          ...toLista(item.planDisplay),
          ...toLista(item.planesNombres),
          ...toLista(item.raw?.plan)
        ]
          .filter(Boolean)
          .some(planValor => filtroPlanNormalizado && normalizar(planValor) === filtroPlanNormalizado);

        if (!coincidePlanPorId && !planNombreCoincide) {
          return false;
        }
      }

      return true;
    });

    if (this.components.tablaActividades && this.components.tablaActividades.state) {
      this.components.tablaActividades.state.currentPage = 1;
    }

    this.components.tablaActividades.setData(filtradas);
  }

  limpiarFiltros() {
    const filtroEstado = document.getElementById('filtro-estado');
    const filtroArea = document.getElementById('filtro-area');
    const filtroPlan = document.getElementById('filtro-plan');
    const buscador = document.getElementById('actividades-search');

    if (filtroEstado) filtroEstado.value = '';
    if (filtroArea) filtroArea.value = '';
    if (filtroPlan) filtroPlan.value = '';
    if (buscador) buscador.value = '';

    this.state.filtros = { estado: '', area: '', areaLabel: '', plan: '' };

    if (this.components.tablaActividades && this.components.tablaActividades.state) {
      this.components.tablaActividades.state.searchTerm = '';
      this.components.tablaActividades.state.currentPage = 1;
    }

    this.refreshModernSelect('filtro-estado');
    this.refreshModernSelect('filtro-area');
    this.refreshModernSelect('filtro-plan');

    this.aplicarRestriccionesDeAreaEnSelects();
    this.aplicarFiltros();
  }
}

Object.assign(
  ActividadesManager.prototype,
  utilsMethods,
  permissionMethods,
  catalogMethods,
  uiEnhancerMethods,
  activitiesDataMethods,
  descriptionMethods,
  bimestresMethods,
  budgetMethods
);

export default ActividadesManager;