import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

const SKIP = 'csrf:skip';
/**
 * For endpoints that other sites legitimately post to with a plain HTML form — the bank
 * payment callbacks. They carry no session and trust nothing until verified with the bank.
 */
export const SkipCsrf = () => SetMetadata(SKIP, true);

/**
 * CSRF defence for cookie-authenticated requests:
 *  1. every state-changing request must carry `X-Requested-With: pipeox` — a custom header
 *     that browsers refuse to send cross-site without a CORS preflight (which we never allow);
 *  2. if the browser sends an Origin header, it must match the host serving the API.
 * Cookies are also SameSite, so this is defence in depth.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return true;
    if (this.reflector.getAllAndOverride<boolean>(SKIP, [ctx.getHandler(), ctx.getClass()])) return true;

    if (req.get('x-requested-with') !== 'pipeox') {
      throw new ForbiddenException('Missing request header');
    }
    const origin = req.get('origin');
    if (origin) {
      let host: string;
      try {
        host = new URL(origin).host;
      } catch {
        throw new ForbiddenException('Bad origin');
      }
      const expected = req.get('x-forwarded-host') ?? req.get('host');
      if (host !== expected) throw new ForbiddenException('Cross-site request blocked');
    }
    return true;
  }
}
