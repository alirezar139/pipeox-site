import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { I18n } from '../../core/i18n';
import { AdminApi } from './admin-api.service';

/** The real check is server-side (every /api/admin call); this only routes to the login screen. */
const adminOnly: CanActivateFn = async () => {
  const admin = await inject(AdminApi).me().catch(() => null);
  return !!admin || inject(Router).createUrlTree(['/admin/login']);
};

/** Support accounts only reach inquiries, chats and their own password (the API enforces it too). */
const managers: CanActivateFn = () => !inject(AdminApi).isSupport() || inject(Router).createUrlTree(['/admin/chats']);

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
      { path: '', canActivate: [managers], loadComponent: () => import('./pages/dashboard.page').then((m) => m.AdminDashboardPage) },
      { path: 'inquiries', loadComponent: () => import('./pages/inquiries.page').then((m) => m.AdminInquiriesPage) },
      { path: 'orders', loadComponent: () => import('./pages/orders.page').then((m) => m.AdminOrdersPage) },
      { path: 'orders/:id', loadComponent: () => import('./pages/order-edit.page').then((m) => m.AdminOrderEditPage) },
      { path: 'chats', loadComponent: () => import('./pages/chats.page').then((m) => m.AdminChatsPage) },
      { path: 'products', canActivate: [managers], loadComponent: () => import('./pages/products.page').then((m) => m.AdminProductsPage) },
      { path: 'products/:id', canActivate: [managers], loadComponent: () => import('./pages/product-edit.page').then((m) => m.AdminProductEditPage) },
      { path: 'articles', canActivate: [managers], loadComponent: () => import('./pages/articles.page').then((m) => m.AdminArticlesPage) },
      { path: 'articles/:id', canActivate: [managers], loadComponent: () => import('./pages/article-edit.page').then((m) => m.AdminArticleEditPage) },
      { path: 'projects', canActivate: [managers], loadComponent: () => import('./pages/projects.page').then((m) => m.AdminProjectsPage) },
      { path: 'customers', canActivate: [managers], loadComponent: () => import('./pages/customers.page').then((m) => m.AdminCustomersPage) },
      { path: 'subscribers', canActivate: [managers], loadComponent: () => import('./pages/subscribers.page').then((m) => m.AdminSubscribersPage) },
      { path: 'settings', canActivate: [managers], loadComponent: () => import('./pages/settings.page').then((m) => m.AdminSettingsPage) },
      { path: 'users', loadComponent: () => import('./pages/users.page').then((m) => m.AdminUsersPage) },
      { path: 'system', canActivate: [developerOnly], loadComponent: () => import('./pages/system.page').then((m) => m.AdminSystemPage) },
    ],
  },
];
