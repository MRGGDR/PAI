function initCatalogMultiSelect(config) {
  const select = document.getElementById(config.selectId);
  const container = document.querySelector(`[data-multiselect="${config.containerAttr}"]`);
  if (!select || !container) return;

  select.multiple = true;
  select.classList.add('modern-multiselect__native');
  select.dataset.skipEnhance = 'true';

  const state = this.components[config.stateKey] || {};
  state.select = select;
  state.container = container;
  state.trigger = container.querySelector('[data-multiselect-trigger]');
  state.dropdown = container.querySelector('[data-multiselect-dropdown]');
  state.list = container.querySelector('[data-multiselect-list]');
  state.searchInput = container.querySelector('[data-multiselect-search]');
  state.labelEl = container.querySelector('[data-multiselect-label]');
  state.countEl = container.querySelector('[data-multiselect-count]');
  state.emptyEl = container.querySelector('[data-multiselect-empty]');
  state.clearBtn = container.querySelector('[data-multiselect-clear]');
  state.closeBtn = container.querySelector('[data-multiselect-close]');
  state.placeholder = container.dataset.placeholder || config.placeholder || 'Seleccionar...';
  state.open = false;

  const summaryFormatter = typeof config.summaryFormatter === 'function'
    ? config.summaryFormatter
    : (items, placeholder) => {
        if (!items.length) return placeholder;
        if (items.length <= 2) {
          return items.map(opt => opt.textContent).join(', ');
        }
        return `${items.length} seleccionados`;
      };

  const countFormatter = typeof config.countFormatter === 'function'
    ? config.countFormatter
    : (count) => `${count}`;

  const updateSummary = () => {
    if (!state.labelEl) return;
    const seleccionados = [...select.options].filter(opt => opt.value !== '' && opt.selected);
    const labelText = summaryFormatter(seleccionados, state.placeholder, config) || state.placeholder;
    state.labelEl.textContent = labelText;

    if (state.countEl) {
      if (seleccionados.length) {
        state.countEl.textContent = countFormatter(seleccionados.length, config);
        state.countEl.classList.remove('hidden');
      } else {
        state.countEl.classList.add('hidden');
      }
    }
  };

  const syncFromNative = () => {
    const valores = new Set([...select.options].filter(opt => opt.selected).map(opt => opt.value));
    if (state.optionLabels) {
      state.optionLabels.forEach(label => {
        const checkbox = label.querySelector('input[type="checkbox"]');
        if (checkbox) {
          checkbox.checked = valores.has(checkbox.value);
        }
      });
    }
    updateSummary();
  };

  const filterOptions = (termino = '') => {
    const texto = termino.trim().toLowerCase();
    let coincidencias = 0;
    if (state.optionLabels) {
      state.optionLabels.forEach(label => {
        const match = !texto || (label.dataset.search || '').includes(texto);
        label.classList.toggle('hidden', !match);
        if (match) coincidencias++;
      });
    }
    if (state.emptyEl) {
      state.emptyEl.classList.toggle('hidden', coincidencias > 0);
    }
  };

  const buildOptions = () => {
    if (!state.list) return;
    const fragment = document.createDocumentFragment();
    const opciones = [...select.options].filter(option => option.value !== '');
    opciones.forEach(option => {
      const label = document.createElement('label');
      label.className = 'modern-multiselect__option';
      label.dataset.value = option.value;
      label.dataset.search = (option.textContent || '').toLowerCase();

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = option.value;
      checkbox.className = 'modern-multiselect__checkbox';

      const textSpan = document.createElement('span');
      textSpan.className = 'modern-multiselect__label';
      textSpan.textContent = option.textContent;

      label.appendChild(checkbox);
      label.appendChild(textSpan);
      fragment.appendChild(label);
    });

    state.list.innerHTML = '';
    state.list.appendChild(fragment);
    state.optionLabels = Array.from(state.list.querySelectorAll('.modern-multiselect__option'));

    syncFromNative();
    filterOptions(state.searchInput?.value || '');
  };

  const toggleOption = (value, checked) => {
    const option = [...select.options].find(opt => opt.value === value);
    if (option) {
      option.selected = checked;
    }
    updateSummary();
  };

  const clearSelection = () => {
    [...select.options].forEach(opt => {
      if (opt.value !== '') opt.selected = false;
    });
    syncFromNative();
  };

  const closeDropdown = () => {
    if (!state.dropdown || !state.container) return;
    state.open = false;
    state.dropdown.classList.add('hidden');
    state.container.classList.remove('modern-multiselect--open');
    document.removeEventListener('click', state.onDocumentClick);
    syncFromNative();
  };

  const openDropdown = () => {
    if (!state.dropdown || !state.container) return;
    state.open = true;
    state.dropdown.classList.remove('hidden');
    state.container.classList.add('modern-multiselect--open');
    document.addEventListener('click', state.onDocumentClick);
    if (state.searchInput) {
      state.searchInput.value = '';
      filterOptions('');
      requestAnimationFrame(() => state.searchInput.focus());
    }
  };

  state.onDocumentClick = (event) => {
    if (!state.container?.contains(event.target)) {
      closeDropdown();
    }
  };

  if (!state.initialized) {
    state.list?.addEventListener('change', (event) => {
      const target = event.target;
      if (target && target.matches('input[type="checkbox"]')) {
        toggleOption(target.value, target.checked);
      }
    });

    state.trigger?.addEventListener('click', () => {
      state.open ? closeDropdown() : openDropdown();
    });

    state.clearBtn?.addEventListener('click', () => {
      clearSelection();
      filterOptions('');
    });

    state.closeBtn?.addEventListener('click', () => closeDropdown());

    state.searchInput?.addEventListener('input', (event) => {
      filterOptions(event.target.value);
    });

    state.dropdown?.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeDropdown();
      }
    });

    state.initialized = true;
  }

  state.buildOptions = buildOptions;
  state.syncFromNative = syncFromNative;
  state.updateSummary = updateSummary;
  state.openDropdown = openDropdown;
  state.closeDropdown = closeDropdown;

  buildOptions();

  this.components[config.stateKey] = state;
}

