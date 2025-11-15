import { showLoaderDuring } from '../lib/loader.js';
import { UI } from '../lib/ui.js';
import apiService from './actividades/api.js';
import {
	normalizarRol,
	obtenerAreaUsuarioActual,
	coincideAreaUsuario,
	normalizarEstadoActividad,
	obtenerClaseEstadoActividad,
	normalizarEstadoRevision,
	obtenerClaseEstadoRevision,
	ESTADOS_REVISION
} from './actividades/utils.js';

const AREA_ALL = '__all__';
const YEAR_ALL = 'all';

const currencyFormatter = new Intl.NumberFormat('es-CO', {
	style: 'currency',
	currency: 'COP',
	maximumFractionDigits: 0
});

const integerFormatter = new Intl.NumberFormat('es-CO', {
	maximumFractionDigits: 0
});

const percentFormatter = new Intl.NumberFormat('es-CO', {
	style: 'percent',
	minimumFractionDigits: 0,
	maximumFractionDigits: 1
});

const state = {
	role: 'visualizador',
	assignedArea: '',
	filters: {
		areaCode: AREA_ALL,
		areaLabel: '',
		year: YEAR_ALL
	},
	areaCatalog: {
		byCode: new Map(),
		byNormalizedLabel: new Map()
	},
	areaFilterOptions: new Map(),
	rawActivities: [],
	filteredActivities: [],
	rawBudgets: [],
	filteredBudgets: []
};

const refs = {
	scopeBadge: null,
	totalActivities: null,
	inProgress: null,
	closed: null,
	compliance: null,
	budgetComparison: null,
	budgetDetail: null,
	yearFilter: null,
	areaFilter: null,
	clearFilters: null,
	chartAreasColumns: null,
	chartAreasEmpty: null,
	chartCompliance: null,
	chartComplianceEmpty: null,
	tableBody: null,
	tableEmpty: null
};

document.addEventListener('DOMContentLoaded', () => {
	captureDomReferences();
	initDashboard().catch(error => {
		console.error('[Dashboard] Error inicializando:', error);
	});
});

async function initDashboard() {
	detectContext();
	toggleAdminSections();

	try {
		await showLoaderDuring(loadData, 'Cargando dashboard...');
	} catch (error) {
		console.error('[Dashboard] No fue posible cargar datos:', error);
		UI.showMessage('No fue posible cargar los datos del dashboard.', 'error', 6000);
	}

	populateFilters({ preserveArea: false, preserveYear: false });
	setupFilterHandlers();
	applyFilters();
	renderAll();
}

function captureDomReferences() {
	refs.scopeBadge = document.getElementById('dashboard-scope');
	refs.totalActivities = document.getElementById('kpi-total-activities');
	refs.inProgress = document.getElementById('kpi-in-progress');
	refs.closed = document.getElementById('kpi-closed');
	refs.compliance = document.getElementById('kpi-compliance');
	refs.budgetComparison = document.getElementById('kpi-budget-comparison');
	refs.budgetDetail = document.getElementById('kpi-budget-detail');
	refs.budgetBar = document.getElementById('kpi-budget-bar');
	refs.yearFilter = document.getElementById('filter-year');
	refs.areaFilter = document.getElementById('filter-area');
	refs.clearFilters = document.getElementById('filter-clear');
	refs.chartAreasColumns = document.getElementById('chart-areas-columns');
	refs.chartAreasEmpty = document.getElementById('chart-areas-empty');
	refs.chartCompliance = document.getElementById('chart-compliance');
	refs.chartComplianceEmpty = document.getElementById('chart-compliance-empty');
	refs.tableBody = document.getElementById('dashboard-activities-body');
	refs.tableEmpty = document.getElementById('dashboard-activities-empty');
}

function detectContext() {
	try {
		state.role = normalizarRol(localStorage.getItem('auth_role') || '');
	} catch (error) {
		state.role = 'visualizador';
	}

	state.assignedArea = obtenerAreaUsuarioActual() || '';

	if (state.role !== 'admin') {
		state.filters.areaCode = '';
		state.filters.areaLabel = state.assignedArea;
	}
}

function toggleAdminSections() {
	if (state.role === 'admin') return;
	document.querySelectorAll('[data-role="admin-only"]').forEach(element => {
		element.classList.add('hidden');
	});
}

async function loadData() {
	const requests = [
		apiService.callBackend('actividades/obtener', {}, { loaderMessage: null }),
		apiService.callBackend('presupuestos/listar', { es_actual: true }, { loaderMessage: null }),
		apiService.callBackend('catalog/getByType', { type: 'area', includeInactive: true }, { loaderMessage: null })
	];

	const [activitiesRes, budgetsRes, areasRes] = await Promise.allSettled(requests);

	const areasPayload = areasRes.status === 'fulfilled' ? areasRes.value : null;
	if (areasRes.status !== 'fulfilled') {
		console.warn('[Dashboard] No fue posible obtener el catálogo de áreas:', areasRes.reason);
	}
	state.areaCatalog = buildAreaCatalog(extractArrayFromResponse(areasPayload));

	const activitiesPayload = activitiesRes.status === 'fulfilled' ? activitiesRes.value : null;
	if (activitiesRes.status !== 'fulfilled') {
		console.error('[Dashboard] Error cargando actividades:', activitiesRes.reason);
	}
	state.rawActivities = normalizeActivities(extractArrayFromResponse(activitiesPayload), state.areaCatalog);

	const budgetsPayload = budgetsRes.status === 'fulfilled' ? budgetsRes.value : null;
	if (budgetsRes.status !== 'fulfilled') {
		console.warn('[Dashboard] Error cargando presupuestos:', budgetsRes.reason);
	}
	state.rawBudgets = normalizeBudgets(extractArrayFromResponse(budgetsPayload), state.areaCatalog);

	if (state.role !== 'admin') {
		resolveContributorAreaFilter();
	}
}

