import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject, InjectionToken } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { I18n } from '../i18n';
import type { ApiError } from '../models';

/**
 * Absolute origin of the API for server-side rendering (relative URLs have no host there).
 * Provided in app.config.server.ts; empty in the browser, which uses its own origin.
 */
export const SERVER_API_ORIGIN = new InjectionToken<string>('SERVER_API_ORIGIN', { factory: () => '' });

/**
 * Every API call:
 *  - on the server, gets the absolute API origin;
 *  - carries X-Requested-With (the API's CSRF check) and same-origin credentials;
 *  - asks for content in the visitor's language (?lang=en|de; a query parameter, so the SSR
 *    transfer cache never mixes languages);
 *  - fails with a uniform ApiError { statusCode, message, field? } in that language.
 */
export const apiInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith('/api/')) return next(req);
  // Absolute on both sides so SSR transfer-cache keys match (see HTTP_TRANSFER_CACHE_ORIGIN_MAP)
  const origin = inject(SERVER_API_ORIGIN) || (typeof location !== 'undefined' ? location.origin : '');
  const i18n = inject(I18n);
  const lang = req.url.startsWith('/api/admin/') ? 'fa' : i18n.lang(); // the panel stays Persian
  const request = req.clone({
    url: origin + req.url,
    ...(lang !== 'fa' ? { params: req.params.set('lang', lang) } : {}),
    withCredentials: true,
    setHeaders: { 'X-Requested-With': 'pipeox' },
  });
  return next(request).pipe(
    catchError((err: HttpErrorResponse) => {
      const body = err.error as Partial<ApiError> | null;
      const apiError: ApiError = {
        statusCode: err.status,
        message:
          typeof body?.message === 'string'
            ? body.message
            : err.status === 0
              ? i18n.t('common.networkError')
              : i18n.t('common.error'),
        field: body?.field,
      };
      return throwError(() => apiError);
    }),
  );
};
