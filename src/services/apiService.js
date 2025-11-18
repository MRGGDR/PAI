/**
 * Servicio centralizado para todas las llamadas del frontend al backend.
 * Siempre envía las solicitudes al endpoint /api; el backend reenvía a Apps Script.
 */

const API_URL = '/api';

export async function callBackend(path, payload = {}) {
  const sanitizedPath = typeof path === 'string' ? path.trim() : '';
  if (!sanitizedPath) {
    throw new Error('callBackend requiere un path');
  }

  const body = {
    path: sanitizedPath,
    ...(payload && typeof payload === 'object' ? payload : {})
  };

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body),
    credentials: 'omit'
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    const detail = text ? ` (${text})` : '';
    throw new Error(`Error HTTP ${response.status} en /api${detail}`);
  }

  const text = await response.text();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error('La respuesta de /api no es JSON válido');
  }
}

export default {
  callBackend
};
