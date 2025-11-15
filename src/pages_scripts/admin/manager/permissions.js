import { mostrarToast } from '../../actividades/utils.js';

export const permissionMethods = {
  puedeGestionarCatalogos() {
    return Boolean(this.state?.permisos?.['catalogs:manage']);
  },

  puedeGestionarUsuarios() {
    return this.state?.usuario?.rol === 'admin';
  },

  puedeGestionarPresupuestos() {
    return Boolean(this.state?.permisos?.['budgets:manage'] || this.state?.usuario?.rol === 'admin');
  },

  mostrarAccesoRestringido() {
    console.warn('[WARN] Acceso denegado al módulo de administración para el rol actual');
    if (this.dom.root) {
      this.dom.root.innerHTML = `
        <section class="mx-auto max-w-3xl rounded-xl border border-amber-200 bg-amber-50 px-6 py-10 text-center shadow-sm">
          <h2 class="text-2xl font-semibold text-amber-800 mb-4">Acceso restringido</h2>
          <p class="text-sm text-amber-700">
            Tu rol actual no permite administrar catálogos ni usuarios. Si necesitas realizar cambios,
            contacta a un administrador del sistema.
          </p>
        </section>
      `;
    } else {
      mostrarToast('No tienes permisos para acceder al módulo de administración.', 'warning');
    }
  },

  applyPermissionGuards() {
    const panelUsuarios = document.getElementById('panel-usuarios');
    if (panelUsuarios && !this.puedeGestionarUsuarios()) {
      panelUsuarios.setAttribute('data-disabled', 'true');
      panelUsuarios.open = false;
      panelUsuarios.querySelectorAll('button, input, select, textarea').forEach(el => {
        el.setAttribute('disabled', 'true');
      });
      const body = panelUsuarios.querySelector('.usuarios-panel-body');
      if (body) {
        body.innerHTML = `
          <div class="rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-700">
            Solo los administradores pueden gestionar usuarios. Contacta a un administrador si necesitas crear o eliminar cuentas.
          </div>
        `;
      }
    }

    const panelPresupuestos = document.getElementById('panel-presupuestos');
    if (panelPresupuestos && !this.puedeGestionarPresupuestos()) {
      panelPresupuestos.setAttribute('data-disabled', 'true');
      panelPresupuestos.open = false;
      panelPresupuestos.querySelectorAll('button, input, select, textarea').forEach(el => {
        el.setAttribute('disabled', 'true');
      });
      const body = panelPresupuestos.querySelector('.presupuestos-panel-body');
      if (body) {
        body.innerHTML = `
          <div class="rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-700">
            Solo los administradores pueden gestionar los presupuestos por área. Solicita acceso al equipo de coordinación si necesitas realizar cambios.
          </div>
        `;
      }
    }

    const panelActividades = document.getElementById('panel-actividades');
    if (panelActividades && !this.state.permisos['activities:edit'] && !this.state.permisos['activities:delete']) {
      panelActividades.setAttribute('data-disabled', 'true');
      panelActividades.open = false;
      panelActividades.querySelector('div')?.classList.add('opacity-60');
      panelActividades.querySelectorAll('button, input, select, textarea').forEach(el => {
        el.setAttribute('disabled', 'true');
      });
    }

    const panelAvances = document.getElementById('panel-avances');
    if (panelAvances && !this.state.permisos['advances:edit'] && !this.state.permisos['advances:delete']) {
      panelAvances.setAttribute('data-disabled', 'true');
      panelAvances.open = false;
      panelAvances.querySelector('div')?.classList.add('opacity-60');
      panelAvances.querySelectorAll('button, input, select, textarea').forEach(el => {
        el.setAttribute('disabled', 'true');
      });
    }
  }
};
