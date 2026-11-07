import { Logger } from '@nestjs/common';
import express from 'express';
import { mountApi } from './bootstrap.js';

/**
 * Development entry: the API alone on API_PORT (default 3000).
 * `ng serve` proxies /api, /sitemap.xml and /robots.txt here (web/proxy.conf.json).
 * Production runs everything in one process instead — see /server.mjs.
 */
const host = express();
host.disable('x-powered-by');
const app = await mountApi(host);
const port = Number(process.env.API_PORT ?? 3000);
host.listen(port, () => Logger.log(`API ready on http://localhost:${port}/api`, 'Bootstrap'));

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => void app.close().then(() => process.exit(0)));
}
