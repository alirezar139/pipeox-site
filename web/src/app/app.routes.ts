import { Routes } from '@angular/router';
import {
  articleResolver, articlesResolver, homeResolver, productResolver, productsResolver, projectsResolver, recentArticlesResolver,
} from './features/site.resolvers';
import { SiteLayoutComponent } from './layout/site-layout.component';

/**
 * Public site (server-rendered) + customer account + admin panel (client-rendered, see app.routes.server.ts).
 * Every page is lazy-loaded; the admin panel is its own bundle that visitors never download.
 */
export const routes: Routes = [
  {
    path: 'admin',
    loadChildren: () => import('./features/admin/admin.routes').then((m) => m.ADMIN_ROUTES),
  },
  {
    path: '',
    component: SiteLayoutComponent,
    children: [
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
    ],
  },
];
