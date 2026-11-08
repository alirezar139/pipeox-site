import {
  Body, Controller, Delete, ForbiddenException, Get, Headers, HttpCode, NotFoundException, Param, Patch, Post, Req, UseGuards,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { trusted, type Model } from 'mongoose';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { langOf } from '../../common/i18n.js';
import { objectId } from '../../common/utils/text.js';
import { AdminGuard, CurrentAdmin, CurrentUser, OptionalCustomerGuard } from '../auth/guards.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import type { AdminDocument } from '../users/admin.schema.js';
import type { UserDocument } from '../users/user.schema.js';
import { Chat, type ChatMessage, MAX_MESSAGES, messageInput, startInput, statusInput } from './chat.schema.js';

const hash = (token: string) => createHash('sha256').update(token).digest('hex');
const FULL = 'این گفت‌وگو طولانی شده است. لطفاً گفت‌وگوی تازه‌ای شروع کنید.';
const visitorView = (c: { _id: unknown; status: string; messages: ChatMessage[] }) => ({
  id: String(c._id),
  status: c.status,
  messages: c.messages.map((m) => ({ from: m.from, text: m.text, at: m.at, by: m.by })),
});

@Controller()
export class ChatController {
  constructor(
    @InjectModel(Chat.name) private readonly chats: Model<Chat>,
    private readonly notify: NotificationsService,
  ) {}

  /** The visitor proves ownership of a conversation with the secret token handed out when it started. */
  private async own(id: string, token: string | undefined) {
    const chat = await this.chats.findById(id).select('+tokenHash');
    if (!chat || !token) throw new NotFoundException('گفت‌وگو پیدا نشد.');
    const a = Buffer.from(chat.tokenHash, 'hex');
    const b = Buffer.from(hash(token), 'hex');
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new NotFoundException('گفت‌وگو پیدا نشد.');
    return chat;
  }

  /* ───────── Visitor ───────── */

  @Throttle({ default: { limit: 6, ttl: 3_600_000 } })
  @UseGuards(OptionalCustomerGuard)
  @HttpCode(200)
  @Post('chat')
  async start(@Body({ schema: startInput }) body: z.infer<typeof startInput>, @Req() req: Request, @CurrentUser() user?: UserDocument) {
    if (body.website) throw new ForbiddenException('درخواست نامعتبر است.'); // honeypot
    const token = randomBytes(24).toString('base64url');
    const now = new Date();
    const chat = await this.chats.create({
      tokenHash: hash(token),
      name: body.name || user?.name || '',
      contact: body.contact || user?.email || '',
      lang: langOf(req),
      page: body.page,
      ip: req.ip ?? '',
      userAgent: (req.get('user-agent') ?? '').slice(0, 300),
      user: user?._id ?? null,
      messages: [{ from: 'visitor', text: body.text, at: now }],
      unread: 1,
      lastAt: now,
    });
    void this.notify.notifyStaff(
      `پیام پشتیبانی جدید${chat.name ? ` از ${chat.name}` : ''}`,
      [`گفت‌وگوی پشتیبانی جدید #${chat.id.slice(-6)}`, chat.name && `نام: ${chat.name}`, chat.contact && `راه تماس: ${chat.contact}`, `پیام: ${body.text}`, body.page && `صفحه: ${body.page}`, 'پاسخ: پنل مدیریت › گفت‌وگوها']
        .filter(Boolean).join('\n'),
    );
    return { ...visitorView(chat), token };
  }

  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  @Get('chat/:id')
  async read(@Param('id', { schema: objectId }) id: string, @Headers('x-chat-token') token?: string) {
    return visitorView(await this.own(id, token));
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(200)
  @Post('chat/:id/messages')
  async send(@Param('id', { schema: objectId }) id: string, @Body({ schema: messageInput }) body: z.infer<typeof messageInput>, @Headers('x-chat-token') token?: string) {
    const chat = await this.own(id, token);
    if (chat.messages.length >= MAX_MESSAGES) throw new ForbiddenException(FULL);
    const wasRead = chat.unread === 0;
    const now = new Date();
    chat.messages.push({ from: 'visitor', text: body.text, at: now, by: '' });
    chat.unread += 1;
    chat.status = 'open';
    chat.lastAt = now;
    await chat.save();
    // One alert per batch of unread messages, not one per line typed
    if (wasRead) {
      void this.notify.notifyStaff(
        `پیام تازه در گفت‌وگوی پشتیبانی${chat.name ? ` (${chat.name})` : ''}`,
        [`گفت‌وگو #${chat.id.slice(-6)}`, `پیام: ${body.text}`, 'پاسخ: پنل مدیریت › گفت‌وگوها'].join('\n'),
      );
    }
    return visitorView(chat);
  }

  /* ───────── Panel ───────── */

  @UseGuards(AdminGuard)
  @Get('admin/chats')
  async list() {
    const [items, unread] = await Promise.all([
      this.chats
        .aggregate([
          { $sort: { lastAt: -1 } },
          { $limit: 300 },
          { $project: { name: 1, contact: 1, status: 1, unread: 1, lastAt: 1, createdAt: 1, count: { $size: '$messages' }, last: { $arrayElemAt: ['$messages', -1] } } },
        ]),
      this.unreadCount(),
    ]);
    return { items, unread };
  }

  @UseGuards(AdminGuard)
  @Get('admin/chats/unread')
  async unread() {
    return { unread: await this.unreadCount() };
  }

  @UseGuards(AdminGuard)
  @Get('admin/chats/:id')
  async open(@Param('id', { schema: objectId }) id: string) {
    const chat = await this.chats.findByIdAndUpdate(id, { unread: 0 }, { returnDocument: 'after' }).select('+ip').populate('user', 'email name').lean();
    if (!chat) throw new NotFoundException();
    return chat;
  }

  @UseGuards(AdminGuard)
  @HttpCode(200)
  @Post('admin/chats/:id/messages')
  async reply(@Param('id', { schema: objectId }) id: string, @Body({ schema: messageInput }) body: z.infer<typeof messageInput>, @CurrentAdmin() admin: AdminDocument) {
    const now = new Date();
    const chat = await this.chats
      .findByIdAndUpdate(id, { $push: { messages: { from: 'staff', text: body.text, at: now, by: admin.name } }, unread: 0, lastAt: now, status: 'open' }, { returnDocument: 'after' })
      .lean();
    if (!chat) throw new NotFoundException();
    return chat;
  }

  @UseGuards(AdminGuard)
  @Patch('admin/chats/:id')
  async setStatus(@Param('id', { schema: objectId }) id: string, @Body({ schema: statusInput }) body: z.infer<typeof statusInput>) {
    if (!(await this.chats.findByIdAndUpdate(id, body))) throw new NotFoundException();
    return { ok: true };
  }

  @UseGuards(AdminGuard)
  @Delete('admin/chats/:id')
  async remove(@Param('id', { schema: objectId }) id: string) {
    if (!(await this.chats.findByIdAndDelete(id))) throw new NotFoundException();
    return { ok: true };
  }

  private async unreadCount() {
    return this.chats.countDocuments({ unread: trusted({ $gt: 0 }) });
  }
}
