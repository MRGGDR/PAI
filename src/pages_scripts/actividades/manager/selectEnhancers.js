function llenarSelect(selectId, items, options = {}) {
  const select = document.getElementById(selectId);
  if (!select) return;

  const {
    placeholder = 'Seleccionar...',
    preserveFirstOption = false,
    valueKey = 'id',
    labelKey = 'nombre',
    selectedValue
  } = options;

  const isMultiple = Boolean(select.multiple);
  const previousValue = selectedValue !== undefined
    ? selectedValue
    : (isMultiple ? Array.from(select.selectedOptions || []).map(opt => opt.value) : select.value);
  const firstOption = preserveFirstOption ? select.querySelector('option') : null;

  const placeholderOption = firstOption || document.createElement('option');
  placeholderOption.value = '';
  placeholderOption.textContent = placeholder;
  if (isMultiple) {
    placeholderOption.disabled = true;
    placeholderOption.hidden = true;
  }

  select.innerHTML = '';
  select.appendChild(placeholderOption);

  items.forEach(item => {
    if (!item) return;
    const option = document.createElement('option');
    const value = item[valueKey] ?? '';
    option.value = typeof value === 'number' ? String(value) : value;
    option.textContent = item[labelKey] ?? option.value ?? '';
    select.appendChild(option);
  });

  const valuesDisponibles = [...select.options].map(opt => opt.value);
  if (isMultiple) {
    const valores = Array.isArray(previousValue)
      ? previousValue.map(valor => String(valor))
      : previousValue
        ? [String(previousValue)]
        : [];
    const valoresUnicos = new Set(valores.filter(valor => valor !== ''));
    [...select.options].forEach(option => {
      if (valoresUnicos.has(option.value)) {
        option.selected = true;
      }
    });
  } else if (previousValue && valuesDisponibles.includes(previousValue)) {
    select.value = previousValue;
  } else {
    select.value = '';
  }

  if (selectId === 'plan_id') {
    this.initPlanMultiSelect();
  } else if (selectId === 'fuente_financiacion') {
    this.initFuenteMultiSelect();
  } else {
    this.refreshModernSelect(selectId);
  }
}

function aplicarEstilosBaseSelects() {
  const selects = document.querySelectorAll('select');
  selects.forEach(select => {
    if (select.dataset.skipEnhance === 'true') return;
    if (select.classList.contains('modern-multiselect__native')) return;
    if (!select.classList.contains('modern-select')) {
      select.classList.add('modern-select');
    }
    if (!select.dataset.enhanced) {
      this.initModernSelect(select);
    } else {
      this.refreshModernSelect(select.id || select.name || '');
    }
  });
}

