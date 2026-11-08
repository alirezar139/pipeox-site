import { BadRequestException, Body, Controller, Get, HttpCode, Logger, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { trusted, type Model } from 'mongoose';
import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { burnPasswordCheck, hashPassword, verifyPassword } from '../../common/security/password.js';
import { email, password, phone, requiredText, text } from '../../common/utils/text.js';
import type { Env } from '../../config/env.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PasswordReset, toAccount, User } from '../users/user.schema.js';
import { CaptchaService } from '../captcha/captcha.module.js';
import { CustomerResolver } from './guards.js';
import { IDLE_MINUTES, SessionService } from './session.service.js';

const registerSchema = z.object({
  name: requiredText(100, 'لطفاً نام خود را وارد کنید.'),
  email,
  phone,
  company: text(150).default(''),
  password,
  website: z.string().max(200).optional(), // honeypot
});
const loginSchema = z.object({ email: z.string().max(190), password: z.string().max(200) });
const forgotSchema = z.object({ email });
const resetSchema = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/, 'پیوند نامعتبر است.'), password });

/** Customer sign-up, sign-in, sign-out and password recovery. */
@Controller('auth')
export class AuthController {
  private readonly log = new Logger(AuthController.name);

  constructor(
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(PasswordReset.name) private readonly resets: Model<PasswordReset>,
    private readonly sessions: SessionService,
    private readonly resolver: CustomerResolver,
    private readonly notify: NotificationsService,
    private readonly config: ConfigService<Env, true>,
    private readonly captcha: CaptchaService,
  ) {}

  @Get('me')
  async me(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const user = await this.resolver.resolve(req, res);
    return { user: user ? toAccount(user) : null, idleMinutes: IDLE_MINUTES };
  }

  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  @Post('register')
  async register(@Body({ schema: registerSchema }) body: z.infer<typeof registerSchema>, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    if (body.website) throw new BadRequestException('درخواست نامعتبر است.');
    this.captcha.verify(req.body);
    if (await this.users.exists({ email: body.email })) {
      throw new BadRequestException({ message: 'با این ایمیل قبلاً حساب ساخته شده است. وارد شوید یا رمز را بازیابی کنید.', field: 'email' });
    }
    const user = await this.users.create({
      email: body.email,
      name: body.name,
      phone: body.phone,
      company: body.company,
      passwordHash: await hashPassword(body.password),
    });
    await this.sessions.startCustomer(res, String(user._id), user.tokenVersion);
    return { user: toAccount(user) };
  }

  @Throttle({ default: { limit: 10, ttl: 900_000 } })
  @HttpCode(200)
  @Post('login')
  async login(@Body({ schema: loginSchema }) body: z.infer<typeof loginSchema>, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    this.captcha.verify(req.body);
    const user = await this.users.findOne({ email: body.email.trim().toLowerCase() }).select('+passwordHash');
    if (!user) {
      await burnPasswordCheck(body.password); // same timing as a real account
      throw new UnauthorizedException('ایمیل یا رمز عبور اشتباه است.');
    }
    if (!(await verifyPassword(body.password, user.passwordHash))) {
      throw new UnauthorizedException('ایمیل یا رمز عبور اشتباه است.');
    }
    if (!user.active) throw new UnauthorizedException('این حساب غیرفعال شده است. با پشتیبانی تماس بگیرید.');
    user.lastLoginAt = new Date();
    await user.save();
    await this.sessions.startCustomer(res, String(user._id), user.tokenVersion);
    return { user: toAccount(user) };
  }

  @HttpCode(200)
  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    this.sessions.endCustomer(res);
    return { ok: true };
  }

  /** Always answers the same way — never reveals whether an address is registered. */
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  @HttpCode(200)
  @Post('forgot')
  async forgot(@Body({ schema: forgotSchema }) body: z.infer<typeof forgotSchema>, @Req() req: Request) {
    this.captcha.verify(req.body);
    if (!this.notify.emailEnabled) {
      return { ok: true, emailEnabled: false };
    }
    const user = await this.users.findOne({ email: body.email, active: true });
    if (user) {
      const token = randomBytes(32).toString('hex');
      await this.resets.deleteMany({ userId: String(user._id) });
      await this.resets.create({
        tokenHash: createHash('sha256').update(token).digest('hex'),
        userId: String(user._id),
        expiresAt: new Date(Date.now() + 3600_000),
      });
      const base = this.config.get('SITE_URL', { infer: true }) || `${req.protocol}://${req.get('host')}`;
      this.notify
        .sendEmail(
          user.email,
          'بازیابی رمز عبور PIPEOX',
          `سلام ${user.name}،\n\nبرای تعیین رمز عبور جدید روی پیوند زیر بزنید (تا یک ساعت معتبر است):\n${base}/account/reset?token=${token}\n\nاگر این درخواست را شما نداده‌اید، این ایمیل را نادیده بگیرید.`,
        )
        .catch((e) => this.log.warn(`Reset email failed: ${String(e)}`));
    }
    return { ok: true, emailEnabled: true };
  }

  @Throttle({ default: { limit: 10, ttl: 3_600_000 } })
  @HttpCode(200)
  @Post('reset')
  async reset(@Body({ schema: resetSchema }) body: z.infer<typeof resetSchema>, @Res({ passthrough: true }) res: Response) {
    const row = await this.resets.findOneAndDelete({
      tokenHash: createHash('sha256').update(body.token).digest('hex'),
      expiresAt: trusted({ $gt: new Date() }),
    });
    if (!row) throw new BadRequestException('این پیوند نامعتبر است یا منقضی شده است.');
    const user = await this.users.findOneAndUpdate(
      { _id: row.userId, active: true },
      { passwordHash: await hashPassword(body.password), $inc: { tokenVersion: 1 } },
      { returnDocument: 'after' },
    );
    if (!user) throw new BadRequestException('این پیوند نامعتبر است یا منقضی شده است.');
    await this.resets.deleteMany({ userId: row.userId });
    await this.sessions.startCustomer(res, String(user._id), user.tokenVersion);
    return { user: toAccount(user) };
  }
}
