/**
 * AdvancesManager.gs - Handler mínimo para avances (stubs para desarrollo)
 *
 * Implementa rutas básicas: 'avances/crear' y 'avances/obtener' para permitir
 * que el frontend de desarrollo pruebe la integración. En producción este
 * módulo debe ser completado con persistencia real en hoja de cálculo.
 */

function handleAdvancesRoutes(request) {
  try {
    const { path, payload = {} } = request;

    switch (path) {
      case 'avances/crear':
        return crearAvance(payload);

      case 'avances/obtener':
        return obtenerAvances(payload);

      case 'avances/debugStatus':
        return debugAvancesStatus();

      case 'avances/fixHeaders':
        return fixAvancesHeaders();

      case 'avances/cleanupTestRows':
        return cleanupTestRows(payload);

      case 'avances/eliminar':
        return eliminarAvance(payload);

      case 'avances/revisar':
      case 'avances/revision':
        return actualizarEstadoAvance(payload);

      default:
        return formatResponse(false, null, '', `Endpoint '${path}' no reconocido por AdvancesManager`);
    }
  } catch (e) {
    console.error('Error en handleAdvancesRoutes:', e);
    return formatResponse(false, null, '', 'Error interno en AdvancesManager');
  }
}

// Definición canónica de headers para la hoja Avances
const ADVANCE_HEADERS = [
  'avance_id',
  'actividad_id',
  'codigo',
  'anio',
  'bimestre_id',
  'bimestre_nombre',
  'meta_programada_bimestre',
  'logro_valor',
  'presupuesto_ejecutado_bimestre',
  'avances_texto',
  'dificultades_texto',
  'evidencia_url',
  'fecha_reporte',
  'reportado_por',
  'estado_revision',
  'revision_comentarios',
  'revision_fecha',
  'revision_por',
  'area',
  'creado_en'
];

const ADVANCE_LOG_EVENTS = {
  CREATE: 'AVANCE_CREAR',
  RETRIEVE: 'AVANCE_CONSULTAR',
  REVIEW: 'AVANCE_REVISAR',
  DELETE: 'AVANCE_ELIMINAR',
  ERROR: 'AVANCE_ERROR'
};

function resolveBimestreMetadataFromPayload(payload) {
  try {
    const definition = typeof getBimestresDefinition === 'function' ? getBimestresDefinition() : [];
    const bimestres = Array.isArray(definition) ? definition : [];
    const total = bimestres.length;

    const ensureBounds = (value) => {
      const number = Number(value);
      if (!Number.isNaN(number) && number >= 1 && number <= total) {
        return Math.trunc(number);
      }
      return null;
    };

    const tryResolve = (rawValue) => {
      if (rawValue === null || rawValue === undefined) return null;
      const text = String(rawValue).trim();
      if (!text) return null;

      const numeric = ensureBounds(text);
      if (numeric) {
        return {
          index: numeric,
          label: bimestres[numeric - 1] ? bimestres[numeric - 1].label : text
        };
      }

      if (typeof resolveBimestreIndexFromLabel === 'function') {
        const idx = resolveBimestreIndexFromLabel(text, bimestres);
        if (idx) {
          return {
            index: idx,
            label: bimestres[idx - 1] ? bimestres[idx - 1].label : text
          };
        }
      }

      return {
        index: null,
        label: text
      };
    };

    const indexCandidates = [
      payload && payload.bimestre_index,
      payload && payload.bimestreIndex,
      payload && payload.bimestre_numero,
      payload && payload.bimestreNumero
    ];

    for (let i = 0; i < indexCandidates.length; i++) {
      const resolved = tryResolve(indexCandidates[i]);
      if (resolved && resolved.index) {
        return {
          index: String(resolved.index),
          label: resolved.label
        };
      }
    }

    const valueCandidates = [
      payload && payload.bimestre_id,
      payload && payload.bimestre,
      payload && payload.bimestre_label,
      payload && payload.bimestreLabel,
      payload && payload.bimestre_nombre,
      payload && payload.bimestreNombre,
      payload && payload.bimestre_periodo,
      payload && payload.bimestrePeriodo
    ];

    let fallbackLabel = '';
    for (let i = 0; i < valueCandidates.length; i++) {
      const resolved = tryResolve(valueCandidates[i]);
      if (resolved) {
        if (resolved.index) {
          return {
            index: String(resolved.index),
            label: resolved.label
          };
        }
        if (!fallbackLabel && resolved.label) {
          fallbackLabel = resolved.label;
        }
      }
    }

    return {
      index: '',
      label: fallbackLabel || ''
    };
  } catch (error) {
    console.error('resolveBimestreMetadataFromPayload error:', error);
    return {
      index: payload && payload.bimestre_id ? String(payload.bimestre_id) : '',
      label: payload && (payload.bimestre_nombre || payload.bimestre || payload.bimestre_label)
        ? String(payload.bimestre_nombre || payload.bimestre || payload.bimestre_label)
        : ''
    };
  }
}

