import { inject } from '@angular/core';
import { CanActivateFn, Routes } from '@angular/router';
import { I18n, type Lang } from './core/i18n';
import { SiteStore } from './core/site.store';
import {
  articleResolver, articlesResolver, homeResolver, productResolver, productsResolver, projectsResolver, recentArticlesResolver,
} from './features/site.resolvers';
import { SiteLayoutComponent } from './layout/site-layout.component';

/**
 * Public site in three languages (server-rendered) + customer account + admin panel (client-rendered, see app.routes.server.ts).
 * Every page is lazy-loaded; the admin panel is its own bundle that visitors never download.
 */
/** Entering a language section: switch the UI language and reload the site texts in it. */
const enterLang: CanActivateFn = async (route) => {
  const lang = route.data['lang'] as Lang;
  inject(I18n).set(lang);
  const site = inject(SiteStore);
  if (site.loadedLang !== lang) await site.load();
  return true;
};

const SITE_PAGES: Routes = [
  { path: '', loadComponent: () => import('./features/home/home.page').then((m) => m.HomePage), resolve: { data: homeResolver } },
  {
    path: 'products',
    loadComponent: () => import('./features/products/products.page').then((m) => m.ProductsPage),
    resolve: { products: productsResolver },
  },
  {
    path: 'products/:slug',
    loadComponent: () => import('./features/products/product-detail.page').then((m) => m.ProductDetailPage),
    resolve: { product: productResolver, products: productsResolver },
  },
  {
    path: 'insights',
    loadComponent: () => import('./features/insights/insights.page').then((m) => m.InsightsPage),
    resolve: { articles: articlesResolver },
  },
  {
    path: 'insights/:slug',
    loadComponent: () => import('./features/insights/article.page').then((m) => m.ArticlePage),
    resolve: { article: articleResolver, recent: recentArticlesResolver },
  },
  {
    path: 'projects',
    loadComponent: () => import('./features/pages/projects.page').then((m) => m.ProjectsPage),
    resolve: { projects: projectsResolver },
  },
  { path: 'about', loadComponent: () => import('./features/pages/about.page').then((m) => m.AboutPage) },
  {
    path: 'contact',
    loadComponent: () => import('./features/pages/contact.page').then((m) => m.ContactPage),
    resolve: { products: productsResolver },
  },
  { path: 'account', loadChildren: () => import('./features/account/account.routes').then((m) => m.ACCOUNT_ROUTES) },
  { path: '404', loadComponent: () => import('./features/pages/not-found.page').then((m) => m.NotFoundPage) },
  { path: '**', loadComponent: () => import('./features/pages/not-found.page').then((m) => m.NotFoundPage) },
];

/** The public site, once per language: / (Persian), /en (English), /de (German). */
const site = (lang: Lang) => ({ path: lang === 'fa' ? '' : lang, component: SiteLayoutComponent, data: { lang }, canActivate: [enterLang], children: SITE_PAGES });

export const routes: Routes = [
  {
    path: 'admin',
    loadChildren: () => import('./features/admin/admin.routes').then((m) => m.ADMIN_ROUTES),
  },
  site('en'),
  site('de'),
  site('fa'),
];
