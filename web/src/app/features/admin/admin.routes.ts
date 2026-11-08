import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { I18n } from '../../core/i18n';
import { AdminApi } from './admin-api.service';

/** The real check is server-side (every /api/admin call); this only routes to the login screen. */
const adminOnly: CanActivateFn = async () => {
  const admin = await inject(AdminApi).me().catch(() => null);
  return !!admin || inject(Router).createUrlTree(['/admin/login']);
};

/** The System page is for developer accounts (the API enforces it too). */
const developerOnly: CanActivateFn = () => inject(AdminApi).current()?.role === 'developer' || inject(Router).createUrlTree(['/admin']);

/** The panel is Persian and right-to-left whatever language the visitor last used on the site. */
const persian: CanActivateFn = () => {
  inject(I18n).set('fa');
  return true;
};

export const ADMIN_ROUTES: Routes = [
  { path: 'login', canActivate: [persian], loadComponent: () => import('./admin-login.page').then((m) => m.AdminLoginPage) },
  {
    path: '',
    canActivate: [persian, adminOnly],
    loadComponent: () => import('./admin-shell.component').then((m) => m.AdminShellComponent),
    children: [
      { path: '', loadComponent: () => import('./pages/dashboard.page').then((m) => m.AdminDashboardPage) },
      { path: 'inquiries', loadComponent: () => import('./pages/inquiries.page').then((m) => m.AdminInquiriesPage) },
      { path: 'chats', loadComponent: () => import('./pages/chats.page').then((m) => m.AdminChatsPage) },
      { path: 'products', loadComponent: () => import('./pages/products.page').then((m) => m.AdminProductsPage) },
      { path: 'products/:id', loadComponent: () => import('./pages/product-edit.page').then((m) => m.AdminProductEditPage) },
      { path: 'articles', loadComponent: () => import('./pages/articles.page').then((m) => m.AdminArticlesPage) },
      { path: 'articles/:id', loadComponent: () => import('./pages/article-edit.page').then((m) => m.AdminArticleEditPage) },
      { path: 'projects', loadComponent: () => import('./pages/projects.page').then((m) => m.AdminProjectsPage) },
      { path: 'customers', loadComponent: () => import('./pages/customers.page').then((m) => m.AdminCustomersPage) },
      { path: 'subscribers', loadComponent: () => import('./pages/subscribers.page').then((m) => m.AdminSubscribersPage) },
      { path: 'settings', loadComponent: () => import('./pages/settings.page').then((m) => m.AdminSettingsPage) },
      { path: 'users', loadComponent: () => import('./pages/users.page').then((m) => m.AdminUsersPage) },
      { path: 'system', canActivate: [developerOnly], loadComponent: () => import('./pages/system.page').then((m) => m.AdminSystemPage) },
    ],
  },
];