function crearAvance(datos) {
  try {
    // Validaciones básicas
    if (!datos || !datos.actividad_id) {
      return formatResponse(false, null, '', 'actividad_id es requerido');
    }

    // Generar id de avance (usar helper si está disponible)
    let id;
    try {
      id = (typeof generateUniqueId === 'function') ? generateUniqueId('AV') : ('av_' + new Date().getTime());
    } catch (e) {
      id = 'av_' + new Date().getTime();
    }

    // Normalizar y preparar datos para la hoja
    const nowISO = (typeof new Date().toISOString === 'function') ? new Date().toISOString() : getCurrentTimestamp();
    const fechaReporte = datos && datos.fecha_reporte ? normalizeDateInput(datos.fecha_reporte) : getCurrentDateOnly();
    const reviewDefault = (SYSTEM_CONFIG && SYSTEM_CONFIG.REVIEW_STATES && SYSTEM_CONFIG.REVIEW_STATES.length)
      ? SYSTEM_CONFIG.REVIEW_STATES[0]
      : 'Sin revisión';

    // Log recibido para debugging
    try { console.log('crearAvance: datos recibidos ->', JSON.stringify(datos)); } catch (e) { /* ignore */ }

    // Mapear campos explícitamente y aceptar variantes de nombres
    const bimestreMetadata = resolveBimestreMetadataFromPayload(datos);

    const toTrimmedString = (value) => {
      if (value === null || value === undefined) return '';
      try {
        const text = value.toString();
        return typeof text === 'string' ? text.trim() : '';
      } catch (error) {
        try {
          return String(value).trim();
        } catch (innerError) {
          return '';
        }
      }
    };

    const actividadId = toTrimmedString(
      (datos && (datos.actividad_id || datos.actividad || datos.activity_id || datos.id)) || ''
    );

    let codigoActividad = '';
    const codigoCandidates = [
      datos && datos.codigo,
      datos && datos.codigo_actividad,
      datos && datos.codigoActividad,
      datos && datos.actividad_codigo,
      datos && datos.actividadCodigo
    ];
    for (let i = 0; i < codigoCandidates.length; i++) {
      const candidate = toTrimmedString(codigoCandidates[i]);
      if (candidate) {
        codigoActividad = candidate;
        break;
      }
    }

    const complete = {
      avance_id: id,
      actividad_id: actividadId,
      codigo: codigoActividad,
      anio: (datos && (datos.anio || datos.year)) || (new Date().getFullYear()).toString(),
      bimestre_id: bimestreMetadata.index || '',
      bimestre_nombre: bimestreMetadata.label || '',
      meta_programada_bimestre: (datos && datos.meta_programada_bimestre !== undefined && datos.meta_programada_bimestre !== null && datos.meta_programada_bimestre !== '')
        ? Number(datos.meta_programada_bimestre)
        : '',
      logro_valor: (datos && (datos.logro_valor !== undefined && datos.logro_valor !== null && datos.logro_valor !== '')) ? Number(datos.logro_valor) : '',
      presupuesto_ejecutado_bimestre: (datos && (datos.presupuesto_ejecutado_bimestre !== undefined && datos.presupuesto_ejecutado_bimestre !== null && datos.presupuesto_ejecutado_bimestre !== '')) ? Number(datos.presupuesto_ejecutado_bimestre) : '',
      avances_texto: (datos && (datos.avances_texto || datos.avances || datos.avance_texto)) || '',
      dificultades_texto: (datos && (datos.dificultades_texto || datos.dificultad_texto || datos.dificultades)) || '',
      evidencia_url: (datos && (datos.evidencia_url || datos.evidence || datos.evidencia)) || '',
      fecha_reporte: fechaReporte,
      reportado_por: (datos && (datos.reportado_por || datos.creado_por || datos.usuario || datos.email)) || '',
      estado_revision: reviewDefault,
      revision_comentarios: '',
      revision_fecha: '',
      revision_por: '',
      area: '',
      creado_en: nowISO
    };

    try {
      const actividadRelacionada = findRowByField(SYSTEM_CONFIG.SHEETS.ACTIVITIES, 'actividad_id', complete.actividad_id);
      if (actividadRelacionada) {
        complete.area = actividadRelacionada.area || actividadRelacionada.area_nombre || '';
        if (!complete.codigo) {
          const actividadCodigoCandidates = [
            actividadRelacionada.codigo,
            actividadRelacionada.codigo_actividad,
            actividadRelacionada.codigoActividad,
            actividadRelacionada.actividad_id
          ];
          for (let j = 0; j < actividadCodigoCandidates.length; j++) {
            const candidate = toTrimmedString(actividadCodigoCandidates[j]);
            if (candidate) {
              complete.codigo = candidate;
              break;
            }
          }
        }
      }
    } catch (lookupErr) {
      console.warn('crearAvance: no fue posible determinar el área desde la actividad', lookupErr);
    }

    complete.codigo = toTrimmedString(complete.codigo || complete.actividad_id || '');

    // Obtener o crear la hoja de avances usando headers canónicos
    const sheetName = (SYSTEM_CONFIG && SYSTEM_CONFIG.SHEETS && SYSTEM_CONFIG.SHEETS.ADVANCES) ? SYSTEM_CONFIG.SHEETS.ADVANCES : 'Avances';
    const sheet = getOrCreateSheet(sheetName, ADVANCE_HEADERS);

    // Si la hoja no tiene headers escritos en la primera fila, escribirlos explícitamente y garantizar la columna "codigo"
    let lastCol = sheet.getLastColumn();
    if (lastCol === 0) {
      lastCol = ADVANCE_HEADERS.length;
    }

    let headerRange = sheet.getRange(1, 1, 1, Math.max(lastCol, ADVANCE_HEADERS.length));
    let existingHeaders = (lastCol > 0) ? headerRange.getValues()[0] : [];

    const hasCodigoHeader = existingHeaders.some(header => String(header || '').trim().toLowerCase() === 'codigo');
    if (!hasCodigoHeader && sheet.getMaxColumns() >= 2) {
      try {
        sheet.insertColumnAfter(2);
      } catch (insertError) {
        console.warn('crearAvance: no fue posible insertar columna para codigo', insertError);
      }
      lastCol = sheet.getLastColumn();
      headerRange = sheet.getRange(1, 1, 1, Math.max(lastCol, ADVANCE_HEADERS.length));
      existingHeaders = headerRange.getValues()[0] || [];
    }

    const headerMismatch = ADVANCE_HEADERS.some((h, i) => String(existingHeaders[i] || '').trim() !== String(h).trim());
    if (sheet.getLastRow() === 0 || headerMismatch) {
      sheet.getRange(1, 1, 1, ADVANCE_HEADERS.length).setValues([ADVANCE_HEADERS]);
    }

    // Preparar fila en el mismo orden de ADVANCE_HEADERS
    const rowData = ADVANCE_HEADERS.map(h => {
      const v = complete[h];
      return (v === null || typeof v === 'undefined') ? '' : v;
    });

    // Insertar la fila y retornar el registro creado
    sheet.appendRow(rowData);

    if (typeof appendSystemLog === 'function') {
      appendSystemLog({
        evento_tipo: ADVANCE_LOG_EVENTS.CREATE,
        origen: 'AdvancesManager',
        usuario_email: complete.reportado_por || datos?.usuario || datos?.email || '',
        usuario_rol: datos?.usuario_rol || datos?.rol || '',
        actividad_id: complete.actividad_id,
        actividad_codigo: complete.codigo,
        bimestre: complete.bimestre_nombre || complete.bimestre_id || '',
        avance_id: complete.avance_id,
        estado_revision: complete.estado_revision,
        requiere_revision: false,
        mensaje: 'Avance creado exitosamente',
        payload_json: datos,
        resultado: 'OK'
      });
    }

    return formatResponse(true, complete, 'Avance creado correctamente');
  } catch (e) {
    console.error('Error en crearAvance:', e);
    if (typeof appendSystemLog === 'function') {
      appendSystemLog({
        evento_tipo: ADVANCE_LOG_EVENTS.ERROR,
        origen: 'AdvancesManager',
        usuario_email: datos?.usuario || datos?.reportado_por || '',
        usuario_rol: datos?.usuario_rol || datos?.rol || '',
        actividad_id: datos?.actividad_id || datos?.actividad || '',
        bimestre: datos?.bimestre || datos?.bimestre_nombre || '',
        avance_id: datos?.avance_id || '',
        mensaje: 'Error creando avance',
        payload_json: { error: e && e.message ? e.message : e, payload: datos },
        resultado: 'ERROR'
      });
    }
    return formatResponse(false, null, '', `Error guardando avance: ${e && e.message ? e.message : e}`);
  }
}

