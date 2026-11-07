#!/usr/bin/env node
/**
 * PIPEOX production server — the whole site in one Node process on one port:
 *   /api/*, /sitemap.xml, /robots.txt  → NestJS API      (api/dist)
 *   everything else                    → Angular SSR app (web/dist)
 *
 *   npm run build && npm start
 * Put nginx (or the hosting panel's proxy) in front for HTTPS; set TRUST_PROXY=1 then.
 */
import compression from 'compression';
import express from 'express';
import helmet from 'helmet';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const need = (p, hint) => {
  if (!existsSync(root + p)) {
    console.error(`Missing ${p} — ${hint}`);
    process.exit(1);
  }
};
need('.env', 'run `npm run setup` first.');
need('api/dist/bootstrap.js', 'run `npm run build` first.');
need('web/dist/web/server/server.mjs', 'run `npm run build` first.');

// The project's .env wins over machine-wide variables (e.g. a global MONGODB_URI of another project)
const env = Object.fromEntries(
  readFileSync(root + '.env', 'utf8')
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
);
Object.assign(process.env, env);
const setting = (k, d) => process.env[k] || d;
const port = Number(setting('PORT', 4000));
const trustProxy = Number(setting('TRUST_PROXY', 0));
const siteUrl = setting('SITE_URL', '');

process.env.NODE_ENV = setting('NODE_ENV', 'production');
// The Angular renderer fetches page data from the API in this same process
process.env.INTERNAL_API_ORIGIN = `http://127.0.0.1:${port}`;
// SSR only answers for known host names (protects against host-header attacks)
process.env.NG_ALLOWED_HOSTS ??= ['localhost', '127.0.0.1', siteUrl && new URL(siteUrl).hostname].filter(Boolean).join(',');
if (trustProxy) process.env.NG_TRUST_PROXY_HEADERS ??= 'x-forwarded-host,x-forwarded-proto,x-forwarded-for';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', trustProxy);
app.use(compression());
// Security headers for every response. The HTML Content-Security-Policy (with a per-request
// nonce) is set by the Angular server, so helmet's CSP is off here.
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    strictTransportSecurity: siteUrl.startsWith('https://') ? { maxAge: 31536000, includeSubDomains: true } : false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  }),
);
app.use((_req, res, next) => {
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  next();
});

const { mountApi } = await import('./api/dist/bootstrap.js');
const api = await mountApi(app);
const { reqHandler } = await import('./web/dist/web/server/server.mjs');
app.use(reqHandler);

const server = app.listen(port, () => console.log(`PIPEOX is running on http://localhost:${port}`));

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    server.close();
    api.close().finally(() => process.exit(0));
  });
}
