/**
 * @fileoverview Sistema de protección de sesión
 * Este módulo verifica automáticamente la validez de la sesión
 * y redirige al login cuando expire. Se ejecuta en todas las páginas protegidas.
 */

import { Auth } from './auth.js';

// Fallback UI helpers when the global UI toolkit is not available
let fallbackNoticeEl = null;
let fallbackNoticeTimer = null;

function ensureFallbackStyles() {
    if (typeof document === 'undefined') return;
    if (document.getElementById('session-guard-fallback-styles')) return;

    const style = document.createElement('style');
    style.id = 'session-guard-fallback-styles';
    style.textContent = [
        '.session-guard-notice{position:fixed;bottom:24px;right:24px;z-index:2147483647;display:flex;align-items:flex-start;gap:16px;max-width:360px;padding:18px 22px;background:#0f172a;color:#f8fafc;border-radius:16px;border:1px solid rgba(148,163,184,0.25);box-shadow:0 28px 60px -28px rgba(15,23,42,0.8);font-family:"Segoe UI",system-ui,-apple-system,BlinkMacSystemFont,sans-serif;opacity:0;transform:translateY(12px);transition:opacity 0.22s ease,transform 0.22s ease;pointer-events:auto;line-height:1.45;position:fixed;}',
        '.session-guard-notice--visible{opacity:1;transform:translateY(0);}',
        '.session-guard-notice__icon{font-size:1.5rem;line-height:1;flex-shrink:0;}',
        '.session-guard-notice__content{display:flex;flex-direction:column;gap:6px;flex:1;position:relative;}',
        '.session-guard-notice__title{margin:0;font-size:1rem;font-weight:600;color:#f8fafc;}',
        '.session-guard-notice__message{margin:0;font-size:0.95rem;}',
        '.session-guard-notice__detail{margin:0;font-size:0.85rem;opacity:0.8;}',
        '.session-guard-notice__actions{display:flex;gap:10px;margin-top:10px;flex-wrap:wrap;}',
        '.session-guard-notice__btn{appearance:none;border:none;border-radius:12px;padding:8px 16px;font-size:0.9rem;font-weight:600;cursor:pointer;transition:background 0.18s ease,color 0.18s ease,opacity 0.18s ease;}',
        '.session-guard-notice__btn--main{background:var(--session-guard-accent,#fb923c);color:#0f172a;box-shadow:0 10px 30px -15px rgba(251,146,60,0.65);}',
        '.session-guard-notice__btn--main:hover{filter:brightness(0.95);}',
        '.session-guard-notice__btn--ghost{background:rgba(148,163,184,0.12);color:#e2e8f0;}',
        '.session-guard-notice__btn--ghost:hover{background:rgba(148,163,184,0.24);}',
        '.session-guard-notice__close{position:absolute;top:8px;right:8px;background:transparent;border:none;color:#cbd5f5;font-size:1.1rem;line-height:1;cursor:pointer;opacity:0.6;transition:opacity 0.18s ease;}',
        '.session-guard-notice__close:hover{opacity:1;}',
        '.session-guard-notice__accent{position:absolute;left:-18px;top:16px;bottom:16px;width:4px;border-radius:999px;background:var(--session-guard-accent,#fb923c);}'
    ].join('');
    document.head.appendChild(style);
}

function closeFallbackNotice() {
    if (!fallbackNoticeEl) return;
    if (fallbackNoticeTimer) {
        clearTimeout(fallbackNoticeTimer);
        fallbackNoticeTimer = null;
    }
    const current = fallbackNoticeEl;
    fallbackNoticeEl = null;
    current.classList.remove('session-guard-notice--visible');
    setTimeout(() => current.remove(), 220);
}

