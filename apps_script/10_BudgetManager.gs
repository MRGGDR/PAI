/**
 * 10_BudgetManager.gs - Gestión de presupuestos por área
 */

const AREA_BUDGET_HEADERS = Object.freeze([
  'presupuesto_id',
  'area_id',
  'vigencia',
  'versión',
  'valido_desde',
  'valido_hasta',
  'es_actual',
  'presupuesto_asignado',
  'moneda',
  'fuente_presupuestal',
  'estado',
  'motivo_cambio',
  'doc_soporte_url',
  'registrado_por',
  'registrado_en',
  'observaciones'
]);

const AREA_BUDGET_ALLOWED_STATES = Object.freeze([
  'Propuesto',
  'Aprobado',
  'Modificado',
  'Suspendido',
  'Cerrado'
]);

const AREA_BUDGET_DEFAULT_OPEN_DATE = '2099-12-31';

function handleBudgetRoutes(request) {
  try {
    const safeRequest = request || {};
    const path = (safeRequest.path || '').toString().trim();
    const payload = safeRequest.payload || {};

    switch (path) {
      case 'presupuestos/listar':
        return listarPresupuestos(payload);

      case 'presupuestos/guardar':
        return guardarPresupuestoArea(payload);

      case 'presupuestos/eliminar':
        return eliminarPresupuestoArea(payload);

      case 'presupuestos/resumenArea':
        return obtenerResumenPresupuestoArea(payload);

      default:
        return formatResponse(false, null, '', "Endpoint '" + path + "' no reconocido por BudgetManager");
    }
  } catch (error) {
    console.error('Error en handleBudgetRoutes:', error);
    return formatResponse(false, null, '', 'Error interno en BudgetManager');
  }
}

function ensureAreaBudgetSheet() {
  const sheet = getOrCreateSheet(SYSTEM_CONFIG.SHEETS.AREA_BUDGETS, AREA_BUDGET_HEADERS);
  enforceAreaBudgetStructure(sheet);
  return sheet;
}

function enforceAreaBudgetStructure(sheet) {
  if (!sheet) return;

  const requiredColumns = AREA_BUDGET_HEADERS.length;
  const currentMaxColumns = sheet.getMaxColumns();

  if (currentMaxColumns < requiredColumns) {
    sheet.insertColumnsAfter(currentMaxColumns, requiredColumns - currentMaxColumns);
  }

  const headerRange = sheet.getRange(1, 1, 1, requiredColumns);
  const currentHeaders = headerRange.getValues()[0] || [];

  let needsUpdate = currentHeaders.length !== requiredColumns;
  if (!needsUpdate) {
    for (let i = 0; i < requiredColumns; i++) {
      const expected = AREA_BUDGET_HEADERS[i];
      const existing = (currentHeaders[i] || '').toString().trim();
      if (existing !== expected) {
        needsUpdate = true;
        break;
      }
    }
  }

  if (needsUpdate) {
    headerRange.setValues([AREA_BUDGET_HEADERS]);
  }
}

function readAreaBudgetRecords() {
  const sheet = ensureAreaBudgetSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return [];
  }

  const range = sheet.getRange(1, 1, lastRow, AREA_BUDGET_HEADERS.length);
  const values = range.getValues();
  const headers = values[0].map(header => (header || '').toString().trim());
  const records = [];

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (!row || row.every(cell => cell === '' || cell === null)) {
      continue;
    }

    const record = {};
    headers.forEach((header, idx) => {
      if (!header) return;
      record[header] = row[idx];
    });

    const normalized = normalizeAreaBudgetRow(record);
    if (normalized && normalized.presupuesto_id) {
      records.push(normalized);
    }
  }

  records.sort((a, b) => {
    const yearA = Number(a.vigencia) || 0;
    const yearB = Number(b.vigencia) || 0;
    if (yearA !== yearB) {
      return yearB - yearA;
    }
    const versionA = Number(a.version) || 0;
    const versionB = Number(b.version) || 0;
    if (versionA !== versionB) {
      return versionB - versionA;
    }
    return a.presupuesto_id.localeCompare(b.presupuesto_id);
  });

  return records;
}