function buildAreaCatalog(items = []) {
	const byCode = new Map();
	const byNormalizedLabel = new Map();

	items.forEach(item => {
		if (!item) return;
		const code = String(item.code || item.codigo || item.id || item.area_id || '').trim();
		const label = String(item.label || item.nombre || item.descripcion || item.area || code).trim();
		if (code) {
			byCode.set(code, label || code);
		}
		if (label) {
			byNormalizedLabel.set(normalizeText(label), code || label);
		}
	});

	return { byCode, byNormalizedLabel };
}

function normalizeActivities(list, areaCatalog) {
	return list.map(item => {
		const areaId = String(item?.area_id || item?.areaId || '').trim();
		const areaLabelRaw = String(item?.area_nombre || item?.areaNombre || item?.area || '').trim();
		const areaLabel = areaLabelRaw || resolveAreaLabel(areaCatalog, areaId);
		const estadoRevisionRaw = String(
			item?.estado_revision ||
			item?.estadoRevision ||
			item?.estado_revision_nombre ||
			item?.estadoRevisionNombre ||
			''
		).trim();
		const estadoGeneralRaw = String(
			item?.estado ||
			item?.estadoNombre ||
			item?.estado_actividad ||
			item?.estadoActividad ||
			''
		).trim();
		let estadoRevisionCanonical = estadoRevisionRaw ? normalizarEstadoRevision(estadoRevisionRaw) : '';
		const estadoActividadCanonical = estadoGeneralRaw ? normalizarEstadoActividad(estadoGeneralRaw) : '';
		const estadoDisplay = (() => {
			const revisionSolida = ESTADOS_REVISION.includes(estadoRevisionCanonical) && estadoRevisionCanonical !== 'Sin revisión';
			const actividadSolida = ESTADOS_REVISION.includes(estadoActividadCanonical) && estadoActividadCanonical !== 'Sin revisión';
			if (revisionSolida) return estadoRevisionCanonical;
			if (actividadSolida) return estadoActividadCanonical;
			if (ESTADOS_REVISION.includes(estadoRevisionCanonical)) return estadoRevisionCanonical;
			if (ESTADOS_REVISION.includes(estadoActividadCanonical)) return estadoActividadCanonical;
			if (estadoRevisionCanonical) return estadoRevisionCanonical;
			if (estadoActividadCanonical) return estadoActividadCanonical;
			return 'Sin revisión';
		})();
		if (!estadoRevisionCanonical && ESTADOS_REVISION.includes(estadoActividadCanonical)) {
			estadoRevisionCanonical = estadoActividadCanonical;
		}
		const presupuesto = toNumber(item?.presupuesto_programado ?? item?.presupuesto ?? 0);
		const vigencia = inferYear(item?.vigencia || item?.fecha_inicio_planeada || item?.fecha_fin_planeada || item?.creado_el || item?.codigo);
		const fechaInicio = item?.fecha_inicio_planeada || item?.fecha_inicio || item?.creado_el || '';
		const fechaFin = item?.fecha_fin_planeada || item?.fecha_fin || item?.actualizado_el || '';
		const responsable = String(item?.responsable || item?.responsable_nombre || item?.usuario || '').trim();
		const codigo = String(item?.codigo || item?.actividad_id || item?.id || '').trim();
		const bimestres = parseBimestres(item?.bimestres);

		return {
			id: codigo || String(item?.actividad_id || item?.id || ''),
			codigo: codigo,
			descripcion: String(item?.descripcion_actividad || item?.descripcion || item?.nombre || '').trim(),
			areaId,
			areaLabel: areaLabel || areaId || 'Sin área',
			estado: estadoDisplay,
			estadoRevisionCanonical,
			estadoActividadCanonical,
			estadoRevisionFuente: estadoRevisionRaw,
			estadoActividadFuente: estadoGeneralRaw,
			presupuesto,
			vigencia,
			fechaInicio,
			fechaFin,
			responsable,
			bimestres,
			raw: item
		};
	});
}

function normalizeBudgets(list, areaCatalog) {
	return list.map(item => {
		const areaId = String(item?.area_id || item?.areaId || '').trim();
		const areaLabel = resolveAreaLabel(areaCatalog, item?.area_nombre || areaId);
		const monto = toNumber(item?.presupuesto_asignado ?? item?.presupuesto_total ?? item?.valor ?? 0);
		const vigencia = item?.vigencia ? String(item.vigencia).trim() : '';
		const esActual = parseBoolean(item?.es_actual !== undefined ? item.es_actual : true);

		return {
			areaId,
			areaLabel: areaLabel || areaId || 'Sin área',
			monto,
			vigencia,
			esActual,
			raw: item
		};
	});
}

function resolveContributorAreaFilter() {
	if (state.role === 'admin') return;

	const assigned = (state.assignedArea || '').trim();
	if (!assigned) {
		state.filters.areaCode = '';
		state.filters.areaLabel = '';
		return;
	}

	const availableAreas = deriveAvailableAreas({ year: YEAR_ALL });

	const exactCode = availableAreas.find(area => area.code && area.code.toLowerCase() === assigned.toLowerCase());
	if (exactCode) {
		state.filters.areaCode = exactCode.code;
		state.filters.areaLabel = exactCode.label;
		return;
	}

	const matchingLabel = availableAreas.find(area => coincideAreaUsuario(assigned, [area.label]));
	if (matchingLabel) {
		state.filters.areaCode = matchingLabel.code || '';
		state.filters.areaLabel = matchingLabel.label;
		return;
	}

	state.filters.areaCode = '';
	state.filters.areaLabel = assigned;
}

