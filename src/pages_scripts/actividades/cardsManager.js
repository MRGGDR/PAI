/**
 * cardsManager.js - Gestión de vista de tarjetas para actividades
 */

import {
  formatearFecha,
  normalizarEstadoActividad,
  obtenerClaseEstadoActividad,
  normalizarEstadoRevision,
  obtenerClaseEstadoRevision,
  ESTADOS_REVISION
} from './utils.js';
import { RIESGO_SEMAFORO_CONFIG } from './manager/constants.js';

function normalizeRiskPercent(value) {
  if (value && typeof value === 'object' && value.percent !== undefined) {
    return normalizeRiskPercent(value.percent);
  }

  if (value === null || value === undefined || value === '') {
    return null;
  }

  const text = value.toString().trim();
  if (!text) {
    return null;
  }

  const sanitized = text
    .replace(/%/g, '')
    .replace(/\s+/g, '')
    .replace(/,/g, '.')
    .replace(/[^0-9.+-]/g, '');

  if (!sanitized) {
    return null;
  }

  const number = Number(sanitized);
  if (!Number.isFinite(number)) {
    return null;
  }

  const bounded = Math.min(100, Math.max(0, number));
  return Math.round(bounded * 100) / 100;
}

function resolveRiskConfig(value) {
  const percent = normalizeRiskPercent(value);
  if (percent === null) {
    return {
      id: '',
      label: 'Sin clasificar',
      percent: null,
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

/**
 * Gestiona la vista de tarjetas de actividades
 */
class CardsManager {
  constructor(containerId, options = {}) {
    this.containerId = containerId;
    this.container = document.getElementById(containerId);
    
    if (!this.container) {
      throw new Error(`No se encontró el contenedor con ID: ${containerId}`);
    }
    
    // Opciones por defecto
    this.options = {
      data: [],
      pageSize: 12,
      currentPage: 1,
      search: true,
      pagination: true,
      ...options
    };
    
    // Estado
    this.state = {
      filteredData: [],
      searchTerm: '',
      currentPage: 1,
      pageSize: this.options.pageSize
    };
    
    // Elementos
    this.elements = {
      grid: document.getElementById('actividades-grid'),
      empty: document.getElementById('actividades-empty'),
      search: document.getElementById('actividades-search'),
      count: document.getElementById('actividades-count'),
      pagination: document.getElementById('actividades-pagination'),
      paginationInfo: document.getElementById('pagination-info'),
      paginationControls: document.getElementById('pagination-controls'),
      pageSizeSelect: document.getElementById('page-size-select')
    };
    
    this.selectedBimestreIndex = null;
    this.currentModalItem = null;
    this.avanceShortcut = {
      shouldRender: false,
      isEnabled: false,
      label: 'Registrar avance',
      helperText: '',
      deniedMessage: '',
      onTrigger: null
    };

    this.init();
  }
  
  init() {
    this.initEvents();
    this.setData(this.options.data);
  }
  
  initEvents() {
    // Búsqueda
    if (this.elements.search) {
      this.elements.search.addEventListener('input', (e) => {
        this.state.searchTerm = e.target.value.toLowerCase();
        this.state.currentPage = 1;
        this.render();
      });
    }
    
    // Cambio de tamaño de página
    if (this.elements.pageSizeSelect) {
      this.elements.pageSizeSelect.addEventListener('change', (e) => {
        this.state.pageSize = parseInt(e.target.value);
        this.state.currentPage = 1;
        this.render();
      });
    }
  }
  
  setData(data) {
    this.options.data = data || [];
    this.filterData();
    this.render();
  }
  
  filterData() {
    const searchTerm = this.state.searchTerm;
    
    if (!searchTerm) {
      this.state.filteredData = [...this.options.data];
    } else {
      this.state.filteredData = this.options.data.filter(item => {
        const safeString = (value) => {
          return typeof value === 'string' ? value.toLowerCase() : '';
        };
        
        return (
          safeString(item.descripcion).includes(searchTerm) ||
          safeString(item.codigo).includes(searchTerm) ||
          safeString(item.areaNombre).includes(searchTerm) ||
          safeString(item.responsableNombre).includes(searchTerm) ||
          safeString(item.estadoNombre).includes(searchTerm) ||
          safeString(item.indicadorNombre).includes(searchTerm)
        );
      });
    }
  }
  
  render() {
    this.renderCards();
    this.renderPagination();
    this.updateCount();
  }
  
  renderCards() {
    const startIndex = (this.state.currentPage - 1) * this.state.pageSize;
    const endIndex = startIndex + this.state.pageSize;
    const pageData = this.state.filteredData.slice(startIndex, endIndex);
    
    if (pageData.length === 0) {
      this.elements.grid.classList.add('hidden');
      this.elements.empty.classList.remove('hidden');
      return;
    }
    
    this.elements.grid.classList.remove('hidden');
    this.elements.empty.classList.add('hidden');
    
    this.elements.grid.innerHTML = pageData.map(item => this.createCard(item)).join('');
    
    // Añadir eventos a los botones
    this.addCardEvents();
  }
  
  createCard(item) {
    const metaResumen = this.getMetaDisplaySummary(item);
    return `
      <div class="activity-card bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-all duración-200 overflow-visible group cursor-pointer" data-id="${item.id}">
        <!-- Header compacto -->
        <div class="bg-gradient-to-r from-slate-50 to-slate-100 px-4 py-3 border-b border-gray-200">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              ${this.renderCodigo(item.codigo)}
            </div>
            <div class="flex items-center gap-2">
              ${this.renderEstado(item)}
              ${this.renderAcciones(item)}
            </div>
          </div>
        </div>
        
        <!-- Contenido principal compacto -->
        <div class="p-4">
          <!-- Título/Descripción completo -->
          <div class="mb-3">
            <h3 class="text-base font-medium text-gray-900 leading-relaxed whitespace-normal group-hover:text-indigo-600 transition-colors">
              ${item.descripcion || 'Sin descripción'}
            </h3>
          </div>
          
          <!-- Información completa en formato compacto -->
          <div class="space-y-2 text-sm">
            <!-- Área -->
            <div class="flex items-center justify-between">
              <span class="text-gray-600 font-medium">Área:</span>
              <div class="text-right flex-1 ml-2">
                ${this.renderAreaSimple(item.areaNombre)}
              </div>
            </div>
            
            <!-- Subproceso (si existe) -->
            ${item.subprocesoNombre ? `
              <div class="flex items-center justify-between">
                <span class="text-gray-600 font-medium">Subproceso:</span>
                <div class="text-right flex-1 ml-2">
                  <span class="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                    ${item.subprocesoNombre}
                  </span>
                </div>
              </div>
            ` : ''}
            
            <!-- Responsable -->
            <div class="flex items-center justify-between">
              <span class="text-gray-600 font-medium">Responsable:</span>
              <div class="text-right flex-1 ml-2">
                <span class="text-gray-900 text-xs">${item.responsableNombre || 'Sin asignar'}</span>
              </div>
            </div>
            
            <!-- Indicador -->
            ${item.indicadorNombre ? `
              <div class="flex items-center justify-between">
                <span class="text-gray-600 font-medium">Indicador:</span>
                <div class="text-right flex-1 ml-2">
                  <span class="text-gray-900 text-xs">${item.indicadorNombre}</span>
                </div>
              </div>
            ` : ''}
            
            <!-- Meta -->
            ${metaResumen ? `
              <div class="flex items-center justify-between">
                <span class="text-gray-600 font-medium">Meta:</span>
                <div class="text-right flex-1 ml-2">
                  <span class="text-gray-900 text-xs font-semibold">${this.escapeHtml(metaResumen)}</span>
                </div>
              </div>
            ` : ''}
            
            <!-- Fechas -->
            ${(item.fechaInicio || item.fechaFin) ? `
              <div class="flex items-center justify-between">
                <span class="text-gray-600 font-medium">Período:</span>
                <div class="text-right flex-1 ml-2">
                  <span class="text-gray-900 text-xs">
                    ${item.fechaInicio ? new Date(item.fechaInicio).toLocaleDateString('es-ES', {day: 'numeric', month: 'short', year: 'numeric'}) : '?'} - 
                    ${item.fechaFin ? new Date(item.fechaFin).toLocaleDateString('es-ES', {day: 'numeric', month: 'short', year: 'numeric'}) : '?'}
                  </span>
                </div>
              </div>
            ` : ''}
          </div>
        </div>
        
        <!-- Footer mínimo con click indicator -->
        <div class="px-4 py-2 bg-gray-50 border-t border-gray-100">
          <div class="flex items-center justify-center text-xs text-gray-500">
            <span class="flex items-center gap-1">
              <span class="material-symbols-outlined text-xs">visibility</span>
              Click para detalles completos
            </span>
          </div>
        </div>
      </div>
    `;
  }
  
  renderCodigo(codigo) {
    if (!codigo || codigo === '' || typeof codigo !== 'string') {
      return `
        <div class="flex items-center gap-2 text-gray-400">
          <span class="material-symbols-outlined text-sm">tag</span>
          <span class="text-xs italic">Sin código</span>
        </div>
      `;
    }
    
    return `
      <div class="inline-flex items-center gap-2 bg-gradient-to-r from-slate-200 to-slate-300 border border-slate-400 rounded-lg px-3 py-1.5 shadow-sm">
        <span class="material-symbols-outlined text-sm text-slate-700">tag</span>
        <span class="font-mono font-bold text-slate-800 text-sm">${codigo}</span>
      </div>
    `;
  }
  
  renderEstado(estadoEntrada) {
    if (!estadoEntrada) return '';

    const candidatos = [];
    if (typeof estadoEntrada === 'string') {
      candidatos.push(estadoEntrada);
    } else {
      candidatos.push(
        estadoEntrada.estadoNombre,
        estadoEntrada.estadoRevisionNombre,
        estadoEntrada.estadoActividadNombre,
        estadoEntrada.estadoId,
        estadoEntrada.raw?.estado_revision,
        estadoEntrada.raw?.estadoRevision,
        estadoEntrada.raw?.estado_revision_nombre,
        estadoEntrada.raw?.estado,
        estadoEntrada.raw?.estadoNombre
      );
    }

    const bruto = candidatos.find(valor => typeof valor === 'string' && valor.trim()) || 'Sin revisión';
    const canonicalRevision = normalizarEstadoRevision(bruto);
    const canonicalActividad = normalizarEstadoActividad(bruto);
    const usarRevision = ESTADOS_REVISION.includes(canonicalRevision);
    const display = usarRevision
      ? canonicalRevision
      : canonicalActividad || canonicalRevision || bruto || 'Sin revisión';
    const classes = usarRevision
      ? obtenerClaseEstadoRevision(display, 'badge')
      : obtenerClaseEstadoActividad(display, 'badge');

    return `
      <span class="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${classes}">
        ${this.escapeHtml(display)}
      </span>
    `;
  }
  
  renderAcciones(item) {
    // Se llenará desde el callback de permisos
    return `
      <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200" data-acciones="${item.id}">
        <!-- Se llenarán dinámicamente -->
      </div>
    `;
  }
  
  renderArea(area) {
    if (!area || area === '' || typeof area !== 'string') {
      return `
        <span class="text-xs italic text-gray-400">Sin área</span>
      `;
    }

    return `
      <div class="flex flex-wrap justify-end">
        ${this.renderChip(area, area, { size: 'md' })}
      </div>
    `;
  }

  renderAreaSimple(areaNombre) {
    if (!areaNombre) {
      return '<span class="text-xs text-gray-400">Sin área asignada</span>';
    }

    const colores = {
      'Presidencia': 'purple',
      'Secretaría General': 'blue',
      'Secretaría de Gobierno': 'green',
      'Secretaría de Obras Públicas': 'yellow',
      'Secretaría de Hacienda': 'red',
      'Secretaría de Salud': 'indigo',
      'Secretaría de Educación': 'pink',
      'Secretaría de Desarrollo Rural': 'orange'
    };

    const color = colores[areaNombre] || 'gray';

    return `
      <span class="inline-flex items-center rounded-full bg-${color}-100 px-3 py-1 text-xs font-medium text-${color}-800">
        ${this.escapeHtml(areaNombre)}
      </span>
    `;
  }

  escapeHtml(value) {
    if (value === null || value === undefined) {
      return '';
    }

    return value
      .toString()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  hashString(value = '') {
    const str = value.toString();
    let hash = 0;
    for (let index = 0; index < str.length; index++) {
      hash = (hash << 5) - hash + str.charCodeAt(index);
      hash |= 0;
    }
    return hash;
  }

  getTagPalette(seed = '') {
    const palettes = [
      { bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-200' },
      { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200' },
      { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
      { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200' },
      { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' },
      { bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-200' },
      { bg: 'bg-sky-100', text: 'text-sky-700', border: 'border-sky-200' }
    ];

    const index = Math.abs(this.hashString(seed)) % palettes.length;
    return palettes[index] || palettes[0];
  }

  renderChip(label, seed = '', { size = 'sm' } = {}) {
    if (!label) {
      return '';
    }

    const palette = this.getTagPalette(seed || label);
    const sizeClasses = size === 'lg'
      ? 'px-4 py-2 text-sm'
      : size === 'md'
        ? 'px-3.5 py-1.5 text-sm'
        : 'px-3 py-1 text-xs';

    return `
      <span class="inline-flex items-center rounded-full border font-semibold ${palette.bg} ${palette.text} ${palette.border} ${sizeClasses} whitespace-nowrap">
        ${this.escapeHtml(label)}
      </span>
    `;
  }

  updateRiesgoModal(item) {
    const chip = document.getElementById('modal-riesgo-chip');
    const chipLabel = chip ? chip.querySelector('.riesgo-chip__label') : null;
    const percentNode = document.getElementById('modal-riesgo-porcentaje');

    const info = resolveRiskConfig(
      (item && item.riesgoSemaforo) ||
      (item && item.riesgoPorcentaje) ||
      (item && item.raw && (item.raw.riesgo_porcentaje ?? item.raw.riesgoPorcentaje)) ||
      null
    );

    if (chip) {
      ['riesgo-chip--neutral', 'riesgo-chip--bajo', 'riesgo-chip--moderado', 'riesgo-chip--alto', 'riesgo-chip--critico']
        .forEach(clase => chip.classList.remove(clase));
      chip.classList.add(info.chipClass || 'riesgo-chip--neutral');
      if (chipLabel) {
        chipLabel.textContent = info.label;
      }
    }

    if (percentNode) {
      ['riesgo-porcentaje-helper--neutral', 'riesgo-porcentaje-helper--bajo', 'riesgo-porcentaje-helper--moderado', 'riesgo-porcentaje-helper--alto', 'riesgo-porcentaje-helper--critico']
        .forEach(clase => percentNode.classList.remove(clase));
      percentNode.classList.add(info.helperClass || 'riesgo-porcentaje-helper--neutral');
      percentNode.textContent = info.percent === null
        ? 'Sin porcentaje'
        : `${info.percent}% (${info.rangeLabel})`;
    }
  }

  formatNumber(value, options = {}) {
    if (value === null || value === undefined || value === '') {
      return '';
    }

    const numero = Number(value);
    if (!Number.isFinite(numero)) {
      return '';
    }

    const minimumFractionDigits = options.minimumFractionDigits ?? (Number.isInteger(numero) ? 0 : 2);
    const maximumFractionDigits = options.maximumFractionDigits ?? 2;

    return new Intl.NumberFormat('es-CO', {
      minimumFractionDigits,
      maximumFractionDigits
    }).format(numero);
  }

  formatCurrency(value) {
    if (value === null || value === undefined || value === '') {
      return 'Sin presupuesto';
    }

    const numero = Number(value);
    if (!Number.isFinite(numero)) {
      return 'Sin presupuesto';
    }

    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(numero);
  }

  getMetaDisplaySummary(item) {
    if (!item) return '';

    const display = (item.metaDisplay ?? '').toString().trim();
    if (display) {
      return display;
    }

    const textoPlano = (item.metaTextoPlano ?? '').toString().trim();
    const valorBase = item.metaValor ?? item.meta ?? '';
    const valorFormateado = this.formatNumber(valorBase, { maximumFractionDigits: 2 }) || '';

    if (valorFormateado && textoPlano) {
      return `${valorFormateado} ${textoPlano}`.trim();
    }

    if (textoPlano) return textoPlano;
    if (valorFormateado) return valorFormateado;
    const detalle = (item.metaDetalle ?? '').toString().trim();
    if (detalle) return detalle;
    const metaFallback = (item.meta ?? '').toString().trim();
    return metaFallback;
  }

  normalizePlanDisplay(planDisplay) {
    if (!planDisplay) {
      return [];
    }

    if (Array.isArray(planDisplay)) {
      return planDisplay.map(item => item?.toString().trim()).filter(Boolean);
    }

    if (typeof planDisplay === 'string') {
      return planDisplay
        .split(/[,;\u2022]+/)
        .map(item => item.trim())
        .filter(Boolean);
    }

    return [];
  }

  renderPlanTags(planDisplay) {
    const planes = this.normalizePlanDisplay(planDisplay);
    if (!planes.length) {
      return '<span class="text-gray-400 text-sm italic">Sin plan asignado</span>';
    }

    return `
      <div class="flex flex-wrap justify-end gap-2">
        ${planes.map(plan => this.renderChip(plan, plan, { size: 'sm' })).join('')}
      </div>
    `;
  }

  renderIndicatorCard({ label, icon, iconBgClass, iconTextClass, valueHtml, fallbackText = 'No disponible', containerClass = '' }) {
    const hasValue = valueHtml && valueHtml.toString().trim().length > 0;
    const content = hasValue ? valueHtml : `<span class="text-sm italic text-slate-400">${this.escapeHtml(fallbackText)}</span>`;
    const containerClasses = ['modal-indicator-card'];
    if (containerClass) {
      containerClasses.push(containerClass);
    }

    return `
      <div class="${containerClasses.join(' ')}">
        <div class="flex items-start gap-3">
          <div class="flex h-11 w-11 items-center justify-center rounded-xl ${iconBgClass} ${iconTextClass}">
            <span class="material-symbols-outlined text-lg">${icon}</span>
          </div>
          <div class="flex-1">
            <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">${this.escapeHtml(label)}</p>
            <div class="modal-indicator-value mt-2 text-sm leading-relaxed text-slate-800">
              ${content}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  getBimestreNames() {
    return [
      'Enero-Febrero',
      'Marzo-Abril',
      'Mayo-Junio',
      'Julio-Agosto',
      'Septiembre-Octubre',
      'Noviembre-Diciembre'
    ];
  }

  getBimestreName(index) {
    const names = this.getBimestreNames();
    return names[index] || `Bimestre ${index + 1}`;
  }

  getBimestreDescripcion(bimestre) {
    if (!bimestre) {
      return '';
    }

    const keys = ['descripcion', 'detalle', 'descripcion_detalle', 'desglose', 'descripcionDetalle'];
    for (const key of keys) {
      if (bimestre[key]) {
        return bimestre[key].toString();
      }
    }

    return '';
  }

  renderBimestreDescripcion(descripcion) {
    const texto = (descripcion || '').toString().trim();
    if (!texto) {
      return '<p class="text-xs italic text-gray-400">Sin desglose registrado</p>';
    }

    const lineas = texto
      .split(/\r?\n/)
      .map(linea => linea.trim())
      .filter(Boolean);

    if (!lineas.length) {
      return '<p class="text-xs italic text-gray-400">Sin desglose registrado</p>';
    }

    return `
      <div class="space-y-1">
        ${lineas.map(linea => `<p class="text-xs leading-normal text-gray-600">${this.escapeHtml(linea)}</p>`).join('')}
      </div>
    `;
  }
  
  renderResponsable(responsable) {
    if (!responsable || responsable === '' || typeof responsable !== 'string') {
      return `
        <div class="flex items-center gap-2 text-gray-400">
          <span class="material-symbols-outlined text-sm">person</span>
          <span class="text-xs italic">Sin asignar</span>
        </div>
      `;
    }
    
    let nombreDisplay = responsable;
    if (responsable.includes('@')) {
      nombreDisplay = responsable.split('@')[0];
      nombreDisplay = nombreDisplay.replace(/[._]/g, ' ');
      nombreDisplay = nombreDisplay.replace(/\b\w/g, l => l.toUpperCase());
    }
    
    return `
      <div class="flex items-center gap-2">
        <div class="flex-shrink-0 w-6 h-6 bg-gradient-to-br from-violet-500 to-purple-600 rounded-full flex items-center justify-center">
          <span class="text-white text-xs font-bold">${nombreDisplay.charAt(0).toUpperCase()}</span>
        </div>
        <span class="text-sm font-medium text-gray-900 truncate">${nombreDisplay}</span>
      </div>
    `;
  }
  
  renderIndicador(indicador) {
    const tieneIndicador = indicador && indicador !== 'Sin indicador' && typeof indicador === 'string';
    const valueHtml = tieneIndicador
      ? `<span class="modal-indicator-text block text-base font-semibold text-slate-900">${this.escapeHtml(indicador)}</span>`
      : '';

    return this.renderIndicatorCard({
      label: 'Indicador',
      icon: 'insights',
      iconBgClass: 'bg-indigo-100',
      iconTextClass: 'text-indigo-600',
      valueHtml,
      fallbackText: 'Sin indicador',
      containerClass: 'modal-indicator-card--wide'
    });
  }

  renderMeta(metaInfo) {
    const info = typeof metaInfo === 'object' && metaInfo !== null
      ? metaInfo
      : { display: metaInfo };

    const displayRaw = (info.display ?? '').toString().trim();
    const textoPlano = (info.textoPlano ?? info.metaTextoPlano ?? info.texto ?? info.metaTexto ?? '').toString().trim();
    const valorFuente = info.metaValor ?? info.valor ?? info.metaValorTexto ?? info.meta ?? info.valorTexto;
    const valorEsNumerico = valorFuente !== null && valorFuente !== undefined && valorFuente !== '' && Number.isFinite(Number(valorFuente));
    const valorFormateado = valorEsNumerico ? this.formatNumber(valorFuente, { maximumFractionDigits: 2 }) : '';

    const combined = displayRaw
      || [valorFormateado, textoPlano].filter(Boolean).join(textoPlano ? ' ' : '').trim()
      || valorFormateado
      || textoPlano;

    const valueHtml = combined
      ? `<span class="modal-indicator-text block text-base font-semibold text-orange-600">${this.escapeHtml(combined)}</span>`
      : '';

    return this.renderIndicatorCard({
      label: 'Meta Total',
      icon: 'track_changes',
      iconBgClass: 'bg-orange-100',
      iconTextClass: 'text-orange-600',
      valueHtml,
      fallbackText: 'Sin meta'
    });
  }
  
  renderFechas(fechaInicio, fechaFin) {
    if (!fechaInicio && !fechaFin) {
      return `
        <div class="flex items-center gap-2 text-gray-400">
          <span class="material-symbols-outlined text-sm">event_busy</span>
          <span class="text-xs italic">Sin fechas</span>
        </div>
      `;
    }
    
    const formatearFecha = (fecha) => {
      if (!fecha) return null;
      try {
        return new Date(fecha).toLocaleDateString('es-ES', {
          day: '2-digit',
          month: 'short'
        });
      } catch {
        return fecha;
      }
    };
    
    return `
      <div class="flex items-center gap-2">
        ${fechaInicio ? `
          <div class="flex items-center gap-1">
            <span class="material-symbols-outlined text-xs text-green-600">play_arrow</span>
            <span class="text-xs font-medium text-green-800">${formatearFecha(fechaInicio)}</span>
          </div>
        ` : ''}
  ${fechaInicio && fechaFin ? `<span class="text-xs text-gray-400">&rarr;</span>` : ''}
        ${fechaFin ? `
          <div class="flex items-center gap-1">
            <span class="material-symbols-outlined text-xs text-red-600">stop</span>
            <span class="text-xs font-medium text-red-800">${formatearFecha(fechaFin)}</span>
          </div>
        ` : ''}
      </div>
    `;
  }
  
  addCardEvents() {
    // Los eventos se añadirán desde el manager principal
    // Pero aquí agregamos el evento de click para el modal
    this.elements.grid.addEventListener('click', (event) => {
      const card = event.target.closest('.activity-card');
      if (!card) return;
      
      // Si el click fue en un botón de acción, no abrir el modal
      if (event.target.closest('.js-edit-actividad, .js-delete-actividad')) {
        return;
      }
      
      const id = card.dataset.id;
      const item = this.state.filteredData.find(item => String(item.id) === String(id));
      
      if (item && this.onCardClickCallback) {
        this.onCardClickCallback(item);
      }
    });
  }
  
  // Método para configurar el callback de click en tarjetas
  onCardClick(callback) {
    this.onCardClickCallback = callback;
  }
  
  // Método para abrir el modal de detalles
  openModal(item) {
    const modal = document.getElementById('modal-detalle-actividad');
    if (!modal) return;
    
    this.currentModalItem = item;
    // Llenar la información del modal
    this.populateModal(item);
    
    // Mostrar el modal
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }
  
  // Método para cerrar el modal
  closeModal() {
    const modal = document.getElementById('modal-detalle-actividad');
    if (!modal) return;
    
    modal.classList.add('hidden');
    document.body.style.overflow = 'auto';
    this.currentModalItem = null;
    this.selectedBimestreIndex = null;
  }
  
  // Método para llenar el modal con información
  populateModal(item) {
    this.currentModalItem = item;
    // Título
    const titulo = document.getElementById('modal-titulo');
    if (titulo) titulo.textContent = item.descripcion || 'Sin descripción';
    
    // Reiniciar selección de bimestres al abrir el modal
    this.selectedBimestreIndex = null;

    // Header con código, estado, meta y presupuesto
    const headerContainer = document.getElementById('modal-header-info');
    if (headerContainer) {
      // Calcular totales de bimestres
      const bimestres = item.bimestres || [];
      const totalPresupuesto = bimestres.reduce((total, b) => total + (parseFloat(b.presupuesto || 0)), 0);
      const rawMetaValor = item.metaValor ?? item.meta ?? '';
      let metaValorHeader = this.formatNumber(rawMetaValor, { maximumFractionDigits: 2 });
      if (!metaValorHeader && rawMetaValor !== null && rawMetaValor !== undefined && rawMetaValor !== '') {
        metaValorHeader = rawMetaValor.toString().trim();
      }
      
      headerContainer.innerHTML = `
        <div class="flex items-center justify-around flex-wrap gap-6 py-2">
          <!-- Código -->
          <div class="flex items-center gap-2">
            ${this.renderCodigo(item.codigo)}
          </div>
          
          <!-- Estado -->
          <div class="flex items-center gap-2">
            ${this.renderEstado(item)}
          </div>
          
          <!-- Meta -->
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-green-600">flag</span>
            <span class="text-base font-semibold text-green-600">
              ${metaValorHeader || 'No definida'}
            </span>
          </div>
          
          <!-- Presupuesto Total -->
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-blue-600">attach_money</span>
            <span class="text-base font-semibold text-blue-600 break-all leading-tight">
              ${totalPresupuesto ? `COP ${new Intl.NumberFormat('es-CO', { 
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
              }).format(totalPresupuesto)}` : (item.presupuesto ? `COP ${new Intl.NumberFormat('es-CO', { 
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
              }).format(item.presupuesto)}` : 'No definido')}
            </span>
          </div>
        </div>
      `;
    }

    // Código (legacy - mantener por compatibilidad)
    const codigoContainer = document.getElementById('modal-codigo-container');
    if (codigoContainer) codigoContainer.innerHTML = this.renderCodigo(item.codigo);
    
    // Estado (legacy - mantener por compatibilidad)
    const estadoContainer = document.getElementById('modal-estado-container');
    if (estadoContainer) estadoContainer.innerHTML = this.renderEstado(item);
    
    // Descripción (legacy - mantener por compatibilidad)
    const descripcion = document.getElementById('modal-descripcion');
    if (descripcion) descripcion.textContent = item.descripcion || 'Sin descripción';
    
    // Área
    const areaContainer = document.getElementById('modal-area-container');
    if (areaContainer) areaContainer.innerHTML = this.renderArea(item.areaNombre);
    
    // Subproceso
    const subprocesoContainer = document.getElementById('modal-subproceso-container');
    if (subprocesoContainer) {
      subprocesoContainer.innerHTML = item.subprocesoNombre ? `
        <span class="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800">
          ${item.subprocesoNombre}
        </span>
      ` : '<span class="text-gray-400 text-sm italic">Sin subproceso</span>';
    }
    
    // Responsable
    const responsableContainer = document.getElementById('modal-responsable-container');
    if (responsableContainer) responsableContainer.innerHTML = this.renderResponsable(item.responsableNombre);
    
    // Plan
    const planContainer = document.getElementById('modal-plan-container');
    if (planContainer) {
      const planesDato = Array.isArray(item.planesNombres) && item.planesNombres.length
        ? item.planesNombres
        : item.planDisplay;
      planContainer.innerHTML = this.renderPlanTags(planesDato);
    }

    const riesgosContainer = document.getElementById('modal-riesgos-container');
    if (riesgosContainer) {
      const texto = (item.riesgos || '').toString().trim();
      if (!texto) {
        riesgosContainer.textContent = 'Sin riesgos registrados';
      } else {
        const sanitized = this.escapeHtml(texto).replace(/\n/g, '<br>');
        riesgosContainer.innerHTML = sanitized;
      }
    }
    this.updateRiesgoModal(item);
    
    // Indicador
    const indicadorContainer = document.getElementById('modal-indicador-container');
    if (indicadorContainer) indicadorContainer.innerHTML = this.renderIndicador(item.indicadorNombre);
    
    // Meta
    const metaContainer = document.getElementById('modal-meta-container');
    if (metaContainer) metaContainer.innerHTML = this.renderMeta({
      display: item.metaDisplay,
      textoPlano: item.metaTextoPlano,
      metaValor: item.metaValor,
      metaTexto: item.metaDetalle
    });
    
    // Fechas y estadísticas del cronograma
    const fechaInicioContainer = document.getElementById('modal-fecha-inicio-container');
    if (fechaInicioContainer) {
      fechaInicioContainer.innerHTML = item.fechaInicio ? `
        <div class="flex items-center gap-2">
          <span class="material-symbols-outlined text-sm text-green-600">play_arrow</span>
          <span class="text-sm font-medium text-green-800">${this.formatearFechaCompleta(item.fechaInicio)}</span>
        </div>
      ` : '<span class="text-gray-400 text-sm italic">No definida</span>';
    }
    
    const fechaFinContainer = document.getElementById('modal-fecha-fin-container');
    if (fechaFinContainer) {
      fechaFinContainer.innerHTML = item.fechaFin ? `
        <div class="flex items-center gap-2">
          <span class="material-symbols-outlined text-sm text-red-600">stop</span>
          <span class="text-sm font-medium text-red-800">${this.formatearFechaCompleta(item.fechaFin)}</span>
        </div>
      ` : '<span class="text-gray-400 text-sm italic">No definida</span>';
    }
    
    // Estadísticas del cronograma
    this.populateCronogramaStats(item);
    
    // Bimestres
    this.populateBimestres(item);
    
    // Presupuesto
    this.populatePresupuesto(item);
    
    // Última actualización
    const ultimaActualizacionContainer = document.getElementById('modal-ultima-actualizacion');
    if (ultimaActualizacionContainer) {
      const fechaActualizacion = item.fechaActualizacion || item.updated_at || item.fecha_modificacion;
      ultimaActualizacionContainer.innerHTML = fechaActualizacion ? `
        <span class="inline-flex items-center gap-2 text-xs text-gray-500">
          <span class="material-symbols-outlined text-sm text-gray-400">schedule</span>
          <span>${this.formatearFechaCompleta(fechaActualizacion)}</span>
        </span>
      ` : `
        <span class="inline-flex items-center gap-2 text-xs text-gray-400 italic">
          <span class="material-symbols-outlined text-sm text-gray-300">schedule</span>
          <span>Sin fecha de actualización</span>
        </span>
      `;
    }
  }
  
  // Método auxiliar para formatear fechas completas
  formatearFechaCompleta(fecha) {
    if (!fecha) return '';
    try {
      return new Date(fecha).toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      });
    } catch {
      return fecha;
    }
  }
  
  // Método para calcular y mostrar estadísticas del cronograma
  populateCronogramaStats(item) {
    if (!item.fechaInicio || !item.fechaFin) {
      // Si no hay fechas, limpiar los contenedores
      const duracionContainer = document.getElementById('modal-duracion-total');
      const transcurridosContainer = document.getElementById('modal-dias-transcurridos');
      const restantesContainer = document.getElementById('modal-dias-restantes');
      const porcentajeContainer = document.getElementById('modal-progreso-porcentaje');
      const barraContainer = document.getElementById('modal-progreso-barra');
      
      if (duracionContainer) duracionContainer.innerHTML = '<span class="text-gray-400 text-sm italic">N/A</span>';
      if (transcurridosContainer) transcurridosContainer.innerHTML = '<span class="text-gray-400 text-sm italic">N/A</span>';
      if (restantesContainer) restantesContainer.innerHTML = '<span class="text-gray-400 text-sm italic">N/A</span>';
      if (porcentajeContainer) porcentajeContainer.textContent = '0%';
      if (barraContainer) barraContainer.innerHTML = '<div class="bg-gray-300 h-2 rounded-full" style="width: 0%"></div>';
      return;
    }
    
    const fechaInicio = new Date(item.fechaInicio);
    const fechaFin = new Date(item.fechaFin);
    const hoy = new Date();
    
    // Calcular duración total en días
    const duracionTotal = Math.ceil((fechaFin - fechaInicio) / (1000 * 60 * 60 * 24));
    
    // Calcular días transcurridos (desde inicio hasta hoy, o 0 si no ha iniciado)
    let diasTranscurridos = 0;
    if (hoy >= fechaInicio) {
      diasTranscurridos = Math.ceil((hoy - fechaInicio) / (1000 * 60 * 60 * 24));
      if (diasTranscurridos > duracionTotal) diasTranscurridos = duracionTotal;
    }
    
    // Calcular días restantes (desde hoy hasta fin, o duración total si no ha iniciado)
    let diasRestantes = Math.ceil((fechaFin - hoy) / (1000 * 60 * 60 * 24));
    if (diasRestantes < 0) diasRestantes = 0;
    if (hoy < fechaInicio) diasRestantes = duracionTotal;
    
    // Calcular porcentaje de progreso temporal
    let porcentajeProgreso = 0;
    if (duracionTotal > 0) {
      porcentajeProgreso = Math.min(100, Math.max(0, (diasTranscurridos / duracionTotal) * 100));
    }
    
    // Determinar estado y color
    let estadoColor = 'blue';
    let estadoTexto = 'En progreso';
    if (hoy < fechaInicio) {
      estadoColor = 'gray';
      estadoTexto = 'Por iniciar';
    } else if (hoy > fechaFin) {
      estadoColor = 'red';
      estadoTexto = 'Finalizado';
    } else if (porcentajeProgreso > 75) {
      estadoColor = 'yellow';
      estadoTexto = 'Próximo a finalizar';
    } else {
      estadoColor = 'blue';
      estadoTexto = 'En progreso';
    }
    
    // Actualizar contenedores
    const duracionContainer = document.getElementById('modal-duracion-total');
    if (duracionContainer) {
      duracionContainer.innerHTML = `
        <span class="text-sm font-semibold text-gray-900">${duracionTotal} días</span>
      `;
    }
    
    const transcurridosContainer = document.getElementById('modal-dias-transcurridos');
    if (transcurridosContainer) {
      transcurridosContainer.innerHTML = `
        <span class="text-sm font-semibold text-blue-700">${diasTranscurridos} días</span>
      `;
    }
    
    const restantesContainer = document.getElementById('modal-dias-restantes');
    if (restantesContainer) {
      const colorClass = diasRestantes === 0 ? 'text-red-700' : diasRestantes <= 7 ? 'text-orange-700' : 'text-green-700';
      restantesContainer.innerHTML = `
        <span class="text-sm font-semibold ${colorClass}">${diasRestantes} días</span>
      `;
    }
    
    const porcentajeContainer = document.getElementById('modal-progreso-porcentaje');
    if (porcentajeContainer) {
      porcentajeContainer.textContent = `${Math.round(porcentajeProgreso)}%`;
    }
    
    const barraContainer = document.getElementById('modal-progreso-barra');
    if (barraContainer) {
      const barraColor = estadoColor === 'red' ? 'bg-red-500' : 
                         estadoColor === 'yellow' ? 'bg-yellow-500' : 
                         estadoColor === 'gray' ? 'bg-gray-400' : 'bg-blue-500';
      barraContainer.innerHTML = `
        <div class="${barraColor} h-2 rounded-full transition-all duration-500" style="width: ${porcentajeProgreso}%"></div>
      `;
    }
  }
  
  // Método para mostrar la información de bimestres con desglose
  populateBimestres(item) {
    const bimestresContainer = document.getElementById('modal-bimestres-container');
    if (!bimestresContainer) return;

    const bimestres = item.bimestres || [];
    const nombres = this.getBimestreNames();

    const buttonsHtml = nombres
      .map((nombre, index) => {
        const bimestre = bimestres[index] || {};
        const metaRaw = bimestre.meta ?? bimestre.valor;
        const presupuestoRaw = bimestre.presupuesto;
        const metaNumero = metaRaw === '' || metaRaw === null || metaRaw === undefined ? NaN : Number(metaRaw);
        const presupuestoNumero = presupuestoRaw === '' || presupuestoRaw === null || presupuestoRaw === undefined ? NaN : Number(presupuestoRaw);
        const metaEsValida = Number.isFinite(metaNumero);
        const presupuestoEsValido = Number.isFinite(presupuestoNumero);
        const descripcion = this.getBimestreDescripcion(bimestre);
        const descripcionDisponible = descripcion && descripcion.trim().length > 0;
        const tieneInfo = metaEsValida || presupuestoEsValido || descripcionDisponible;

        return `
          <button type="button"
                  class="bimestre-btn group relative flex w-full items-center justify-between gap-3 rounded-lg border bg-white px-4 py-3 text-left text-sm font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-1 ${
                    tieneInfo
                      ? 'border-emerald-200 hover:border-emerald-300 hover:bg-emerald-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }"
                  data-bimestre="${index}"
                  data-actividad-id="${item.id}"
                  data-has-info="${tieneInfo}"
                  aria-pressed="false"
                  aria-label="${this.escapeHtml(`Bimestre ${index + 1}: ${nombre}`)}">
            <div class="flex items-center gap-3">
              <span class="inline-flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold uppercase tracking-wide text-emerald-700">B${index + 1}</span>
              <span class="text-sm font-medium text-gray-700">${nombre}</span>
            </div>
            <span class="material-symbols-outlined text-base text-gray-400 transition-transform duration-200 group-hover:translate-x-1">chevron_right</span>
            <span class="absolute right-3 top-3 inline-flex h-2 w-2 rounded-full ${tieneInfo ? 'bg-emerald-400' : 'bg-gray-300'}"></span>
          </button>
        `;
      })
      .join('');

    bimestresContainer.innerHTML = `
      <div class="flex flex-col gap-4 lg:flex-row">
        <div class="lg:w-2/5">
          <div class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
            ${buttonsHtml}
          </div>
        </div>
        <div class="flex-1">
          <div id="modal-bimestre-detail" class="h-full rounded-xl border border-dashed border-emerald-200 bg-white p-5 shadow-sm">
            <div class="flex h-full flex-col justify-center gap-2 text-sm text-emerald-700">
              <p class="font-semibold text-emerald-800">Selecciona un bimestre</p>
              <p class="text-emerald-600">Consulta meta, presupuesto y desglose haciendo clic en el bimestre correspondiente.</p>
            </div>
          </div>
        </div>
      </div>
    `;

    this.addBimestreButtonEvents(item);
  }
  
  // Método para agregar eventos a los botones de bimestre
  addBimestreButtonEvents(item) {
    const container = document.getElementById('modal-bimestres-container');
    if (!container) return;

    const buttons = Array.from(container.querySelectorAll('.bimestre-btn'));
    if (!buttons.length) return;

    const selectBimestre = (index, options = {}) => {
      this.showBimestreDetail(item, index, options);
    };

    buttons.forEach(button => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        const index = Number(button.dataset.bimestre);
        selectBimestre(index);
      });

      button.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          const index = Number(button.dataset.bimestre);
          selectBimestre(index);
        }
      });
    });

    let initialIndex = typeof this.selectedBimestreIndex === 'number'
      ? this.selectedBimestreIndex
      : undefined;

    if (initialIndex === undefined || Number.isNaN(initialIndex) || !buttons[initialIndex]) {
      const firstWithInfo = buttons.find(btn => btn.dataset.hasInfo === 'true');
      if (firstWithInfo) {
        initialIndex = Number(firstWithInfo.dataset.bimestre);
      } else {
        initialIndex = Number(buttons[0].dataset.bimestre);
      }
    }

    selectBimestre(initialIndex, { scrollIntoView: false });
  }

  showBimestreDetail(item, bimestreIndex, { scrollIntoView = false } = {}) {
    const container = document.getElementById('modal-bimestres-container');
    const detailContainer = document.getElementById('modal-bimestre-detail');

    if (!container || !detailContainer) {
      return;
    }

    const buttons = Array.from(container.querySelectorAll('.bimestre-btn'));
    if (!buttons.length || bimestreIndex < 0 || bimestreIndex >= buttons.length) {
      return;
    }

    const currentButton = container.querySelector(`.bimestre-btn[data-bimestre="${bimestreIndex}"]`);

    buttons.forEach(button => {
      button.classList.remove('ring-2', 'ring-emerald-400', 'ring-offset-1', 'bg-emerald-50');
      button.setAttribute('aria-pressed', 'false');
    });

    if (currentButton) {
      currentButton.classList.add('ring-2', 'ring-emerald-400', 'ring-offset-1', 'bg-emerald-50');
      currentButton.setAttribute('aria-pressed', 'true');
      if (scrollIntoView) {
        currentButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }

    const nombre = this.getBimestreName(bimestreIndex);
    const bimestres = item.bimestres || [];
    const bimestre = bimestres[bimestreIndex] || {};
    const metaRaw = bimestre.meta ?? bimestre.valor;
    const presupuestoRaw = bimestre.presupuesto;

    const metaNumero = metaRaw === '' || metaRaw === null || metaRaw === undefined ? NaN : Number(metaRaw);
    const presupuestoNumero = presupuestoRaw === '' || presupuestoRaw === null || presupuestoRaw === undefined ? NaN : Number(presupuestoRaw);

    const metaEsValida = Number.isFinite(metaNumero);
    const presupuestoEsValido = Number.isFinite(presupuestoNumero);
    const metaTexto = metaEsValida
      ? this.formatNumber(metaNumero, { maximumFractionDigits: 2 })
      : 'Sin meta';
    const presupuestoTexto = presupuestoEsValido
      ? this.formatCurrency(presupuestoNumero)
      : 'Sin presupuesto';

    const descripcion = this.getBimestreDescripcion(bimestre);
    const descripcionDisponible = descripcion && descripcion.trim().length > 0;
    const descripcionHtml = descripcionDisponible
      ? this.renderBimestreDescripcion(descripcion)
      : '<p class="text-xs italic text-gray-400">Sin desglose registrado</p>';
    const avanceShortcutHtml = this.renderAvanceShortcut(item, bimestreIndex, { bimestreNombre: nombre });

    detailContainer.innerHTML = `
      <div class="flex flex-col gap-4">
        <div class="border-b border-gray-100 pb-4">
          <p class="text-xs font-semibold uppercase tracking-wide text-emerald-600">Bimestre ${bimestreIndex + 1}</p>
          <h4 class="text-lg font-semibold text-gray-900">${nombre}</h4>
        </div>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <p class="text-xs font-semibold uppercase tracking-wide text-gray-500">Meta programada</p>
            <p class="modal-bimestre-stat-value mt-2 text-xl sm:text-2xl font-semibold ${metaEsValida ? 'text-emerald-700' : 'text-gray-400'} leading-tight">${metaTexto}</p>
          </div>
          <div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <p class="text-xs font-semibold uppercase tracking-wide text-gray-500">Presupuesto</p>
            <p class="modal-bimestre-stat-value mt-2 text-xl sm:text-2xl font-semibold ${presupuestoEsValido ? 'text-sky-700' : 'text-gray-400'} leading-tight">${presupuestoTexto}</p>
          </div>
        </div>
        <div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p class="text-xs font-semibold uppercase tracking-wide text-gray-500">Desglose / entregables</p>
          <div class="mt-3 space-y-2 text-sm text-gray-600">
            ${descripcionHtml}
          </div>
        </div>
        ${avanceShortcutHtml}
      </div>
    `;

    this.selectedBimestreIndex = bimestreIndex;
    this.attachAvanceShortcut(detailContainer, item, bimestre, bimestreIndex, nombre);
  }

  renderAvanceShortcut(item, bimestreIndex, { bimestreNombre } = {}) {
    const shortcut = this.avanceShortcut;
    if (!shortcut || (!shortcut.shouldRender && !shortcut.isEnabled)) {
      return '';
    }

    if (!shortcut.isEnabled) {
      if (shortcut.deniedMessage) {
        return `
          <div class="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-base">lock</span>
              <span>${this.escapeHtml(shortcut.deniedMessage)}</span>
            </div>
          </div>
        `;
      }
      return '';
    }

    return `
      <div class="mt-5 flex justify-end">
        <button type="button" class="js-register-avance inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2">
          <span class="material-symbols-outlined text-base">add_circle</span>
          <span>${this.escapeHtml(shortcut.label || 'Registrar avance')}</span>
        </button>
      </div>
    `;
  }

  attachAvanceShortcut(detailContainer, item, bimestre, bimestreIndex, bimestreNombre) {
    const shortcut = this.avanceShortcut;
    if (!shortcut || !shortcut.isEnabled || typeof shortcut.onTrigger !== 'function') {
      return;
    }

    if (!detailContainer) {
      return;
    }

    const button = detailContainer.querySelector('.js-register-avance');
    if (!button) {
      return;
    }

    button.addEventListener('click', (event) => {
      event.preventDefault();
      try {
        shortcut.onTrigger({
          actividad: item,
          bimestre,
          bimestreIndex,
          bimestreLabel: bimestreNombre || this.getBimestreName(bimestreIndex)
        });
      } catch (error) {
        console.error('[WARN] No fue posible ejecutar el acceso directo de avances:', error);
      }
    });
  }

  populatePresupuesto(item) {
    const presupuestoTotal = document.getElementById('modal-presupuesto-total');
    const metaDistribuida = document.getElementById('modal-meta-distribuida');
    
    // Calcular totales
    const bimestres = item.bimestres || [];
    let totalMeta = 0;
    bimestres.forEach(bimestre => {
      totalMeta += parseFloat(bimestre.valor || bimestre.meta || 0);
    });
    
    const presupuesto = item.presupuesto || item.presupuesto_total || 0;
    
    if (presupuestoTotal) {
      presupuestoTotal.textContent = presupuesto ? 
        new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(presupuesto) : 
        'No definido';
    }
    
    if (metaDistribuida) {
      metaDistribuida.textContent = totalMeta ? totalMeta.toString() : 'No distribuida';
    }
  }
  
  // Método para configurar callbacks
  setEditCallback(callback) {
    this.onEditCallback = callback;
  }

  setAvanceShortcut(options = {}) {
    const {
      enabled = false,
      label = 'Registrar avance',
      helperText = '',
      deniedMessage = '',
      onTrigger = null
    } = options || {};

    const hasHandler = typeof onTrigger === 'function';

    this.avanceShortcut = {
      shouldRender: Boolean(enabled || deniedMessage),
      isEnabled: Boolean(enabled && hasHandler),
      label,
      helperText,
      deniedMessage,
      onTrigger: hasHandler ? onTrigger : null
    };

    if (this.currentModalItem && typeof this.selectedBimestreIndex === 'number') {
      this.showBimestreDetail(this.currentModalItem, this.selectedBimestreIndex, { scrollIntoView: false });
    }
  }
  
  renderPagination() {
    const totalPages = Math.ceil(this.state.filteredData.length / this.state.pageSize);
    
    if (totalPages <= 1) {
      this.elements.pagination.classList.add('hidden');
      return;
    }
    
    this.elements.pagination.classList.remove('hidden');
    
    // Información de paginación
    const start = (this.state.currentPage - 1) * this.state.pageSize + 1;
    const end = Math.min(this.state.currentPage * this.state.pageSize, this.state.filteredData.length);
    this.elements.paginationInfo.textContent = `${start}-${end} de ${this.state.filteredData.length}`;
    
    // Controles de paginación
    let controls = '';
    
    // Botón anterior
    controls += `
      <button class="pagination-btn px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-l-md hover:bg-gray-50 ${this.state.currentPage <= 1 ? 'opacity-50 cursor-not-allowed' : ''}" 
              data-page="${this.state.currentPage - 1}" ${this.state.currentPage <= 1 ? 'disabled' : ''}>
        <span class="material-symbols-outlined text-sm">chevron_left</span>
      </button>
    `;
    
    // Páginas
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= this.state.currentPage - 1 && i <= this.state.currentPage + 1)) {
        controls += `
          <button class="pagination-btn px-4 py-2 text-sm font-medium border-t border-b border-r border-gray-300 
                         ${i === this.state.currentPage ? 'bg-indigo-50 text-indigo-600 border-indigo-500' : 'bg-white text-gray-700 hover:bg-gray-50'}" 
                  data-page="${i}">
            ${i}
          </button>
        `;
      } else if ((i === 2 && this.state.currentPage > 3) || (i === totalPages - 1 && this.state.currentPage < totalPages - 2)) {
        controls += `
          <span class="px-4 py-2 text-sm font-medium text-gray-500 bg-white border-t border-b border-r border-gray-300">
            ...
          </span>
        `;
      }
    }
    
    // Botón siguiente
    controls += `
      <button class="pagination-btn px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-r-md hover:bg-gray-50 ${this.state.currentPage >= totalPages ? 'opacity-50 cursor-not-allowed' : ''}" 
              data-page="${this.state.currentPage + 1}" ${this.state.currentPage >= totalPages ? 'disabled' : ''}>
        <span class="material-symbols-outlined text-sm">chevron_right</span>
      </button>
    `;
    
    this.elements.paginationControls.innerHTML = controls;
    
    // Eventos de paginación
    this.elements.paginationControls.querySelectorAll('.pagination-btn:not([disabled])').forEach(btn => {
      btn.addEventListener('click', () => {
        const page = parseInt(btn.dataset.page);
        if (page > 0 && page <= totalPages) {
          this.state.currentPage = page;
          this.render();
        }
      });
    });
  }
  
  updateCount() {
    const total = this.state.filteredData.length;
    const showing = Math.min(this.state.pageSize, total - (this.state.currentPage - 1) * this.state.pageSize);
    
    if (this.state.searchTerm) {
      this.elements.count.textContent = `${total} resultado${total !== 1 ? 's' : ''} encontrado${total !== 1 ? 's' : ''}`;
    } else {
      this.elements.count.textContent = `${total} actividad${total !== 1 ? 'es' : ''}`;
    }
  }
  
  // Método para configurar acciones en las tarjetas
  setCardActions(callback) {
    this.cardActionsCallback = callback;
    // Regenerar las acciones en las tarjetas existentes
    this.updateCardActions();
  }
  
  updateCardActions() {
    if (!this.cardActionsCallback) return;
    
    this.elements.grid.querySelectorAll('[data-acciones]').forEach(element => {
      const id = element.dataset.acciones;
      const item = this.state.filteredData.find(item => String(item.id) === String(id));
      if (item) {
        element.innerHTML = this.cardActionsCallback(item);
      }
    });
  }
  
  // Método para manejar clicks en botones de las tarjetas
  onButtonClick(selector, callback) {
    this.elements.grid.addEventListener('click', (event) => {
      const button = event.target.closest(selector);
      if (!button) return;
      
      const card = button.closest('.activity-card');
      if (!card) return;
      
      const id = card.dataset.id;
      const item = this.state.filteredData.find(item => String(item.id) === String(id));
      
      if (item) {
        callback(event, { id, button, card, record: item });
      }
    });
  }
}

export default CardsManager;