function refreshCatalogMultiSelect(stateKey) {
  const state = this.components[stateKey];
  if (!state) return;
  if (typeof state.buildOptions === 'function') {
    state.buildOptions();
  } else if (typeof state.syncFromNative === 'function') {
    state.syncFromNative();
  }
}

function initPlanMultiSelect() {
  initCatalogMultiSelect.call(this, {
    stateKey: 'multiSelectPlanes',
    selectId: 'plan_id',
    containerAttr: 'plan',
    placeholder: 'Seleccionar planes...',
    summaryFormatter: (items, placeholder) => {
      if (!items.length) return placeholder;
      if (items.length <= 2) {
        return items.map(opt => opt.textContent).join(', ');
      }
      return `${items.length} planes seleccionados`;
    }
  });
}

function refreshPlanMultiSelect() {
  refreshCatalogMultiSelect.call(this, 'multiSelectPlanes');
}

function initFuenteMultiSelect() {
  initCatalogMultiSelect.call(this, {
    stateKey: 'multiSelectFuentes',
    selectId: 'fuente_financiacion',
    containerAttr: 'fuente',
    placeholder: 'Seleccionar fuentes...',
    summaryFormatter: (items, placeholder) => {
      if (!items.length) return placeholder;
      if (items.length <= 3) {
        return items.map(opt => opt.textContent).join(', ');
      }
      return `${items.length} fuentes seleccionadas`;
    }
  });
}

function refreshFuenteMultiSelect() {
  refreshCatalogMultiSelect.call(this, 'multiSelectFuentes');
}

export const multiSelectMethods = {
  initPlanMultiSelect,
  refreshPlanMultiSelect,
  initFuenteMultiSelect,
  refreshFuenteMultiSelect
};