function normalizeAreaBudgetRow(row) {
  if (!row || typeof row !== 'object') {
    return null;
  }

  const versionRaw = row['versión'] !== undefined ? row['versión'] : row.version;
  const esActual = parseBudgetBoolean(row.es_actual);
  const total = normalizeBudgetValue(row.presupuesto_asignado);
  const moneda = (row.moneda || 'COP').toString().trim().toUpperCase() || 'COP';

  const normalized = {
    presupuesto_id: (row.presupuesto_id || '').toString().trim(),
    area_id: (row.area_id || '').toString().trim(),
    vigencia: (row.vigencia || '').toString().trim(),
    version: Number(versionRaw) || 0,
    valido_desde: normalizeDateInput(row.valido_desde) || '',
    valido_hasta: normalizeDateInput(row.valido_hasta) || '',
    es_actual: esActual,
    presupuesto_asignado: roundCurrencyValue(total),
    moneda: moneda,
    fuente_presupuestal: (row.fuente_presupuestal || '').toString().trim(),
    estado: sanitizeBudgetState(row.estado),
    motivo_cambio: (row.motivo_cambio || '').toString().trim(),
    doc_soporte_url: (row.doc_soporte_url || '').toString().trim(),
    registrado_por: (row.registrado_por || '').toString().trim(),
    registrado_en: formatBudgetTimestamp(row.registrado_en),
    observaciones: (row.observaciones || '').toString().trim()
  };

  return normalized;
}

function parseBudgetBoolean(value) {
  if (value === true || value === false) {
    return value;
  }
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  const text = value.toString().trim().toLowerCase();
  if (!text) return false;
  if (['1', 'true', 'si', 'sí', 'yes', 'activo', 'actual', 'vigente'].indexOf(text) !== -1) {
    return true;
  }
  if (['0', 'false', 'no', 'inactive'].indexOf(text) !== -1) {
    return false;
  }
  return false;
}

function sanitizeBudgetState(value) {
  const text = (value || '').toString().trim();
  if (!text) {
    return 'Propuesto';
  }
  const match = AREA_BUDGET_ALLOWED_STATES.find(option => option.toLowerCase() === text.toLowerCase());
  return match || text;
}

function formatBudgetTimestamp(value) {
  if (value === null || value === undefined || value === '') {
    return '';
  }
  if (value instanceof Date) {
    if (isNaN(value.getTime())) {
      return '';
    }
    return value.toISOString();
  }
  try {
    const text = value.toString().trim();
    if (!text) return '';
    const parsed = new Date(text);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
    return text;
  } catch (error) {
    console.warn('formatBudgetTimestamp warning:', error);
    return '';
  }
}

function roundCurrencyValue(value) {
  const numberValue = Number(value) || 0;
  if (typeof roundCurrency === 'function') {
    return roundCurrency(numberValue);
  }
  return Math.round(numberValue * 100) / 100;
}

function resolveAreaLabel(areaId) {
  if (!areaId) return '';
  try {
    const response = getCatalogByCode(areaId);
    if (response && response.success && response.data) {
      return response.data.label || response.data.nombre || response.data.descripcion || areaId;
    }
  } catch (error) {
    console.warn('resolveAreaLabel warning:', error);
  }
  return areaId;
}

function sanitizeAreaSegment(areaId, areaLabel) {
  const label = areaLabel || resolveAreaLabel(areaId);
  if (typeof getAreaAcronym === 'function') {
    const acronym = getAreaAcronym(label);
    if (acronym) {
      return acronym;
    }
  }
  const source = label || areaId || 'AREA';
  if (typeof buildAcronymSegment === 'function') {
    return buildAcronymSegment(source, 4, 'AREA').toUpperCase();
  }
  return source.toString().replace(/[^A-Z0-9]/gi, '').toUpperCase().substring(0, 4) || 'AREA';
}

function generateAreaBudgetId(areaId, areaLabel, vigencia, budgets) {
  const yearSegment = (vigencia || new Date().getFullYear()).toString();
  const areaSegment = sanitizeAreaSegment(areaId, areaLabel);
  const scopedBudgets = Array.isArray(budgets) ? budgets : [];
  let maxSequence = 0;
  const regex = new RegExp('^PAI-PRE-' + yearSegment + '-' + areaSegment + '-(\\d{3})$', 'i');

  scopedBudgets.forEach(item => {
    if (!item || !item.presupuesto_id) return;
    if (String(item.vigencia) !== yearSegment) return;
    if (sanitizeAreaSegment(item.area_id, item.area_nombre) !== areaSegment) return;
    const match = regex.exec(item.presupuesto_id.toString());
    if (match) {
      const sequence = Number(match[1]);
      if (!isNaN(sequence) && sequence > maxSequence) {
        maxSequence = sequence;
      }
    }
  });

  const nextSequence = String(maxSequence + 1).padStart(3, '0');
  return 'PAI-PRE-' + yearSegment + '-' + areaSegment + '-' + nextSequence;
}