function populateFilters({ preserveArea = true, preserveYear = true } = {}) {
	if (state.role === 'admin' && refs.areaFilter) {
		populateAreaFilter({ preserveSelection: preserveArea });
	}

	populateYearFilter({ preserveSelection: preserveYear });

	if (state.role === 'admin' && refs.areaFilter) {
		populateAreaFilter({ preserveSelection: true });
	}

	updateScopeBadge();
}

function populateYearFilter({ preserveSelection = true } = {}) {
	if (!refs.yearFilter) return;

	const areaFilter = {
		areaCode: state.filters.areaCode,
		areaLabel: state.filters.areaLabel
	};

	const availableYears = deriveAvailableYears(areaFilter);
	const previous = preserveSelection ? state.filters.year : YEAR_ALL;

	refs.yearFilter.innerHTML = '';

	const optionAll = document.createElement('option');
	optionAll.value = YEAR_ALL;
	optionAll.textContent = 'Todas';
	refs.yearFilter.appendChild(optionAll);

	availableYears.forEach(year => {
		const option = document.createElement('option');
		option.value = year;
		option.textContent = year;
		refs.yearFilter.appendChild(option);
	});

	let selected = YEAR_ALL;
	if (preserveSelection) {
		if (availableYears.includes(previous)) {
			selected = previous;
		} else if (previous !== YEAR_ALL && availableYears.length === 1) {
			selected = availableYears[0];
		}
	}

	refs.yearFilter.value = selected;
	state.filters.year = selected;
}

function populateAreaFilter({ preserveSelection = true } = {}) {
	if (!refs.areaFilter) return;

	const availableAreas = deriveAvailableAreas({ year: state.filters.year });
	const previousCode = preserveSelection ? state.filters.areaCode : AREA_ALL;
	const previousLabel = preserveSelection ? state.filters.areaLabel : '';
	const normalizedPrevLabel = normalizeText(previousLabel || '');

	state.areaFilterOptions = new Map();
	refs.areaFilter.innerHTML = '';

	const addOption = (value, label, meta) => {
		const option = document.createElement('option');
		option.value = value;
		option.textContent = label;
		refs.areaFilter.appendChild(option);
		state.areaFilterOptions.set(value, meta);
	};

	addOption(AREA_ALL, 'Todas las áreas', { code: AREA_ALL, label: '' });

	availableAreas.forEach(area => {
		const value = area.code && area.code.trim() ? area.code : `label:${normalizeText(area.label)}`;
		addOption(value, area.label, { code: area.code || '', label: area.label });
	});

	let desiredValue = AREA_ALL;

	if (preserveSelection) {
		if (previousCode && previousCode !== AREA_ALL) {
			const matchByCode = availableAreas.find(area => area.code && area.code === previousCode);
			if (matchByCode) {
				desiredValue = matchByCode.code;
			}
		} else if (normalizedPrevLabel) {
			const matchByLabel = availableAreas.find(area => normalizeText(area.label) === normalizedPrevLabel);
			if (matchByLabel) {
				desiredValue = matchByLabel.code ? matchByLabel.code : `label:${normalizeText(matchByLabel.label)}`;
			}
		}
	}

	if (!state.areaFilterOptions.has(desiredValue) && availableAreas.length === 1) {
		const onlyArea = availableAreas[0];
		desiredValue = onlyArea.code ? onlyArea.code : `label:${normalizeText(onlyArea.label)}`;
	}

	if (!state.areaFilterOptions.has(desiredValue)) {
		desiredValue = AREA_ALL;
	}

	refs.areaFilter.value = desiredValue;

	const selectedMeta = state.areaFilterOptions.get(desiredValue);
	if (!selectedMeta || desiredValue === AREA_ALL) {
		state.filters.areaCode = AREA_ALL;
		state.filters.areaLabel = '';
	} else {
		state.filters.areaCode = selectedMeta.code || '';
		state.filters.areaLabel = selectedMeta.label || '';
	}
}

function deriveAvailableYears(areaFilter = { areaCode: AREA_ALL, areaLabel: '' }) {
	const years = new Set();

	state.rawActivities.forEach(item => {
		if (!item.vigencia) return;
		if (areaFilter.areaCode !== AREA_ALL || areaFilter.areaLabel) {
			if (!matchArea(item, areaFilter)) return;
		}
		years.add(item.vigencia);
	});

	state.rawBudgets.forEach(item => {
		if (!item.vigencia) return;
		if (areaFilter.areaCode !== AREA_ALL || areaFilter.areaLabel) {
			if (!matchBudgetArea(item, areaFilter)) return;
		}
		years.add(item.vigencia);
	});

	return Array.from(years)
		.filter(Boolean)
		.sort((a, b) => Number(b) - Number(a));
}

function deriveAvailableAreas({ year = YEAR_ALL } = {}) {
	const map = new Map();

	const registerArea = (code, label) => {
		const resolvedLabel = label || resolveAreaLabel(state.areaCatalog, code) || code || 'Sin área';
		const key = code ? `code:${code}` : `label:${normalizeText(resolvedLabel)}`;
		if (!map.has(key)) {
			map.set(key, { code: code || '', label: resolvedLabel, count: 0 });
		}
		const entry = map.get(key);
		entry.count += 1;
	};

	state.rawActivities.forEach(item => {
		if (year !== YEAR_ALL && item.vigencia && item.vigencia !== year) return;
		registerArea(item.areaId, item.areaLabel);
	});

	state.rawBudgets.forEach(item => {
		if (year !== YEAR_ALL && item.vigencia && item.vigencia !== year) return;
		registerArea(item.areaId, item.areaLabel);
	});

	return Array.from(map.values())
		.filter(entry => entry.count > 0)
		.sort((a, b) => a.label.localeCompare(b.label, 'es', { sensitivity: 'base' }));
}