function showFallbackNotice(options) {
    if (typeof document === 'undefined') {
        if (typeof window !== 'undefined' && typeof window.alert === 'function') {
            const fallbackText = [options.title, options.plainMessage || options.message || ''].filter(Boolean).join('\n\n');
            window.alert(fallbackText);
        }
        return;
    }

    ensureFallbackStyles();
    closeFallbackNotice();

    const {
        title = 'Aviso de sesión',
        messageHtml = '',
        detailHtml = '',
        plainMessage = '',
        icon = '[!]',
        accent = '#fb923c',
        actionLabel = 'Entendido',
        onAction = null,
        secondaryLabel = 'Cerrar',
        onSecondary = null,
        duration = 15000,
        dismissible = true
    } = options || {};

    const notice = document.createElement('section');
    notice.className = 'session-guard-notice';
    notice.style.setProperty('--session-guard-accent', accent);
    notice.setAttribute('role', 'alertdialog');
    notice.setAttribute('aria-live', 'assertive');
    notice.tabIndex = -1;

    const accentBar = document.createElement('span');
    accentBar.className = 'session-guard-notice__accent';
    notice.appendChild(accentBar);

    if (dismissible) {
        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'session-guard-notice__close';
        closeBtn.innerHTML = '&times;';
        closeBtn.addEventListener('click', closeFallbackNotice);
        notice.appendChild(closeBtn);
    }

    const iconEl = document.createElement('span');
    iconEl.className = 'session-guard-notice__icon';
    iconEl.textContent = icon;
    notice.appendChild(iconEl);

    const content = document.createElement('div');
    content.className = 'session-guard-notice__content';

    const titleEl = document.createElement('h2');
    titleEl.className = 'session-guard-notice__title';
    titleEl.textContent = title;
    content.appendChild(titleEl);

    if (messageHtml || plainMessage) {
        const messageEl = document.createElement('p');
        messageEl.className = 'session-guard-notice__message';
        if (messageHtml) {
            messageEl.innerHTML = messageHtml;
        } else {
            messageEl.textContent = plainMessage;
        }
        content.appendChild(messageEl);
    }

    if (detailHtml) {
        const detailEl = document.createElement('p');
        detailEl.className = 'session-guard-notice__detail';
        detailEl.innerHTML = detailHtml;
        content.appendChild(detailEl);
    }

    const actions = document.createElement('div');
    actions.className = 'session-guard-notice__actions';

    if (actionLabel) {
        const mainBtn = document.createElement('button');
        mainBtn.type = 'button';
        mainBtn.className = 'session-guard-notice__btn session-guard-notice__btn--main';
        mainBtn.textContent = actionLabel;
        mainBtn.addEventListener('click', () => {
            if (typeof onAction === 'function') {
                onAction();
            }
            closeFallbackNotice();
        });
        actions.appendChild(mainBtn);
    }

    if (secondaryLabel) {
        const secondaryBtn = document.createElement('button');
        secondaryBtn.type = 'button';
        secondaryBtn.className = 'session-guard-notice__btn session-guard-notice__btn--ghost';
        secondaryBtn.textContent = secondaryLabel;
        secondaryBtn.addEventListener('click', () => {
            if (typeof onSecondary === 'function') {
                onSecondary();
            }
            closeFallbackNotice();
        });
        actions.appendChild(secondaryBtn);
    }

    if (actions.childElementCount > 0) {
        content.appendChild(actions);
    }

    notice.appendChild(content);

    document.body.appendChild(notice);
    fallbackNoticeEl = notice;

    requestAnimationFrame(() => {
        if (!fallbackNoticeEl) return;
        fallbackNoticeEl.classList.add('session-guard-notice--visible');
    });

    if (duration && duration !== Infinity) {
        fallbackNoticeTimer = setTimeout(closeFallbackNotice, duration);
    }

    setTimeout(() => {
        try {
            notice.focus();
        } catch (error) {
            // Ignore focus errors on hidden browsers
        }
    }, 60);
}

/**
 * Clase para manejar la protección de sesión
 */
class SessionGuard {
    constructor() {
        this.intervalId = null;
        this.warningShown = false;
        this.lastActivity = Date.now();
        this.activityListeners = [];
        this.init();
    }

