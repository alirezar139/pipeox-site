import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { AdminApi } from './admin-api.service';

/** The real check is server-side (every /api/admin call); this only routes to the login screen. */
const adminOnly: CanActivateFn = async () => {
  const ok = await inject(AdminApi).me().then((r) => r.admin, () => false);
  return ok || inject(Router).createUrlTree(['/admin/login']);
};

export const ADMIN_ROUTES: Routes = [
  { path: 'login', loadComponent: () => import('./admin-login.page').then((m) => m.AdminLoginPage) },
  {
    path: '',
    canActivate: [adminOnly],
    loadComponent: () => import('./admin-shell.component').then((m) => m.AdminShellComponent),
    children: [
      { path: '', loadComponent: () => import('./pages/dashboard.page').then((m) => m.AdminDashboardPage) },
      { path: 'inquiries', loadComponent: () => import('./pages/inquiries.page').then((m) => m.AdminInquiriesPage) },
      { path: 'products', loadComponent: () => import('./pages/products.page').then((m) => m.AdminProductsPage) },
      { path: 'products/:id', loadComponent: () => import('./pages/product-edit.page').then((m) => m.AdminProductEditPage) },
      { path: 'articles', loadComponent: () => import('./pages/articles.page').then((m) => m.AdminArticlesPage) },
      { path: 'articles/:id', loadComponent: () => import('./pages/article-edit.page').then((m) => m.AdminArticleEditPage) },
      { path: 'projects', loadComponent: () => import('./pages/projects.page').then((m) => m.AdminProjectsPage) },
      { path: 'customers', loadComponent: () => import('./pages/customers.page').then((m) => m.AdminCustomersPage) },
      { path: 'subscribers', loadComponent: () => import('./pages/subscribers.page').then((m) => m.AdminSubscribersPage) },
      { path: 'settings', loadComponent: () => import('./pages/settings.page').then((m) => m.AdminSettingsPage) },
    ],
  },
];