function setupFilterHandlers() {
	if (refs.yearFilter) {
		refs.yearFilter.addEventListener('change', () => {
			state.filters.year = refs.yearFilter.value || YEAR_ALL;
			if (state.role === 'admin' && refs.areaFilter) {
				populateAreaFilter({ preserveSelection: true });
			}
			applyFilters();
			renderAll();
		});
	}

	if (state.role === 'admin' && refs.areaFilter) {
		refs.areaFilter.addEventListener('change', () => {
			const selectedValue = refs.areaFilter.value;
			const meta = state.areaFilterOptions.get(selectedValue);

			if (!meta || selectedValue === AREA_ALL) {
				state.filters.areaCode = AREA_ALL;
				state.filters.areaLabel = '';
			} else {
				state.filters.areaCode = meta.code || '';
				state.filters.areaLabel = meta.label || '';
			}

			const previousYear = state.filters.year;
			populateYearFilter({ preserveSelection: true });

			if (state.filters.year !== previousYear) {
				populateAreaFilter({ preserveSelection: true });
			}

			applyFilters();
			renderAll();
		});
	}

	if (refs.clearFilters) {
		refs.clearFilters.addEventListener('click', () => {
			state.filters.year = YEAR_ALL;

			if (state.role === 'admin') {
				state.filters.areaCode = AREA_ALL;
				state.filters.areaLabel = '';
			} else {
				resolveContributorAreaFilter();
			}

			populateFilters({ preserveArea: false, preserveYear: false });
			applyFilters();
			renderAll();
		});
	}
}

function applyFilters() {
	const areaFilter = {
		areaCode: state.role === 'admin' ? state.filters.areaCode : state.filters.areaCode || '',
		areaLabel: state.role === 'admin' ? state.filters.areaLabel : state.filters.areaLabel || state.assignedArea
	};

	const yearFilter = state.filters.year;

	let activities = state.rawActivities.slice();
	if (state.role === 'admin') {
		if (areaFilter.areaCode && areaFilter.areaCode !== AREA_ALL) {
			activities = activities.filter(item => matchArea(item, areaFilter));
		} else if (areaFilter.areaLabel) {
			activities = activities.filter(item => matchArea(item, areaFilter));
		}
	} else if (areaFilter.areaLabel) {
		activities = activities.filter(item => matchArea(item, areaFilter));
	}

	if (yearFilter !== YEAR_ALL) {
		activities = activities.filter(item => item.vigencia === yearFilter);
	}

	state.filteredActivities = activities;

	let budgets = state.rawBudgets.slice();
	if (state.role === 'admin') {
		if (areaFilter.areaCode && areaFilter.areaCode !== AREA_ALL) {
			budgets = budgets.filter(item => matchBudgetArea(item, areaFilter));
		} else if (areaFilter.areaLabel) {
			budgets = budgets.filter(item => matchBudgetArea(item, areaFilter));
		}
	} else if (areaFilter.areaLabel) {
		budgets = budgets.filter(item => matchBudgetArea(item, areaFilter));
	}

	if (yearFilter !== YEAR_ALL) {
		budgets = budgets.filter(item => item.vigencia === yearFilter || !item.vigencia);
	}

	state.filteredBudgets = budgets;
}

function renderAll() {
	renderKpis();
	if (state.role === 'admin') {
		renderAreaChart();
		renderComplianceChart();
	}
	renderActivitiesTable();
}

function renderKpis() {
	const total = state.filteredActivities.length;
	const inProgress = state.filteredActivities.filter(item => isInProgress(item.estado)).length;
	const completed = state.filteredActivities.filter(item => isCompleted(item.estado)).length;
	const compliance = total > 0 ? completed / total : 0;

	if (refs.totalActivities) refs.totalActivities.textContent = formatInteger(total);
	if (refs.inProgress) refs.inProgress.textContent = formatInteger(inProgress);
	if (refs.closed) refs.closed.textContent = formatInteger(completed);
	if (refs.compliance) refs.compliance.textContent = total ? formatPercent(compliance) : '0%';

	const executedBudget = state.filteredActivities.reduce((acc, item) => acc + (item.presupuesto || 0), 0);
	const totalBudget = state.filteredBudgets
		.filter(item => item.esActual !== false)
		.reduce((acc, item) => acc + (item.monto || 0), 0);

	if (refs.budgetComparison) {
		if (executedBudget || totalBudget) {
			refs.budgetComparison.textContent = `${formatCurrency(executedBudget)} / ${formatCurrency(totalBudget)}`;
		} else {
			refs.budgetComparison.textContent = 'Sin registros';
		}
	}

	if (refs.budgetDetail) {
		if (totalBudget > 0) {
			const ratio = executedBudget / totalBudget;
			refs.budgetDetail.textContent = `${formatPercent(ratio)}`;
			
			// Update progress bar
			if (refs.budgetBar) {
				const percentage = Math.min(ratio * 100, 100);
				refs.budgetBar.style.width = `${percentage}%`;
			}
		} else {
			refs.budgetDetail.textContent = '0%';
			if (refs.budgetBar) {
				refs.budgetBar.style.width = '0%';
			}
		}
	}

	updateScopeBadge();
}