function listarPresupuestos(payload) {
  try {
    const filters = payload || {};
    const budgets = readAreaBudgetRecords();
    let filtered = budgets;

    if (filters.area_id) {
      const areaId = filters.area_id.toString().trim();
      filtered = filtered.filter(item => item.area_id === areaId);
    }

    if (filters.vigencia) {
      const vigencia = filters.vigencia.toString().trim();
      filtered = filtered.filter(item => item.vigencia === vigencia);
    }

    if (filters.es_actual !== undefined) {
      const flag = parseBudgetBoolean(filters.es_actual);
      filtered = filtered.filter(item => item.es_actual === flag);
    }

    return formatResponse(
      true,
      filtered,
      filtered.length + ' presupuestos obtenidos',
      null,
      {
        totalCount: budgets.length,
        filteredCount: filtered.length,
        filters: filters
      }
    );
  } catch (error) {
    return handleError(error, 'listarPresupuestos');
  }
}

function guardarPresupuestoArea(payload) {
  try {
    const data = payload || {};
    const areaId = (data.area_id || data.areaId || '').toString().trim();
    if (!areaId) {
      return formatResponse(false, null, '', 'area_id es requerido');
    }

    let vigencia = data.vigencia || data.year || data.anio;
    if (!vigencia) {
      vigencia = new Date().getFullYear();
    }
    vigencia = vigencia.toString().trim();
    if (!/^-?\d{4}$/.test(vigencia)) {
      return formatResponse(false, null, '', 'La vigencia debe ser un año válido (YYYY)');
    }

    const presupuestoAsignado = normalizeBudgetValue(
      data.presupuesto_asignado !== undefined ? data.presupuesto_asignado : (data.monto || data.valor || 0)
    );
    if (presupuestoAsignado <= 0) {
      return formatResponse(false, null, '', 'presupuesto_asignado debe ser mayor a cero');
    }

    const esActual = parseBudgetBoolean(data.es_actual);
    const moneda = (data.moneda || 'COP').toString().trim().toUpperCase() || 'COP';
    const fuente = (data.fuente_presupuestal || data.fuente || '').toString().trim();
    const estado = sanitizeBudgetState(data.estado);
    const motivo = (data.motivo_cambio || '').toString().trim();
    const docUrl = (data.doc_soporte_url || data.doc || '').toString().trim();
    const observaciones = (data.observaciones || '').toString().trim();
    const validoDesde = normalizeDateInput(data.valido_desde) || getCurrentDateOnly();
    const validoHasta = normalizeDateInput(data.valido_hasta) || (esActual ? AREA_BUDGET_DEFAULT_OPEN_DATE : '');
    const usuario = (data.usuario || data.registrado_por || '').toString().trim() || 'sistema';
    const timestamp = typeof getCurrentTimestamp === 'function'
      ? getCurrentTimestamp()
      : new Date().toISOString();

    const budgets = readAreaBudgetRecords();
    const sheet = ensureAreaBudgetSheet();

    const providedId = (data.presupuesto_id || data.id || '').toString().trim();
    const isExisting = providedId && budgets.some(item => item.presupuesto_id === providedId);

    const areaLabel = (data.area_nombre || data.areaLabel || '').toString().trim() || resolveAreaLabel(areaId);
    const scopeBudgets = budgets.filter(item => item.area_id === areaId && item.vigencia === vigencia);

    let version = data.version !== undefined
      ? Number(data.version)
      : (data['versión'] !== undefined ? Number(data['versión']) : NaN);
    if (!isExisting) {
      if (!Number.isFinite(version) || version <= 0) {
        const maxVersion = scopeBudgets.reduce((max, item) => {
          const current = Number(item.version) || 0;
          return current > max ? current : max;
        }, 0);
        version = maxVersion + 1;
      }
    } else if (!Number.isFinite(version) || version <= 0) {
      const currentBudget = budgets.find(item => item.presupuesto_id === providedId);
      version = currentBudget ? Number(currentBudget.version) || 1 : 1;
    }

    const normalizedBudget = {
      presupuesto_id: isExisting ? providedId : generateAreaBudgetId(areaId, areaLabel, vigencia, budgets),
      area_id: areaId,
      area_nombre: areaLabel,
      vigencia: vigencia,
      version: version,
      valido_desde: validoDesde,
      valido_hasta: validoHasta,
      es_actual: esActual,
      presupuesto_asignado: roundCurrencyValue(presupuestoAsignado),
      moneda: moneda,
      fuente_presupuestal: fuente,
      estado: estado,
      motivo_cambio: motivo,
      doc_soporte_url: docUrl,
      registrado_por: usuario,
      registrado_en: timestamp,
      observaciones: observaciones
    };

    if (!isExisting) {
      const rowData = AREA_BUDGET_HEADERS.map(header => {
        if (header === 'versión') return normalizedBudget.version;
        if (header === 'es_actual') return normalizedBudget.es_actual ? true : false;
        if (normalizedBudget[header] !== undefined) {
          return normalizedBudget[header];
        }
        return '';
      });
      sheet.appendRow(rowData);
    } else {
      const updateData = {
        area_id: normalizedBudget.area_id,
        vigencia: normalizedBudget.vigencia,
        'versión': normalizedBudget.version,
        valido_desde: normalizedBudget.valido_desde,
        valido_hasta: normalizedBudget.valido_hasta,
        es_actual: normalizedBudget.es_actual ? true : false,
        presupuesto_asignado: normalizedBudget.presupuesto_asignado,
        moneda: normalizedBudget.moneda,
        fuente_presupuestal: normalizedBudget.fuente_presupuestal,
        estado: normalizedBudget.estado,
        motivo_cambio: normalizedBudget.motivo_cambio,
        doc_soporte_url: normalizedBudget.doc_soporte_url,
        registrado_por: normalizedBudget.registrado_por,
        registrado_en: normalizedBudget.registrado_en,
        observaciones: normalizedBudget.observaciones
      };

      const updated = updateRowByKey(
        SYSTEM_CONFIG.SHEETS.AREA_BUDGETS,
        'presupuesto_id',
        providedId,
        updateData
      );

      if (!updated) {
        return formatResponse(false, null, '', 'No se encontró el presupuesto a actualizar');
      }
    }

    if (normalizedBudget.es_actual) {
      enforceUniqueBudgetFlag(normalizedBudget.presupuesto_id, normalizedBudget.area_id, normalizedBudget.vigencia);
    }

    const refreshed = readAreaBudgetRecords();
    const saved = refreshed.find(item => item.presupuesto_id === normalizedBudget.presupuesto_id);

    return formatResponse(
      true,
      saved || normalizedBudget,
      isExisting ? 'Presupuesto actualizado correctamente' : 'Presupuesto creado correctamente'
    );
  } catch (error) {
    return handleError(error, 'guardarPresupuestoArea');
  }
}

