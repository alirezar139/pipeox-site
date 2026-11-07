import { Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import type { Model } from 'mongoose';
import { z } from 'zod';
import { sendCsv } from '../../common/utils/csv.js';
import { email, objectId } from '../../common/utils/text.js';
import { AdminGuard } from '../auth/guards.js';
import { Subscriber } from './subscriber.schema.js';

const subscribeSchema = z.object({ email, website: z.string().max(200).optional() });

@Controller()
export class SubscribersController {
  constructor(@InjectModel(Subscriber.name) private readonly subscribers: Model<Subscriber>) {}

  /** Re-subscribing an existing address also answers ok (no address enumeration). */
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  @HttpCode(200)
  @Post('subscribers')
  async subscribe(@Body({ schema: subscribeSchema }) body: z.infer<typeof subscribeSchema>, @Req() req: Request) {
    if (!body.website) {
      await this.subscribers.updateOne({ email: body.email }, { $setOnInsert: { email: body.email, ip: req.ip ?? '' } }, { upsert: true });
    }
    return { ok: true };
  }

  @UseGuards(AdminGuard)
  @Get('admin/subscribers')
  list() {
    return this.subscribers.find().sort({ _id: -1 }).select('email createdAt').lean();
  }

  @UseGuards(AdminGuard)
  @Get('admin/subscribers/export.csv')
  async export(@Res() res: Response) {
    const rows = await this.subscribers.find().sort({ _id: -1 }).lean();
    sendCsv(res, 'pipeox-subscribers', ['ایمیل', 'تاریخ عضویت'], rows.map((r) => [r.email, r.createdAt]));
  }

  @UseGuards(AdminGuard)
  @Delete('admin/subscribers/:id')
  async remove(@Param('id', { schema: objectId }) id: string) {
    if (!(await this.subscribers.findByIdAndDelete(id))) throw new NotFoundException();
    return { ok: true };
  }
}
