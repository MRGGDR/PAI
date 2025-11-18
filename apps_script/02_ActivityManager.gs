/**
 * ActivityManager.gs - Gestor de Actividades para PAI-UNGRD
 * 
 * Este módulo maneja todas las operaciones CRUD de actividades:
 * - Integración con el nuevo sistema de catálogos unificado
 * - Validaciones de negocio y integridad referencial
 * - Mapeo automático de campos derivados
 * - API limpia y consistente
 * - Gestión de estados y auditoría
 * 
 * @author: Sistema PAI-UNGRD
 * @version: 1.0
 */

// ==================== CONFIGURACIÓN DE ACTIVIDADES ====================

/**
 * Headers de la hoja de actividades (mantener compatibilidad)
 * Nota: Los campos guardan los labels/nombres para mejor legibilidad
 */
const ACTIVITY_HEADERS = [
  'actividad_id',           // A - ID único de la actividad
  'codigo',                 // B - Código identificador único de la actividad
  'area',                   // C - Nombre del área (label del catálogo)
  'subproceso',             // D - Nombre del subproceso (label del catálogo)
  'linea_trabajo',          // E - Línea de trabajo (label del catálogo)
  'mipg',                   // F - Dimensión MIPG (label del catálogo)
  'linea_accion',           // G - Línea de acción (label del catálogo)
  'descripcion_actividad',  // H - Descripción de la actividad
  'indicador',              // I - Nombre del indicador (label del catálogo o texto libre)
  'meta_valor',             // J - Valor numérico de la meta del indicador
  'meta_texto',             // K - Descripción de la meta sin incluir el valor numérico
  'presupuesto_programado', // L - Presupuesto programado
  'fuente',                 // M - Fuente de financiación (label del catálogo)
  'plan',                   // N - Planes asociados (separados por comas)
  'riesgos',                // O - Riesgos identificados para la actividad
  'riesgo_porcentaje',      // P - Nivel de riesgo reportado (porcentaje)
  'responsable',            // Q - Responsable de la actividad
  'fecha_inicio_planeada',  // R - Fecha de inicio planeada
  'fecha_fin_planeada',     // S - Fecha de fin planeada
  'estado',                 // T - Estado operativo de la actividad
  'creado_por',             // U - Email del usuario que creó la actividad
  'creado_el',              // V - Fecha de creación
  'actualizado_el'          // W - Fecha de última actualización
];

const RISK_CATEGORY_CONFIG = [
  { id: 'bajo', label: 'Bajo', min: 0, max: 25 },
  { id: 'moderado', label: 'Moderado', min: 26, max: 50 },
  { id: 'alto', label: 'Alto', min: 51, max: 75 },
  { id: 'critico', label: 'Crítico', min: 76, max: 100 }
];

const AREA_ACRONYM_ENTRIES = [
  ['Subdirección General', 'SGG'],
  ['Subdirección para el Conocimiento del Riesgo', 'SCR'],
  ['Subdirección para la Reducción del Riesgo', 'SRR'],
  ['Subdirección para el Manejo de Desastres', 'SMD'],
  ['Oficina Asesora de Planeación e Información', 'OAPI'],
  ['Oficina Asesora Jurídica', 'OAJ'],
  ['Oficina Asesora de Comunicaciones', 'OAC'],
  ['Oficina de Control Interno', 'OCI'],
  ['Secretaría General', 'SG'],
  ['Grupo de Cooperación Internacional', 'GCI'],
  ['Grupo de Apoyo Financiero y Contable', 'GAFC'],
  ['Grupo de Apoyo Administrativo', 'GAA'],
  ['Grupo de Gestión Contractual', 'GGC'],
  ['Grupo de Talento Humano', 'GTH'],
  ['Grupo Tecnologías de la Información', 'GTI'],
  ['Grupo Relacionamiento con el Ciudadano', 'GRC'],
  ['Grupo Control Disciplinario Interno', 'GCDI']
];

const AREA_ACRONYM_MAP = AREA_ACRONYM_ENTRIES.reduce((map, entry) => {
  const [label, acronym] = entry;
  if (!label || !acronym) return map;
  const key = normalizeText(label || '');
  if (key) {
    map[key] = acronym.toUpperCase();
  }
  return map;
}, {});

function getAreaAcronym(areaLabel) {
  if (!areaLabel) return '';
  const normalized = normalizeText(areaLabel);
  return AREA_ACRONYM_MAP[normalized] || '';
}