function enforceUniqueBudgetFlag(keepId, areaId, vigencia) {
  try {
    const sheet = ensureAreaBudgetSheet();
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return;

    const headers = AREA_BUDGET_HEADERS;
    const idxArea = headers.indexOf('area_id');
    const idxVigencia = headers.indexOf('vigencia');
    const idxId = headers.indexOf('presupuesto_id');
    const idxActual = headers.indexOf('es_actual');

    const range = sheet.getRange(2, 1, lastRow - 1, headers.length);
    const values = range.getValues();

    for (let i = 0; i < values.length; i++) {
      const row = values[i];
      if (!row || !row[idxId]) continue;
      if (row[idxId].toString().trim() === keepId) continue;
      if (row[idxArea].toString().trim() === areaId && row[idxVigencia].toString().trim() === vigencia) {
        const currentValue = row[idxActual];
        if (parseBudgetBoolean(currentValue)) {
          sheet.getRange(i + 2, idxActual + 1).setValue(false);
        }
      }
    }
  } catch (error) {
    console.warn('enforceUniqueBudgetFlag warning:', error);
  }
}

function eliminarPresupuestoArea(payload) {
  try {
    const presupuestoId = (payload && (payload.presupuesto_id || payload.id))
      ? payload.presupuesto_id || payload.id
      : '';
    const id = presupuestoId.toString().trim();
    if (!id) {
      return formatResponse(false, null, '', 'presupuesto_id es requerido');
    }

    const sheet = ensureAreaBudgetSheet();
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) {
      return formatResponse(false, null, '', 'No hay registros en la hoja de presupuestos');
    }

    const headers = AREA_BUDGET_HEADERS;
    const idxId = headers.indexOf('presupuesto_id');
    const idxArea = headers.indexOf('area_id');
    const idxVigencia = headers.indexOf('vigencia');
    const idxActual = headers.indexOf('es_actual');

    const dataRange = sheet.getRange(2, 1, lastRow - 1, headers.length);
    const values = dataRange.getValues();

    let targetRowIndex = -1;
    let wasActual = false;
    let areaId = '';
    let vigencia = '';

    for (let i = 0; i < values.length; i++) {
      const row = values[i];
      if (!row || !row[idxId]) continue;
      if (row[idxId].toString().trim() === id) {
        targetRowIndex = i + 2; // +2 to compensate header row and zero-based index
        areaId = row[idxArea] ? row[idxArea].toString().trim() : '';
        vigencia = row[idxVigencia] ? row[idxVigencia].toString().trim() : '';
        wasActual = parseBudgetBoolean(row[idxActual]);
        break;
      }
    }

    if (targetRowIndex === -1) {
      return formatResponse(false, null, '', "Presupuesto '" + id + "' no encontrado");
    }

    sheet.deleteRow(targetRowIndex);

    if (wasActual && areaId && vigencia) {
      const budgets = readAreaBudgetRecords().filter(item => item.area_id === areaId && item.vigencia === vigencia);
      if (budgets.length) {
        budgets.sort((a, b) => (Number(b.version) || 0) - (Number(a.version) || 0));
        const next = budgets[0];
        if (next) {
          updateRowByKey(
            SYSTEM_CONFIG.SHEETS.AREA_BUDGETS,
            'presupuesto_id',
            next.presupuesto_id,
            { es_actual: true }
          );
        }
      }
    }

    return formatResponse(true, null, 'Presupuesto eliminado correctamente');
  } catch (error) {
    return handleError(error, 'eliminarPresupuestoArea');
  }
}

