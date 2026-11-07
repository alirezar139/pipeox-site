import { AngularNodeAppEngine, createNodeRequestHandler, isMainModule, writeResponseToNodeResponse } from '@angular/ssr/node';
import express from 'express';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';

/**
 * Angular server: static browser files + server-side rendering.
 * In production it is mounted by /server.mjs together with the API (one process, one port);
 * `ng serve` uses `reqHandler` directly during development.
 */
const browserDistFolder = join(import.meta.dirname, '../browser');
const isProd = process.env['NODE_ENV'] === 'production';

const app = express();
app.disable('x-powered-by');
const angularApp = new AngularNodeAppEngine();

/** Strict Content-Security-Policy: scripts only from this site or carrying this response's nonce. */
function csp(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isProd ? ['upgrade-insecure-requests'] : []),
  ].join('; ');
}

/** Hashed build files never change → cache for a year; other public files for a day. */
app.use(
  express.static(browserDistFolder, {
    index: false,
    redirect: false,
    setHeaders: (res, path) => {
      const hashed = /\.[a-z0-9]{8,}\.(js|css|mjs)$/i.test(path) || path.includes('/media/');
      res.setHeader('Cache-Control', hashed ? 'public, max-age=31536000, immutable' : 'public, max-age=86400');
    },
  }),
);

app.use((req, res, next) => {
  const nonce = randomBytes(16).toString('base64');
  angularApp
    .handle(req, { nonce })
    .then(async (response) => {
      if (!response) return next();
      if (!response.headers.get('content-type')?.includes('text/html')) return writeResponseToNodeResponse(response, res);

      // Angular's build inserts the event-replay contract as an inline script without a nonce;
      // stamp this response's nonce on it so the strict CSP allows it (and nothing else inline).
      const html = (await response.text()).replace(
        '<script type="text/javascript" id="ng-event-dispatch-contract">',
        `<script nonce="${nonce}" type="text/javascript" id="ng-event-dispatch-contract">`,
      );
      const headers = new Headers(response.headers);
      headers.set('Content-Security-Policy', csp(nonce));
      headers.delete('content-length');
      // Pages are rendered per request (fresh panel content); let proxies revalidate
      if (!headers.has('cache-control')) headers.set('Cache-Control', 'no-cache');
      return writeResponseToNodeResponse(new Response(html, { status: response.status, headers }), res);
    })
    .catch(next);
});

if (isMainModule(import.meta.url)) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) throw error;
    console.log(`Web server listening on http://localhost:${port}`);
  });
}

/** Used by the Angular CLI (dev server, build) and by /server.mjs. */
export const reqHandler = createNodeRequestHandler(app);
