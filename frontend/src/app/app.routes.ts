import { Routes } from '@angular/router';
import { roleGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    title: 'Inicio | AgendaME',
    loadComponent: () => import('./pages/home/home').then((module) => module.Home),
  },
  {
    path: 'negocios',
    title: 'Negocios | AgendaME',
    loadComponent: () =>
      import('./pages/business-directory/business-directory').then(
        (module) => module.BusinessDirectory,
      ),
  },
  {
    path: 'negocios/:slug',
    title: 'Servicios | AgendaME',
    loadComponent: () =>
      import('./pages/business-detail/business-detail').then((module) => module.BusinessDetail),
  },
  {
    path: 'negocios/:slug/servicios/:serviceId',
    title: 'Detalle del servicio | AgendaME',
    loadComponent: () =>
      import('./pages/service-detail/service-detail').then((module) => module.ServiceDetail),
  },
  {
    path: 'reservas',
    title: 'Mis reservas | AgendaME',
    canActivate: [roleGuard('cliente')],
    loadComponent: () =>
      import('./pages/my-bookings/my-bookings').then((module) => module.MyBookings),
  },
  {
    path: 'reservas/nueva',
    title: 'Confirmar reserva | AgendaME',
    canActivate: [roleGuard('cliente')],
    loadComponent: () => import('./pages/booking/booking').then((module) => module.Booking),
  },
  {
    path: 'login',
    title: 'Iniciar sesión | AgendaME',
    loadComponent: () => import('./pages/login/login').then((module) => module.Login),
  },
  {
    path: 'registro',
    title: 'Crear cuenta | AgendaME',
    loadComponent: () => import('./pages/register/register').then((module) => module.Register),
  },
  {
    path: 'registro-negocio',
    title: 'Registrar negocio | AgendaME',
    canActivate: [roleGuard('superadmin')],
    loadComponent: () =>
      import('./pages/business-register/business-register').then(
        (module) => module.BusinessRegister,
      ),
  },
  {
    path: 'panel/admin',
    title: 'Panel del negocio | AgendaME',
    canActivate: [roleGuard('admin')],
    loadComponent: () =>
      import('./pages/admin-panel/admin-panel').then((module) => module.AdminPanel),
  },
  {
    path: 'panel/servicios/:serviceId/formulario',
    title: 'Formulario del servicio | AgendaME',
    canActivate: [roleGuard('admin')],
    loadComponent: () =>
      import('./pages/service-form-builder/service-form-builder').then(
        (module) => module.ServiceFormBuilder,
      ),
  },
  {
    path: 'panel/admin/servicios/:serviceId/formulario',
    title: 'Formulario del servicio | AgendaME',
    canActivate: [roleGuard('admin')],
    loadComponent: () =>
      import('./pages/service-form-builder/service-form-builder').then(
        (module) => module.ServiceFormBuilder,
      ),
  },
  {
    path: 'panel/reservas',
    title: 'Reservas del negocio | AgendaME',
    canActivate: [roleGuard('admin', 'superadmin')],
    loadComponent: () =>
      import('./pages/reservation-management/reservation-management').then(
        (module) => module.ReservationManagement,
      ),
  },
  {
    path: 'panel/superadmin',
    title: 'Panel global | AgendaME',
    canActivate: [roleGuard('superadmin')],
    loadComponent: () =>
      import('./pages/superadmin-panel/superadmin-panel').then((module) => module.SuperadminPanel),
  },
  { path: '**', redirectTo: '' },
];
