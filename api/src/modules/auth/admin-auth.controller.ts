import { BadRequestException, Body, Controller, Get, HttpCode, Logger, OnModuleInit, Post, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import type { Model } from 'mongoose';
import { z } from 'zod';
import { burnPasswordCheck, hashPassword, verifyPassword } from '../../common/security/password.js';
import type { Env } from '../../config/env.js';
import { CaptchaService } from '../captcha/captcha.module.js';
import { Admin, type AdminDocument, toAdmin } from '../users/admin.schema.js';
import { AdminResolver, CurrentAdmin, StaffGuard } from './guards.js';
import { IDLE_MINUTES, SessionService } from './session.service.js';

const loginSchema = z.object({ username: z.string().trim().min(1).max(40), password: z.string().min(1).max(200) });
export const adminPassword = z.string().min(10, 'رمز مدیر باید حداقل ۱۰ کاراکتر باشد.').max(200);
const changeSchema = z.object({ current: z.string().max(200), password: adminPassword });

/** Admin users sign in with username + password (+ captcha). Brute force is throttled per IP. */
@Controller('admin')
export class AdminAuthController implements OnModuleInit {
  private readonly log = new Logger(AdminAuthController.name);

  constructor(
    @InjectModel(Admin.name) private readonly admins: Model<Admin>,
    private readonly sessions: SessionService,
    private readonly resolver: AdminResolver,
    private readonly captcha: CaptchaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** First start: create the "admin" user from ADMIN_PASSWORD_HASH (written by npm run setup). */
  async onModuleInit() {
    if (await this.admins.estimatedDocumentCount()) return;
    await this.admins.create({ username: 'admin', name: 'مدیر سایت', role: 'admin', passwordHash: this.config.get('ADMIN_PASSWORD_HASH', { infer: true }) });
    this.log.log('Created the first admin user "admin" (password from .env)');
  }

  @Get('me')
  async me(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const admin = await this.resolver.resolve(req, res);
    return { admin: admin ? toAdmin(admin) : null, idleMinutes: IDLE_MINUTES };
  }

  @Throttle({ default: { limit: 5, ttl: 900_000 } })
  @HttpCode(200)
  @Post('login')
  async login(@Body({ schema: loginSchema }) body: z.infer<typeof loginSchema>, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    this.captcha.verify(req.body);
    const admin = await this.admins.findOne({ username: body.username.toLowerCase() }).select('+passwordHash');
    if (!admin) {
      await burnPasswordCheck(body.password); // same timing as a real account
      throw new UnauthorizedException('نام کاربری یا رمز عبور اشتباه است.');
    }
    if (!(await verifyPassword(body.password, admin.passwordHash))) throw new UnauthorizedException('نام کاربری یا رمز عبور اشتباه است.');
    if (!admin.active) throw new UnauthorizedException('این حساب غیرفعال شده است.');
    admin.lastLoginAt = new Date();
    await admin.save();
    await this.sessions.startAdmin(res, String(admin._id), admin.tokenVersion);
    return { admin: toAdmin(admin) };
  }

  @HttpCode(200)
  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    this.sessions.endAdmin(res);
    return { ok: true };
  }

  /** Change your own password; other sessions of this account end, this one continues. */
  @Throttle({ default: { limit: 10, ttl: 900_000 } })
  @UseGuards(StaffGuard)
  @HttpCode(200)
  @Post('password')
  async changePassword(@CurrentAdmin() me: AdminDocument, @Body({ schema: changeSchema }) body: z.infer<typeof changeSchema>, @Res({ passthrough: true }) res: Response) {
    const admin = await this.admins.findById(me._id).select('+passwordHash');
    if (!admin || !(await verifyPassword(body.current, admin.passwordHash))) {
      throw new BadRequestException({ message: 'رمز فعلی اشتباه است.', field: 'current' });
    }
    admin.passwordHash = await hashPassword(body.password);
    admin.tokenVersion += 1;
    await admin.save();
    await this.sessions.startAdmin(res, String(admin._id), admin.tokenVersion);
    return { ok: true };
  }
}