function initModernSelect(select) {
  if (!select || select.dataset.skipEnhance === 'true') return;
  if (select.classList.contains('modern-multiselect__native')) return;

  const ensureId = () => {
    if (select.id && select.id.trim() !== '') return select.id;
    const generated = `select-${Math.random().toString(36).slice(2, 8)}`;
    select.id = generated;
    return generated;
  };

  const selectId = ensureId();

  const getPlaceholder = () => {
    const attr = select.getAttribute('placeholder') || select.dataset.placeholder;
    if (attr) return attr;
    const placeholderOption = [...select.options].find(opt => opt.value === '');
    if (placeholderOption) {
      return placeholderOption.textContent?.trim() || placeholderOption.label || 'Seleccionar...';
    }
    return 'Seleccionar...';
  };

  const wrapper = document.createElement('div');
  wrapper.className = 'modern-select';
  wrapper.dataset.selectId = selectId;

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'modern-select__trigger';
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.innerHTML = `
      <span class="modern-select__label"></span>
      <span class="material-symbols-outlined modern-select__chevron">expand_more</span>
    `;

  const dropdown = document.createElement('div');
  dropdown.className = 'modern-select__dropdown hidden';
  dropdown.setAttribute('role', 'listbox');
  dropdown.setAttribute('aria-labelledby', selectId);

  const searchContainer = document.createElement('div');
  searchContainer.className = 'modern-select__search';

  const searchIcon = document.createElement('span');
  searchIcon.className = 'material-symbols-outlined';
  searchIcon.textContent = 'search';

  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.className = 'modern-select__search-input';
  searchInput.placeholder = 'Buscar opción...';
  searchInput.autocomplete = 'off';

  searchContainer.appendChild(searchIcon);
  searchContainer.appendChild(searchInput);

  const list = document.createElement('div');
  list.className = 'modern-select__list';

  const emptyState = document.createElement('div');
  emptyState.className = 'modern-select__empty hidden';
  emptyState.textContent = 'No hay opciones disponibles.';

  dropdown.appendChild(searchContainer);
  dropdown.appendChild(list);
  dropdown.appendChild(emptyState);

  const parent = select.parentNode;
  if (parent) {
    parent.insertBefore(wrapper, select);
  }
  wrapper.appendChild(select);
  wrapper.appendChild(trigger);
  wrapper.appendChild(dropdown);

  select.classList.add('modern-select__native');
  select.dataset.enhanced = 'single';
  select.tabIndex = -1;

  const state = {
    id: selectId,
    select,
    wrapper,
    trigger,
    dropdown,
    list,
    searchInput,
    emptyState,
    placeholder: getPlaceholder(),
    optionButtons: [],
    open: false,
    onDocumentClick: null,
    getPlaceholder,
  };

  const labelEl = trigger.querySelector('.modern-select__label');

  const closeDropdown = () => {
    if (!state.open) return;
    state.open = false;
    dropdown.classList.add('hidden');
    wrapper.classList.remove('modern-select--open');
    trigger.setAttribute('aria-expanded', 'false');
    document.removeEventListener('click', state.onDocumentClick);
    if (state.searchInput) {
      state.searchInput.value = '';
    }
    filterOptions('');
  };

  const openDropdown = () => {
    if (state.open) return;
    state.open = true;
    dropdown.classList.remove('hidden');
    wrapper.classList.add('modern-select--open');
    trigger.setAttribute('aria-expanded', 'true');
    document.addEventListener('click', state.onDocumentClick);
    if (state.searchInput) {
      state.searchInput.value = '';
      filterOptions('');
      requestAnimationFrame(() => state.searchInput?.focus());
    }
  };

  state.onDocumentClick = (event) => {
    if (!wrapper.contains(event.target)) {
      closeDropdown();
    }
  };

  const updateSummary = () => {
    const selectedOption = select.options[select.selectedIndex];
    const hasValue = selectedOption && selectedOption.value !== '';
    const text = hasValue ? (selectedOption.textContent || selectedOption.label || selectedOption.value) : state.placeholder;
    if (labelEl) {
      labelEl.textContent = text;
      labelEl.classList.toggle('modern-select__label--placeholder', !hasValue);
    }
  };

  const markSelectedInList = () => {
    const value = select.value;
    state.optionButtons.forEach(button => {
      button.classList.toggle('modern-select__option--selected', button.dataset.value === value);
    });
  };

  const filterOptions = (termino) => {
    const text = (termino || '').trim().toLowerCase();
    let visibles = 0;
    state.optionButtons.forEach(button => {
      const coincide = !text || (button.dataset.search || '').includes(text);
      button.classList.toggle('hidden', !coincide);
      if (coincide) visibles++;
    });
    if (state.emptyState) {
      state.emptyState.classList.toggle('hidden', visibles > 0);
    }
  };

  const selectValue = (value) => {
    if (select.value === value) {
      closeDropdown();
      return;
    }
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    select.dispatchEvent(new Event('input', { bubbles: true }));
    updateSummary();
    markSelectedInList();
    closeDropdown();
  };

  const buildOptions = () => {
    if (!list) return;
    const fragment = document.createDocumentFragment();
    state.optionButtons = [];
    const options = [...select.options];
    let hasOptions = false;
    options.forEach(option => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'modern-select__option';
      button.dataset.value = option.value;
      button.dataset.search = (option.textContent || option.label || option.value || '').toLowerCase();
      button.textContent = option.textContent || option.label || option.value || option.value;
      button.disabled = option.disabled;

      if (option.disabled) {
        button.classList.add('modern-select__option--disabled');
      }

      button.addEventListener('click', () => {
        if (option.disabled) return;
        selectValue(option.value);
      });

      fragment.appendChild(button);
      state.optionButtons.push(button);
      hasOptions = true;
    });

    list.innerHTML = '';
    list.appendChild(fragment);

    if (state.emptyState) {
      state.emptyState.classList.toggle('hidden', hasOptions);
      state.emptyState.textContent = hasOptions
        ? 'No hay opciones que coincidan con tu búsqueda.'
        : 'No hay opciones disponibles.';
    }

    markSelectedInList();
    updateSummary();
  };

  const updateDisabledState = () => {
    const isDisabled = select.disabled;
    trigger.disabled = isDisabled;
    wrapper.classList.toggle('modern-select--disabled', isDisabled);
    if (isDisabled) {
      closeDropdown();
    }
  };

  trigger.addEventListener('click', () => {
    if (select.disabled) return;
    if (state.open) {
      closeDropdown();
    } else {
      openDropdown();
    }
  });

  trigger.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      state.open ? closeDropdown() : openDropdown();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      state.open ? filterOptions('') : openDropdown();
    } else if (event.key === 'Escape') {
      closeDropdown();
    }
  });

  searchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeDropdown();
      trigger.focus();
    }
  });

  searchInput.addEventListener('input', (event) => {
    filterOptions(event.target.value);
  });

  select.addEventListener('change', () => {
    markSelectedInList();
    updateSummary();
  });

  select.addEventListener('blur', () => {
    if (!wrapper.contains(document.activeElement)) {
      closeDropdown();
    }
  });

  buildOptions();
  updateSummary();
  updateDisabledState();

  state.buildOptions = () => {
    state.placeholder = state.getPlaceholder();
    buildOptions();
    markSelectedInList();
    updateSummary();
    filterOptions(searchInput.value || '');
    updateDisabledState();
  };
  state.updateDisabledState = updateDisabledState;
  state.updateSummary = updateSummary;
  state.markSelectedInList = markSelectedInList;
  state.closeDropdown = closeDropdown;
  state.openDropdown = openDropdown;
  state.filterOptions = filterOptions;

  this.components.selectEnhancers.set(selectId, state);
}

function refreshModernSelect(id) {
  if (!id) return;
  const select = document.getElementById(id);
  if (!select) return;
  if (select.dataset.skipEnhance === 'true') return;
  if (select.classList.contains('modern-multiselect__native')) return;

  const selectId = select.id || select.name || id;
  const state = this.components.selectEnhancers.get(selectId);
  if (!state) {
    if (!select.dataset.enhanced) {
      this.initModernSelect(select);
    }
    return;
  }

  state.buildOptions?.();
  state.updateDisabledState?.();
  state.updateSummary?.();
}

export const selectEnhancerMethods = {
  llenarSelect,
  aplicarEstilosBaseSelects,
  initModernSelect,
  refreshModernSelect
};
