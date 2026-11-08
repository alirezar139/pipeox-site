import { RenderMode, ServerRoute } from '@angular/ssr';

/**
 * Public pages render on the server for every request (fresh content from the panel, full HTML for SEO).
 * Account and admin pages are private and per-user: rendered in the browser only.
 */
export const serverRoutes: ServerRoute[] = [
  { path: 'admin/**', renderMode: RenderMode.Client },
  { path: 'admin', renderMode: RenderMode.Client },
  ...['account', 'en/account', 'de/account'].flatMap((p) => [
    { path: `${p}/**`, renderMode: RenderMode.Client } as ServerRoute,
    { path: p, renderMode: RenderMode.Client } as ServerRoute,
  ]),
  // Cart and checkout live in the visitor's browser (localStorage) — no server rendering
  ...['cart', 'en/cart', 'de/cart', 'checkout', 'en/checkout', 'de/checkout'].map((path) => ({ path, renderMode: RenderMode.Client }) as ServerRoute),
  ...['404', 'en/404', 'de/404'].map((path) => ({ path, renderMode: RenderMode.Server, status: 404 }) as ServerRoute),
  { path: '**', renderMode: RenderMode.Server },
];
