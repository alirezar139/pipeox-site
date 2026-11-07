import { HTTP_TRANSFER_CACHE_ORIGIN_MAP } from '@angular/common/http';
import { ApplicationConfig, CSP_NONCE, inject, mergeApplicationConfig, REQUEST, REQUEST_CONTEXT } from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';
import { SERVER_API_ORIGIN } from './core/http/api.interceptor';

/**
 * Where the server-side renderer reaches the API: the same Node process in production
 * (server.mjs sets INTERNAL_API_ORIGIN), the standalone API on API_PORT in development.
 */
const internalOrigin = process.env['INTERNAL_API_ORIGIN'] ?? `http://127.0.0.1:${process.env['API_PORT'] ?? 3000}`;

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    { provide: SERVER_API_ORIGIN, useValue: internalOrigin },
    // Per-request nonce from server.ts → Angular stamps it on the inline scripts it renders (CSP)
    { provide: CSP_NONCE, useFactory: () => (inject(REQUEST_CONTEXT, { optional: true }) as { nonce?: string } | null)?.nonce ?? null },
    // Responses fetched from the internal origin are handed to the browser under the public origin,
    // so hydration reuses them instead of calling the API again.
    {
      provide: HTTP_TRANSFER_CACHE_ORIGIN_MAP,
      useFactory: () => {
        const req = inject(REQUEST, { optional: true });
        return req ? { [internalOrigin]: new URL(req.url).origin } : {};
      },
    },
  ],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