function renderAreaChart() {
	if (!refs.chartAreasColumns) return;
	clearElement(refs.chartAreasColumns);

	const dataset = buildAreaDataset();
	if (!dataset.length) {
		showElement(refs.chartAreasEmpty);
		return;
	}

	hideElement(refs.chartAreasEmpty);

	const sorted = dataset
		.slice()
		.sort((a, b) => b.total - a.total || a.areaLabel.localeCompare(b.areaLabel))
		.slice(0, 8);

	sorted.forEach(item => {
		const column = document.createElement('div');
		column.className = 'flex min-w-[80px] flex-col items-center gap-2 text-xs text-[var(--text-secondary)]';
		column.title = `${item.areaLabel} | ${formatInteger(item.total)} actividades`;

		const countTag = document.createElement('span');
		countTag.className = 'text-sm font-semibold text-[var(--text-primary)]';
		countTag.textContent = formatInteger(item.total);

		const bar = document.createElement('div');
		bar.className = 'flex h-48 w-12 flex-col overflow-hidden rounded-lg border border-slate-200 bg-slate-50';

		const segments = [
			{ value: item.completed, className: 'bg-emerald-500', label: 'Completadas' },
			{ value: item.inProgress, className: 'bg-indigo-500', label: 'En ejecución' },
			{ value: item.planned, className: 'bg-amber-400', label: 'Planeadas' },
			{ value: item.others, className: 'bg-slate-400', label: 'Otras' }
		];

		segments.forEach(segmentInfo => {
			const { value, className, label } = segmentInfo;
			if (!value) return;
			const segment = document.createElement('div');
			segment.className = `${className} w-full`;
			segment.style.flexGrow = value;
			segment.style.minHeight = '6px';
			const percent = item.total ? (value / item.total) * 100 : 0;
			segment.title = `${label}: ${formatInteger(value)} (${percent.toFixed(1)}%)`;
			bar.appendChild(segment);
		});

		if (!bar.children.length) {
			const placeholder = document.createElement('div');
			placeholder.className = 'h-full w-full bg-slate-200';
			bar.appendChild(placeholder);
		}

		const label = document.createElement('span');
		label.className = 'w-full truncate text-center font-medium text-[var(--text-primary)]';
		label.textContent = item.areaLabel;
		label.title = item.areaLabel;

		column.appendChild(countTag);
		column.appendChild(bar);
		column.appendChild(label);
		refs.chartAreasColumns.appendChild(column);
	});
}

function renderComplianceChart() {
	if (!refs.chartCompliance) return;
	clearElement(refs.chartCompliance);

	const dataset = buildAreaDataset();
	const ranked = dataset
		.filter(item => item.total > 0)
		.map(item => ({
			areaLabel: item.areaLabel,
			completed: item.completed,
			total: item.total,
			ratio: item.completed / item.total
		}))
		.sort((a, b) => b.ratio - a.ratio || b.total - a.total)
		.slice(0, 8);

	if (!ranked.length) {
		showElement(refs.chartComplianceEmpty);
		return;
	}

	hideElement(refs.chartComplianceEmpty);

	ranked.forEach(item => {
		const row = document.createElement('div');
		row.className = 'rounded-lg border border-slate-200 bg-white p-3 shadow-sm';
		row.title = [
			`Área: ${item.areaLabel}`,
			`Cumplimiento: ${formatPercent(item.ratio)}`,
			`Actividades completadas: ${formatInteger(item.completed)}`,
			`Actividades totales: ${formatInteger(item.total)}`
		].join('\n');

		const header = document.createElement('div');
		header.className = 'flex items-center justify-between gap-3 text-sm';

		const label = document.createElement('span');
		label.className = 'font-medium text-[var(--text-primary)]';
		label.textContent = item.areaLabel;
		label.title = item.areaLabel;

		const value = document.createElement('span');
		value.className = 'text-sm font-semibold text-indigo-600';
		value.textContent = formatPercent(item.ratio);

		header.appendChild(label);
		header.appendChild(value);

		const bar = document.createElement('div');
		bar.className = 'mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100';

		const fill = document.createElement('div');
		fill.className = 'h-full bg-indigo-500';
		const percent = Math.min(100, Math.max(0, item.ratio * 100));
		fill.style.width = `${percent}%`;
		bar.appendChild(fill);

		const detail = document.createElement('p');
		detail.className = 'mt-2 text-xs text-[var(--text-secondary)]';
		detail.textContent = `${formatInteger(item.completed)} de ${formatInteger(item.total)} actividades completadas`;

		row.appendChild(header);
		row.appendChild(bar);
		row.appendChild(detail);
		refs.chartCompliance.appendChild(row);
	});
}

