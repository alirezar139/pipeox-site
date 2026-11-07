import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { AuthStore } from '../../core/auth.store';

/** Signed-in customers only; others go to login and come back afterwards. */
const signedIn: CanActivateFn = async (_route, state) => {
  const user = await inject(AuthStore).refresh();
  return user ? true : inject(Router).createUrlTree(['/account/login'], { queryParams: { next: state.url } });
};

/** Login / register pages send signed-in customers straight to their dashboard. */
const signedOut: CanActivateFn = async () => ((await inject(AuthStore).refresh()) ? inject(Router).createUrlTree(['/account']) : true);

export const ACCOUNT_ROUTES: Routes = [
  { path: '', canActivate: [signedIn], loadComponent: () => import('./dashboard.page').then((m) => m.DashboardPage) },
  { path: 'login', canActivate: [signedOut], loadComponent: () => import('./auth.pages').then((m) => m.LoginPage) },
  { path: 'register', canActivate: [signedOut], loadComponent: () => import('./auth.pages').then((m) => m.RegisterPage) },
  { path: 'forgot', loadComponent: () => import('./auth.pages').then((m) => m.ForgotPage) },
  { path: 'reset', loadComponent: () => import('./auth.pages').then((m) => m.ResetPage) },
];
