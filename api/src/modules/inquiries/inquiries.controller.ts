import {
  Body, Controller, Get, HttpCode, Logger, NotFoundException, Param, Patch, Post, Query, Req, Res, UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import type { Model } from 'mongoose';
import { existsSync } from 'node:fs';
import { z } from 'zod';
import { sendCsv } from '../../common/utils/csv.js';
import { safeDisplayName, type UploadedFileData } from '../../common/utils/files.js';
import { objectId } from '../../common/utils/text.js';
import { AdminGuard, CurrentUser, CustomerGuard, OptionalCustomerGuard } from '../auth/guards.js';
import { StorageService } from '../media/storage.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import type { UserDocument } from '../users/user.schema.js';
import { Inquiry, inquiryInput, type InquiryInput, type InquiryStatus, inquiryUpdate, STATUSES } from './inquiry.schema.js';

const STATUS_FA: Record<string, string> = { new: 'جدید', contacted: 'تماس گرفته شد', quoted: 'پیشنهاد ارسال شد', won: 'منجر به فروش', closed: 'بسته شد' };

@Controller()
export class InquiriesController {
  private readonly log = new Logger(InquiriesController.name);

  constructor(
    @InjectModel(Inquiry.name) private readonly inquiries: Model<Inquiry>,
    private readonly storage: StorageService,
    private readonly notify: NotificationsService,
  ) {}

  /* ───────── Public: submit ───────── */

  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  @UseGuards(OptionalCustomerGuard)
  @UseInterceptors(FileInterceptor('attachment', { limits: { fileSize: 8 * 1024 * 1024, files: 1, fields: 10 } }))
  @HttpCode(200)
  @Post('inquiries')
  async create(
    @Body({ schema: inquiryInput }) body: InquiryInput,
    @Req() req: Request,
    @CurrentUser() user?: UserDocument,
    @UploadedFile() file?: UploadedFileData,
  ) {
    if (body.website) return { ok: true }; // honeypot: pretend success to bots
    const attachment = file ? { ...(await this.storage.saveAttachment(file)), name: safeDisplayName(file.originalname), size: file.size } : null;

    const doc = await this.inquiries.create({
      name: body.name,
      phone: body.phone,
      category: body.category,
      details: body.details,
      page: body.page,
      attachment: attachment && { stored: attachment.stored, name: attachment.name, size: attachment.size },
      ip: req.ip ?? '',
      userAgent: (req.get('user-agent') ?? '').slice(0, 300),
      user: user?._id ?? null,
    });

    void this.notify.notifyStaff(
      `استعلام جدید از ${body.name}`,
      [
        `استعلام جدید #${doc.id.slice(-6)}`,
        `نام: ${body.name}`,
        `تلفن: ${body.phone}`,
        body.category && `گروه محصول: ${body.category}`,
        body.details && `توضیحات: ${body.details}`,
        attachment && `پیوست: ${attachment.name}`,
        user && `حساب کاربری: ${user.email}`,
        body.page && `صفحه: ${body.page}`,
      ].filter(Boolean).join('\n'),
    );
    return { ok: true };
  }

  /* ───────── Customer: own inquiries ───────── */

  @UseGuards(CustomerGuard)
  @Get('account/inquiries')
  mine(@CurrentUser() user: UserDocument) {
    return this.inquiries
      .find({ user: user._id })
      .sort({ _id: -1 })
      .select('category details status createdAt attachment.name')
      .lean();
  }

  /* ───────── Admin ───────── */

  @UseGuards(AdminGuard)
  @Get('admin/inquiries')
  async list(
    @Query('status', { schema: z.enum(STATUSES).optional() }) status?: InquiryStatus,
    @Query('user', { schema: objectId.optional() }) user?: string,
  ) {
    const filter = { ...(status ? { status } : {}), ...(user ? { user } : {}) };
    const [items, counts] = await Promise.all([
      this.inquiries.find(filter).sort({ _id: -1 }).limit(300).populate('user', 'email name').select('-ip -userAgent -attachment.stored').lean(),
      this.inquiries.aggregate<{ _id: string; n: number }>([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
    ]);
    return { items, counts: Object.fromEntries(counts.map((c) => [c._id, c.n])) };
  }

  @UseGuards(AdminGuard)
  @Patch('admin/inquiries/:id')
  async update(@Param('id', { schema: objectId }) id: string, @Body({ schema: inquiryUpdate }) body: z.infer<typeof inquiryUpdate>) {
    if (!(await this.inquiries.findByIdAndUpdate(id, body))) throw new NotFoundException();
    return { ok: true };
  }

  @UseGuards(AdminGuard)
  @Get('admin/inquiries/:id/attachment')
  async attachment(@Param('id', { schema: objectId }) id: string, @Res() res: Response) {
    const inq = await this.inquiries.findById(id).lean();
    const full = inq?.attachment ? this.storage.attachmentPath(inq.attachment.stored) : null;
    if (!inq?.attachment || !full || !existsSync(full)) throw new NotFoundException('فایل پیدا نشد.');
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(inq.attachment.name)}`);
    res.setHeader('Cache-Control', 'no-store');
    res.sendFile(full);
  }

  @UseGuards(AdminGuard)
  @Get('admin/inquiries/export.csv')
  async export(@Res() res: Response) {
    const rows = await this.inquiries.find().sort({ _id: -1 }).populate<{ user: { email: string } | null }>('user', 'email').lean();
    sendCsv(res, 'pipeox-inquiries', ['تاریخ', 'نام', 'تلفن', 'ایمیل حساب', 'گروه محصول', 'توضیحات', 'پیوست', 'وضعیت', 'یادداشت', 'صفحه'],
      rows.map((r) => [r.createdAt, r.name, r.phone, r.user?.email ?? '', r.category, r.details, r.attachment?.name ?? '', STATUS_FA[r.status], r.notes, r.page]));
  }
}
