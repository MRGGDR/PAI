/**
 * @fileoverview Utilidades mínimas para la interfaz de usuario
 * Este módulo proporciona funciones para gestionar notificaciones toast y modales,
 * permitiendo una interacción más rica con el usuario.
 */

import './debug-filter.js';

const TOAST_THEMES = {
	success: {
		icon: '\u2705',
		badge: 'ÉXITO',
		background: '#ECFDF5',
		text: '#065F46',
		border: '#34D399',
		duration: 4200,
		ariaLive: 'polite'
	},
	error: {
		icon: '\u26D4',
		badge: 'ERROR',
		background: '#FEF2F2',
		text: '#7F1D1D',
		border: '#F87171',
		duration: 6000,
		ariaLive: 'assertive'
	},
	warning: {
		icon: '\u26A0',
		badge: 'ALERTA',
		background: '#FFF7ED',
		text: '#92400E',
		border: '#FB923C',
		duration: 5200,
		ariaLive: 'assertive'
	},
	info: {
		icon: '\u2139',
		badge: 'INFO',
		background: '#EFF6FF',
		text: '#1E3A8A',
		border: '#60A5FA',
		duration: 4000,
		ariaLive: 'polite'
	}
};

function makeToastEl(type, message, options = {}){
	const theme = TOAST_THEMES[type] || TOAST_THEMES.info;
	const el = document.createElement('div');
	el.className = `app-toast app-toast--${type}`;
	el.style.padding = '14px 18px';
	el.style.borderRadius = '14px';
	el.style.marginBottom = '12px';
	el.style.boxShadow = '0 18px 45px -20px rgba(15,23,42,0.45)';
	el.style.fontSize = '0.95rem';
	el.style.display = 'flex';
	el.style.alignItems = 'flex-start';
	el.style.gap = '14px';
	el.style.backgroundColor = theme.background;
	el.style.color = theme.text;
	el.style.border = `1px solid ${theme.border}`;
	el.style.borderLeft = `5px solid ${theme.border}`;
	el.style.maxWidth = '400px';
	el.style.position = 'relative';
	el.style.overflow = 'hidden';
	el.style.opacity = '0';
	el.style.transform = 'translateY(-10px)';
	el.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
	el.setAttribute('role', 'alert');
	el.setAttribute('aria-live', options.ariaLive || theme.ariaLive || 'polite');

	const icon = document.createElement('span');
	icon.textContent = options.icon || theme.icon;
	icon.style.fontSize = '1.25rem';
	icon.style.lineHeight = '1';
	icon.setAttribute('aria-hidden', 'true');

	const content = document.createElement('div');
	content.style.display = 'flex';
	content.style.flexDirection = 'column';
	content.style.gap = '4px';
	content.style.flex = '1';

	const badge = document.createElement('span');
	badge.textContent = options.badge || theme.badge;
	badge.style.fontSize = '0.7rem';
	badge.style.fontWeight = '600';
	badge.style.letterSpacing = '0.08em';
	badge.style.textTransform = 'uppercase';
	badge.style.opacity = '0.75';

	const messageEl = document.createElement('div');
	messageEl.style.lineHeight = '1.45';
	messageEl.style.whiteSpace = 'pre-line';
	if(options.preserveHtml){
		messageEl.innerHTML = message;
	}else{
		messageEl.textContent = message;
	}

	const closeBtn = document.createElement('button');
	closeBtn.type = 'button';
	closeBtn.innerHTML = '&times;';
	closeBtn.setAttribute('aria-label', 'Cerrar notificación');
	closeBtn.style.background = 'transparent';
	closeBtn.style.border = 'none';
	closeBtn.style.color = theme.text;
	closeBtn.style.opacity = '0.6';
	closeBtn.style.cursor = 'pointer';
	closeBtn.style.fontSize = '1.15rem';
	closeBtn.style.lineHeight = '1';
	closeBtn.style.marginLeft = '8px';
	closeBtn.style.marginTop = '-2px';
	closeBtn.style.padding = '0';
	closeBtn.style.transition = 'opacity 0.15s ease';
	closeBtn.addEventListener('mouseenter', () => closeBtn.style.opacity = '1');
	closeBtn.addEventListener('mouseleave', () => closeBtn.style.opacity = '0.6');

	if (options.dismissible === false) {
		closeBtn.style.display = 'none';
	}

	content.appendChild(badge);
	content.appendChild(messageEl);

	el.appendChild(icon);
	el.appendChild(content);
	el.appendChild(closeBtn);

	if (options.showProgress) {
		const progress = document.createElement('span');
		progress.dataset.toastProgress = 'true';
		progress.style.position = 'absolute';
		progress.style.left = '0';
		progress.style.bottom = '0';
		progress.style.height = '3px';
		progress.style.width = '100%';
		progress.style.backgroundColor = options.progressColor || theme.border;
		progress.style.transformOrigin = 'left';
		progress.style.transform = 'scaleX(1)';
		progress.style.transition = `transform ${options.duration}ms linear`;
		el.appendChild(progress);
	}

	return {
		element: el,
		closeButton: closeBtn,
		progressBar: el.querySelector('[data-toast-progress]') || null
	};
}

