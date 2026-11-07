import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject, InjectionToken } from '@angular/core';
import { catchError, throwError } from 'rxjs';
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
 *  - fails with a uniform ApiError { statusCode, message, field? } in Persian.
 */
export const apiInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith('/api/')) return next(req);
  // Absolute on both sides so SSR transfer-cache keys match (see HTTP_TRANSFER_CACHE_ORIGIN_MAP)
  const origin = inject(SERVER_API_ORIGIN) || (typeof location !== 'undefined' ? location.origin : '');
  const request = req.clone({
    url: origin + req.url,
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
              ? 'ارتباط با سرور برقرار نشد. اتصال اینترنت را بررسی کنید.'
              : 'خطایی رخ داد. لطفاً دوباره تلاش کنید.',
        field: body?.field,
      };
      return throwError(() => apiError);
    }),
  );
};