    /**
     * Inicializa el guardian de sesión
     */
    init() {
        // Verificar inmediatamente si hay sesión válida
        if (!Auth.isAuthenticated()) {
            this.redirectToLogin('Su sesión ha expirado. Por favor, inicie sesión nuevamente.');
            return;
        }

        // Iniciar monitoreo continuo
        this.startMonitoring();
        
        // Configurar listeners de actividad del usuario
        this.setupActivityListeners();
        
        // Verificar cuando la ventana regain focus (usuario vuelve a la pestaña)
        window.addEventListener('focus', () => {
            // Resetear la advertencia cuando el usuario vuelve
            this.warningShown = false;
            
            if (!Auth.isAuthenticated()) {
                this.redirectToLogin('Su sesión ha expirado. Por favor, inicie sesión nuevamente.');
            } else {
                // Actualizar actividad cuando regresa el foco
                this.lastActivity = Date.now();
            }
        });

        // Verificar antes de que se cierre la ventana/pestaña
        window.addEventListener('beforeunload', () => {
            this.stopMonitoring();
        });
    }

    /**
     * Configura listeners para detectar actividad del usuario
     */
    setupActivityListeners() {
        const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];

        const activityHandler = () => {
            this.lastActivity = Date.now();
            // Permitir que las advertencias se muestren nuevamente tras actividad del usuario
            if (this.warningShown) {
                this.warningShown = false;
            }
        };