function buildAcronymSegment(value, length, fallback) {
  const safeFallback = (fallback || '').toString().toUpperCase() || 'X'.repeat(length);
  if (!value) {
    return safeFallback.substring(0, length).padEnd(length, 'X');
  }

  const upper = value.toString().trim().toUpperCase();
  if (!upper) {
    return safeFallback.substring(0, length).padEnd(length, 'X');
  }

  const words = upper
    .replace(/[^A-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  let acronym = '';
  words.forEach(word => {
    if (acronym.length < length && word.length) {
      acronym += word[0];
    }
  });

  if (acronym.length < length) {
    const alphanumeric = upper.replace(/[^A-Z0-9]/g, '');
    acronym += alphanumeric.substring(0, Math.max(0, length - acronym.length));
  }

  acronym = acronym.substring(0, length);
  if (!acronym) {
    acronym = safeFallback.substring(0, length);
  }

  return acronym.padEnd(length, safeFallback[0] || 'X');
}

function extractYearFromDate(rawDate) {
  if (!rawDate) {
    return (new Date()).getFullYear().toString();
  }

  if (rawDate instanceof Date) {
    return rawDate.getFullYear().toString();
  }

  const text = rawDate.toString().trim();
  if (!text) {
    return (new Date()).getFullYear().toString();
  }

  const isoMatch = text.match(/^(\d{4})/);
  if (isoMatch) {
    return isoMatch[1];
  }

  const date = new Date(text);
  if (!isNaN(date.getTime())) {
    return date.getFullYear().toString();
  }

  return (new Date()).getFullYear().toString();
}

function parseActivityCode(code) {
  if (!code) return null;
  const parts = code.toString().split('-').map(part => part.trim()).filter(Boolean);
  if (parts.length === 3) {
    return {
      area: parts[0] || '',
      subproceso: '',
      plan: '',
      fuente: '',
      year: parts[1] || '',
      consecutivo: parts[2] || ''
    };
  }

  if (parts.length === 4) {
    return {
      area: parts[0] || '',
      subproceso: parts[1] || '',
      plan: '',
      fuente: '',
      year: parts[2] || '',
      consecutivo: parts[3] || ''
    };
  }

  if (parts.length === 5) {
    return {
      area: parts[0] || '',
      subproceso: parts[1] || '',
      plan: parts[2] || '',
      fuente: parts[2] || '',
      year: parts[3] || '',
      consecutivo: parts[4] || ''
    };
  }

  if (parts.length >= 6) {
    return {
      area: parts[0] || '',
      subproceso: parts[1] || '',
      plan: parts[2] || '',
      fuente: parts[3] || '',
      year: parts[4] || '',
      consecutivo: parts[5] || ''
    };
  }

  return null;
}

function getNextActivitySequence(sheet, areaCode, year, activityIdToIgnore) {
  if (!sheet) {
    return 1;
  }

  const range = sheet.getDataRange();
  const values = range.getValues();
  if (!values.length) {
    return 1;
  }

  const headers = values[0];
  const codeIndex = headers.indexOf('codigo');
  const idIndex = headers.indexOf('actividad_id');

  if (codeIndex === -1) {
    return 1;
  }

  let maxSequence = 0;
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (!row || !row.length) continue;

    if (activityIdToIgnore && idIndex !== -1) {
      const rowId = row[idIndex];
      if (rowId !== null && rowId !== undefined) {
        if (rowId.toString() === activityIdToIgnore.toString()) {
          continue;
        }
      }
    }

    const existingCode = row[codeIndex];
    if (!existingCode) continue;

    const parsed = parseActivityCode(existingCode);
    if (!parsed) continue;

    if (parsed.area === areaCode && parsed.year === year) {
      const sequenceNumber = parseInt(parsed.consecutivo, 10);
      if (!isNaN(sequenceNumber) && sequenceNumber > maxSequence) {
        maxSequence = sequenceNumber;
      }
    }
  }

  return maxSequence + 1;
}

function generateActivityCode(sheet, context) {
  const {
    activityId,
    areaLabel,
    fechaInicio,
    currentCode
  } = context || {};

  let areaSegment = getAreaAcronym(areaLabel);
  if (!areaSegment) {
    areaSegment = buildAcronymSegment(areaLabel, 4, 'AREA').toUpperCase();
  }

  const yearSegment = extractYearFromDate(fechaInicio);

  let sequenceSegment = null;
  if (currentCode) {
    const parsedCurrent = parseActivityCode(currentCode);
    if (parsedCurrent && parsedCurrent.area === areaSegment && parsedCurrent.year === yearSegment) {
      sequenceSegment = parsedCurrent.consecutivo || null;
    }
  }

  if (!sequenceSegment) {
    const nextSequence = getNextActivitySequence(sheet, areaSegment, yearSegment, activityId);
    sequenceSegment = ('000' + nextSequence).slice(-3);
  }

  return [areaSegment, yearSegment, sequenceSegment].join('-');
}

/**
 * Mapeo de campos de formulario a campos de base de datos
 */
const FORM_FIELD_MAPPING = {
  'subproceso_id': 'subproceso_id',
  'mipg': 'mipg',
  'linea_trabajo_id': 'linea_trabajo_id',
  'linea_trabajo': 'linea_trabajo',
  'linea_accion_id': 'linea_id',
  'linea_id': 'linea_id',
  'descripcion_actividad': 'descripcion_actividad',
  'indicador_id': 'indicador_id',
  'indicador': 'indicador',
  'indicador_detalle': 'indicador_detalle',
  'tipo_indicador': 'tipo_indicador',
  'meta_valor': 'meta_valor',
  'meta_texto': 'meta_texto',
  'meta_indicador_valor': 'meta_valor',
  'meta_indicador_detalle': 'meta_texto',
  'presupuesto_programado': 'presupuesto_programado',
  'fuente': 'fuente',
  'plan_id': 'plan_id',
  'plan_ids': 'plan_ids',
  'riesgos': 'riesgos',
  'riesgo_porcentaje': 'riesgo_porcentaje',
  'responsable': 'responsable',
  'fecha_inicio_planeada': 'fecha_inicio_planeada',
  'fecha_fin_planeada': 'fecha_fin_planeada',
  'estado': 'estado'
};

function stripFirstNumericSegment(text) {
  if (text === null || text === undefined) {
    return '';
  }

  const raw = text.toString();
  const match = raw.match(/[0-9]+(?:[.,][0-9]+)?/);
  if (!match) {
    return raw.trim();
  }

  const startIndex = match.index || 0;
  const endIndex = startIndex + match[0].length;
  const before = raw.slice(0, startIndex);
  const after = raw.slice(endIndex);

  const cleanedBefore = before.replace(/\s+/g, ' ').trim();
  let cleanedAfter = after.replace(/^([\s%:;,-]+)/, '');
  cleanedAfter = cleanedAfter.replace(/\s+/g, ' ').trim();

  if (cleanedBefore && cleanedAfter) {
    return `${cleanedBefore} ${cleanedAfter}`.replace(/\s+/g, ' ').trim();
  }

  if (cleanedBefore) {
    return cleanedBefore.replace(/\s+/g, ' ').trim();
  }

  if (cleanedAfter) {
    return cleanedAfter.replace(/\s+/g, ' ').trim();
  }

  return '';
}

function formatMetaValorOutput(value) {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  let numeric = value;
  if (typeof numeric !== 'number') {
    numeric = normalizeMetaValue(numeric);
  }

  if (!isFinite(numeric)) {
    return '';
  }

  return Number.isInteger(numeric) ? String(numeric) : numeric.toString();
}

function composeMetaFullText(metaValor, metaTexto) {
  const valorString = formatMetaValorOutput(metaValor);
  const textoString = (metaTexto || '').toString().trim();

  if (valorString && textoString) {
    return `${valorString} ${textoString}`.replace(/\s+/g, ' ').trim();
  }

  if (valorString) {
    return valorString;
  }

  return textoString;
}

function pickMetaFullText(metaValor, metaTexto, originalText) {
  const original = (originalText || '').toString().trim();
  if (original) {
    return original;
  }
  return composeMetaFullText(metaValor, metaTexto);
}

function extractMetaComponents(primary, fallback) {
  const basePrimary = primary || {};
  const baseFallback = fallback || {};
  const merged = Object.assign({}, baseFallback, basePrimary);

  const metaValorCandidates = [
    basePrimary.meta_valor,
    basePrimary.metaValor,
    basePrimary.meta_indicador_valor,
    basePrimary.meta,
    merged.meta_valor,
    merged.metaValor,
    merged.meta_indicador_valor,
    merged.meta
  ];

  let metaValorCandidate = metaValorCandidates.find(value => value !== undefined && value !== null && value !== '');
  if (metaValorCandidate === undefined) {
    const rawTextCandidate = merged.meta_texto_completo || merged.meta_indicador_detalle || merged.meta_detalle || '';
    if (rawTextCandidate) {
      metaValorCandidate = rawTextCandidate;
    }
  }

  const metaValor = normalizeMetaValue(metaValorCandidate);

  let metaTexto = basePrimary.meta_texto !== undefined && basePrimary.meta_texto !== null
    ? basePrimary.meta_texto
    : '';
  metaTexto = metaTexto.toString().trim();

  if (!metaTexto) {
    metaTexto = merged.meta_texto ? merged.meta_texto.toString().trim() : '';
  }

  const originalCandidates = [
    basePrimary.meta_texto_completo,
    basePrimary.meta_indicador_detalle,
    basePrimary.meta_detalle,
    basePrimary.metaDescripcion,
    basePrimary.metaOriginal,
    merged.meta_texto_completo,
    merged.meta_indicador_detalle,
    merged.meta_detalle,
    merged.metaDescripcion
  ];

  let originalText = originalCandidates.find(value => value !== undefined && value !== null && value.toString().trim() !== '');
  originalText = originalText ? originalText.toString() : '';

  if (!metaTexto && originalText) {
    metaTexto = stripFirstNumericSegment(originalText);
  }

  const composedText = composeMetaFullText(metaValor, metaTexto);
  const displayText = pickMetaFullText(metaValor, metaTexto, originalText);

  return {
    valor: metaValor,
    texto: metaTexto,
    original: (originalText || '').toString().trim(),
    composed: composedText,
    display: displayText
  };
}

function getMetaValorFromActivity(activity) {
  if (!activity || typeof activity !== 'object') {
    return 0;
  }

  const metaInfo = extractMetaComponents(activity);
  return metaInfo.valor;
}

function getMetaTextoFromActivity(activity) {
  if (!activity || typeof activity !== 'object') {
    return '';
  }

  const metaInfo = extractMetaComponents(activity);
  return metaInfo.texto;
}

function resolveRiskCategory(percent) {
  const normalized = normalizeRiskPercentage(percent);
  if (normalized === null) {
    return {
      id: '',
      label: 'Sin clasificar',
      min: 0,
      max: 100,
      percent: null,
      rangeLabel: '0% - 100%'
    };
  }

  const config = RISK_CATEGORY_CONFIG.find(item => normalized >= item.min && normalized <= item.max)
    || RISK_CATEGORY_CONFIG[RISK_CATEGORY_CONFIG.length - 1];

  return {
    ...config,
    percent: normalized,
    rangeLabel: `${config.min}% - ${config.max}%`
  };
}

function normalizeActivityRecord(activity, fallback) {
  if (!activity || typeof activity !== 'object') {
    return activity;
  }

  var estadoRevisionNormalizado = normalizeReviewStateValue(activity.estado_revision);
  if (!estadoRevisionNormalizado && fallback && typeof fallback === 'object') {
    estadoRevisionNormalizado = normalizeReviewStateValue(fallback.estado_revision);
  }

  var estadoNormalizado = normalizeReviewStateValue(activity.estado);
  if (!estadoNormalizado && estadoRevisionNormalizado) {
    estadoNormalizado = estadoRevisionNormalizado;
  }

  const metaInfo = extractMetaComponents(activity, fallback);
  const rawRiskValue = activity.riesgo_porcentaje !== undefined && activity.riesgo_porcentaje !== ''
    ? activity.riesgo_porcentaje
    : (fallback && fallback.riesgo_porcentaje !== undefined ? fallback.riesgo_porcentaje : null);
  const riskPercent = normalizeRiskPercentage(rawRiskValue);
  const riskCategory = resolveRiskCategory(riskPercent);

  return {
    ...activity,
    estado: estadoNormalizado || activity.estado || '',
    estado_revision: estadoRevisionNormalizado || activity.estado_revision || '',
    meta_valor: metaInfo.valor,
    meta_texto: metaInfo.texto,
    meta_texto_completo: metaInfo.display,
    meta_texto_original: metaInfo.original,
    meta_indicador_valor: metaInfo.valor,
    meta_indicador_detalle: metaInfo.display,
    riesgo_porcentaje: riskPercent,
    riesgo_categoria: riskCategory.id,
    riesgo_categoria_label: riskCategory.label,
    riesgo_categoria_min: riskCategory.min,
    riesgo_categoria_max: riskCategory.max,
    riesgo_categoria_rango: riskCategory.rangeLabel
  };
}

function getSheetHeaders(sheet) {
  if (!sheet) {
    return [];
  }

  const lastColumn = sheet.getLastColumn();
  if (lastColumn <= 0) {
    return [];
  }

  const headerRange = sheet.getRange(1, 1, 1, lastColumn);
  const values = headerRange.getValues();
  if (!values || !values.length) {
    return [];
  }

  return values[0].map(cell => (cell === null || cell === undefined) ? '' : cell.toString().trim());
}

function normalizePlanSelectionInput(input) {
  const values = [];
  if (Array.isArray(input)) {
    input.forEach(item => {
      if (item === null || item === undefined) return;
      const trimmed = item.toString().trim();
      if (trimmed) values.push(trimmed);
    });
    return values;
  }

  if (input === null || input === undefined) {
    return values;
  }

  const raw = input.toString();
  if (!raw) {
    return values;
  }

  if (raw.indexOf(',') !== -1) {
    raw.split(',').forEach(part => {
      const trimmed = part.trim();
      if (trimmed) values.push(trimmed);
    });
  } else {
    const trimmed = raw.trim();
    if (trimmed) values.push(trimmed);
  }

  return values;
}

function normalizeFuenteSelectionInput(input) {
  return normalizePlanSelectionInput(input);
}

let PLAN_LOOKUP_CACHE = null;

function getPlanLookupCache() {
  if (PLAN_LOOKUP_CACHE) {
    return PLAN_LOOKUP_CACHE;
  }

  PLAN_LOOKUP_CACHE = {
    items: [],
    byId: {},
    byCode: {},
    byLabel: {}
  };

  try {
    const response = getCatalogByType ? getCatalogByType('plan', true) : null;
    if (response && response.success && Array.isArray(response.data)) {
      PLAN_LOOKUP_CACHE.items = response.data;
      response.data.forEach(item => {
        const idKey = item.id ? item.id.toString().trim() : '';
        const codeKey = item.code ? item.code.toString().trim() : '';
        const labelKey = item.label ? normalizeText(item.label) : '';

        if (idKey && !PLAN_LOOKUP_CACHE.byId[idKey]) {
          PLAN_LOOKUP_CACHE.byId[idKey] = item;
        }
        if (codeKey && !PLAN_LOOKUP_CACHE.byCode[codeKey]) {
          PLAN_LOOKUP_CACHE.byCode[codeKey] = item;
        }
        if (labelKey && !PLAN_LOOKUP_CACHE.byLabel[labelKey]) {
          PLAN_LOOKUP_CACHE.byLabel[labelKey] = item;
        }
      });
    }
  } catch (error) {
    console.error('[ERROR] getPlanLookupCache:', error);
  }

  return PLAN_LOOKUP_CACHE;
}

let FUENTE_LOOKUP_CACHE = null;

function getFuenteLookupCache() {
  if (FUENTE_LOOKUP_CACHE) {
    return FUENTE_LOOKUP_CACHE;
  }

  FUENTE_LOOKUP_CACHE = {
    items: [],
    byCode: {},
    byLabel: {}
  };

  try {
    const response = getCatalogByType ? getCatalogByType('fuente', true) : null;
    if (response && response.success && Array.isArray(response.data)) {
      FUENTE_LOOKUP_CACHE.items = response.data;
      response.data.forEach(item => {
        if (!item) return;
        const codeKeyCandidates = [item.code, item.codigo, item.id, item.value, item.key];
        codeKeyCandidates.forEach(candidate => {
          if (candidate !== null && candidate !== undefined) {
            const key = String(candidate).trim();
            if (key && !FUENTE_LOOKUP_CACHE.byCode[key]) {
              FUENTE_LOOKUP_CACHE.byCode[key] = item;
            }
          }
        });

        if (item.label) {
          const labelKey = normalizeText(item.label);
          if (labelKey && !FUENTE_LOOKUP_CACHE.byLabel[labelKey]) {
            FUENTE_LOOKUP_CACHE.byLabel[labelKey] = item;
          }
        }
      });
    }
  } catch (error) {
    console.error('[WARN] getFuenteLookupCache error:', error);
  }

  return FUENTE_LOOKUP_CACHE;
}

function resolveFuenteSelection(data) {
  try {
    const lookup = getFuenteLookupCache();
    const source = data || {};
    const codes = [];
    const labels = [];
    const seenCodes = {};
    const seenLabelKeys = {};

    const addItem = (item) => {
      if (!item) return;
      const codeValue = item.code !== undefined && item.code !== null ? String(item.code).trim() : '';
      if (codeValue && !seenCodes[codeValue]) {
        seenCodes[codeValue] = true;
        codes.push(codeValue);
      }
      const labelValue = item.label ? String(item.label).trim() : '';
      const labelKey = labelValue ? normalizeText(labelValue) : '';
      if (labelValue && labelKey && !seenLabelKeys[labelKey]) {
        seenLabelKeys[labelKey] = true;
        labels.push(labelValue);
      }
    };

    const addCode = (value) => {
      if (value === null || value === undefined) return;
      const raw = String(value).trim();
      if (!raw || seenCodes[raw]) return;
      let item = lookup.byCode[raw];
      if (!item) {
        const normalized = normalizeText(raw);
        if (normalized && lookup.byLabel[normalized]) {
          item = lookup.byLabel[normalized];
        }
      }
      if (item) {
        addItem(item);
      } else {
        seenCodes[raw] = true;
        codes.push(raw);
      }
    };

    const addLabel = (value) => {
      if (value === null || value === undefined) return;
      const raw = String(value).trim();
      if (!raw) return;
      const labelKey = normalizeText(raw);
      if (labelKey && seenLabelKeys[labelKey]) return;
      let item = (labelKey && lookup.byLabel[labelKey]) || lookup.byCode[raw];
      if (item) {
        addItem(item);
      } else if (labelKey && !seenLabelKeys[labelKey]) {
        seenLabelKeys[labelKey] = true;
        labels.push(raw);
      }
    };

    const codeCandidates = []
      .concat(normalizeFuenteSelectionInput(source.fuente_codigos))
      .concat(normalizeFuenteSelectionInput(source.fuente_codigo))
      .concat(normalizeFuenteSelectionInput(source.fuente_ids))
      .concat(normalizeFuenteSelectionInput(source.fuente_id))
      .concat(normalizeFuenteSelectionInput(source.fuenteCode))
      .concat(normalizeFuenteSelectionInput(source.fuente_code))
      .concat(normalizeFuenteSelectionInput(source.fuenteSeleccion))
      .concat(normalizeFuenteSelectionInput(source.fuente));

    codeCandidates.forEach(addCode);

    const labelCandidates = []
      .concat(normalizeFuenteSelectionInput(source.fuente_nombres))
      .concat(normalizeFuenteSelectionInput(source.fuente_nombre))
      .concat(normalizeFuenteSelectionInput(source.fuente_label))
      .concat(normalizeFuenteSelectionInput(source.fuenteLabel))
      .concat(normalizeFuenteSelectionInput(source.fuente));

    labelCandidates.forEach(addLabel);

    const codeString = codes.join(', ');
    const labelString = labels.join(', ');

    return {
      codes: codes,
      labels: labels,
      code: codes.length ? codes[0] : '',
      label: labels.length ? labels[0] : '',
      codeString: codeString,
      labelString: labelString
    };
  } catch (error) {
    console.error('[WARN] resolveFuenteSelection error:', error);
    const fallbackCodes = normalizeFuenteSelectionInput(
      data && (data.fuente_codigos || data.fuente_codigo || data.fuente_ids || data.fuente_id || data.fuente)
    );
    const fallbackLabels = normalizeFuenteSelectionInput(
      data && (data.fuente_nombres || data.fuente_nombre || data.fuente)
    );
    const codeString = fallbackCodes.join(', ');
    const labelString = fallbackLabels.length ? fallbackLabels.join(', ') : codeString;
    return {
      codes: fallbackCodes,
      labels: fallbackLabels.length ? fallbackLabels : (codeString ? [codeString] : []),
      code: fallbackCodes.length ? fallbackCodes[0] : '',
      label: labelString || '',
      codeString: codeString,
      labelString: labelString
    };
  }
}

function resolvePlanSelection(data) {
  const lookup = getPlanLookupCache();
  const ids = [];
  const labels = [];
  const seenIds = new Set();
  const seenLabelKeys = new Set();

  const pushPlanItem = (item) => {
    if (!item) return;
    const idValue = item.id ? item.id.toString().trim() : '';
    if (idValue && !seenIds.has(idValue)) {
      seenIds.add(idValue);
      ids.push(idValue);
    }

    const labelValue = item.label ? item.label.toString().trim() : '';
    if (labelValue) {
      const labelKey = normalizeText(labelValue);
      if (!seenLabelKeys.has(labelKey)) {
        seenLabelKeys.add(labelKey);
        labels.push(labelValue);
      }
    }
  };

  const pushLooseLabel = (value) => {
    if (value === null || value === undefined) return;
    const text = value.toString().trim();
    if (!text) return;
    const key = normalizeText(text);
    if (!seenLabelKeys.has(key)) {
      seenLabelKeys.add(key);
      labels.push(text);
    }
  };

  const idCandidates = []
    .concat(normalizePlanSelectionInput(data.plan_ids))
    .concat(normalizePlanSelectionInput(data.plan_id))
    .concat(normalizePlanSelectionInput(data.plan_codes));

  idCandidates.forEach(value => {
    if (value === null || value === undefined) return;
    const raw = value.toString().trim();
    if (!raw) return;
    const normalized = normalizeText(raw);

    let planItem = lookup.byId[raw] || lookup.byCode[raw];
    if (!planItem && normalized) {
      planItem = lookup.byLabel[normalized];
    }

    if (planItem) {
      pushPlanItem(planItem);
    } else {
      pushLooseLabel(raw);
      if (!seenIds.has(raw)) {
        seenIds.add(raw);
        ids.push(raw);
      }
    }
  });

  const labelCandidates = []
    .concat(normalizePlanSelectionInput(data.plan || data.plan_nombre || data.planNombre))
    .concat(normalizePlanSelectionInput(data.plan_display))
    .concat(Array.isArray(data.plan_labels) ? data.plan_labels : [])
    .concat(Array.isArray(data.planNames) ? data.planNames : [])
    .concat(Array.isArray(data.plan_nombres) ? data.plan_nombres : []);

  labelCandidates.forEach(value => {
    if (value === null || value === undefined) return;
    const raw = value.toString().trim();
    if (!raw) return;
    const normalized = normalizeText(raw);

    let planItem = lookup.byLabel[normalized];
    if (!planItem) {
      planItem = lookup.byId[raw] || lookup.byCode[raw];
    }

    if (planItem) {
      pushPlanItem(planItem);
    } else {
      pushLooseLabel(raw);
    }
  });

  return {
    ids: ids,
    labels: labels,
    labelString: labels.join(', ')
  };
}

function hydrateActivityFuente(activity) {
  if (!activity || typeof activity !== 'object') {
    return activity;
  }

  const fuenteSelection = resolveFuenteSelection(activity);
  const codeCandidates = fuenteSelection.codes.length
    ? fuenteSelection.codes
    : normalizeFuenteSelectionInput(
        activity.fuente_codigos_lista || activity.fuente_codigos || activity.fuente_ids || activity.fuente_codigo || activity.fuente_id || activity.fuente
      );
  const labelCandidates = fuenteSelection.labels.length
    ? fuenteSelection.labels
    : normalizeFuenteSelectionInput(
        activity.fuente_nombres_lista || activity.fuente_nombres || activity.fuente_nombre || activity.fuente
      );
  const labelString = fuenteSelection.labelString || (labelCandidates.length ? labelCandidates.join(', ') : (activity.fuente_nombre || activity.fuente || ''));
  const codeString = fuenteSelection.codeString || (codeCandidates.length ? codeCandidates.join(', ') : (activity.fuente_codigo || activity.fuente_id || ''));

  const hydrated = {
    ...activity,
    fuente: labelString,
    fuente_id: codeCandidates.length === 1 ? codeCandidates[0] : (activity.fuente_id || ''),
    fuente_codigo: codeString,
    fuente_codigos: codeCandidates,
    fuente_ids: codeCandidates,
    fuente_nombre: labelString,
    fuente_nombres: labelCandidates
  };

  delete hydrated.fuente_codigos_lista;
  delete hydrated.fuente_nombres_lista;

  return hydrated;
}

// ==================== MANEJADOR PRINCIPAL ====================

/**
 * Manejador principal para requests de actividades
 * @param {Object} body - Request body con path y payload
 * @returns {Object} Respuesta formateada
 */
function handleActivityRequest(body) {
  try {
    const path = body.path || '';
    const payload = body.payload || {};

    // Router para endpoints de actividades
    switch (path) {
      // Endpoints CRUD básicos
      case 'activities/create':
        return createActivity(payload);
      
      case 'activities/getAll':
        return getAllActivities(payload.filters);
      
      case 'activities/getById':
        return getActivityById(payload.id);
      
      case 'activities/update':
        return updateActivity(payload.id, payload.data);
      
      case 'activities/delete':
        return deleteActivity(payload.id);

      case 'activities/review':
        return updateActivityReviewStatus(payload);
      
      // Endpoints de búsqueda y filtros
      case 'activities/search':
        return searchActivities(payload);
      
      case 'activities/filter':
        return filterActivities(payload);
      
      // Endpoints de reportes
      case 'activities/report':
        return generateActivityReport(payload);
      
      case 'activities/export':
        return exportActivities(payload);
      
      // Endpoints de validación
      case 'activities/validate':
        return validateActivity(payload);
      
      default:
        return formatResponse(false, null, '', `Endpoint de actividades '${path}' no reconocido`);
    }
    
  } catch (error) {
    console.error('Error en handleActivityRequest:', error);
    return handleError(error, 'handleActivityRequest');
  }
}

// ==================== FUNCIONES CRUD BÁSICAS ====================

/**
 * Crea una nueva actividad
 * @param {Object} data - Datos de la actividad
 * @returns {Object} Respuesta con la actividad creada
 */
function createActivity(data) {
  console.log('[DEBUG] createActivity: === INICIO ===');
  console.log('[DEBUG] createActivity: Datos recibidos:', JSON.stringify(data, null, 2));
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (lockError) {
    console.error('[ERROR] createActivity: No se pudo obtener lock:', lockError);
    return formatResponse(false, null, '', ['El sistema está ocupado procesando otra solicitud. Intenta nuevamente en unos segundos.']);
  }

  try {
    // Validación básica más detallada
    if (!data || typeof data !== 'object') {
  const error = 'Datos de actividad requeridos';
  console.error('[ERROR] createActivity: ' + error);
      return formatResponse(false, null, '', [error]);
    }
    
    if (!data.descripcion_actividad || typeof data.descripcion_actividad !== 'string' || data.descripcion_actividad.trim() === '') {
  const error = 'Descripción de actividad es requerida';
  console.error('[ERROR] createActivity: ' + error);
      return formatResponse(false, null, '', [error]);
    }

  console.log('[OK] createActivity: Validación básica OK');
    
    // Validar datos de actividad con reglas de negocio
  console.log('[DEBUG] createActivity: Validando datos con reglas de negocio...');
    const validation = validateActivityData(data, 'create');
    if (!validation.valid) {
  console.error('[ERROR] createActivity: Errores de validación:', validation.errors);
      return formatResponse(false, null, '', validation.errors);
    }
  console.log('[OK] createActivity: Validación de reglas de negocio OK');
    
  const presupuestoTotal = normalizeBudgetValue(data.presupuesto_programado);
  const metaComponents = extractMetaComponents(data);
  const metaTotal = metaComponents.valor;
  const metaTextoSinNumero = metaComponents.texto;
  const metaTextoOriginal = metaComponents.original;
  const metaTextoDisplay = metaComponents.display;
    const bimestresPayload = Array.isArray(data.bimestres) ? data.bimestres : [];
    const bimestresValidation = validateBimestreDistribution(bimestresPayload, presupuestoTotal, {
      requireCompleteSet: true,
      totalMeta: metaTotal
    });
    if (!bimestresValidation.ok) {
  console.error('[ERROR] createActivity: Validación de bimestres falló:', bimestresValidation.errors);
      return formatResponse(false, null, '', bimestresValidation.errors);
    }
    const normalizedBimestres = bimestresValidation.bimestres.map(item => ({ ...item }));
    const sumaBimestres = bimestresValidation.sum;
    const diferenciaBimestres = bimestresValidation.difference;
    const sumaMetaBimestres = bimestresValidation.metaSum;
    const diferenciaMetaBimestres = bimestresValidation.metaDifference;

  const planSelection = resolvePlanSelection(data);
  const riesgoPorcentaje = normalizeRiskPercentage(
    data.riesgo_porcentaje ?? data.riesgoPorcentaje ?? data.riesgo_percent ?? data.riesgoPercent ?? data.riesgo
  );
    
    // Generar ID único ANTES de obtener la hoja
    let activityId;
    try {
      activityId = generateUniqueId('ACT');
  console.log('[OK] createActivity: ID generado:', activityId);
    } catch (idError) {
  console.error('[ERROR] createActivity: Error generando ID:', idError);
      return formatResponse(false, null, '', [`Error generando ID: ${idError.message}`]);
    }
    
  const fuenteSelection = resolveFuenteSelection(data);

  // Obtener hoja de actividades
    let sheet;
    try {
  console.log('[DEBUG] createActivity: Obteniendo hoja de actividades...');
      sheet = getOrCreateActivitiesSheet();
  console.log('[OK] createActivity: Hoja obtenida:', sheet.getName());
    } catch (sheetError) {
  console.error('[ERROR] createActivity: Error obteniendo hoja:', sheetError);
      return formatResponse(false, null, '', [`Error accediendo a hoja: ${sheetError.message}`]);
    }
    
    // Preparar datos básicos
  console.log('[DEBUG] createActivity: Analizando datos de usuario...');
  console.log('[DEBUG] createActivity: data.usuario =', data.usuario);
  console.log('[DEBUG] createActivity: data.correo =', data.correo);
  console.log('[DEBUG] createActivity: data.email =', data.email);
  console.log('[DEBUG] createActivity: data.creado_por =', data.creado_por);
    
    // Determinar el email del usuario con prioridad correcta
    let userEmail = 'sistema@ungrd.gov.co'; // fallback por defecto
    
    if (data.email && data.email !== 'usuario_actual') {
      userEmail = data.email;
  console.log('[OK] createActivity: Usando data.email:', userEmail);
    } else if (data.correo && data.correo !== 'usuario_actual') {
      userEmail = data.correo;
  console.log('[OK] createActivity: Usando data.correo:', userEmail);
    } else if (data.creado_por && data.creado_por !== 'usuario_actual') {
      userEmail = data.creado_por;
  console.log('[OK] createActivity: Usando data.creado_por:', userEmail);
    } else if (data.usuario && data.usuario !== 'usuario_actual' && data.usuario.includes('@')) {
      userEmail = data.usuario;
  console.log('[OK] createActivity: Usando data.usuario (contiene @):', userEmail);
    } else {
  console.log('[WARN] createActivity: No se encontró email válido, usando fallback:', userEmail);
    }

  const indicadorTexto = (data.indicador || data.indicador_detalle || data.indicador_texto || '').toString().trim();
  const defaultReviewState = (SYSTEM_CONFIG.REVIEW_STATES && SYSTEM_CONFIG.REVIEW_STATES.length)
    ? SYSTEM_CONFIG.REVIEW_STATES[0]
    : 'Sin revisión';
  const estadoInicial = normalizeReviewStateValue(data.estado || defaultReviewState) || defaultReviewState;
  const estadoRevisionInicial = normalizeReviewStateValue(
    data.estado_revision || data.estadoRevision || estadoInicial
  ) || defaultReviewState;

  const fuenteCodesResolved = fuenteSelection.codes && fuenteSelection.codes.length
    ? fuenteSelection.codes
    : normalizeFuenteSelectionInput(
        data.fuente_codigos || data.fuente_codigo || data.fuente_ids || data.fuente_id || data.fuente
      );
  const fuenteLabelsResolved = fuenteSelection.labels && fuenteSelection.labels.length
    ? fuenteSelection.labels
    : normalizeFuenteSelectionInput(data.fuente_nombres || data.fuente_nombre || data.fuente);
  const fuenteCodeString = fuenteSelection.codeString || (fuenteCodesResolved.length ? fuenteCodesResolved.join(', ') : '');
  const fuenteLabelString = (() => {
    if (fuenteSelection.labelString) return fuenteSelection.labelString;
    if (fuenteLabelsResolved.length) return fuenteLabelsResolved.join(', ');
    if (typeof data.fuente_nombre === 'string') return data.fuente_nombre;
    if (Array.isArray(data.fuente_nombre)) return data.fuente_nombre.join(', ');
    if (typeof data.fuente === 'string') return data.fuente;
    return '';
  })();

  const completeData = {
    actividad_id: activityId,
    codigo: '',
    descripcion_actividad: data.descripcion_actividad.trim(),
      area_id: data.area_id || '',
      subproceso_id: data.subproceso_id || '',
      objetivo_id: data.objetivo_id || '',
      estrategia_id: data.estrategia_id || '', 
      linea_trabajo_id: data.linea_trabajo_id || data.linea_trabajo_codigo || '',
      linea_trabajo: data.linea_trabajo || '',
      linea_accion_id: data.linea_accion_id || data.linea_id || '',
      linea_accion: data.linea_accion || data.linea || '',
      linea_id: data.linea_accion_id || data.linea_id || '',
      linea: data.linea_accion || data.linea || '',
      indicador_id: data.indicador_id || '',
      indicador: indicadorTexto,
      indicador_detalle: indicadorTexto,
      tipo_indicador: data.tipo_indicador || '',
      plan_ids: planSelection.ids,
      plan_id: planSelection.ids.length ? planSelection.ids[0] : '',
      plan_labels: planSelection.labels,
    plan: planSelection.labelString,
    riesgos: (data.riesgos || '').toString().trim(),
    riesgo_porcentaje: riesgoPorcentaje,
  plan_display: planSelection.labelString,
      bimestre_id: data.bimestre_id || '',
      mipg: data.mipg || '',
  fuente: fuenteLabelString || '',
  fuente_id: fuenteCodesResolved.length === 1 ? fuenteCodesResolved[0] : '',
  fuente_codigo: fuenteCodeString || '',
  fuente_codigos: fuenteCodeString || '',
  fuente_ids: fuenteCodeString || '',
  fuente_nombre: fuenteLabelString || '',
  fuente_nombres: fuenteLabelString || '',
  fuente_codigos_lista: fuenteCodesResolved,
  fuente_nombres_lista: fuenteLabelsResolved,
      usuario: data.usuario || 'sistema',
      creado_por: userEmail, // Usar el email determinado correctamente
    estado: estadoInicial,
    estado_revision: estadoRevisionInicial,
    revision_comentarios: '',
    revision_fecha: '',
    revision_por: '',
  // Guardar timestamps de auditoría como fecha-only (YYYY-MM-DD)
  creado_el: getCurrentDateOnly(),
  actualizado_el: getCurrentDateOnly()
    };
  completeData.presupuesto_programado = presupuestoTotal;
  completeData.meta_valor = metaTotal;
  completeData.meta_texto = metaTextoSinNumero;
  completeData.meta_texto_completo = metaTextoDisplay;
  completeData.meta_texto_original = metaTextoOriginal;
  completeData.meta_indicador_valor = metaTotal;
  completeData.meta_indicador_detalle = metaTextoDisplay;
    completeData.bimestres = normalizedBimestres.map(item => ({ ...item }));
    completeData.presupuesto_bimestres_total = sumaBimestres;
    completeData.presupuesto_bimestres_diferencia = diferenciaBimestres;
    completeData.meta_bimestres_total = sumaMetaBimestres;
    completeData.meta_bimestres_diferencia = diferenciaMetaBimestres;
    
  console.log('[OK] createActivity: creado_por final =', completeData.creado_por);
    
    // Resolver códigos a labels para guardar en la hoja
  console.log('[DEBUG] createActivity: Resolviendo códigos a labels...');
    const dataForSheet = { ...completeData };
    
    // Resolver área (priorizando subproceso y luego el área seleccionada directamente)
    if (data.subproceso_id) {
      const subprocesoResult = getCatalogByCode(data.subproceso_id);
      if (subprocesoResult.success) {
  console.log(` [OK] Subproceso resuelto: ${data.subproceso_id} -> ${subprocesoResult.data.label}`);
        dataForSheet.subproceso = subprocesoResult.data.label;
        
        // Resolver área padre
        if (subprocesoResult.data.parent_code) {
          const areaResult = getCatalogByCode(subprocesoResult.data.parent_code);
          if (areaResult.success) {
            console.log(` [OK] Área resuelta: ${subprocesoResult.data.parent_code} -> ${areaResult.data.label}`);
            dataForSheet.area = areaResult.data.label;
          } else {
            console.log(` [ERROR] No se pudo resolver área: ${subprocesoResult.data.parent_code}`);
            dataForSheet.area = subprocesoResult.data.parent_code;
          }
        } else {
          dataForSheet.area = '';
        }
      } else {
  console.log(` [ERROR] No se pudo resolver subproceso: ${data.subproceso_id}`);
        dataForSheet.subproceso = data.subproceso_id;
        dataForSheet.area = '';
      }
    } else {
      dataForSheet.subproceso = '';
      dataForSheet.area = '';
    }

    if (!dataForSheet.area && data.area_id) {
      const areaResult = getCatalogByCode(data.area_id);
      if (areaResult.success) {
        console.log(` [OK] Área resuelta directamente: ${data.area_id} -> ${areaResult.data.label}`);
        dataForSheet.area = areaResult.data.label;
      } else {
        console.log(` [WARN] No se pudo resolver área directamente, usando código recibido: ${data.area_id}`);
        dataForSheet.area = data.area_id;
      }
    }
    
    // Resolver línea de trabajo
    const lineaTrabajoCodigo = data.linea_trabajo_id || data.linea_trabajo_codigo;
    if (lineaTrabajoCodigo) {
      const lineaTrabajoResult = getCatalogByCode(lineaTrabajoCodigo);
      if (lineaTrabajoResult.success) {
        console.log(` [OK] Línea de trabajo resuelta: ${lineaTrabajoCodigo} -> ${lineaTrabajoResult.data.label}`);
        dataForSheet.linea_trabajo = lineaTrabajoResult.data.label;
      } else {
        console.log(` [ERROR] No se pudo resolver línea de trabajo: ${lineaTrabajoCodigo}`);
        dataForSheet.linea_trabajo = lineaTrabajoCodigo;
      }
    } else {
      dataForSheet.linea_trabajo = data.linea_trabajo || '';
    }

    // Resolver línea de acción
    const lineaAccionCodigo = data.linea_accion_id || data.linea_id;
    if (lineaAccionCodigo) {
      const lineaResult = getCatalogByCode(lineaAccionCodigo);
      if (lineaResult.success) {
        console.log(` [OK] Línea de acción resuelta: ${lineaAccionCodigo} -> ${lineaResult.data.label}`);
        dataForSheet.linea_accion = lineaResult.data.label;
        dataForSheet.linea = lineaResult.data.label;
      } else {
        console.log(` [ERROR] No se pudo resolver línea de acción: ${lineaAccionCodigo}`);
        dataForSheet.linea_accion = lineaAccionCodigo;
        dataForSheet.linea = lineaAccionCodigo;
      }
    } else {
      dataForSheet.linea_accion = data.linea_accion || data.linea || '';
      dataForSheet.linea = dataForSheet.linea_accion;
    }
    
    // Resolver indicador priorizando el texto ingresado por el usuario
    if (indicadorTexto) {
      dataForSheet.indicador = indicadorTexto;
    } else if (data.indicador_id) {
      const indicadorResult = getCatalogByCode(data.indicador_id);
      if (indicadorResult.success) {
  console.log(` [OK] Indicador resuelto: ${data.indicador_id} -> ${indicadorResult.data.label}`);
        dataForSheet.indicador = indicadorResult.data.label;
      } else {
  console.log(` [ERROR] No se pudo resolver indicador: ${data.indicador_id}`);
        dataForSheet.indicador = data.indicador_id; // fallback al código
      }
    } else {
      dataForSheet.indicador = '';
    }
    dataForSheet.indicador_detalle = indicadorTexto;
    
    // Resolver plan
    if (data.plan_id) {
      const planResult = getCatalogByCode(data.plan_id);
      if (planResult.success) {
  console.log(` [OK] Plan resuelto: ${data.plan_id} -> ${planResult.data.label}`);
        dataForSheet.plan = planResult.data.label;
      } else {
  console.log(` [ERROR] No se pudo resolver plan: ${data.plan_id}`);
        dataForSheet.plan = data.plan_id; // fallback al código
      }
    } else {
      dataForSheet.plan = '';
    }
    
    // Resolver MIPG
    if (data.mipg) {
      const mipgResult = getCatalogByCode(data.mipg);
      if (mipgResult.success) {
  console.log(` [OK] MIPG resuelto: ${data.mipg} -> ${mipgResult.data.label}`);
        dataForSheet.mipg = mipgResult.data.label;
      } else {
  console.log(` [ERROR] No se pudo resolver MIPG: ${data.mipg}`);
        dataForSheet.mipg = data.mipg; // fallback al código
      }
    } else {
      dataForSheet.mipg = '';
    }
    
    // Resolver fuente
    if (fuenteLabelString) {
      console.log(` [OK] Fuente resuelta: ${fuenteCodeString || data.fuente || 'n/a'} -> ${fuenteLabelString}`);
    } else if (data.fuente) {
      console.log(` [WARN] No se pudo resolver fuente, usando valor recibido: ${data.fuente}`);
    }

    dataForSheet.fuente = fuenteLabelString || data.fuente || '';
    dataForSheet.fuente_codigo = fuenteCodeString || data.fuente_codigo || '';
    dataForSheet.fuente_codigos = dataForSheet.fuente_codigo;
    
    // Asegurar que tenemos todos los campos básicos
  dataForSheet.meta_valor = metaTotal;
  dataForSheet.meta_texto = metaTextoSinNumero;
    dataForSheet.tipo_indicador = data.tipo_indicador || '';
  dataForSheet.presupuesto_programado = presupuestoTotal;
    dataForSheet.plan = planSelection.labelString;
    dataForSheet.riesgos = completeData.riesgos;
    dataForSheet.riesgo_porcentaje = riesgoPorcentaje === null ? '' : riesgoPorcentaje;
    
    // Para responsable, usar el email del usuario si no se proporciona otro valor
    dataForSheet.responsable = data.responsable || userEmail;
    
  // Normalizar fechas entrantes a formato YYYY-MM-DD (texto)
  dataForSheet.fecha_inicio_planeada = normalizeDateInput(data.fecha_inicio_planeada) || '';
  dataForSheet.fecha_fin_planeada = normalizeDateInput(data.fecha_fin_planeada) || '';
  dataForSheet.estado = completeData.estado;

  const activityCode = generateActivityCode(sheet, {
    activityId: activityId,
    areaLabel: dataForSheet.area,
    fechaInicio: dataForSheet.fecha_inicio_planeada,
    currentCode: data.codigo || data.codigo_generado
  });

  completeData.codigo = activityCode;
  dataForSheet.codigo = activityCode;
  completeData.area = dataForSheet.area;
  completeData.subproceso = dataForSheet.subproceso;
  completeData.plan = dataForSheet.plan;
  completeData.riesgos = dataForSheet.riesgos;
  completeData.riesgo_porcentaje = riesgoPorcentaje;
  completeData.fuente = dataForSheet.fuente;
  completeData.fuente_codigo = dataForSheet.fuente_codigo;
  completeData.fuente_codigos = dataForSheet.fuente_codigos;
  completeData.fuente_ids = dataForSheet.fuente_codigos;
  completeData.fuente_nombre = dataForSheet.fuente;
  completeData.fuente_nombres = dataForSheet.fuente;
  completeData.fecha_inicio_planeada = dataForSheet.fecha_inicio_planeada;
  completeData.fecha_fin_planeada = dataForSheet.fecha_fin_planeada;
  completeData.responsable = dataForSheet.responsable;
  completeData.indicador = dataForSheet.indicador;
  completeData.indicador_detalle = dataForSheet.indicador_detalle;
    
  console.log('[OK] createActivity: Datos preparados con labels:', JSON.stringify(dataForSheet, null, 2));
    
    // Insertar en la hoja usando método directo
    try {
  console.log('[DEBUG] createActivity: Insertando en hoja...');
      
      let sheetHeaders = getSheetHeaders(sheet).filter(header => header);
      if (!sheetHeaders.length) {
  console.log('[DEBUG] createActivity: Hoja sin encabezados, inicializando con ACTIVITY_HEADERS');
        sheet.getRange(1, 1, 1, ACTIVITY_HEADERS.length).setValues([ACTIVITY_HEADERS]);
        sheetHeaders = ACTIVITY_HEADERS.slice();
      }

      const headersToUse = sheetHeaders.length ? sheetHeaders : ACTIVITY_HEADERS.slice();

      const rowData = headersToUse.map(header => {
        if (!header) {
          return '';
        }
        if (Object.prototype.hasOwnProperty.call(dataForSheet, header)) {
          return dataForSheet[header];
        }
        if (Object.prototype.hasOwnProperty.call(completeData, header)) {
          return completeData[header];
        }
        return '';
      });
  console.log('[DEBUG] createActivity: Fila a insertar (con labels):', rowData);

      const rowCountBeforeInsert = sheet.getLastRow();
      sheet.appendRow(rowData);
  console.log('[OK] createActivity: Fila insertada exitosamente');

      try {
  writeBimestresForActivity(activityId, normalizedBimestres, { codigo: activityCode });
      } catch (distributionError) {
  console.error('[ERROR] createActivity: Error guardando distribución por bimestres:', distributionError);
        const currentLastRow = sheet.getLastRow();
        if (currentLastRow > rowCountBeforeInsert) {
          sheet.deleteRow(currentLastRow);
        }
        return formatResponse(false, null, '', [`Error guardando distribución por bimestres: ${distributionError.message}`]);
      }

      const bimestresGuardados = getBimestresForActivity(activityId);
      const sumaGuardada = sumBimestres(bimestresGuardados);
  const metaGuardada = sumMetaBimestres(bimestresGuardados);
      completeData.bimestres = bimestresGuardados.map(item => ({ ...item }));
      completeData.presupuesto_bimestres_total = sumaGuardada;
      completeData.presupuesto_bimestres_diferencia = roundCurrency(sumaGuardada - presupuestoTotal);
  completeData.meta_bimestres_total = metaGuardada;
  completeData.meta_bimestres_diferencia = Math.round((metaGuardada - metaTotal) * 100) / 100;

      const responseData = hydrateActivityFuente(
        normalizeActivityRecord({ actividad_id: activityId, ...completeData })
      );
      const response = formatResponse(
        true, 
        responseData, 
        'Actividad creada exitosamente'
      );
      
  console.log('[OK] createActivity: === FIN EXITOSO ===');
  console.log('[DEBUG] createActivity: Respuesta:', JSON.stringify(response, null, 2));
      return response;
      
    } catch (insertError) {
  console.error('[ERROR] createActivity: Error insertando:', insertError);
      return formatResponse(false, null, '', [`Error insertando actividad: ${insertError.message}`]);
    }
    
  } catch (error) {
  console.error('[ERROR] createActivity: Error general:', error);
  console.error('[ERROR] createActivity: Stack trace:', error.stack);
    return formatResponse(false, null, '', [`Error creando actividad: ${error.message}`]);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Obtiene todas las actividades con filtros opcionales
 * @param {Object} filters - Filtros de búsqueda
 * @returns {Object} Lista de actividades
 */
function getAllActivities(filters = {}) {
  try {
    const defaultReviewState = (SYSTEM_CONFIG.REVIEW_STATES && SYSTEM_CONFIG.REVIEW_STATES.length)
      ? SYSTEM_CONFIG.REVIEW_STATES[0]
      : 'Sin revisión';
    const activities = readSheetAsObjects(SYSTEM_CONFIG.SHEETS.ACTIVITIES, false).map(activity => {
      const estadoRevision = normalizeReviewStateValue(activity.estado_revision || defaultReviewState) || defaultReviewState;
      const estadoGeneral = normalizeReviewStateValue(activity.estado || estadoRevision) || activity.estado || estadoRevision || defaultReviewState;
      const planSelection = resolvePlanSelection(activity);
      const enriched = {
        ...activity,
        estado: estadoGeneral,
        estado_revision: estadoRevision,
        plan: planSelection.labelString || activity.plan || '',
        plan_display: planSelection.labelString || activity.plan || '',
        plan_ids: planSelection.ids,
        plan_id: planSelection.ids.length ? planSelection.ids[0] : '',
        plan_labels: planSelection.labels,
        revision_comentarios: activity.revision_comentarios || '',
        revision_fecha: activity.revision_fecha || '',
        revision_por: activity.revision_por || ''
      };
      return normalizeActivityRecord(enriched, activity);
    });
    
  let filteredActivities = activities.filter(activity => activity.actividad_id); // Solo actividades válidas
    
    // Aplicar filtros si existen
    if (filters.area_id) {
      filteredActivities = filteredActivities.filter(activity => {
        return activity.subproceso_id && isSubprocessOfArea(activity.subproceso_id, filters.area_id);
      });
    }
    
    if (filters.estado) {
      filteredActivities = filteredActivities.filter(activity => activity.estado === filters.estado);
    }

    if (filters.estado_revision) {
      filteredActivities = filteredActivities.filter(activity => activity.estado_revision === filters.estado_revision);
    }
    
    if (filters.onlyApproved) {
      filteredActivities = filteredActivities.filter(activity => activity.estado_revision === 'Aprobado');
    }
    
    if (filters.area) {
      const areaNormalized = normalizeText(filters.area);
      filteredActivities = filteredActivities.filter(activity => normalizeText(activity.area) === areaNormalized);
    }

    if (filters.area_label) {
      const areaNormalized = normalizeText(filters.area_label);
      filteredActivities = filteredActivities.filter(activity => normalizeText(activity.area) === areaNormalized);
    }
    
    if (filters.plan_id) {
      const rawPlanFilter = filters.plan_id.toString().trim();
      const normalizedPlanFilter = normalizeText(rawPlanFilter);
      filteredActivities = filteredActivities.filter(activity => {
        const activityPlanIds = Array.isArray(activity.plan_ids) ? activity.plan_ids : [];
        if (activityPlanIds.some(id => id === rawPlanFilter)) {
          return true;
        }
        const activityPlanLabels = Array.isArray(activity.plan_labels) ? activity.plan_labels : [];
        return activityPlanLabels.some(label => normalizeText(label) === normalizedPlanFilter);
      });
    }
    
    if (filters.responsable) {
      const searchTerm = normalizeText(filters.responsable);
      filteredActivities = filteredActivities.filter(activity => 
        normalizeText(activity.responsable).includes(searchTerm)
      );
    }

    const bimestresMap = getBimestresMapByActivity();
    filteredActivities = filteredActivities
      .map(activity => hydrateActivityFuente(activity))
      .map(activity => hydrateActivityWithBimestres(activity, bimestresMap));
    
    // Ordenar por fecha de creación (más recientes primero)
    filteredActivities.sort((a, b) => {
      const dateA = new Date(a.creado_el || '1970-01-01');
      const dateB = new Date(b.creado_el || '1970-01-01');
      return dateB - dateA;
    });
    
    return formatResponse(
      true, 
      filteredActivities, 
      `${filteredActivities.length} actividades obtenidas`,
      null,
      { 
        totalCount: activities.length,
        filteredCount: filteredActivities.length,
        filters: filters 
      }
    );
    
  } catch (error) {
    return handleError(error, 'getAllActivities');
  }
}

/**
 * Obtiene una actividad por su ID
 * @param {string} id - ID de la actividad
 * @returns {Object} Actividad encontrada
 */
function getActivityById(id) {
  if (!id) {
    return formatResponse(false, null, '', 'ID de actividad requerido');
  }
  
  try {
    const activity = findRowByField(SYSTEM_CONFIG.SHEETS.ACTIVITIES, 'actividad_id', id);
    
    if (!activity) {
      return formatResponse(false, null, '', `Actividad con ID '${id}' no encontrada`);
    }
    const planSelection = resolvePlanSelection(activity);
    const activityWithPlan = {
      ...hydrateActivityFuente(activity),
      plan: planSelection.labelString || activity.plan || '',
      plan_display: planSelection.labelString || activity.plan || '',
      plan_ids: planSelection.ids,
      plan_id: planSelection.ids.length ? planSelection.ids[0] : '',
      plan_labels: planSelection.labels
    };
    const hydratedActivity = hydrateActivityWithBimestres(activityWithPlan);
    
    return formatResponse(true, hydratedActivity, 'Actividad obtenida exitosamente');
    
  } catch (error) {
    return handleError(error, 'getActivityById');
  }
}

/**
 * Actualiza una actividad existente
 * @param {string} id - ID de la actividad
 * @param {Object} updateData - Datos a actualizar
 * @returns {Object} Resultado de la operación
 */
function updateActivity(id, updateData) {
  if (!id) {
    return formatResponse(false, null, '', 'ID de actividad requerido');
  }
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (lockError) {
    console.error('[ERROR] updateActivity: No se pudo obtener lock:', lockError);
    return formatResponse(false, null, '', ['El sistema está ocupado procesando otra solicitud. Intenta nuevamente en unos segundos.']);
  }

  try {
    // Verificar que la actividad existe
    const existing = getActivityById(id);
    if (!existing.success) return existing;
    const existingData = existing.data || {};
    const payload = updateData ? { ...updateData } : {};

    const existingDistribution = Array.isArray(existingData.bimestres) && existingData.bimestres.length
      ? existingData.bimestres.map(item => ({ ...item }))
      : getBimestresForActivity(id);

    const incomingBimestres = Array.isArray(payload.bimestres) ? payload.bimestres : null;
    const hasBudgetUpdate = Object.prototype.hasOwnProperty.call(payload, 'presupuesto_programado');
    const hasMetaUpdate = ['meta_valor', 'meta_indicador_valor', 'meta_texto', 'meta_indicador_detalle'].some(key => Object.prototype.hasOwnProperty.call(payload, key));
    const presupuestoObjetivo = hasBudgetUpdate
      ? normalizeBudgetValue(payload.presupuesto_programado)
      : normalizeBudgetValue(existingData.presupuesto_programado);
    const combinedForMeta = hasMetaUpdate ? { ...existingData, ...payload } : existingData;
    const metaInfo = extractMetaComponents(combinedForMeta, existingData);
    const metaObjetivo = metaInfo.valor;

    if (hasBudgetUpdate) {
      payload.presupuesto_programado = presupuestoObjetivo;
    }

    payload.meta_valor = metaObjetivo;
    payload.meta_texto = metaInfo.texto;
    payload.meta_indicador_valor = metaObjetivo;
    payload.meta_indicador_detalle = metaInfo.display;

    const bimestresParaValidar = incomingBimestres || existingDistribution;
    const bimestresValidation = validateBimestreDistribution(bimestresParaValidar, presupuestoObjetivo, {
      requireCompleteSet: true,
      totalMeta: metaObjetivo
    });
    if (!bimestresValidation.ok) {
      return formatResponse(false, null, '', bimestresValidation.errors);
    }
    const normalizedBimestres = bimestresValidation.bimestres.map(item => ({ ...item }));

    const sanitizedUpdateData = { ...payload };
    delete sanitizedUpdateData.bimestres;

    const sanitizedExisting = { ...existingData };
    delete sanitizedExisting.bimestres;
    delete sanitizedExisting.presupuesto_bimestres_total;
    delete sanitizedExisting.presupuesto_bimestres_diferencia;

    const mergedData = {
      ...sanitizedExisting,
      ...sanitizedUpdateData,
      presupuesto_programado: presupuestoObjetivo,
      meta_valor: metaObjetivo,
      meta_texto: metaInfo.texto,
      meta_indicador_valor: metaObjetivo,
      meta_indicador_detalle: metaInfo.display
    };

    const validation = validateActivityData(mergedData, 'update');
    if (!validation.valid) {
      return formatResponse(false, null, '', validation.errors);
    }
    
    const enrichedData = enrichActivityWithCatalogData(mergedData);
    const processedData = prepareActivityData(id, enrichedData, 'update');
    processedData.presupuesto_programado = presupuestoObjetivo;
  processedData.meta_valor = metaObjetivo;
  processedData.meta_texto = metaInfo.texto;
  processedData.meta_indicador_valor = metaObjetivo;
  processedData.meta_indicador_detalle = metaInfo.display;

    const sheetForCode = getOrCreateActivitiesSheet();
    const areaLabelForCode = enrichedData.area_nombre || mergedData.area || existingData.area || '';
    const subLabelForCode = enrichedData.subproceso_nombre || mergedData.subproceso || existingData.subproceso || '';
    const fechaInicioForCode = processedData.fecha_inicio_planeada || mergedData.fecha_inicio_planeada || existingData.fecha_inicio_planeada || '';

    const updatedCode = generateActivityCode(sheetForCode, {
      activityId: id,
      areaLabel: areaLabelForCode,
      fechaInicio: fechaInicioForCode,
      currentCode: existingData.codigo
    });

    processedData.codigo = updatedCode;
    processedData.area = areaLabelForCode;
    processedData.subproceso = subLabelForCode;

    let distributionWritten = false;
    if (incomingBimestres) {
      try {
  writeBimestresForActivity(id, normalizedBimestres, { codigo: updatedCode });
        distributionWritten = true;
      } catch (distributionError) {
        console.error('[ERROR] updateActivity: Error guardando distribución por bimestres:', distributionError);
        return formatResponse(false, null, '', [`Error guardando distribución por bimestres: ${distributionError.message}`]);
      }
    }
    
    const updated = updateRowByKey(SYSTEM_CONFIG.SHEETS.ACTIVITIES, 'actividad_id', id, processedData);
    
    if (!updated) {
      if (incomingBimestres && distributionWritten) {
        try {
          writeBimestresForActivity(id, existingDistribution, { codigo: existingData.codigo });
        } catch (revertError) {
          console.error('[ERROR] updateActivity: No se pudo revertir bimestres tras fallo de actualización:', revertError);
        }
      }
      return formatResponse(false, null, '', 'Error actualizando actividad en la hoja');
    }

  const finalDistribution = getBimestresForActivity(id);
    const sumaFinal = sumBimestres(finalDistribution);
  const metaFinal = sumMetaBimestres(finalDistribution);
    const responseDataRaw = {
      ...processedData,
      actividad_id: id,
      presupuesto_programado: presupuestoObjetivo,
      meta_valor: metaObjetivo,
      meta_texto: metaInfo.texto,
      meta_indicador_valor: metaObjetivo,
      meta_indicador_detalle: metaInfo.display,
      bimestres: finalDistribution.map(item => ({ ...item })),
      presupuesto_bimestres_total: sumaFinal,
      presupuesto_bimestres_diferencia: roundCurrency(sumaFinal - presupuestoObjetivo),
      meta_bimestres_total: metaFinal,
      meta_bimestres_diferencia: Math.round((metaFinal - metaObjetivo) * 100) / 100
    };
    const responseData = hydrateActivityFuente(
      normalizeActivityRecord(responseDataRaw, processedData)
    );

    return formatResponse(
      true, 
      responseData, 
      'Actividad actualizada exitosamente'
    );
    
  } catch (error) {
    return handleError(error, 'updateActivity');
  } finally {
    lock.releaseLock();
  }
}

/**
 * Elimina una actividad (eliminación lógica)
 * @param {string} id - ID de la actividad
 * @returns {Object} Resultado de la operación
 */
function deleteActivity(id) {
  if (!id) {
    return formatResponse(false, null, '', 'ID de actividad requerido');
  }
  
  try {
    // Verificar que existe
    const existing = getActivityById(id);
    if (!existing.success) return existing;
    
    // Marcar como eliminada o cancelada
    const result = updateActivity(id, { 
      estado: 'Cancelada',
      actualizado_el: getCurrentTimestamp()
    });
    
    if (result.success) {
      result.message = 'Actividad eliminada exitosamente';
    }
    
    return result;
    
  } catch (error) {
    return handleError(error, 'deleteActivity');
  }
}

// ==================== FUNCIONES DE ENRIQUECIMIENTO DE DATOS ====================

/**
 * Enriquece datos de actividad con información del catálogo
 * @param {Object} activityData - Datos de la actividad
 * @returns {Object} Datos enriquecidos
 */
function enrichActivityWithCatalogData(activityData) {
  try {
    const enriched = { ...activityData };
    
    // Derivar área y subproceso
    if (activityData.subproceso_id) {
      const subproceso = getCatalogByCode(activityData.subproceso_id);
      if (subproceso.success) {
        enriched.subproceso_nombre = subproceso.data.label;
        
        // Derivar área padre
        if (subproceso.data.parent_code) {
          const area = getCatalogByCode(subproceso.data.parent_code);
          if (area.success) {
            enriched.area_nombre = area.data.label;
          }
        }
      }
    }

    if (!enriched.area_nombre && activityData.area_id) {
      const areaDirect = getCatalogByCode(activityData.area_id);
      if (areaDirect.success) {
        enriched.area_nombre = areaDirect.data.label;
      }
    }
    
    // Derivar línea de trabajo
    const lineaTrabajoCodigo = activityData.linea_trabajo_id || activityData.linea_trabajo_codigo;
    if (lineaTrabajoCodigo) {
      const lineaTrabajo = getCatalogByCode(lineaTrabajoCodigo);
      if (lineaTrabajo.success) {
        enriched.linea_trabajo_nombre = lineaTrabajo.data.label;
      }
    }

    // Derivar estrategia y objetivo desde línea de acción
    const lineaAccionCodigo = activityData.linea_accion_id || activityData.linea_id;
    if (lineaAccionCodigo) {
      const linea = getCatalogByCode(lineaAccionCodigo);
      if (linea.success) {
        enriched.linea_accion_nombre = linea.data.label;
        enriched.linea_nombre = linea.data.label;
        
        // Derivar estrategia
        if (linea.data.parent_code) {
          const estrategia = getCatalogByCode(linea.data.parent_code);
          if (estrategia.success) {
            enriched.estrategia_nombre = estrategia.data.label;
            
            // Derivar objetivo
            if (estrategia.data.parent_code) {
              const objetivo = getCatalogByCode(estrategia.data.parent_code);
              if (objetivo.success) {
                enriched.objetivo_nombre = objetivo.data.label;
              }
            }
          }
        }
      }
    }
    
    return enriched;
    
  } catch (error) {
    console.error('Error enriqueciendo datos de actividad:', error);
    return activityData; // Devolver datos originales si hay error
  }
}

/**
 * Prepara datos de actividad para inserción/actualización
 * @param {string} activityId - ID de la actividad
 * @param {Object} data - Datos de la actividad
 * @param {string} operation - Operación ('create', 'update')
 * @returns {Object} Datos preparados
 */
function prepareActivityData(activityId, data, operation) {
  // Usar helper que devuelve YYYY-MM-DD
  const dateOnly = getCurrentDateOnly();
  const planData = resolvePlanSelection(data || {});
  const fuenteSelection = resolveFuenteSelection(data || {});

  const prepared = {};

  // Campos básicos
  prepared.actividad_id = activityId;
  prepared.subproceso_id = data.subproceso_id || '';
  prepared.mipg = data.mipg || '';
  prepared.linea_trabajo_id = data.linea_trabajo_id || data.linea_trabajo_codigo || '';
  prepared.linea_trabajo = data.linea_trabajo || '';
  prepared.linea_accion_id = data.linea_accion_id || data.linea_id || '';
  prepared.linea_accion = data.linea_accion || data.linea || '';
  prepared.linea_id = prepared.linea_accion_id;
  prepared.descripcion_actividad = data.descripcion_actividad || '';
  prepared.indicador_id = data.indicador_id || '';
  prepared.indicador = (data.indicador || data.indicador_detalle || data.indicador_texto || '').toString().trim();
  prepared.indicador_detalle = (data.indicador_detalle || data.indicador || data.indicador_texto || '').toString().trim();
  prepared.tipo_indicador = data.tipo_indicador || '';
  const metaInfo = extractMetaComponents(data);
  prepared.meta_valor = metaInfo.valor || '';
  prepared.meta_texto = metaInfo.texto || '';
  prepared.meta_texto_completo = metaInfo.display || '';
  prepared.meta_texto_original = metaInfo.original || '';
  prepared.meta_indicador_valor = metaInfo.valor || '';
  prepared.meta_indicador_detalle = metaInfo.display || '';
  if (data.presupuesto_programado !== undefined && data.presupuesto_programado !== null && data.presupuesto_programado !== '') {
    prepared.presupuesto_programado = normalizeBudgetValue(data.presupuesto_programado);
  } else {
    prepared.presupuesto_programado = '';
  }
  const fuenteCodesPrep = fuenteSelection.codes.length
    ? fuenteSelection.codes
    : normalizeFuenteSelectionInput(
        data.fuente_codigos || data.fuente_codigo || data.fuente_ids || data.fuente_id || data.fuente
      );
  const fuenteLabelsPrep = fuenteSelection.labels.length
    ? fuenteSelection.labels
    : normalizeFuenteSelectionInput(data.fuente_nombres || data.fuente_nombre || data.fuente);
  const fuenteCodeStringPrep = fuenteSelection.codeString || (fuenteCodesPrep.length ? fuenteCodesPrep.join(', ') : '');
  const fuenteLabelStringPrep = fuenteSelection.labelString || (fuenteLabelsPrep.length ? fuenteLabelsPrep.join(', ') : (typeof data.fuente_nombre === 'string' ? data.fuente_nombre : (Array.isArray(data.fuente_nombre) ? data.fuente_nombre.join(', ') : (typeof data.fuente === 'string' ? data.fuente : ''))));

  prepared.fuente = fuenteLabelStringPrep || '';
  prepared.fuente_id = fuenteCodesPrep.length === 1 ? fuenteCodesPrep[0] : (data.fuente_id || '');
  prepared.fuente_codigo = fuenteCodeStringPrep || '';
  prepared.fuente_codigos = fuenteCodeStringPrep || '';
  prepared.fuente_ids = fuenteCodeStringPrep || '';
  prepared.fuente_nombre = fuenteLabelStringPrep || '';
  prepared.fuente_nombres = fuenteLabelStringPrep || '';
  prepared.fuente_codigos_lista = fuenteCodesPrep;
  prepared.fuente_nombres_lista = fuenteLabelsPrep;
  prepared.plan_ids = planData.ids;
  prepared.plan_id = planData.ids.length ? planData.ids[0] : '';
  prepared.plan = planData.labelString;
  prepared.plan_labels = planData.labels;
  prepared.plan_display = planData.labelString;
  prepared.riesgos = (data.riesgos || '').toString().trim();
  const preparedRiskPercent = normalizeRiskPercentage(
    data.riesgo_porcentaje ?? data.riesgoPorcentaje ?? data.riesgo_percent ?? data.riesgoPercent
  );
  prepared.riesgo_porcentaje = preparedRiskPercent === null ? '' : preparedRiskPercent;
  prepared.responsable = data.responsable || '';
  // Asegurar que las fechas se almacenen como texto YYYY-MM-DD
  prepared.fecha_inicio_planeada = normalizeDateInput(data.fecha_inicio_planeada) || '';
  prepared.fecha_fin_planeada = normalizeDateInput(data.fecha_fin_planeada) || '';
  prepared.estado = data.estado || 'Planeada';

  // Campos de auditoría
  if (operation === 'create') {
    prepared.creado_por = data.usuario || data.creado_por || 'sistema';
    prepared.creado_el = dateOnly;
  }
  prepared.actualizado_el = dateOnly;

  // Campos derivados del catálogo
  prepared.area_nombre = data.area_nombre || '';
  prepared.subproceso_nombre = data.subproceso_nombre || '';
  prepared.objetivo_nombre = data.objetivo_nombre || '';
  prepared.estrategia_nombre = data.estrategia_nombre || '';
  prepared.linea_trabajo_nombre = data.linea_trabajo_nombre || data.linea_trabajo || '';
  prepared.linea_accion_nombre = data.linea_accion_nombre || data.linea_nombre || data.linea || '';
  prepared.linea_nombre = prepared.linea_accion_nombre;

  return prepared;
}

// ==================== FUNCIONES DE BÚSQUEDA Y FILTROS ====================

/**
 * Busca actividades con criterios avanzados
 * @param {Object} searchCriteria - Criterios de búsqueda
 * @returns {Object} Actividades encontradas
 */
function searchActivities(searchCriteria) {
  try {
    const { query, filters = {}, sortBy = 'creado_el', sortOrder = 'desc' } = searchCriteria;
    
    // Obtener todas las actividades
    const allActivities = getAllActivities(filters);
    if (!allActivities.success) return allActivities;
    
    let activities = allActivities.data;
    
    // Aplicar búsqueda por texto si se proporciona
    if (query && query.trim()) {
      const searchTerm = normalizeText(query);
      activities = activities.filter(activity => {
        return normalizeText(activity.descripcion_actividad).includes(searchTerm) ||
               normalizeText(activity.responsable).includes(searchTerm) ||
               normalizeText(activity.indicador).includes(searchTerm) ||
               normalizeText(activity.tipo_indicador).includes(searchTerm) ||
               normalizeText(activity.plan).includes(searchTerm) ||
               normalizeText(activity.area_nombre).includes(searchTerm) ||
               normalizeText(activity.subproceso_nombre).includes(searchTerm);
      });
    }
    
    // Ordenar resultados
    activities.sort((a, b) => {
      let valueA = a[sortBy] || '';
      let valueB = b[sortBy] || '';
      
      // Manejar fechas
      if (sortBy.includes('fecha') || sortBy.includes('_el')) {
        valueA = new Date(valueA || '1970-01-01');
        valueB = new Date(valueB || '1970-01-01');
      }
      
      if (sortOrder === 'desc') {
        return valueB > valueA ? 1 : -1;
      } else {
        return valueA > valueB ? 1 : -1;
      }
    });
    
    return formatResponse(
      true, 
      activities, 
      `${activities.length} actividades encontradas`,
      null,
      { query, filters, sortBy, sortOrder }
    );
    
  } catch (error) {
    return handleError(error, 'searchActivities');
  }
}

/**
 * Filtra actividades por múltiples criterios
 * @param {Object} filterCriteria - Criterios de filtrado
 * @returns {Object} Actividades filtradas
 */
function filterActivities(filterCriteria) {
  try {
    return getAllActivities(filterCriteria || {});
  } catch (error) {
    return handleError(error, 'filterActivities');
  }
}

// ==================== FUNCIONES DE VALIDACIÓN ====================

/**
 * Valida datos de actividad con reglas de negocio
 * @param {Object} data - Datos a validar
 * @param {string} operation - Operación ('create', 'update')
 * @returns {Object} Resultado de validación
 */
function validateActivity(data) {
  return validateActivityData(data, 'validate');
}

// ==================== FUNCIONES AUXILIARES ====================

/**
 * Verifica si un subproceso pertenece a un área específica
 * @param {string} subprocesoId - ID del subproceso
 * @param {string} areaId - ID del área
 * @returns {boolean} True si pertenece al área
 */
function isSubprocessOfArea(subprocesoId, areaId) {
  if (!subprocesoId || !areaId) return false;
  
  try {
    // Buscar subproceso en catálogo
    const subproceso = getCatalogByCode(subprocesoId);
    if (!subproceso.success) return false;
    
    // Verificar si el padre es el área especificada
    return subproceso.data.parent_code === areaId;
    
  } catch (error) {
    console.error('Error verificando subproceso de área:', error);
    return false;
  }
}

/**
 * Obtiene o crea la hoja de actividades
 * @returns {Sheet} Hoja de actividades
 */
function ensureSheetHeaders(sheet, headers) {
  if (!sheet || !Array.isArray(headers) || !headers.length) {
    return;
  }

  let lastColumn = Math.max(sheet.getLastColumn(), headers.length);
  let currentHeaders = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];

  const desiredCodigoIndex = headers.indexOf('codigo');
  const currentCodigoIndex = currentHeaders.indexOf('codigo');

  if (desiredCodigoIndex !== -1 && currentCodigoIndex === -1) {
    sheet.insertColumnAfter(1);
    lastColumn = Math.max(sheet.getLastColumn(), headers.length);
    currentHeaders = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  }

  const desiredRiskIndex = headers.indexOf('riesgo_porcentaje');
  const currentRiskIndex = currentHeaders.indexOf('riesgo_porcentaje');

  if (desiredRiskIndex !== -1 && currentRiskIndex === -1) {
    const responsableIndex = currentHeaders.indexOf('responsable');
    const fallbackPosition = Math.min(desiredRiskIndex + 1, headers.length);
    const insertPosition = Math.max(1, responsableIndex !== -1 ? responsableIndex + 1 : fallbackPosition);
    sheet.insertColumnBefore(insertPosition);
    lastColumn = Math.max(sheet.getLastColumn(), headers.length);
    currentHeaders = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  }

  const needsUpdate = (() => {
    if (currentHeaders.length < headers.length) {
      return true;
    }
    for (let i = 0; i < headers.length; i++) {
      if (currentHeaders[i] !== headers[i]) {
        return true;
      }
    }
    return false;
  })();

  if (needsUpdate) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
}

function getOrCreateActivitiesSheet() {
  const sheet = getOrCreateSheet(SYSTEM_CONFIG.SHEETS.ACTIVITIES, ACTIVITY_HEADERS);
  ensureSheetHeaders(sheet, ACTIVITY_HEADERS);
  return sheet;
}

function hydrateActivityWithBimestres(activity, cachedMap) {
  if (!activity || !activity.actividad_id) {
    return activity;
  }

  const actividadId = activity.actividad_id.toString();
  const map = cachedMap || getBimestresMapByActivity();
  const distribution = map && map[actividadId]
    ? map[actividadId].map(item => ({ ...item }))
    : getBimestresForActivity(actividadId);

  const presupuestoTotal = normalizeBudgetValue(activity.presupuesto_programado);
  const sumaDistribuida = sumBimestres(distribution);
  const metaInfo = extractMetaComponents(activity);
  const metaTotal = metaInfo.valor;
  const metaDistribuida = sumMetaBimestres(distribution);

  const hydrated = {
    ...activity,
    presupuesto_programado: presupuestoTotal,
    bimestres: distribution,
    presupuesto_bimestres_total: sumaDistribuida,
    presupuesto_bimestres_diferencia: roundCurrency(sumaDistribuida - presupuestoTotal),
    meta_valor: metaTotal,
    meta_texto: metaInfo.texto,
    meta_indicador_valor: metaTotal,
    meta_indicador_detalle: metaInfo.display,
    meta_texto_completo: metaInfo.display,
    meta_texto_original: metaInfo.original,
    meta_bimestres_total: metaDistribuida,
    meta_bimestres_diferencia: Math.round((metaDistribuida - metaTotal) * 100) / 100
  };

  return normalizeActivityRecord(hydrated, activity);
}

/**
 * Genera reporte de actividades
 * @param {Object} reportParams - Parámetros del reporte
 * @returns {Object} Reporte generado
 */
function generateActivityReport(reportParams) {
  try {
    const { groupBy = 'estado', includeSummary = true } = reportParams;
    
    const activities = getAllActivities(reportParams.filters);
    if (!activities.success) return activities;
    
    const data = activities.data;
    const report = {
      total: data.length,
      summary: {},
      details: data
    };
    
    if (includeSummary) {
      // Agrupar por criterio especificado
      const grouped = {};
      data.forEach(activity => {
        const key = activity[groupBy] || 'Sin especificar';
        if (!grouped[key]) {
          grouped[key] = { count: 0, activities: [] };
        }
        grouped[key].count++;
        grouped[key].activities.push(activity);
      });
      
      report.summary = grouped;
    }
    
    return formatResponse(true, report, 'Reporte generado exitosamente');
    
  } catch (error) {
    return handleError(error, 'generateActivityReport');
  }
}

/**
 * Exporta actividades en formato estructurado
 * @param {Object} exportParams - Parámetros de exportación
 * @returns {Object} Datos estructurados para exportar
 */
function exportActivities(exportParams) {
  try {
    const activities = getAllActivities(exportParams.filters);
    if (!activities.success) return activities;
    
    const exportData = {
      metadata: {
        exportDate: getCurrentTimestamp(),
        totalRecords: activities.data.length,
        filters: exportParams.filters || {},
        version: SYSTEM_CONFIG.API.VERSION
      },
      headers: ACTIVITY_HEADERS,
      data: activities.data
    };
    
    return formatResponse(true, exportData, 'Datos preparados para exportación');
    
  } catch (error) {
    return handleError(error, 'exportActivities');
  }
}

// ==================== COMPATIBILIDAD CON VERSIÓN ANTERIOR ====================

// Mantener funciones legacy para compatibilidad durante migración
function crearActividad(datos) {
  return createActivity(datos);
}

function obtenerActividades(filtros) {
  return getAllActivities(filtros);
}

function actualizarActividad(id, datos) {
  return updateActivity(id, datos);
}

function eliminarActividad(id) {
  return deleteActivity(id);
}

function buscarActividades(filtros) {
  return searchActivities({ filters: filtros });
}

/**
 * Actualiza el estado de revisión de una actividad y notifica al responsable
 * @param {Object} payload - Datos de la revisión
 * @returns {Object} Resultado de la operación
 */
function updateActivityReviewStatus(payload) {
  try {
    const actividadId = payload?.actividad_id || payload?.id;
    const nuevoEstado = payload?.estado_revision || payload?.estadoRevision;
    const comentarios = payload?.comentarios || payload?.revision_comentarios || '';
    const revisor = payload?.revisor || payload?.revision_por || payload?.usuario || '';
    const notificar = payload?.notificar === false ? false : true;

    if (!actividadId) {
      return formatResponse(false, null, '', 'ID de actividad requerido');
    }

    const estadoNormalizado = normalizeReviewStateValue(nuevoEstado);
    if (!estadoNormalizado || !isValidReviewState(estadoNormalizado)) {
      return formatResponse(false, null, '', `Estado de revisión inválido. Debe ser uno de: ${(SYSTEM_CONFIG.REVIEW_STATES || []).join(', ')}`);
    }

    const actual = getActivityById(actividadId);
    if (!actual.success) {
      return actual;
    }

    const ahoraTimestamp = getCurrentTimestamp();
    const comentariosTexto = comentarios ? comentarios.toString().trim() : '';
    const estadosQueNotifican = ['Corrección', 'En revisión', 'Aprobado', 'Cancelado'];
    const reviewData = {
      estado_revision: estadoNormalizado,
      estado: estadoNormalizado,
      revision_comentarios: comentariosTexto,
      revision_fecha: ahoraTimestamp,
      revision_por: revisor,
      actualizado_el: getCurrentDateOnly()
    };

    const actualizado = updateRowByKey(
      SYSTEM_CONFIG.SHEETS.ACTIVITIES,
      'actividad_id',
      actividadId,
      reviewData
    );

    if (!actualizado) {
      return formatResponse(false, null, '', 'No fue posible actualizar la actividad');
    }

    const actividadActualizada = normalizeActivityRecord({ ...actual.data, ...reviewData }, actual.data);

    if (notificar && estadosQueNotifican.indexOf(estadoNormalizado) !== -1) {
      sendActivityReviewNotification(actividadActualizada, estadoNormalizado, comentariosTexto, revisor);
    }

    return formatResponse(true, actividadActualizada, `Estado actualizado a ${estadoNormalizado}`);

  } catch (error) {
    return handleError(error, 'updateActivityReviewStatus');
  }
}

/**
 * Envía un correo al responsable de la actividad cuando se requiere corrección
 * @param {Object} actividad - Datos de la actividad
 * @param {string} estado - Estado de revisión aplicado
 * @param {string} comentarios - Comentarios del revisor
 * @param {string} revisor - Email del revisor
 */
function resolveActivityRecipientEmail(actividad) {
  if (!actividad || typeof actividad !== 'object') {
    return '';
  }

  const candidatos = [];

  if (actividad.responsable && typeof actividad.responsable === 'object') {
    if (actividad.responsable.email) candidatos.push(actividad.responsable.email);
    if (actividad.responsable.correo) candidatos.push(actividad.responsable.correo);
  }

  candidatos.push(
    actividad.responsable_correo,
    actividad.responsable_email,
    actividad.responsableCorreo,
    actividad.responsableEmail,
    actividad.responsable,
    actividad.responsable_nombre,
    actividad.creado_por,
    actividad.usuario,
    actividad.email
  );

  for (var i = 0; i < candidatos.length; i++) {
    var candidato = candidatos[i];
    if (!candidato) continue;
    if (typeof candidato !== 'string') {
      candidato = candidato.toString();
    }
    var trimmed = candidato.trim();
    if (trimmed && trimmed.indexOf('@') !== -1) {
      return trimmed;
    }
  }

  return '';
}

function getActivityPreferredCode(actividad) {
  if (!actividad || typeof actividad !== 'object') {
    return '';
  }

  const candidatos = [
    actividad.codigo,
    actividad.codigo_actividad,
    actividad.codigoActividad,
    actividad.actividad_codigo,
    actividad.actividadCodigo,
    actividad.codigo_pai,
    actividad.codigoPai,
    actividad.actividad_id,
    actividad.id
  ];

  for (var i = 0; i < candidatos.length; i++) {
    var candidato = candidatos[i];
    if (candidato === null || candidato === undefined) continue;
    var valor = candidato.toString().trim();
    if (valor) {
      return valor;
    }
  }

  return '';
}

function escapeHtml(value) {
  if (value === null || value === undefined) {
    return '';
  }

  return value
    .toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildActivityStatusEmailContent(actividad, estado, comentarios, revisor, codigoActividad) {
  const descripcion = actividad?.descripcion_actividad || actividad?.descripcion || actividad?.nombre || 'Actividad sin descripción';
  const area = actividad?.area || actividad?.area_nombre || actividad?.areaNombre || '';
  const areaHtml = area ? ` del área <strong>${escapeHtml(area)}</strong>` : '';
  const areaText = area ? ` del área ${area}` : '';
  const canonicalEstado = normalizeReviewStateValue(estado) || estado || 'Sin revisión';
  const comentariosTexto = comentarios ? comentarios.toString().trim() : '';
  const comentariosHtml = comentariosTexto ? escapeHtml(comentariosTexto).replace(/\r?\n/g, '<br>') : '';

  const htmlParts = [];
  const textParts = [];

  htmlParts.push('<p>Hola,</p>');
  textParts.push('Hola,');

  switch (canonicalEstado) {
    case 'Corrección':
      htmlParts.push(`<p>La actividad <strong>${escapeHtml(descripcion)}</strong>${areaHtml} requiere correcciones para continuar con el proceso de aprobación.</p>`);
      htmlParts.push('<p>Por favor revisa las observaciones y actualiza la información en el gestor de actividades.</p>');
      textParts.push(`La actividad "${descripcion}"${areaText} requiere correcciones para continuar con el proceso de aprobación.`);
      textParts.push('Por favor revisa las observaciones y actualiza la información en el gestor de actividades.');
      break;
    case 'En revisión':
      htmlParts.push(`<p>La actividad <strong>${escapeHtml(descripcion)}</strong>${areaHtml} fue marcada como <strong>En revisión</strong>. El equipo administrador está evaluando la información reportada.</p>`);
      htmlParts.push('<p>No se requieren acciones adicionales en este momento. Te contactaremos si se necesitan cambios.</p>');
      textParts.push(`La actividad "${descripcion}"${areaText} fue marcada como "En revisión". El equipo administrador está evaluando la información reportada.`);
      textParts.push('No se requieren acciones adicionales en este momento. Te contactaremos si se necesitan cambios.');
      break;
    case 'Aprobado':
      htmlParts.push(`<p>La actividad <strong>${escapeHtml(descripcion)}</strong>${areaHtml} fue <strong>aprobada</strong>.</p>`);
      htmlParts.push('<p>Gracias por mantener la información actualizada en el sistema.</p>');
      textParts.push(`La actividad "${descripcion}"${areaText} fue aprobada.`);
      textParts.push('Gracias por mantener la información actualizada en el sistema.');
      break;
    case 'Cancelado':
      htmlParts.push(`<p>La actividad <strong>${escapeHtml(descripcion)}</strong>${areaHtml} fue marcada como <strong>Cancelado</strong>.</p>`);
      htmlParts.push('<p>No es necesario continuar con gestiones adicionales relacionadas con esta actividad.</p>');
      textParts.push(`La actividad "${descripcion}"${areaText} fue marcada como cancelada.`);
      textParts.push('No es necesario continuar con gestiones adicionales relacionadas con esta actividad.');
      break;
    default:
      htmlParts.push(`<p>La actividad <strong>${escapeHtml(descripcion)}</strong>${areaHtml} cambió al estado <strong>${escapeHtml(canonicalEstado)}</strong>.</p>`);
      textParts.push(`La actividad "${descripcion}"${areaText} cambió al estado "${canonicalEstado}".`);
      break;
  }

  if (comentariosHtml) {
    htmlParts.push('<p>Observaciones del equipo revisor:</p>');
    htmlParts.push(`<blockquote style="border-left:3px solid #4f46e5;padding-left:12px;color:#374151;">${comentariosHtml}</blockquote>`);
    textParts.push('Observaciones del equipo revisor:');
    textParts.push(comentariosTexto);
  }

  if (codigoActividad) {
    htmlParts.push(`<p>Código de la actividad: <strong>${escapeHtml(codigoActividad)}</strong></p>`);
    textParts.push(`Código de la actividad: ${codigoActividad}`);
  }

  if (revisor && revisor.indexOf('@') !== -1) {
    htmlParts.push(`<p>Revisión registrada por: <strong>${escapeHtml(revisor)}</strong></p>`);
    textParts.push(`Revisión registrada por: ${revisor}`);
  }

  htmlParts.push('<p>Gracias por tu gestión.</p>');
  htmlParts.push('<p>&mdash; Sistema PAI UNGRD</p>');
  textParts.push('Gracias por tu gestión.');
  textParts.push('-- Sistema PAI UNGRD');

  return {
    htmlBody: htmlParts.join(''),
    textBody: textParts.join('\n\n')
  };
}

function sendActivityReviewNotification(actividad, estado, comentarios, revisor) {
  try {
    const destinatario = resolveActivityRecipientEmail(actividad);
    if (!destinatario) {
      console.warn('sendActivityReviewNotification: destinatario no válido', destinatario);
      return;
    }

    const codigoActividad = getActivityPreferredCode(actividad);
    const estadoLabel = normalizeReviewStateValue(estado) || estado || 'Sin revisión';
    const asunto = codigoActividad
      ? `${codigoActividad} "${estadoLabel}"`
      : `Actividad "${estadoLabel}"`;

    const contenido = buildActivityStatusEmailContent(actividad, estadoLabel, comentarios, revisor, codigoActividad);

    const mailOptions = {
      to: destinatario,
      subject: asunto,
      htmlBody: contenido.htmlBody,
      body: contenido.textBody,
      name: 'Sistema PAI UNGRD'
    };

    if (revisor && typeof revisor === 'string' && revisor.indexOf('@') !== -1) {
      mailOptions.replyTo = revisor;
    }

    MailApp.sendEmail(mailOptions);
  } catch (error) {
    console.error('sendActivityReviewNotification error:', error);
  }
}