function obtenerAvances(filter) {
  try {
    // Leer la hoja de Avances y devolver objetos
    const sheetName = (SYSTEM_CONFIG && SYSTEM_CONFIG.SHEETS && SYSTEM_CONFIG.SHEETS.ADVANCES) ? SYSTEM_CONFIG.SHEETS.ADVANCES : 'Avances';
    const defaultReviewState = (SYSTEM_CONFIG.REVIEW_STATES && SYSTEM_CONFIG.REVIEW_STATES.length)
      ? SYSTEM_CONFIG.REVIEW_STATES[0]
      : 'Sin revisión';
    const objects = readSheetAsObjects(sheetName, false).map(item => {
      const bimestreMeta = resolveBimestreMetadataFromPayload(item);
      const pickCodigo = (...candidates) => {
        for (let i = 0; i < candidates.length; i++) {
          const candidate = candidates[i];
          if (candidate === null || candidate === undefined) continue;
          try {
            const text = candidate.toString().trim();
            if (text) return text;
          } catch (error) {
            try {
              const fallback = String(candidate).trim();
              if (fallback) return fallback;
            } catch (innerError) {
              // Ignore conversion errors and continue checking candidates
            }
          }
        }
        return '';
      };

      const codigo = pickCodigo(
        item.codigo,
        item.codigo_actividad,
        item.codigoActividad,
        item.actividad_codigo,
        item.actividadCodigo,
        item.actividad_id
      );

      return {
        ...item,
        codigo: codigo,
        bimestre_id: bimestreMeta.index || item.bimestre_id || '',
        bimestre_nombre: bimestreMeta.label || item.bimestre_nombre || item.bimestre || '',
        meta_programada_bimestre: item.meta_programada_bimestre !== undefined && item.meta_programada_bimestre !== null && item.meta_programada_bimestre !== ''
          ? Number(item.meta_programada_bimestre)
          : '',
        estado_revision: item.estado_revision || defaultReviewState,
        revision_comentarios: item.revision_comentarios || '',
        revision_fecha: item.revision_fecha || '',
        revision_por: item.revision_por || '',
        area: item.area || ''
      };
    });

    // Opcional: aplicar filtro simple por actividad_id o reportado_por si se solicita
    let results = objects;
    if (filter && typeof filter === 'object') {
      if (filter.actividad_id) {
        results = results.filter(r => r.actividad_id === filter.actividad_id);
      }
      if (filter.reportado_por) {
        results = results.filter(r => r.reportado_por === filter.reportado_por);
      }
      if (filter.estado_revision) {
        results = results.filter(r => r.estado_revision === filter.estado_revision);
      }
      if (filter.onlyApproved) {
        results = results.filter(r => r.estado_revision === 'Aprobado');
      }
      if (filter.area) {
        const areaNormalized = normalizeText(filter.area);
        results = results.filter(r => normalizeText(r.area) === areaNormalized);
      }
    }

    return formatResponse(true, results, 'Lista de avances');
  } catch (e) {
    console.error('Error en obtenerAvances:', e);
    return formatResponse(false, null, '', 'Error obteniendo avances');
  }
}

