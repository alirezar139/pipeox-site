import { Body, Controller, Get, HttpCode, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { verifyPassword } from '../../common/security/password.js';
import type { Env } from '../../config/env.js';
import { SessionService } from './session.service.js';

const loginSchema = z.object({ password: z.string().min(1).max(200) });

/** Single admin, password hash from the environment. Brute force is throttled per IP. */
@Controller('admin')
export class AdminAuthController {
  constructor(
    private readonly sessions: SessionService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Get('me')
  async me(@Req() req: Request) {
    return { admin: await this.sessions.isAdmin(req) };
  }

  @Throttle({ default: { limit: 5, ttl: 900_000 } })
  @HttpCode(200)
  @Post('login')
  async login(@Body({ schema: loginSchema }) body: z.infer<typeof loginSchema>, @Res({ passthrough: true }) res: Response) {
    const ok = await verifyPassword(body.password, this.config.get('ADMIN_PASSWORD_HASH', { infer: true }));
    if (!ok) throw new UnauthorizedException('رمز عبور اشتباه است.');
    await this.sessions.startAdmin(res);
    return { admin: true };
  }

  @HttpCode(200)
  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    this.sessions.endAdmin(res);
    return { ok: true };
  }
}