function renderActivitiesTable() {
	if (!refs.tableBody || !refs.tableEmpty) return;
	clearElement(refs.tableBody);

	if (!state.filteredActivities.length) {
		showElement(refs.tableEmpty);
		return;
	}

	hideElement(refs.tableEmpty);

	const limit = state.role === 'admin' ? 12 : 15;
	const rows = state.filteredActivities
		.slice()
		.sort(compareActivitiesByCode)
		.slice(0, limit);

	rows.forEach(activity => {
		const tr = document.createElement('tr');
		tr.className = 'transition-all duration-200 hover:bg-gray-50 cursor-pointer';

		const codeCell = document.createElement('td');
		codeCell.className = 'whitespace-nowrap px-6 py-4 text-sm font-semibold text-indigo-600';
		const codeValue = activity.codigo || activity.id || '--';
		codeCell.textContent = codeValue;
		codeCell.title = codeValue;
		tr.appendChild(codeCell);

		const descriptionCell = document.createElement('td');
		descriptionCell.className = 'max-w-xs px-6 py-4 align-top text-sm text-gray-700';
		const descriptionWrapper = document.createElement('div');
		descriptionWrapper.className = 'space-y-2';
		const descriptionText = document.createElement('p');
		descriptionText.className = 'font-medium text-gray-800';
		descriptionText.textContent = activity.descripcion || 'Sin descripción';
		descriptionWrapper.appendChild(descriptionText);

		const metaInfo = document.createElement('div');
		metaInfo.className = 'flex flex-wrap gap-2 text-xs text-gray-500';

		if (activity.areaLabel) {
			const areaBadge = document.createElement('span');
			areaBadge.className = 'inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 font-semibold text-slate-700';
			areaBadge.textContent = activity.areaLabel;
			metaInfo.appendChild(areaBadge);
		}

		const periodLabel = buildPeriodLabel(activity.fechaInicio, activity.fechaFin);
		if (periodLabel) {
			const periodSpan = document.createElement('span');
			periodSpan.className = 'inline-flex items-center rounded-full bg-slate-50 px-2.5 py-0.5';
			periodSpan.textContent = periodLabel;
			metaInfo.appendChild(periodSpan);
		}

		if (Array.isArray(activity.bimestres) && activity.bimestres.length) {
			const bimestresSpan = document.createElement('span');
			bimestresSpan.className = 'inline-flex items-center rounded-full bg-slate-50 px-2.5 py-0.5';
			bimestresSpan.textContent = `Bimestres ${activity.bimestres.join(', ')}`;
			metaInfo.appendChild(bimestresSpan);
		}

		if (metaInfo.children.length) {
			descriptionWrapper.appendChild(metaInfo);
		}

		descriptionCell.appendChild(descriptionWrapper);
		tr.appendChild(descriptionCell);

		const statusCell = document.createElement('td');
		statusCell.className = 'whitespace-nowrap px-6 py-4';
		statusCell.appendChild(createStatusBadge(activity));
		tr.appendChild(statusCell);

		const budgetCell = document.createElement('td');
		budgetCell.className = 'whitespace-nowrap px-6 py-4 text-sm text-gray-700 text-right';
		budgetCell.textContent = activity.presupuesto ? formatCurrency(activity.presupuesto) : 'Sin dato';
		tr.appendChild(budgetCell);

		const yearCell = document.createElement('td');
		yearCell.className = 'whitespace-nowrap px-6 py-4 text-sm text-gray-600';
		yearCell.textContent = activity.vigencia || inferYear(activity.fechaInicio || activity.fechaFin || activity.codigo) || '--';
		tr.appendChild(yearCell);

		const responsableCell = document.createElement('td');
		responsableCell.className = 'whitespace-nowrap px-6 py-4 text-sm text-gray-600';
		responsableCell.textContent = activity.responsable || '--';
		tr.appendChild(responsableCell);

		refs.tableBody.appendChild(tr);
	});
}

function compareActivitiesByCode(a, b) {
	const keyA = buildCodeSortKey(a?.codigo || a?.id || '');
	const keyB = buildCodeSortKey(b?.codigo || b?.id || '');

	if (keyA.prefix !== keyB.prefix) {
		return keyA.prefix.localeCompare(keyB.prefix);
	}

	if (keyA.numeric !== keyB.numeric) {
		return keyA.numeric - keyB.numeric;
	}

	if (keyA.full !== keyB.full) {
		return keyA.full.localeCompare(keyB.full);
	}

	return keyA.raw.localeCompare(keyB.raw);
}

function buildCodeSortKey(code) {
	const raw = (code || '').toString().trim();
	if (!raw) {
		return {
			prefix: 'zzzz',
			numeric: Number.MAX_SAFE_INTEGER,
			full: 'zzzz',
			raw: ''
		};
	}

	const lowered = raw.toLowerCase();
	const match = lowered.match(/(\d+)(?!.*\d)/);
	let numeric = Number.MAX_SAFE_INTEGER;
	let prefix = lowered;
	if (match) {
		numeric = parseInt(match[1], 10);
		const index = match.index !== undefined ? match.index : lowered.length;
		prefix = lowered.slice(0, index).replace(/[-_\s]+$/, '');
		if (!prefix) {
			prefix = lowered.slice(0, index);
		}
	}

	return {
		prefix,
		numeric: Number.isFinite(numeric) ? numeric : Number.MAX_SAFE_INTEGER,
		full: lowered,
		raw
	};
}

function buildPeriodLabel(startDate, endDate) {
	const start = formatDateLabel(startDate);
	const end = formatDateLabel(endDate);
	if (start && end) {
		return `${start} -> ${end}`;
	}
	if (start) {
		return `Desde ${start}`;
	}
	if (end) {
		return `Hasta ${end}`;
	}
	return '';
}

function formatDateLabel(value) {
	if (!value) return '';
	try {
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return '';
		return date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
	} catch (error) {
		return '';
	}
}