function actualizarEstadoAvance(payload) {
  try {
    const avanceId = payload?.avance_id || payload?.id;
    const nuevoEstado = payload?.estado_revision || payload?.estadoRevision;
    const comentarios = payload?.comentarios || payload?.revision_comentarios || '';
    const revisor = payload?.revisor || payload?.revision_por || payload?.usuario || '';
    const notificar = payload?.notificar === false ? false : true;

    if (!avanceId) {
      return formatResponse(false, null, '', 'avance_id requerido');
    }

    const estadoNormalizado = normalizeReviewStateValue(nuevoEstado);
    if (!estadoNormalizado || !isValidReviewState(estadoNormalizado)) {
      return formatResponse(false, null, '', `Estado de revisión inválido. Usa: ${(SYSTEM_CONFIG.REVIEW_STATES || []).join(', ')}`);
    }

    const sheetName = (SYSTEM_CONFIG && SYSTEM_CONFIG.SHEETS && SYSTEM_CONFIG.SHEETS.ADVANCES) ? SYSTEM_CONFIG.SHEETS.ADVANCES : 'Avances';
    const registros = readSheetAsObjects(sheetName, false);
    const registro = registros.find(item => item.avance_id === avanceId);
    if (!registro) {
      return formatResponse(false, null, '', 'Avance no encontrado');
    }

    const comentariosTexto = comentarios ? comentarios.toString().trim() : '';
    const reviewData = {
      estado_revision: estadoNormalizado,
      revision_comentarios: comentariosTexto,
      revision_fecha: getCurrentTimestamp(),
      revision_por: revisor,
      actualizado_el: getCurrentDateOnly()
    };

    const actualizado = updateRowByKey(sheetName, 'avance_id', avanceId, reviewData);
    if (!actualizado) {
      return formatResponse(false, null, '', 'No fue posible actualizar el avance');
    }

    const avanceActualizado = { ...registro, ...reviewData };
    const estadosQueNotifican = ['Corrección', 'En revisión', 'Aprobado', 'Cancelado'];

    if (notificar && estadosQueNotifican.indexOf(estadoNormalizado) !== -1) {
      sendAvanceReviewNotification(avanceActualizado, estadoNormalizado, comentariosTexto, revisor);
    }

    if (typeof appendSystemLog === 'function') {
      appendSystemLog({
        evento_tipo: ADVANCE_LOG_EVENTS.REVIEW,
        origen: 'AdvancesManager',
        usuario_email: revisor || payload?.usuario_email || '',
        usuario_rol: payload?.usuario_rol || '',
        actividad_id: avanceActualizado.actividad_id || '',
        actividad_codigo: avanceActualizado.codigo || '',
        bimestre: avanceActualizado.bimestre_nombre || avanceActualizado.bimestre_id || '',
        avance_id: avanceActualizado.avance_id || avanceId,
        estado_revision: estadoNormalizado,
        requiere_revision: ['Corrección', 'Cancelado'].includes(estadoNormalizado),
        mensaje: 'Estado de revisión actualizado',
        payload_json: payload,
        resultado: 'OK'
      });
    }

    return formatResponse(true, avanceActualizado, `Estado actualizado a ${estadoNormalizado}`);
  } catch (e) {
    console.error('actualizarEstadoAvance error', e);
    if (typeof appendSystemLog === 'function') {
      const estadoIntentado = payload?.estado_revision || payload?.estadoRevision || '';
      appendSystemLog({
        evento_tipo: ADVANCE_LOG_EVENTS.ERROR,
        origen: 'AdvancesManager',
        usuario_email: payload?.usuario || payload?.usuario_email || '',
        usuario_rol: payload?.usuario_rol || '',
        actividad_id: payload?.actividad_id || '',
        bimestre: payload?.bimestre || payload?.bimestre_nombre || '',
        avance_id: payload?.avance_id || payload?.id || '',
        estado_revision: estadoIntentado,
        requiere_revision: ['Corrección', 'Cancelado'].includes(normalizeReviewStateValue(estadoIntentado)),
        mensaje: 'Error actualizando estado de avance',
        payload_json: { error: e && e.message ? e.message : e, payload: payload },
        resultado: 'ERROR'
      });
    }
    return formatResponse(false, null, '', 'Error actualizando estado del avance');
  }
}

