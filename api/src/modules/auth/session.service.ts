import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { CookieOptions, Request, Response } from 'express';
import type { Env } from '../../config/env.js';

export const CUSTOMER_COOKIE = 'pipeox_session';
export const ADMIN_COOKIE = 'pipeox_admin';

/** Sessions end after this much inactivity (customers and admins alike). */
export const IDLE_MINUTES = 30;
const IDLE_MS = IDLE_MINUTES * 60_000;
/** A session is re-issued (its idle clock restarted) at most this often. */
const TOUCH_AFTER_MS = 60_000;

interface Claims {
  sub: string;
  /** Token version of the account: bumping it ends every session of that account. */
  v: number;
  role: 'customer' | 'admin';
  iat?: number;
}

/**
 * Signed, httpOnly session cookies with a sliding idle timeout: every authenticated
 * request restarts the 30-minute clock; 30 minutes without one and the session is gone.
 */
@Injectable()
export class SessionService {
  private readonly secure: boolean;

  constructor(
    private readonly jwt: JwtService,
    config: ConfigService<Env, true>,
  ) {
    this.secure = config.get('NODE_ENV', { infer: true }) === 'production';
  }

  private async issue(res: Response, cookie: string, claims: Claims, sameSite: 'lax' | 'strict') {
    const token = await this.jwt.signAsync({ sub: claims.sub, v: claims.v, role: claims.role }, { expiresIn: `${IDLE_MINUTES}m` });
    const opts: CookieOptions = { httpOnly: true, secure: this.secure, sameSite, path: '/', maxAge: IDLE_MS };
    res.cookie(cookie, token, opts);
  }

  private async read(req: Request, cookie: string, role: Claims['role']): Promise<Claims | null> {
    const token = req.cookies?.[cookie];
    if (typeof token !== 'string') return null;
    try {
      const claims = await this.jwt.verifyAsync<Claims>(token);
      return claims.role === role && /^[a-f0-9]{24}$/.test(claims.sub) ? claims : null;
    } catch {
      return null;
    }
  }

  private async touch(res: Response | undefined, cookie: string, claims: Claims, sameSite: 'lax' | 'strict') {
    if (res && !res.headersSent && Date.now() - (claims.iat ?? 0) * 1000 > TOUCH_AFTER_MS) await this.issue(res, cookie, claims, sameSite);
  }

  /* ───────── Customer ───────── */

  startCustomer = (res: Response, userId: string, v: number) => this.issue(res, CUSTOMER_COOKIE, { sub: userId, v, role: 'customer' }, 'lax');
  readCustomer = (req: Request) => this.read(req, CUSTOMER_COOKIE, 'customer');
  touchCustomer = (res: Response | undefined, claims: Claims) => this.touch(res, CUSTOMER_COOKIE, claims, 'lax');
  endCustomer(res: Response): void {
    res.clearCookie(CUSTOMER_COOKIE, { path: '/' });
  }

  /* ───────── Admin ───────── */

  startAdmin = (res: Response, adminId: string, v: number) => this.issue(res, ADMIN_COOKIE, { sub: adminId, v, role: 'admin' }, 'strict');
  readAdmin = (req: Request) => this.read(req, ADMIN_COOKIE, 'admin');
  touchAdmin = (res: Response | undefined, claims: Claims) => this.touch(res, ADMIN_COOKIE, claims, 'strict');
  endAdmin(res: Response): void {
    res.clearCookie(ADMIN_COOKIE, { path: '/' });
  }
}
