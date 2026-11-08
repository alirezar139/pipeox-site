import { BadRequestException, Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { trusted, type Connection, type Model } from 'mongoose';
import { readFileSync } from 'node:fs';
import os from 'node:os';
import { z } from 'zod';
import { hashPassword } from '../../common/security/password.js';
import { objectId, requiredText } from '../../common/utils/text.js';
import { Admin, ADMIN_ROLES, type AdminDocument, toAdmin } from '../users/admin.schema.js';
import { adminPassword } from './admin-auth.controller.js';
import { AdminGuard, CurrentAdmin, DeveloperGuard } from './guards.js';
import { IDLE_MINUTES } from './session.service.js';

/** Software version (kept the same in the root, api and web package.json). */
const VERSION = (JSON.parse(readFileSync(new URL('../../../package.json', import.meta.url), 'utf8')) as { version: string }).version;

const username = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._-]{3,40}$/, 'نام کاربری: ۳ تا ۴۰ حرف انگلیسی کوچک، عدد، نقطه، خط تیره یا زیرخط.');
const createSchema = z.object({ username, name: requiredText(100, 'نام را وارد کنید.'), role: z.enum(ADMIN_ROLES), password: adminPassword });
const updateSchema = z.object({ name: requiredText(100, 'نام را وارد کنید.').optional(), role: z.enum(ADMIN_ROLES).optional(), active: z.boolean().optional() });

/** Admin → panel users: list, add, change role/name/status, set password, delete. */
@UseGuards(AdminGuard)
@Controller('admin/users')
export class AdminUsersController {
  constructor(@InjectModel(Admin.name) private readonly admins: Model<Admin>) {}

  @Get()
  async list() {
    return (await this.admins.find().sort({ _id: 1 })).map(toAdmin);
  }

  @Post()
  async create(@Body({ schema: createSchema }) body: z.infer<typeof createSchema>) {
    if (await this.admins.exists({ username: body.username })) {
      throw new BadRequestException({ message: 'این نام کاربری قبلاً استفاده شده است.', field: 'username' });
    }
    const a = await this.admins.create({ username: body.username, name: body.name, role: body.role, passwordHash: await hashPassword(body.password) });
    return toAdmin(a);
  }

  @Patch(':id')
  async update(@CurrentAdmin() me: AdminDocument, @Param('id', { schema: objectId }) id: string, @Body({ schema: updateSchema }) body: z.infer<typeof updateSchema>) {
    const self = String(me._id) === id;
    if (self && (body.active === false || (body.role && body.role !== me.role))) {
      throw new BadRequestException('نقش یا وضعیت حساب خودتان را نمی‌توانید تغییر دهید.');
    }
    if (body.active === false || body.role) await this.keepOneDeveloperOrAdmin(id, body);
    const ends = body.active !== undefined || body.role !== undefined; // access changed → end their sessions
    const a = await this.admins.findByIdAndUpdate(id, { ...body, ...(ends ? { $inc: { tokenVersion: 1 } } : {}) }, { returnDocument: 'after' });
    if (!a) throw new NotFoundException();
    return toAdmin(a);
  }

  @HttpCode(200)
  @Post(':id/password')
  async setPassword(@Param('id', { schema: objectId }) id: string, @Body({ schema: z.object({ password: adminPassword }) }) body: { password: string }) {
    const a = await this.admins.findByIdAndUpdate(id, { passwordHash: await hashPassword(body.password), $inc: { tokenVersion: 1 } });
    if (!a) throw new NotFoundException();
    return { ok: true };
  }

  @Delete(':id')
  async remove(@CurrentAdmin() me: AdminDocument, @Param('id', { schema: objectId }) id: string) {
    if (String(me._id) === id) throw new BadRequestException('حساب خودتان را نمی‌توانید حذف کنید.');
    await this.keepOneDeveloperOrAdmin(id, { active: false });
    const a = await this.admins.findByIdAndDelete(id);
    if (!a) throw new NotFoundException();
    return { ok: true };
  }

  /** The panel must always keep at least one active user. */
  private async keepOneDeveloperOrAdmin(id: string, change: { active?: boolean; role?: string }) {
    if (change.active !== false) return;
    const others = await this.admins.countDocuments({ _id: trusted({ $ne: id }), active: true });
    if (!others) throw new BadRequestException('حداقل یک حساب فعال برای پنل لازم است.');
  }
}

/** Developer → technical overview of the running system (no secrets). */
@UseGuards(DeveloperGuard)
@Controller('admin/system')
export class AdminSystemController {
  constructor(@InjectConnection() private readonly conn: Connection) {}

  @Get()
  async info() {
    const db = this.conn.db!;
    const [build, collections] = await Promise.all([db.admin().command({ buildInfo: 1 }).catch(() => ({ version: '?' })), db.listCollections().toArray()]);
    const counts = await Promise.all(collections.map(async (c) => ({ name: c.name, count: await db.collection(c.name).estimatedDocumentCount() })));
    const env = process.env;
    const mem = process.memoryUsage();
    return {
      app: { version: VERSION, node: process.version, env: env.NODE_ENV, uptimeSec: Math.round(process.uptime()), memoryMb: Math.round(mem.rss / 1048576), pid: process.pid },
      host: { platform: `${os.type()} ${os.release()}`, cpus: os.cpus().length, loadAvg: os.loadavg().map((x) => Math.round(x * 100) / 100), freeMemMb: Math.round(os.freemem() / 1048576), totalMemMb: Math.round(os.totalmem() / 1048576) },
      database: { name: db.databaseName, version: (build as { version: string }).version, collections: counts.sort((a, b) => a.name.localeCompare(b.name)) },
      config: {
        siteUrl: env.SITE_URL || '—',
        dataDir: env.DATA_DIR,
        trustProxy: env.TRUST_PROXY,
        idleMinutes: IDLE_MINUTES,
        email: Boolean(env.SMTP_HOST),
        bale: Boolean(env.BALE_BOT_TOKEN),
        telegram: Boolean(env.TELEGRAM_BOT_TOKEN),
      },
    };
  }
}
