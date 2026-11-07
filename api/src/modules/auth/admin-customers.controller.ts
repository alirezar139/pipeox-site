import { Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, Patch, Post, Res, UseGuards } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import type { Response } from 'express';
import type { Connection, Model } from 'mongoose';
import { z } from 'zod';
import { hashPassword } from '../../common/security/password.js';
import { sendCsv } from '../../common/utils/csv.js';
import { objectId, password } from '../../common/utils/text.js';
import { PasswordReset, User } from '../users/user.schema.js';
import { AdminGuard } from './guards.js';

/** Admin → customers: list, enable/disable, set password, delete, export. */
@UseGuards(AdminGuard)
@Controller('admin/customers')
export class AdminCustomersController {
  constructor(
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(PasswordReset.name) private readonly resets: Model<PasswordReset>,
    @InjectConnection() private readonly conn: Connection,
  ) {}

  private async listWithCounts() {
    const counts = await this.conn
      .collection('inquiries')
      .aggregate<{ _id: unknown; n: number }>([{ $match: { user: { $ne: null } } }, { $group: { _id: '$user', n: { $sum: 1 } } }])
      .toArray();
    const byUser = new Map(counts.map((c) => [String(c._id), c.n]));
    const users = await this.users.find().sort({ _id: -1 }).lean();
    return users.map((u) => ({
      id: String(u._id),
      email: u.email,
      name: u.name,
      phone: u.phone,
      company: u.company,
      active: u.active,
      createdAt: u.createdAt,
      lastLoginAt: u.lastLoginAt ?? null,
      inquiries: byUser.get(String(u._id)) ?? 0,
    }));
  }

  @Get()
  list() {
    return this.listWithCounts();
  }

  @Get('export.csv')
  async export(@Res() res: Response) {
    const rows = await this.listWithCounts();
    sendCsv(res, 'pipeox-customers', ['نام', 'ایمیل', 'تلفن', 'شرکت', 'تاریخ ثبت‌نام', 'تعداد استعلام'],
      rows.map((r) => [r.name, r.email, r.phone, r.company, r.createdAt, r.inquiries]));
  }

  @Patch(':id')
  async setActive(@Param('id', { schema: objectId }) id: string, @Body({ schema: z.object({ active: z.boolean() }) }) body: { active: boolean }) {
    const u = await this.users.findByIdAndUpdate(id, { active: body.active, $inc: { tokenVersion: 1 } }, { returnDocument: 'after' });
    if (!u) throw new NotFoundException();
    return { ok: true };
  }

  @HttpCode(200)
  @Post(':id/password')
  async setPassword(@Param('id', { schema: objectId }) id: string, @Body({ schema: z.object({ password }) }) body: { password: string }) {
    const u = await this.users.findByIdAndUpdate(id, { passwordHash: await hashPassword(body.password), $inc: { tokenVersion: 1 } });
    if (!u) throw new NotFoundException();
    return { ok: true };
  }

  /** Inquiries stay in the inbox, detached from the deleted account. */
  @Delete(':id')
  async remove(@Param('id', { schema: objectId }) id: string) {
    const u = await this.users.findByIdAndDelete(id);
    if (!u) throw new NotFoundException();
    await this.conn.collection('inquiries').updateMany({ user: u._id }, { $set: { user: null } });
    await this.resets.deleteMany({ userId: id });
    return { ok: true };
  }
}