function resolveAvanceRecipientEmail(avance) {
  if (!avance || typeof avance !== 'object') {
    return '';
  }

  const candidatos = [];

  if (avance.reportado_por && typeof avance.reportado_por === 'object') {
    if (avance.reportado_por.email) candidatos.push(avance.reportado_por.email);
    if (avance.reportado_por.correo) candidatos.push(avance.reportado_por.correo);
  }

  candidatos.push(
    avance.reportado_por,
    avance.reportadoPor,
    avance.enviado_por,
    avance.registrado_por,
    avance.usuario,
    avance.responsable
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

function buildAvanceStatusEmailContent(avance, estado, comentarios, revisor, codigoRef) {
  const canonicalEstado = normalizeReviewStateValue(estado) || estado || 'Sin revisión';
  const actividad = (avance && typeof avance.actividad === 'object') ? avance.actividad : null;
  const actividadDescripcion = actividad?.descripcion_actividad || actividad?.descripcion || actividad?.nombre || avance?.actividad_nombre || avance?.actividad || avance?.actividad_id || 'Actividad registrada';
  const bimestre = avance?.bimestre_nombre || avance?.bimestre_id || avance?.bimestre || '';
  const comentariosTexto = comentarios ? comentarios.toString().trim() : '';
  const comentariosHtml = comentariosTexto ? escapeHtml(comentariosTexto).replace(/\r?\n/g, '<br>') : '';

  const htmlParts = [];
  const textParts = [];

  htmlParts.push('<p>Hola,</p>');
  textParts.push('Hola,');

  switch (canonicalEstado) {
    case 'Corrección':
      htmlParts.push(`<p>El avance de la actividad <strong>${escapeHtml(actividadDescripcion)}</strong>${bimestre ? ` para el bimestre <strong>${escapeHtml(bimestre)}</strong>` : ''} requiere correcciones antes de poder ser aprobado.</p>`);
      htmlParts.push('<p>Por favor revisa las observaciones y actualiza el reporte en el sistema.</p>');
      textParts.push(`El avance de la actividad "${actividadDescripcion}"${bimestre ? ` para el bimestre ${bimestre}` : ''} requiere correcciones antes de poder ser aprobado.`);
      textParts.push('Por favor revisa las observaciones y actualiza el reporte en el sistema.');
      break;
    case 'En revisión':
      htmlParts.push(`<p>El avance de la actividad <strong>${escapeHtml(actividadDescripcion)}</strong>${bimestre ? ` (${escapeHtml(bimestre)})` : ''} fue marcado como <strong>En revisión</strong>. El equipo administrador está evaluando la información reportada.</p>`);
      htmlParts.push('<p>No se requieren acciones adicionales por el momento.</p>');
      textParts.push(`El avance de la actividad "${actividadDescripcion}"${bimestre ? ` (${bimestre})` : ''} fue marcado como "En revisión". El equipo administrador está evaluando la información reportada.`);
      textParts.push('No se requieren acciones adicionales por el momento.');
      break;
    case 'Aprobado':
      htmlParts.push(`<p>El avance de la actividad <strong>${escapeHtml(actividadDescripcion)}</strong>${bimestre ? ` (${escapeHtml(bimestre)})` : ''} fue <strong>aprobado</strong>. ¡Gracias por mantener la información actualizada!</p>`);
      textParts.push(`El avance de la actividad "${actividadDescripcion}"${bimestre ? ` (${bimestre})` : ''} fue aprobado. ¡Gracias por mantener la información actualizada!`);
      break;
    case 'Cancelado':
      htmlParts.push(`<p>El avance de la actividad <strong>${escapeHtml(actividadDescripcion)}</strong>${bimestre ? ` (${escapeHtml(bimestre)})` : ''} fue marcado como <strong>Cancelado</strong>.</p>`);
      htmlParts.push('<p>No es necesario continuar con gestiones adicionales para este registro.</p>');
      textParts.push(`El avance de la actividad "${actividadDescripcion}"${bimestre ? ` (${bimestre})` : ''} fue marcado como cancelado.`);
      textParts.push('No es necesario continuar con gestiones adicionales para este registro.');
      break;
    default:
      htmlParts.push(`<p>El avance de la actividad <strong>${escapeHtml(actividadDescripcion)}</strong> cambió al estado <strong>${escapeHtml(canonicalEstado)}</strong>.</p>`);
      textParts.push(`El avance de la actividad "${actividadDescripcion}" cambió al estado "${canonicalEstado}".`);
      break;
  }

  if (comentariosHtml) {
    htmlParts.push('<p>Observaciones del equipo revisor:</p>');
    htmlParts.push(`<blockquote style="border-left:3px solid #4f46e5;padding-left:12px;color:#374151;">${comentariosHtml}</blockquote>`);
    textParts.push('Observaciones del equipo revisor:');
    textParts.push(comentariosTexto);
  }

  if (codigoRef) {
    htmlParts.push(`<p>Referencia: <strong>${escapeHtml(codigoRef)}</strong></p>`);
    textParts.push(`Referencia: ${codigoRef}`);
  }

  if (revisor && revisor.indexOf('@') !== -1) {
    htmlParts.push(`<p>Revisión registrada por: <strong>${escapeHtml(revisor)}</strong></p>`);
    textParts.push(`Revisión registrada por: ${revisor}`);
  }

  htmlParts.push('<p>Gracias por tu colaboración.</p>');
  htmlParts.push('<p>&mdash; Sistema PAI UNGRD</p>');
  textParts.push('Gracias por tu colaboración.');
  textParts.push('-- Sistema PAI UNGRD');

  return {
    htmlBody: htmlParts.join(''),
    textBody: textParts.join('\n\n')
  };
}

function sendAvanceReviewNotification(avance, estado, comentarios, revisor) {
  try {
    const destinatario = resolveAvanceRecipientEmail(avance);
    if (!destinatario) {
      return;
    }

    const estadoLabel = normalizeReviewStateValue(estado) || estado || 'Sin revisión';
    const codigoRef = avance?.avance_id || avance?.codigo || avance?.actividad_codigo || '';
    const asunto = codigoRef ? `${codigoRef} "${estadoLabel}"` : `Avance "${estadoLabel}"`;

    const contenido = buildAvanceStatusEmailContent(avance, estadoLabel, comentarios, revisor, codigoRef);

    const mailOptions = {
      to: destinatario,
      subject: asunto,
      htmlBody: contenido.htmlBody,
      body: contenido.textBody,
      name: 'Sistema PAI UNGRD'
    };

    if (revisor && typeof revisor === 'string' && revisor.indexOf('@') !== -1) {
      mailOptions.replyTo = revisor;
      if (revisor !== destinatario) {
        mailOptions.cc = revisor;
      }
    }

    MailApp.sendEmail(mailOptions);
  } catch (error) {
    console.error('sendAvanceReviewNotification error:', error);
  }
}

/**
 * Reescribe la fila de headers en la hoja 'Avances' usando ADVANCE_HEADERS
 * Útil para corregir cabeceras mal formadas (ej: celda vacía al final).
 */
function fixAvancesHeaders() {
  try {
    const sheetName = (SYSTEM_CONFIG && SYSTEM_CONFIG.SHEETS && SYSTEM_CONFIG.SHEETS.ADVANCES) ? SYSTEM_CONFIG.SHEETS.ADVANCES : 'Avances';
    const sheet = getOrCreateSheet(sheetName, ADVANCE_HEADERS);

    let lastCol = sheet.getLastColumn();
    if (lastCol === 0) {
      lastCol = ADVANCE_HEADERS.length;
    }

    const headerRange = sheet.getRange(1, 1, 1, Math.max(lastCol, ADVANCE_HEADERS.length));
    const currentHeaders = headerRange.getValues()[0] || [];
    const hasCodigoHeader = currentHeaders.some(header => String(header || '').trim().toLowerCase() === 'codigo');
    if (!hasCodigoHeader && sheet.getMaxColumns() >= 2) {
      try {
        sheet.insertColumnAfter(2);
      } catch (insertError) {
        console.warn('fixAvancesHeaders: fallo al insertar columna codigo', insertError);
      }
    }

    // Sobrescribir la primera fila con los headers canónicos
    sheet.getRange(1, 1, 1, ADVANCE_HEADERS.length).setValues([ADVANCE_HEADERS]);

    return formatResponse(true, { headers: ADVANCE_HEADERS }, 'Headers reescritos correctamente');
  } catch (e) {
    console.error('fixAvancesHeaders error', e);
    return formatResponse(false, null, '', 'Error reescribiendo headers');
  }
}

/**
 * Elimina filas de la hoja Avances que coincidan con ciertos patrones de prueba.
 * Si no se especifica payload, eliminará filas donde actividad_id comienza con 'ACT-TEST'.
 * Payload opcional: { actividad_prefix: 'ACT-TEST' }
 */
function cleanupTestRows(payload) {
  try {
    const prefix = payload && payload.actividad_prefix ? String(payload.actividad_prefix) : 'ACT-TEST';
    const sheetName = (SYSTEM_CONFIG && SYSTEM_CONFIG.SHEETS && SYSTEM_CONFIG.SHEETS.ADVANCES) ? SYSTEM_CONFIG.SHEETS.ADVANCES : 'Avances';
    const sheet = getOrCreateSheet(sheetName, ADVANCE_HEADERS);

    const range = sheet.getDataRange();
    const values = range.getValues();
    if (!values || values.length <= 1) return formatResponse(true, { deleted: 0 }, 'No hay filas para procesar');

    const headers = values[0] || [];
    const activityCol = headers.findIndex(h => h === 'actividad_id');
    if (activityCol === -1) return formatResponse(false, null, '', "Columna 'actividad_id' no encontrada");

    let deleted = 0;
    // Iterar de abajo hacia arriba para eliminar sin romper índices
    for (let r = values.length - 1; r >= 1; r--) {
      const cell = String(values[r][activityCol] || '');
      if (cell.indexOf(prefix) === 0) {
        sheet.deleteRow(r + 1); // rango values está offset por 1 (headers)
        deleted++;
      }
    }

    return formatResponse(true, { deleted: deleted }, `Filas eliminadas que comenzaban con '${prefix}'`);
  } catch (e) {
    console.error('cleanupTestRows error', e);
    return formatResponse(false, null, '', 'Error limpiando filas de prueba');
  }
}

/**
 * Debug helper: devuelve información sobre el spreadsheet y la hoja 'Avances'
 */
function debugAvancesStatus() {
  try {
    const ssId = SYSTEM_CONFIG && SYSTEM_CONFIG.SPREADSHEET_ID ? SYSTEM_CONFIG.SPREADSHEET_ID : null;
    if (!ssId) return formatResponse(false, null, '', 'SPREADSHEET_ID no configurado');

    const ss = SpreadsheetApp.openById(ssId);
    const sheetNames = ss.getSheets().map(s => s.getName());

    const sheetName = (SYSTEM_CONFIG && SYSTEM_CONFIG.SHEETS && SYSTEM_CONFIG.SHEETS.ADVANCES) ? SYSTEM_CONFIG.SHEETS.ADVANCES : 'Avances';
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return formatResponse(true, { spreadsheetId: ssId, sheetNames: sheetNames, message: `Sheet '${sheetName}' not found` }, 'Debug status');

    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    const headerRange = sheet.getRange(1, 1, 1, lastCol);
    const headers = headerRange.getValues()[0];

    // Get last up to 5 rows of data
    const fromRow = Math.max(2, lastRow - 4);
    let data = [];
    if (lastRow >= 2) {
      const rows = sheet.getRange(fromRow, 1, lastRow - fromRow + 1, lastCol).getValues();
      data = rows.map(r => r);
    }

    return formatResponse(true, { spreadsheetId: ssId, sheetNames: sheetNames, sheetName: sheetName, headers: headers, lastRow: lastRow, previewRows: data }, 'Debug status');
  } catch (e) {
    console.error('debugAvancesStatus error', e);
    return formatResponse(false, null, '', 'Error running debug status');
  }
}

function eliminarAvance(payload) {
  try {
    const id = payload && (payload.avance_id || payload.id);
    if (!id) return formatResponse(false, null, '', 'avance_id requerido');

    const sheetName = (SYSTEM_CONFIG && SYSTEM_CONFIG.SHEETS && SYSTEM_CONFIG.SHEETS.ADVANCES) ? SYSTEM_CONFIG.SHEETS.ADVANCES : 'Avances';
    const sheet = getOrCreateSheet(sheetName, []);

    const range = sheet.getDataRange();
    const values = range.getValues();
    const headers = values[0] || [];
    const idCol = headers.findIndex(h => h === 'avance_id');
    if (idCol === -1) return formatResponse(false, null, '', "Columna 'avance_id' no encontrada");

    let foundRow = -1;
    let rowSnapshot = null;
    for (let i = 1; i < values.length; i++) {
      if (String(values[i][idCol]) === String(id)) {
        foundRow = i + 1;
        rowSnapshot = values[i];
        break;
      }
    }

    if (foundRow === -1) return formatResponse(false, null, '', 'avance_id no encontrado');

    sheet.deleteRow(foundRow);
    if (typeof appendSystemLog === 'function') {
      const headers = values[0] || [];
      const asObject = rowSnapshot
        ? headers.reduce((acc, header, idx) => {
            if (header) acc[header] = rowSnapshot[idx];
            return acc;
          }, {})
        : {};
      appendSystemLog({
        evento_tipo: ADVANCE_LOG_EVENTS.DELETE,
        origen: 'AdvancesManager',
        usuario_email: payload?.usuario || payload?.usuario_email || '',
        usuario_rol: payload?.usuario_rol || '',
        actividad_id: asObject?.actividad_id || payload?.actividad_id || '',
        actividad_codigo: asObject?.codigo || '',
        bimestre: asObject?.bimestre_nombre || asObject?.bimestre_id || '',
        avance_id: id,
        estado_revision: asObject?.estado_revision || '',
        requiere_revision: false,
        mensaje: 'Avance eliminado',
        payload_json: { payload: payload, eliminado: asObject },
        resultado: 'OK'
      });
    }
    return formatResponse(true, { avance_id: id }, 'Avance eliminado');
  } catch (e) {
    console.error('eliminarAvance error', e);
    if (typeof appendSystemLog === 'function') {
      appendSystemLog({
        evento_tipo: ADVANCE_LOG_EVENTS.ERROR,
        origen: 'AdvancesManager',
        usuario_email: payload?.usuario || payload?.usuario_email || '',
        usuario_rol: payload?.usuario_rol || '',
        actividad_id: payload?.actividad_id || '',
        avance_id: payload?.avance_id || payload?.id || '',
        mensaje: 'Error eliminando avance',
        payload_json: { error: e && e.message ? e.message : e, payload: payload },
        resultado: 'ERROR'
      });
    }
    return formatResponse(false, null, '', 'Error eliminando avance');
  }
}