function obtenerResumenPresupuestoArea(payload) {
  try {
    const data = payload || {};
    const areaId = (data.area_id || data.areaId || '').toString().trim();
    if (!areaId) {
      return formatResponse(false, null, '', 'area_id es requerido');
    }

    let vigencia = data.vigencia ? data.vigencia.toString().trim() : '';
    const actividadId = (data.actividad_id || data.actividadId || '').toString().trim();
    const presupuestoPlaneado = normalizeBudgetValue(
      data.presupuesto_planeado !== undefined ? data.presupuesto_planeado : (data.presupuesto_programado || data.presupuesto || 0)
    );

    let actividadActualPresupuesto = 0;
    let actividadActualAnio = '';
    if (actividadId) {
      try {
        const actividadResponse = getActivityById(actividadId);
        if (actividadResponse && actividadResponse.success && actividadResponse.data) {
          const actividadData = actividadResponse.data;
          actividadActualPresupuesto = normalizeBudgetValue(actividadData.presupuesto_programado || 0);
          actividadActualAnio = inferActivityYear(actividadData);
          if (!vigencia && actividadActualAnio) {
            vigencia = actividadActualAnio;
          }
        }
      } catch (activityError) {
        console.warn('obtenerResumenPresupuestoArea: no se pudo cargar actividad', activityError);
      }
    }

    const budgets = readAreaBudgetRecords().filter(item => item.area_id === areaId);
    if (!vigencia && budgets.length) {
      const currentActives = budgets.filter(item => item.es_actual);
      if (currentActives.length) {
        vigencia = currentActives[0].vigencia;
      } else {
        vigencia = budgets[0].vigencia;
      }
    }

    const scopedBudgets = budgets
      .filter(item => !vigencia || item.vigencia === vigencia)
      .sort((a, b) => (Number(b.version) || 0) - (Number(a.version) || 0));

    const primaryBudget = scopedBudgets.length ? scopedBudgets[0] : (budgets.length ? budgets[0] : null);
    const presupuestoTotal = primaryBudget ? Number(primaryBudget.presupuesto_asignado) || 0 : 0;

    const activitiesResponse = getAllActivities({ area_id: areaId });
    let actividades = [];
    if (activitiesResponse && activitiesResponse.success && Array.isArray(activitiesResponse.data)) {
      actividades = activitiesResponse.data;
    }

    const filteredActividades = actividades.filter(item => {
      if (!item) return false;
      if (actividadId && item.actividad_id && item.actividad_id.toString() === actividadId) {
        return false;
      }
      if (vigencia) {
        const activityYear = inferActivityYear(item);
        if (activityYear && activityYear !== vigencia) {
          return false;
        }
      }
      return true;
    });

    const presupuestoComprometido = roundCurrencyValue(filteredActividades.reduce((acc, item) => {
      return acc + normalizeBudgetValue(item.presupuesto_programado || item.presupuesto || 0);
    }, 0));

    const presupuestoDisponible = roundCurrencyValue(presupuestoTotal - presupuestoComprometido);
    const presupuestoDisponibleEstimado = roundCurrencyValue(presupuestoDisponible - presupuestoPlaneado);

    const resumen = {
      area_id: areaId,
      area_nombre: resolveAreaLabel(areaId),
      vigencia: vigencia || (primaryBudget ? primaryBudget.vigencia : ''),
      version: primaryBudget ? Number(primaryBudget.version) || 0 : 0,
      es_actual: primaryBudget ? primaryBudget.es_actual : false,
      presupuesto_total: roundCurrencyValue(presupuestoTotal),
      presupuesto_comprometido: presupuestoComprometido,
      presupuesto_disponible: presupuestoDisponible,
      presupuesto_actividad_existente: roundCurrencyValue(actividadActualPresupuesto),
      presupuesto_planeado: roundCurrencyValue(presupuestoPlaneado),
      presupuesto_disponible_estimado: presupuestoDisponibleEstimado,
      moneda: primaryBudget ? primaryBudget.moneda : 'COP',
      fuente_presupuestal: primaryBudget ? primaryBudget.fuente_presupuestal : '',
      estado: primaryBudget ? primaryBudget.estado : '',
      valido_desde: primaryBudget ? primaryBudget.valido_desde : '',
      valido_hasta: primaryBudget ? primaryBudget.valido_hasta : '',
      doc_soporte_url: primaryBudget ? primaryBudget.doc_soporte_url : '',
      observaciones: primaryBudget ? primaryBudget.observaciones : '',
      motivo_cambio: primaryBudget ? primaryBudget.motivo_cambio : ''
    };

    const actividadesResumen = filteredActividades.map(item => ({
      actividad_id: item.actividad_id || '',
      codigo: item.codigo || '',
      descripcion: item.descripcion_actividad || '',
      presupuesto_programado: roundCurrencyValue(item.presupuesto_programado || 0),
      estado: item.estado || '',
      vigencia: inferActivityYear(item)
    }));

    return formatResponse(
      true,
      {
        resumen: resumen,
        actividades: actividadesResumen,
        meta: {
          totalActividades: actividadesResumen.length,
          actividadesConsideradas: actividadesResumen.length,
          presupuestoComprometido: presupuestoComprometido
        }
      },
      'Resumen de presupuesto calculado'
    );
  } catch (error) {
    return handleError(error, 'obtenerResumenPresupuestoArea');
  }
}

function inferActivityYear(activity) {
  if (!activity || typeof activity !== 'object') {
    return '';
  }

  const code = activity.codigo || activity.codigoActividad || activity.idCodigo;
  if (code) {
    const text = code.toString();
    const directMatch = text.match(/-(\d{4})-/);
    if (directMatch) {
      return directMatch[1];
    }
    const parts = text.split('-');
    for (let i = 0; i < parts.length; i++) {
      if (/^\d{4}$/.test(parts[i])) {
        return parts[i];
      }
    }
  }

  const fecha = activity.fecha_inicio_planeada || activity.fecha_inicio || activity.creado_el || '';
  if (fecha) {
    const normalized = normalizeDateInput(fecha);
    if (normalized) {
      return normalized.substring(0, 4);
    }
    const parsed = new Date(fecha);
    if (!isNaN(parsed.getTime())) {
      return parsed.getFullYear().toString();
    }
  }

  return '';
}