function buildAreaDataset() {
	const map = new Map();
	state.filteredActivities.forEach(activity => {
		const label = activity.areaLabel || resolveAreaLabel(state.areaCatalog, activity.areaId) || 'Sin área';
		if (!map.has(label)) {
			map.set(label, { areaLabel: label, total: 0, completed: 0, inProgress: 0, planned: 0, others: 0 });
		}
		const bucket = map.get(label);
		bucket.total += 1;
		if (isCompleted(activity.estado)) bucket.completed += 1;
		else if (isInProgress(activity.estado)) bucket.inProgress += 1;
		else if (isPlanned(activity.estado)) bucket.planned += 1;
		else bucket.others += 1;
	});
	return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

function matchArea(record, filter) {
	if (!record) return false;
	if (filter.areaCode === AREA_ALL && !filter.areaLabel) return true;

	const values = [
		record.areaId,
		record.areaLabel,
		record.raw?.area,
		record.raw?.areaNombre,
		record.raw?.area_id
	]
		.filter(Boolean)
		.map(value => value.toString());

	if (filter.areaCode && filter.areaCode !== AREA_ALL) {
		const targetCode = filter.areaCode.toLowerCase();
		if (values.some(value => value.toLowerCase() === targetCode)) {
			return true;
		}
		const labelFromCode = resolveAreaLabel(state.areaCatalog, filter.areaCode);
		if (labelFromCode && coincideAreaUsuario(labelFromCode, values)) {
			return true;
		}
	}

	if (filter.areaLabel) {
		return coincideAreaUsuario(filter.areaLabel, values);
	}

	return filter.areaCode === AREA_ALL;
}

function matchBudgetArea(record, filter) {
	if (!record) return false;
	if (filter.areaCode === AREA_ALL && !filter.areaLabel) return true;

	const values = [
		record.areaId,
		record.areaLabel,
		record.raw?.area_id,
		record.raw?.area_nombre
	]
		.filter(Boolean)
		.map(value => value.toString());

	if (filter.areaCode && filter.areaCode !== AREA_ALL) {
		const targetCode = filter.areaCode.toLowerCase();
		if (values.some(value => value.toLowerCase() === targetCode)) {
			return true;
		}
		const labelFromCode = resolveAreaLabel(state.areaCatalog, filter.areaCode);
		if (labelFromCode && coincideAreaUsuario(labelFromCode, values)) {
			return true;
		}
	}

	if (filter.areaLabel) {
		return coincideAreaUsuario(filter.areaLabel, values);
	}

	return filter.areaCode === AREA_ALL;
}

function resolveAreaLabel(areaCatalog, value) {
	if (!value) return '';
	const trimmed = value.toString().trim();
	if (!trimmed) return '';
	if (areaCatalog.byCode.has(trimmed)) {
		return areaCatalog.byCode.get(trimmed) || trimmed;
	}
	const normalized = normalizeText(trimmed);
	if (areaCatalog.byNormalizedLabel.has(normalized)) {
		const code = areaCatalog.byNormalizedLabel.get(normalized);
		if (areaCatalog.byCode.has(code)) {
			return areaCatalog.byCode.get(code) || trimmed;
		}
	}
	return trimmed;
}

function updateScopeBadge() {
	if (!refs.scopeBadge) return;
	const yearLabel = state.filters.year === YEAR_ALL ? 'Vigencia: todas' : `Vigencia: ${state.filters.year}`;
	let text = '';

	if (state.role === 'admin') {
		if (state.filters.areaCode === AREA_ALL || !state.filters.areaCode) {
			text = `Resumen general - Todas las áreas - ${yearLabel}`;
		} else {
			const label = state.filters.areaLabel || resolveAreaLabel(state.areaCatalog, state.filters.areaCode);
			text = `Área: ${label} - ${yearLabel}`;
		}
	} else {
		const areaText = state.filters.areaLabel || state.assignedArea || 'Sin área asignada';
		text = `${areaText} - ${yearLabel}`;
	}

	refs.scopeBadge.textContent = text;
}

function extractArrayFromResponse(payload) {
	if (!payload) return [];
	if (Array.isArray(payload)) return payload;
	if (Array.isArray(payload.data)) return payload.data;
	if (Array.isArray(payload.items)) return payload.items;
	if (Array.isArray(payload.actividades)) return payload.actividades;
	return [];
}

function inferYear(value) {
	if (value === null || value === undefined) return '';
	if (typeof value === 'number' && Number.isFinite(value)) {
		return String(Math.round(value));
	}
	const text = value.toString().trim();
	if (!text) return '';
	if (/^\d{4}$/.test(text)) return text;
	const parsed = new Date(text);
	if (!Number.isNaN(parsed.getTime())) {
		return String(parsed.getFullYear());
	}
	const match = text.match(/(19|20)\d{2}/);
	return match ? match[0] : '';
}

function inferBimestre(value) {
	if (!value) return null;
	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) return null;
	const month = parsed.getMonth();
	return Math.floor(month / 2) + 1;
}

function toNumber(value) {
	if (typeof value === 'number') {
		return Number.isFinite(value) ? value : 0;
	}
	if (typeof value === 'string') {
		const normalized = value
			.replace(/COP|\$|\s+/gi, '')
			.replace(/\./g, '')
			.replace(/,/g, '.')
			.trim();
		const parsed = Number(normalized);
		return Number.isFinite(parsed) ? parsed : 0;
	}
	if (typeof value === 'boolean') {
		return value ? 1 : 0;
	}
	if (value === null || value === undefined) {
		return 0;
	}
	const coerced = Number(value);
	return Number.isFinite(coerced) ? coerced : 0;
}

function parseBoolean(value) {
	if (typeof value === 'boolean') return value;
	if (typeof value === 'number') return value !== 0;
	if (typeof value === 'string') {
		const normalized = value.trim().toLowerCase();
		return ['true', '1', 'si', 'sí', 'activo', 'activa', 'yes'].includes(normalized);
	}
	return Boolean(value);
}

function parseBimestres(input) {
	if (!input) return [];
	if (Array.isArray(input)) {
		return input
			.map(item => {
				if (typeof item === 'number') return item;
				if (typeof item === 'string') {
					const match = item.match(/\d+/);
					return match ? Number(match[0]) : null;
				}
				if (item && typeof item === 'object') {
					const candidates = [item.bimestre, item.label, item.nombre, item.id]
						.filter(Boolean)
						.map(value => value.toString());
					for (const candidate of candidates) {
						const match = candidate.match(/\d+/);
						if (match) return Number(match[0]);
					}
				}
				return null;
			})
			.filter(value => typeof value === 'number' && value >= 1 && value <= 6);
	}
	if (typeof input === 'string') {
		return input
			.split(/[^\d]+/)
			.map(part => Number(part))
			.filter(value => Number.isFinite(value) && value >= 1 && value <= 6);
	}
	return [];
}

