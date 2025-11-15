const currencyFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0
});

const numberFormatter = new Intl.NumberFormat('es-CO', {
  maximumFractionDigits: 2
});

const percentFormatter = new Intl.NumberFormat('es-CO', {
  style: 'percent',
  minimumFractionDigits: 0,
  maximumFractionDigits: 1
});

const dateFormatter = new Intl.DateTimeFormat('es-CO', {
  day: '2-digit',
  month: 'short',
  year: 'numeric'
});

export function formatCurrency(value) {
  if (value === null || value === undefined || value === '') return 'N/A';
  const num = Number(value);
  if (!Number.isFinite(num)) return 'N/A';
  try {
    const formatted = currencyFormatter.format(num);
    return softenNumberSpacing(formatted);
  } catch (err) {
    return `$${num.toFixed(0)}`;
  }
}

export function formatNumber(value) {
  if (value === null || value === undefined || value === '') return 'N/A';
  const num = Number(value);
  if (!Number.isFinite(num)) return 'N/A';
  try {
    const formatted = numberFormatter.format(num);
    return softenNumberSpacing(formatted);
  } catch (err) {
    return num.toFixed(2);
  }
}

export function formatPercent(value) {
  if (value === null || value === undefined || value === '') return 'N/A';
  const num = Number(value);
  if (!Number.isFinite(num)) return 'N/A';
  try {
    return percentFormatter.format(num);
  } catch (err) {
    return `${(num * 100).toFixed(1)}%`;
  }
}

export function formatDate(value) {
  if (!value) return 'N/A';
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return dateFormatter.format(date);
  } catch (err) {
    return value;
  }
}

export function evaluateAvancePerformance(meta, logro) {
  const metaNum = Number(meta);
  const logroNum = Number(logro);
  const hasMeta = Number.isFinite(metaNum) && metaNum > 0;
  const hasLogro = Number.isFinite(logroNum) && logroNum >= 0;

  if (!hasMeta && !hasLogro) {
    return {
      status: 'sin-meta',
      ratio: null,
      diff: null,
      label: 'Sin meta',
      message: 'No se ha definido una meta para este bimestre.'
    };
  }

  if (!hasMeta) {
    return {
      status: 'sin-meta',
      ratio: null,
      diff: null,
      label: 'Sin meta',
      message: 'No se ha definido una meta para este bimestre.'
    };
  }

  const ratio = hasLogro ? (metaNum === 0 ? 0 : logroNum / metaNum) : 0;
  const diff = hasLogro ? logroNum - metaNum : -metaNum;

  let status = 'en-riesgo';
  let label = 'En riesgo';
  if (ratio >= 1.05) {
    status = 'superado';
    label = 'Meta superada';
  } else if (ratio >= 0.9) {
    status = 'en-ruta';
    label = 'En ruta';
  }

  return {
    status,
    ratio,
    diff,
    label,
    message: hasLogro
      ? `Logro ${formatNumber(logroNum)} vs meta ${formatNumber(metaNum)}`
      : 'Aún no se reporta avance en este bimestre.'
  };
}

export function parseNumericValue(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  const text = value.toString().trim();
  if (!text) return null;

  const numericSegments = text.match(/-?\d[\d.,]*/g);
  if (numericSegments && numericSegments.length) {
    const parsedSegments = numericSegments
      .map((segment, index) => ({
        raw: segment,
        parsed: normalizeNumberString(segment),
        index
      }))
      .filter((entry) => entry.parsed !== null);

    if (parsedSegments.length) {
      if (parsedSegments.length > 1) {
        const currentYear = new Date().getFullYear();
        const filtered = parsedSegments.filter(
          (entry) => !isLikelyYearToken(
            entry.raw,
            entry.parsed,
            currentYear,
            entry.index,
            parsedSegments.length
          )
        );
        if (filtered.length) {
          return filtered[0].parsed;
        }
      }
      return parsedSegments[0].parsed;
    }
  }

  return normalizeNumberString(text);
}

function softenNumberSpacing(text) {
  if (!text) return text;
  return text
    .replace(/\u00A0/g, ' ')
    .replace(/(\d)\.(?=\d{3}(?:\D|$))/g, '$1.\u2009');
}

function normalizeNumberString(input) {
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

function isLikelyYearToken(raw, parsedValue, currentYear, index, totalSegments) {
  if (!Number.isInteger(parsedValue)) return false;
  if (parsedValue < 1900 || parsedValue > currentYear + 10) return false;
  const trimmed = raw ? raw.trim() : '';
  if (!trimmed) return false;
  const coreToken = trimmed.replace(/^[^0-9-]+|[^0-9-]+$/g, '');
  if (!/^\d{4}$/.test(coreToken)) return false;
  if (totalSegments > 1 && index === totalSegments - 1) {
    return true;
  }
  return /año|vigencia|periodo|período|ano/i.test(trimmed);
}
