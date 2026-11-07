import { BadRequestException, Body, Controller, HttpCode, Patch, Post, Res, UseGuards } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import type { Model } from 'mongoose';
import { z } from 'zod';
import { hashPassword, verifyPassword } from '../../common/security/password.js';
import { password, phone, requiredText, text } from '../../common/utils/text.js';
import { toAccount, User, type UserDocument } from '../users/user.schema.js';
import { CurrentUser, CustomerGuard } from './guards.js';
import { SessionService } from './session.service.js';

const profileSchema = z.object({ name: requiredText(100, 'لطفاً نام خود را وارد کنید.'), phone, company: text(150).default('') });
const passwordSchema = z.object({ current: z.string().max(200), password });

/** Logged-in customer: profile and password. (Their inquiries: InquiriesController.) */
@UseGuards(CustomerGuard)
@Controller('account')
export class AccountController {
  constructor(
    @InjectModel(User.name) private readonly users: Model<User>,
    private readonly sessions: SessionService,
  ) {}

  @Patch('profile')
  async profile(@CurrentUser() me: UserDocument, @Body({ schema: profileSchema }) body: z.infer<typeof profileSchema>) {
    Object.assign(me, body);
    await me.save();
    return { user: toAccount(me) };
  }

  @Throttle({ default: { limit: 10, ttl: 900_000 } })
  @HttpCode(200)
  @Post('password')
  async password(
    @CurrentUser() me: UserDocument,
    @Body({ schema: passwordSchema }) body: z.infer<typeof passwordSchema>,
    @Res({ passthrough: true }) res: Response,
  ) {
    const withHash = await this.users.findById(me._id).select('+passwordHash');
    if (!withHash || !(await verifyPassword(body.current, withHash.passwordHash))) {
      throw new BadRequestException({ message: 'رمز عبور فعلی درست نیست.', field: 'current' });
    }
    withHash.passwordHash = await hashPassword(body.password);
    withHash.tokenVersion += 1; // signs out other devices
    await withHash.save();
    await this.sessions.startCustomer(res, String(withHash._id), withHash.tokenVersion);
    return { ok: true };
  }
}
