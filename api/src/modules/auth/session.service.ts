import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash } from 'node:crypto';
import type { CookieOptions, Request, Response } from 'express';
import type { Env } from '../../config/env.js';

export const CUSTOMER_COOKIE = 'pipeox_session';
export const ADMIN_COOKIE = 'pipeox_admin';

interface CustomerClaims {
  sub: string;
  v: number;
  role: 'customer';
}
interface AdminClaims {
  role: 'admin';
  /** Fingerprint of the configured admin hash: changing the password logs every admin out. */
  fp: string;
}

/** Signed, httpOnly session cookies for customers and the admin. */
@Injectable()
export class SessionService {
  private readonly secure: boolean;
  private readonly adminFp: string;

  constructor(
    private readonly jwt: JwtService,
    config: ConfigService<Env, true>,
  ) {
    this.secure = config.get('NODE_ENV', { infer: true }) === 'production';
    this.adminFp = createHash('sha256').update(config.get('ADMIN_PASSWORD_HASH', { infer: true })).digest('hex').slice(0, 16);
  }

  private opts(maxAgeMs: number, sameSite: 'lax' | 'strict'): CookieOptions {
    return { httpOnly: true, secure: this.secure, sameSite, path: '/', maxAge: maxAgeMs };
  }

  /* ───────── Customer ───────── */

  async startCustomer(res: Response, userId: string, tokenVersion: number): Promise<void> {
    const token = await this.jwt.signAsync({ sub: userId, v: tokenVersion, role: 'customer' } satisfies CustomerClaims, { expiresIn: '30d' });
    res.cookie(CUSTOMER_COOKIE, token, this.opts(30 * 24 * 3600 * 1000, 'lax'));
  }

  async readCustomer(req: Request): Promise<CustomerClaims | null> {
    const token = req.cookies?.[CUSTOMER_COOKIE];
    if (typeof token !== 'string') return null;
    try {
      const claims = await this.jwt.verifyAsync<CustomerClaims>(token);
      return claims.role === 'customer' ? claims : null;
    } catch {
      return null;
    }
  }

  endCustomer(res: Response): void {
    res.clearCookie(CUSTOMER_COOKIE, { path: '/' });
  }

  /* ───────── Admin ───────── */

  async startAdmin(res: Response): Promise<void> {
    const token = await this.jwt.signAsync({ role: 'admin', fp: this.adminFp } satisfies AdminClaims, { expiresIn: '12h' });
    res.cookie(ADMIN_COOKIE, token, this.opts(12 * 3600 * 1000, 'strict'));
  }

  async isAdmin(req: Request): Promise<boolean> {
    const token = req.cookies?.[ADMIN_COOKIE];
    if (typeof token !== 'string') return false;
    try {
      const claims = await this.jwt.verifyAsync<AdminClaims>(token);
      return claims.role === 'admin' && claims.fp === this.adminFp;
    } catch {
      return false;
    }
  }

  endAdmin(res: Response): void {
    res.clearCookie(ADMIN_COOKIE, { path: '/' });
  }
}
