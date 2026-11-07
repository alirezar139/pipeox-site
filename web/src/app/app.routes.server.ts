import { RenderMode, ServerRoute } from '@angular/ssr';

/**
 * Public pages render on the server for every request (fresh content from the panel, full HTML for SEO).
 * Account and admin pages are private and per-user: rendered in the browser only.
 */
export const serverRoutes: ServerRoute[] = [
  { path: 'admin/**', renderMode: RenderMode.Client },
  { path: 'admin', renderMode: RenderMode.Client },
  { path: 'account/**', renderMode: RenderMode.Client },
  { path: 'account', renderMode: RenderMode.Client },
  { path: '404', renderMode: RenderMode.Server, status: 404 },
  { path: '**', renderMode: RenderMode.Server },
];