        events.forEach(event => {
            document.addEventListener(event, activityHandler, true);
            this.activityListeners.push({ event, handler: activityHandler });
        });
    }

    /**
     * Limpia los listeners de actividad
     */
    cleanupActivityListeners() {
        this.activityListeners.forEach(({ event, handler }) => {
            document.removeEventListener(event, handler, true);
        });
        this.activityListeners = [];
    }

    /**
     * Inicia el monitoreo de la sesión
     */
    startMonitoring() {
        // Verificar cada 30 segundos
        this.intervalId = setInterval(() => {
            const timeRemaining = Auth.getSessionTimeRemaining();

            // Si quedan menos de 5 minutos, mostrar advertencia una sola vez
            if (timeRemaining <= 5 && timeRemaining > 0 && !this.warningShown) {
                this.showExpirationWarning(timeRemaining);
                this.warningShown = true;
            }

            // Si la sesión ha expirado, redirigir
            if (!Auth.isAuthenticated()) {
                this.redirectToLogin('Tu sesión se cerró por seguridad. Inicia sesión nuevamente para continuar.');
                return;
            }

            // Si el usuario ha estado inactivo por más de 60 minutos, mostrar advertencia
            const inactiveTime = Date.now() - this.lastActivity;
            const maxInactiveTime = 60 * 60 * 1000; // 60 minutos

            if (inactiveTime > maxInactiveTime && timeRemaining > 5 && !this.warningShown) {
                this.showInactivityWarning();
                this.warningShown = true;
            }

        }, 30000); // Verificar cada 30 segundos
    }

    /**
     * Detiene el monitoreo de la sesión
     */
    stopMonitoring() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.cleanupActivityListeners();
    }

    /**
     * Muestra una advertencia de expiración próxima
     * @param {number} minutesRemaining - Minutos restantes
     */
    showExpirationWarning(minutesRemaining) {
        // Verificar si existe UI para mostrar el mensaje
        if (typeof UI !== 'undefined' && UI.showMessage) {
            const minutesLabel = `${minutesRemaining} minuto${minutesRemaining !== 1 ? 's' : ''}`;
            const message = [
                '<strong style="font-size:0.95rem;">Tu sesión está por expirar</strong>',
                `<span>Quedan <strong>${minutesLabel}</strong> antes de cerrar sesión automáticamente.</span>`,
                '<span style="font-size:0.85rem;opacity:0.8;">Guarda tus avances o realiza alguna acción para mantenerla activa.</span>'
            ].join('<br>');

            UI.showMessage(message, 'warning', {
                duration: 12000,
                preserveHtml: true,
                showProgress: true,
                badge: 'Sesión',
                icon: '[!]'
            });
        } else {
            const minutesLabel = `${minutesRemaining} minuto${minutesRemaining !== 1 ? 's' : ''}`;
            showFallbackNotice({
                title: 'Tu sesión está por expirar',
                messageHtml: `Quedan <strong>${minutesLabel}</strong> antes de cerrar sesión automáticamente.`,
                detailHtml: 'Guarda tus avances o realiza alguna acción para mantenerla activa.',
                plainMessage: `Quedan ${minutesLabel} antes de cerrar sesión automáticamente.`,
                icon: '[!]',
                accent: '#fb923c',
                actionLabel: 'Mantener activa',
                onAction: () => {
                    this.lastActivity = Date.now();
                    this.warningShown = false;
                },
                secondaryLabel: 'Cerrar',
                duration: 15000
            });
        }
    }

    /**
     * Muestra una advertencia de inactividad
     */
    showInactivityWarning() {
        const timeRemaining = Auth.getSessionTimeRemaining();
        if (typeof UI !== 'undefined' && UI.showMessage) {
            const minutesLabel = `${timeRemaining} minuto${timeRemaining !== 1 ? 's' : ''}`;
            const message = [
                '<strong style="font-size:0.95rem;">Actividad requerida</strong>',
                `<span>Has estado inactivo un buen rato. La sesión se cerrará en <strong>${minutesLabel}</strong>.</span>`,
                '<span style="font-size:0.85rem;opacity:0.8;">Mueve el cursor o navega por la aplicación para continuar conectado.</span>'
            ].join('<br>');

            UI.showMessage(message, 'warning', {
                duration: 12000,
                preserveHtml: true,
                showProgress: true,
                badge: 'Sesión',
                icon: '[zZ]'
            });
        } else {
            const minutesLabel = `${timeRemaining} minuto${timeRemaining !== 1 ? 's' : ''}`;
            showFallbackNotice({
                title: 'Actividad requerida',
                messageHtml: 'Has estado inactivo un buen rato.',
                detailHtml: `La sesión se cerrará en <strong>${minutesLabel}</strong>.`,
                plainMessage: `La sesión se cerrará en ${minutesLabel}.`,
                icon: '[zZ]',
                accent: '#38bdf8',
                actionLabel: 'Seguir aquí',
                onAction: () => {
                    this.lastActivity = Date.now();
                    this.warningShown = false;
                },
                secondaryLabel: 'Cerrar',
                duration: 15000
            });
        }
    }

    /**
     * Redirige al login con mensaje
     * @param {string} message - Mensaje a mostrar
     */
    redirectToLogin(message) {
        this.stopMonitoring();
        
        // Mostrar mensaje si está disponible
        if (typeof UI !== 'undefined' && UI.showMessage) {
            UI.showMessage(message, 'warning', 3000);
            setTimeout(() => {
                window.location.href = './login.html';
            }, 3000);
        } else {
            // Redirigir inmediatamente si no hay UI
            window.location.href = './login.html';
        }
    }

    /**
     * Obtiene información de la sesión actual
     * @returns {Object} Información de la sesión
     */
    getSessionInfo() {
        const timeRemaining = Auth.getSessionTimeRemaining();
        const inactiveTime = Math.floor((Date.now() - this.lastActivity) / (60 * 1000)); // minutos
        
        return {
            isValid: Auth.isAuthenticated(),
            timeRemaining: timeRemaining,
            email: Auth.currentEmail(),
            role: Auth.currentRole(),
            inactiveMinutes: inactiveTime,
            lastActivity: new Date(this.lastActivity).toLocaleTimeString()
        };
    }
}

// Crear instancia global del guardian de sesión
let sessionGuard = null;

/**
 * Inicializa el guardian de sesión cuando se carga el DOM
 */
document.addEventListener('DOMContentLoaded', () => {
    // Solo inicializar en páginas que no sean login
    const currentPage = (location.pathname || '').split('/').pop() || '';
    const publicPages = ['login.html', 'index.html', ''];
    
    if (!publicPages.includes(currentPage)) {
        sessionGuard = new SessionGuard();
    }
});

// Exportar la clase para uso manual si es necesario
export { SessionGuard };
export default SessionGuard;