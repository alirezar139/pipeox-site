import {
  All, Body, Controller, Get, HttpCode, NotFoundException, Param, Patch, Post, Query, Req, Res, UseGuards,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import type { Model } from 'mongoose';
import { z } from 'zod';
import { langOf, translateMessage } from '../../common/i18n.js';
import { SkipCsrf } from '../../common/security/csrf.guard.js';
import { sendCsv } from '../../common/utils/csv.js';
import { objectId } from '../../common/utils/text.js';
import { AdminGuard, CurrentAdmin, CurrentUser, CustomerGuard, StaffGuard } from '../auth/guards.js';
import type { AdminDocument } from '../users/admin.schema.js';
import type { UserDocument } from '../users/user.schema.js';
import type { GatewayId } from './gateways/gateway.js';
import { adminOrderUpdate, cartLines, checkoutInput, Order, ORDER_STATUSES, transferInput, type CheckoutInput, type OrderStatus } from './order.schema.js';
import { ORDER_STATUS_FA, ShopService, type OrderDoc } from './shop.service.js';

/** What a customer may see of their order (no internal notes, no bank tokens). */
const customerView = (o: Order & { _id: unknown }) => ({
  _id: String(o._id),
  number: o.number,
  status: o.status,
  payMethod: o.payMethod,
  items: o.items.map(({ slug, productTitle, sku, title, unit, price, qty, total }) => ({ slug, productTitle, sku, title, unit, price, qty, total })),
  subtotal: o.subtotal,
  shipping: o.shipping,
  vatPercent: o.vatPercent,
  vat: o.vat,
  total: o.total,
  address: o.address,
  invoice: o.invoice,
  customerNote: o.customerNote,
  shippingNote: o.shippingNote,
  trackingCode: o.trackingCode,
  payments: o.payments.map(({ gateway, amountRial, status, rrn, card, startedAt, doneAt }) => ({ gateway, amountRial, status, rrn, card, startedAt, doneAt })),
  transfer: o.transfer,
  paidAt: o.paidAt ?? null,
  history: o.history,
  createdAt: o.createdAt,
});

const GATEWAY_IDS = ['mellat', 'saman', 'sadad', 'sandbox'] as const;

@Controller()
export class OrdersController {
  constructor(
    @InjectModel(Order.name) private readonly orders: Model<Order>,
    private readonly shop: ShopService,
  ) {}

  private async mine(id: string, user: UserDocument): Promise<OrderDoc> {
    const o = (await this.orders.findOne({ _id: id, user: user._id })) as OrderDoc | null;
    if (!o) throw new NotFoundException('سفارش پیدا نشد.');
    return o;
  }

  /* ───────── Public ───────── */

  /** Prices and availability for the cart page (the cart itself lives in the browser). */
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @HttpCode(200)
  @Post('cart/price')
  async price(@Body({ schema: z.object({ items: cartLines }) }) body: { items: { slug: string; sku: string; qty: number }[] }, @Req() req: Request) {
    const lang = langOf(req);
    const lines = await this.shop.price(body.items, lang);
    return { lines: lines.map((l) => ({ ...l, error: l.error && translateMessage(l.error, lang) })), gateways: this.shop.gatewayList() };
  }

  @Get('shop/gateways')
  gateways() {
    return this.shop.gatewayList();
  }

  /* ───────── Customer ───────── */

  @Throttle({ default: { limit: 10, ttl: 3_600_000 } })
  @UseGuards(CustomerGuard)
  @Post('orders')
  async place(@Body({ schema: checkoutInput }) body: CheckoutInput, @CurrentUser() user: UserDocument, @Req() req: Request) {
    return customerView(await this.shop.place(user._id, body, langOf(req)));
  }

  @UseGuards(CustomerGuard)
  @Get('account/orders')
  async list(@CurrentUser() user: UserDocument) {
    const rows = await this.orders.find({ user: user._id }).sort({ _id: -1 }).limit(200).lean();
    return rows.map((o) => ({ _id: String(o._id), number: o.number, status: o.status, total: o.total, subtotal: o.subtotal, count: o.items.length, createdAt: o.createdAt }));
  }

  @UseGuards(CustomerGuard)
  @Get('account/orders/:id')
  async one(@Param('id', { schema: objectId }) id: string, @CurrentUser() user: UserDocument) {
    return customerView(await this.mine(id, user));
  }

  @Throttle({ default: { limit: 20, ttl: 3_600_000 } })
  @UseGuards(CustomerGuard)
  @HttpCode(200)
  @Post('orders/:id/pay')
  async pay(
    @Param('id', { schema: objectId }) id: string,
    @Body({ schema: z.object({ gateway: z.enum(GATEWAY_IDS) }) }) body: { gateway: GatewayId },
    @CurrentUser() user: UserDocument,
    @Req() req: Request,
  ) {
    const o = await this.mine(id, user);
    return this.shop.startPayment(o, body.gateway, `${req.protocol}://${req.get('host')}`, o.address.phone);
  }

  @Throttle({ default: { limit: 10, ttl: 3_600_000 } })
  @UseGuards(CustomerGuard)
  @HttpCode(200)
  @Post('orders/:id/transfer')
  async transfer(@Param('id', { schema: objectId }) id: string, @Body({ schema: transferInput }) body: z.infer<typeof transferInput>, @CurrentUser() user: UserDocument) {
    const o = await this.mine(id, user);
    await this.shop.reportTransfer(o, body);
    return customerView(o);
  }

  @UseGuards(CustomerGuard)
  @HttpCode(200)
  @Post('orders/:id/cancel')
  async cancel(@Param('id', { schema: objectId }) id: string, @CurrentUser() user: UserDocument) {
    const o = await this.mine(id, user);
    await this.shop.cancelByCustomer(o);
    return customerView(o);
  }

  /* ───────── Bank callbacks ───────── */

  /** Banks post the result here as an HTML form; the browser is then sent to the order page. */
  @SkipCsrf()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @All('payments/:gateway/callback')
  async callback(@Param('gateway') gateway: string, @Req() req: Request, @Res() res: Response) {
    const body = { ...(req.query as Record<string, string>), ...((req.body ?? {}) as Record<string, string>) };
    try {
      res.redirect(303, await this.shop.callback(gateway, body));
    } catch {
      res.redirect(303, '/account');
    }
  }

  /** The sandbox gateway's "bank page" (development and tests only). */
  @Get('payments/sandbox/pay')
  sandboxPage(@Query('token') token: string, @Res() res: Response) {
    const a = this.shop.sandbox()?.attempt(String(token ?? ''));
    if (!a) throw new NotFoundException();
    const esc = (v: string) => v.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);
    const field = (n: string, v: string | number) => `<input type="hidden" name="${n}" value="${esc(String(v))}">`;
    const form = (result: string, label: string, cls: string) =>
      `<form method="post" action="${esc(a.callbackUrl)}">${field('payNo', a.payNo)}${field('token', token)}${field('result', result)}<button class="${cls}">${label}</button></form>`;
    res.type('html').send(
      `<!doctype html><html lang="fa" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>درگاه آزمایشی</title>` +
        `<style>body{font-family:Tahoma,sans-serif;background:#f4f4f4;display:grid;place-items:center;min-height:100vh;margin:0}main{background:#fff;padding:32px;border-radius:12px;box-shadow:0 2px 12px #0002;text-align:center;max-width:360px}b{font-size:22px;display:block;margin:12px 0}div{display:flex;gap:12px;justify-content:center}button{font:inherit;padding:10px 22px;border:0;border-radius:8px;cursor:pointer}.ok{background:#1a7f37;color:#fff}.no{background:#ddd}</style>` +
        `<main><p>درگاه پرداخت آزمایشی — بدون انتقال واقعی پول</p><b>${(a.amountRial / 10).toLocaleString('fa-IR')} تومان</b><div>${form('ok', 'پرداخت موفق', 'ok')}${form('cancel', 'انصراف', 'no')}</div></main></html>`,
    );
  }

  /* ───────── Panel ───────── */

  @UseGuards(StaffGuard)
  @Get('admin/orders')
  async adminList(@Query('status', { schema: z.enum(ORDER_STATUSES).optional() }) status?: OrderStatus) {
    const [items, counts] = await Promise.all([
      this.orders
        .find(status ? { status } : {})
        .sort({ _id: -1 })
        .limit(300)
        .populate('user', 'email name')
        .select('number status payMethod subtotal total createdAt invoice.name address.phone address.city user transfer.ref items.qty')
        .lean(),
      this.orders.aggregate<{ _id: string; n: number }>([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
    ]);
    return { items, counts: Object.fromEntries(counts.map((c) => [c._id, c.n])) };
  }

  @UseGuards(AdminGuard)
  @Get('admin/orders/export.csv')
  async export(@Res() res: Response) {
    const rows = await this.orders.find().sort({ _id: -1 }).populate<{ user: { email: string } | null }>('user', 'email').lean();
    sendCsv(
      res,
      'pipeox-orders',
      ['شماره', 'تاریخ', 'وضعیت', 'خریدار', 'کد/شناسه ملی', 'کد اقتصادی', 'ایمیل', 'تلفن', 'شهر', 'اقلام', 'جمع کالا', 'ارسال', 'مالیات', 'مبلغ کل', 'روش پرداخت', 'کد مرجع'],
      rows.map((o) => [
        o.number, o.createdAt, ORDER_STATUS_FA[o.status], o.invoice.name, o.invoice.nationalId, o.invoice.economicCode, o.user?.email ?? '', o.address.phone, o.address.city,
        o.items.map((i) => `${i.sku}×${i.qty}`).join(' '), o.subtotal, o.shipping ?? '', o.vat ?? '', o.total ?? '',
        o.payMethod === 'online' ? 'آنلاین' : 'واریز', o.payments.find((p) => p.status === 'paid')?.rrn ?? o.transfer?.ref ?? '',
      ]),
    );
  }

  @UseGuards(StaffGuard)
  @Get('admin/orders/:id')
  async adminOne(@Param('id', { schema: objectId }) id: string) {
    const o = await this.orders.findById(id).populate('user', 'email name phone company').lean();
    if (!o) throw new NotFoundException();
    // Bank tokens stay on the server
    for (const p of o.payments) (p as { token?: string }).token = undefined;
    return o;
  }

  @UseGuards(StaffGuard)
  @Patch('admin/orders/:id')
  async adminUpdate(@Param('id', { schema: objectId }) id: string, @Body({ schema: adminOrderUpdate }) body: z.infer<typeof adminOrderUpdate>, @CurrentAdmin() admin: AdminDocument) {
    const o = (await this.orders.findById(id)) as OrderDoc | null;
    if (!o) throw new NotFoundException();
    await this.shop.adminUpdate(o, body, admin.name);
    return this.adminOne(id);
  }
}