function createStatusBadge(activityOrStatus) {
	const badge = document.createElement('span');
	badge.className = 'status-badge inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold';

	let display = 'Sin revisión';
	let revisionCanonical = '';
	let actividadCanonical = '';

	if (activityOrStatus && typeof activityOrStatus === 'object') {
		display = activityOrStatus.estado || activityOrStatus.estadoNombre || display;
		revisionCanonical = activityOrStatus.estadoRevisionCanonical || normalizarEstadoRevision(display);
		actividadCanonical = activityOrStatus.estadoActividadCanonical || normalizarEstadoActividad(display);
		if (!revisionCanonical && activityOrStatus.estadoRevisionFuente) {
			revisionCanonical = normalizarEstadoRevision(activityOrStatus.estadoRevisionFuente);
		}
		if (!actividadCanonical && activityOrStatus.estadoActividadFuente) {
			actividadCanonical = normalizarEstadoActividad(activityOrStatus.estadoActividadFuente);
		}
	} else {
		display = typeof activityOrStatus === 'string' && activityOrStatus.trim()
			? activityOrStatus.trim()
			: display;
		revisionCanonical = normalizarEstadoRevision(display);
		actividadCanonical = normalizarEstadoActividad(display);
	}

	if (!revisionCanonical && ESTADOS_REVISION.includes(actividadCanonical)) {
		revisionCanonical = actividadCanonical;
	}

	const useRevisionPalette = ESTADOS_REVISION.includes(revisionCanonical);
	const classes = useRevisionPalette
		? obtenerClaseEstadoRevision(revisionCanonical || display, 'badge')
		: obtenerClaseEstadoActividad(actividadCanonical || display, 'badge');

	// Añadir clases (Tailwind) cuando estén disponibles
	classes.split(' ').forEach(className => {
		if (className) badge.classList.add(className);
	});

	// Fallback inline: si las clases utility (Tailwind) no están presentes
	// la mayoría de los proyectos eliminan clases dinámicas en la compilación.
	// Aquí determinamos una paleta simple para asegurar colorización.
	const fallbackPalettes = {
		'Aprobado': { bg: '#ECFDF5', border: '#D1FAE5', text: '#065F46' },
		'En revisión': { bg: '#FFFBEB', border: '#FEF3C7', text: '#92400E' },
		'Corrección': { bg: '#FFF7ED', border: '#FFEDD5', text: '#C2410C' },
		'Sin revisión': { bg: '#F8FAFC', border: '#E6E9EE', text: '#475569' },
		'Planeada': { bg: '#FFFFFF', border: '#E6E9EE', text: '#475569' },
		'En Progreso': { bg: '#EFF6FF', border: '#DBEAFE', text: '#1D4ED8' },
		'Completada': { bg: '#ECFDF5', border: '#D1FAE5', text: '#065F46' },
		'Suspendida': { bg: '#FFFBEB', border: '#FEF3C7', text: '#92400E' },
		'Cancelado': { bg: '#FFF1F2', border: '#FEE2E2', text: '#9F1239' },
		default: { bg: '#F3F4F6', border: '#E5E7EB', text: '#374151' }
	};

	const chosen = (useRevisionPalette ? (revisionCanonical || display) : (actividadCanonical || display)) || display;
	const palette = fallbackPalettes[chosen] || fallbackPalettes[display] || fallbackPalettes.default;

	const statusKey = (() => {
		const base = (revisionCanonical || actividadCanonical || display || 'default').toString().trim();
		if (!base) return 'default';
		return base
			.toLowerCase()
			.normalize('NFD')
			.replace(/[^a-z0-9\s-]/g, '')
			.replace(/\s+/g, '-')
			.replace(/-+/g, '-');
	})();
	badge.dataset.status = statusKey || 'default';
	badge.classList.add(`status-${badge.dataset.status}`);

	// Aplicar estilos inline para asegurar colorización consistente
	if (palette) {
		badge.style.backgroundColor = palette.bg;
		badge.style.border = `1px solid ${palette.border}`;
		badge.style.color = palette.text;
	}

	const finalLabel = (display && display.toString().trim()) || 'Sin revisión';
	badge.textContent = finalLabel;
	return badge;
}



function getCanonicalActivityState(status) {
	const general = normalizarEstadoActividad(status);
	if (general) return general;
	const review = normalizarEstadoRevision(status);
	if (review) return review;
	if (!status) return '';
	try {
		return status.toString().trim();
	} catch (error) {
		return '';
	}
}

function normalizeStatus(status) {
	if (!status) return '';
	return status.toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function isCompleted(status) {
	const canonical = getCanonicalActivityState(status);
	if (canonical === 'Completada' || canonical === 'Aprobado') {
		return true;
	}
	const normalized = typeof status === 'string' ? normalizeStatus(status) : status;
	return normalized.includes('complet') || normalized.includes('cerrad') || normalized.includes('finaliz');
}

function isInProgress(status) {
	const canonical = getCanonicalActivityState(status);
	if (canonical === 'En Progreso' || canonical === 'En revisión') {
		return true;
	}
	const normalized = typeof status === 'string' ? normalizeStatus(status) : status;
	return normalized.includes('progreso') || normalized.includes('ejecuc') || normalized.includes('curso');
}

function isPlanned(status) {
	const canonical = getCanonicalActivityState(status);
	if (canonical === 'Planeada' || canonical === 'Sin revisión') {
		return true;
	}
	const normalized = typeof status === 'string' ? normalizeStatus(status) : status;
	return normalized.includes('plan') || normalized.includes('pend');
}

function formatInteger(value) {
	return integerFormatter.format(Number(value) || 0);
}

function formatCurrency(value) {
	const amount = Number(value) || 0;
	try {
		return currencyFormatter.format(Math.round(amount));
	} catch (error) {
		return `COP ${Math.round(amount).toLocaleString('es-CO')}`;
	}
}

function formatPercent(decimal) {
	try {
		return percentFormatter.format(decimal || 0);
	} catch (error) {
		return `${Math.round((decimal || 0) * 100)}%`;
	}
}

function normalizeText(value) {
	return value
		? value.toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[_/]+/g, ' ').toLowerCase().trim()
		: '';
}

function clearElement(element) {
	if (!element) return;
	while (element.firstChild) {
		element.removeChild(element.firstChild);
	}
}

function showElement(element) {
	if (element) element.classList.remove('hidden');
}

function hideElement(element) {
	if (element) element.classList.add('hidden');
}