/**
 * Muestra una notificación toast
 * @param {string} type - Tipo de notificación ('success', 'error', 'info')
 * @param {string} message - Mensaje a mostrar
 * @param {number|Object} opts - Duración en milisegundos o configuración adicional
 */
export function toast(type, message, opts = {}){
	try{
		if (typeof document === 'undefined') {
			console.info(`[toast] ${type}: ${message}`);
			return { dismiss(){}, element: null };
		}

		let container = document.getElementById('toastContainer');
		if(!container){
			container = document.createElement('div');
			container.id = 'toastContainer';
			container.style.position = 'fixed';
			container.style.top = '18px';
			container.style.right = '18px';
			container.style.zIndex = '999999';
			container.style.display = 'flex';
			container.style.flexDirection = 'column';
			container.style.alignItems = 'flex-end';
			container.setAttribute('aria-live', 'polite');
			container.setAttribute('role', 'region');
			container.setAttribute('aria-label', 'Notificaciones del sistema');
			document.body.appendChild(container);
		}

		const theme = TOAST_THEMES[type] || TOAST_THEMES.info;
		const normalizedOptions = typeof opts === 'number' ? { duration: opts } : { ...opts };
		const duration = typeof normalizedOptions.duration === 'number' ? normalizedOptions.duration : theme.duration;
		const dismissible = normalizedOptions.dismissible !== false;
		const showProgress = normalizedOptions.showProgress ?? duration !== Infinity;
		const ariaLive = normalizedOptions.ariaLive || theme.ariaLive || 'polite';
		const preserveHtml = Boolean(normalizedOptions.preserveHtml);
		const badge = normalizedOptions.badge;
		const icon = normalizedOptions.icon;

		const { element, closeButton, progressBar } = makeToastEl(type, message, {
			ariaLive,
			preserveHtml,
			badge,
			icon,
			duration,
			dismissible,
			showProgress
		});

		container.appendChild(element);

		let timeoutId = null;

		const dismiss = (fromClose = false) => {
			if (!element || element.dataset.toastDismissed === 'true') return;
			element.dataset.toastDismissed = 'true';
			if (timeoutId) clearTimeout(timeoutId);
			element.style.opacity = '0';
			element.style.transform = 'translateY(-12px)';
			setTimeout(() => element.remove(), 240);
			if (typeof normalizedOptions.onClose === 'function') {
				normalizedOptions.onClose({ fromCloseButton: fromClose });
			}
		};

		if (dismissible && closeButton) {
			closeButton.addEventListener('click', () => dismiss(true));
		}

		requestAnimationFrame(() => {
			element.style.opacity = '1';
			element.style.transform = 'translateY(0)';
			if (progressBar && showProgress && duration !== Infinity) {
				progressBar.style.transition = `transform ${duration}ms linear`;
				progressBar.style.transform = 'scaleX(0)';
			}
		});

		if (duration !== Infinity) {
			timeoutId = setTimeout(() => dismiss(false), duration);
		}

		return { dismiss, element };
	}catch(e){
		console.error('No se pudo mostrar la notificación toast:', e);
		if (typeof window !== 'undefined' && window.alert) {
			window.alert(`${(type || 'info').toUpperCase()}: ${message}`);
		}
		return { dismiss(){}, element: null };
	}
}

export function dismissAllToasts(){
	const container = document.getElementById('toastContainer');
	if (!container) return;
	Array.from(container.children).forEach(child => {
		child.style.opacity = '0';
		child.style.transform = 'translateY(-12px)';
		setTimeout(() => child.remove(), 220);
	});
}

/**
 * Abre un modal por su ID
 * @param {string} id - ID del elemento modal
 */
export function openModal(id){
	const el = document.getElementById(id); if(!el) return;
	el.classList.remove('hidden');
	
	// Enfoca automáticamente el primer input dentro del modal
	const fi = el.querySelector('input,button,textarea'); 
	if(fi) fi.focus();
}

/**
 * Cierra un modal por su ID
 * @param {string} id - ID del elemento modal
 */
export function closeModal(id){
	const el = document.getElementById(id); if(!el) return;
	el.classList.add('hidden');
}

/**
 * Muestra un mensaje (compatibilidad con versiones anteriores)
 * @param {string} message - Mensaje a mostrar
 * @param {string} type - Tipo de mensaje ('info', 'success', 'error')
 * @param {number} ms - Duración en milisegundos
 */
export function showMessage(message, type='info', ms=3500){
	try {
		const options = typeof ms === 'object' ? ms : { duration: ms };
		return toast(type, message, options);
	} catch(e){
		console.error(e);
	}
}

/**
 * Objeto UI para acceso conveniente a las funciones
 * @type {Object}
 */
export const UI = { toast, showMessage, dismissAllToasts, openModal, closeModal };