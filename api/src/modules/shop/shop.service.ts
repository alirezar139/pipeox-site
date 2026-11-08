import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { trusted, type Connection, type Model, type Types } from 'mongoose';
import type { Lang } from '../../common/i18n.js';
import type { Env } from '../../config/env.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { Product, type ProductVariant, type Unit } from '../products/product.schema.js';
import { SettingsService } from '../settings/settings.service.js';
import { User } from '../users/user.schema.js';
import { GatewayError, type GatewayId, type PaymentGateway, type Redirect } from './gateways/gateway.js';
import { MellatGateway } from './gateways/mellat.js';
import { SadadGateway } from './gateways/sadad.js';
import { SamanGateway } from './gateways/saman.js';
import { SandboxGateway } from './gateways/sandbox.js';
import { Order, type CheckoutInput, type OrderStatus } from './order.schema.js';

export type OrderDoc = InstanceType<Model<Order>> & { _id: Types.ObjectId };

export interface PricedLine {
  slug: string;
  sku: string;
  qty: number;
  productTitle: string;
  title: string;
  unit: Unit;
  price: number;
  total: number;
  minQty: number;
  /** null = not tracked (made to order). */
  stock: number | null;
  image: string;
  /** Why this line cannot be ordered as it is (Persian message, translated by the filter). */
  error: string;
}

const STATUS_FA: Record<OrderStatus, string> = {
  review: 'در انتظار بررسی و تعیین هزینه ارسال',
  awaiting_payment: 'در انتظار پرداخت',
  paid: 'پرداخت‌شده',
  processing: 'در حال آماده‌سازی',
  shipped: 'ارسال‌شده',
  delivered: 'تحویل‌شده',
  cancelled: 'لغوشده',
};
export const ORDER_STATUS_FA = STATUS_FA;

const LOCALE: Record<Lang, string> = { fa: 'fa-IR', en: 'en-US', de: 'de-DE' };
const money = (n: number, lang: Lang) => `${n.toLocaleString(LOCALE[lang])} ${lang === 'fa' ? 'تومان' : 'Toman'}`;
const prefix = (lang: string) => (lang === 'en' || lang === 'de' ? `/${lang}` : '');

/** Customer emails about their order, in their language. */
const MAIL: Record<'awaiting_payment' | 'paid' | 'shipped', Record<Lang, (o: Order, link: string) => { subject: string; text: string }>> = {
  awaiting_payment: {
    fa: (o, link) => ({
      subject: `سفارش ${o.number} — آماده پرداخت`,
      text: `با سلام\n\nبررسی سفارش شماره ${o.number} انجام شد و مبلغ نهایی ${money(o.total ?? 0, 'fa')} (شامل هزینه ارسال و مالیات بر ارزش افزوده) است.\nبرای پرداخت و مشاهده پیش‌فاکتور به نشانی زیر مراجعه کنید:\n${link}\n\nبا احترام\nپایپ‌اکس`,
    }),
    en: (o, link) => ({
      subject: `Order ${o.number} — ready for payment`,
      text: `Hello,\n\nWe have reviewed order no. ${o.number}. The final amount is ${money(o.total ?? 0, 'en')} (including shipping and VAT).\nTo pay and view the proforma invoice, please visit:\n${link}\n\nKind regards\nPIPEOX`,
    }),
    de: (o, link) => ({
      subject: `Bestellung ${o.number} – bereit zur Zahlung`,
      text: `Guten Tag,\n\nwir haben Bestellung Nr. ${o.number} geprüft. Der Endbetrag beträgt ${money(o.total ?? 0, 'de')} (inkl. Versand und MwSt.).\nZur Zahlung und Proforma-Rechnung:\n${link}\n\nMit freundlichen Grüßen\nPIPEOX`,
    }),
  },
  paid: {
    fa: (o, link) => ({ subject: `سفارش ${o.number} — پرداخت تأیید شد`, text: `با سلام\n\nپرداخت سفارش شماره ${o.number} تأیید شد و سفارش شما برای آماده‌سازی ارسال شد.\nپیگیری سفارش: ${link}\n\nبا احترام\nپایپ‌اکس` }),
    en: (o, link) => ({ subject: `Order ${o.number} — payment confirmed`, text: `Hello,\n\nThe payment for order no. ${o.number} has been confirmed and your order is being prepared.\nTrack your order: ${link}\n\nKind regards\nPIPEOX` }),
    de: (o, link) => ({ subject: `Bestellung ${o.number} – Zahlung bestätigt`, text: `Guten Tag,\n\ndie Zahlung für Bestellung Nr. ${o.number} wurde bestätigt; Ihre Bestellung wird vorbereitet.\nBestellstatus: ${link}\n\nMit freundlichen Grüßen\nPIPEOX` }),
  },
  shipped: {
    fa: (o, link) => ({ subject: `سفارش ${o.number} — ارسال شد`, text: `با سلام\n\nسفارش شماره ${o.number} ارسال شد.${o.trackingCode ? `\nکد رهگیری مرسوله: ${o.trackingCode}` : ''}\nپیگیری سفارش: ${link}\n\nبا احترام\nپایپ‌اکس` }),
    en: (o, link) => ({ subject: `Order ${o.number} — shipped`, text: `Hello,\n\nOrder no. ${o.number} has been shipped.${o.trackingCode ? `\nTracking code: ${o.trackingCode}` : ''}\nTrack your order: ${link}\n\nKind regards\nPIPEOX` }),
    de: (o, link) => ({ subject: `Bestellung ${o.number} – versandt`, text: `Guten Tag,\n\nBestellung Nr. ${o.number} wurde versandt.${o.trackingCode ? `\nSendungsnummer: ${o.trackingCode}` : ''}\nBestellstatus: ${link}\n\nMit freundlichen Grüßen\nPIPEOX` }),
  },
};

@Injectable()
export class ShopService {
  private readonly log = new Logger(ShopService.name);
  readonly gateways = new Map<GatewayId, PaymentGateway>();

  constructor(
    @InjectModel(Order.name) private readonly orders: Model<Order>,
    @InjectModel(Product.name) private readonly products: Model<Product>,
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectConnection() private readonly conn: Connection,
    private readonly settings: SettingsService,
    private readonly notify: NotificationsService,
    private readonly config: ConfigService<Env, true>,
  ) {
    const c = <K extends keyof Env>(k: K) => this.config.get(k, { infer: true });
    if (c('MELLAT_TERMINAL_ID') && c('MELLAT_USERNAME') && c('MELLAT_PASSWORD')) {
      this.gateways.set('mellat', new MellatGateway({ terminalId: c('MELLAT_TERMINAL_ID'), username: c('MELLAT_USERNAME'), password: c('MELLAT_PASSWORD') }));
    }
    if (c('SAMAN_TERMINAL_ID')) this.gateways.set('saman', new SamanGateway({ terminalId: c('SAMAN_TERMINAL_ID') }));
    if (c('SADAD_MERCHANT_ID') && c('SADAD_TERMINAL_ID') && c('SADAD_KEY')) {
      this.gateways.set('sadad', new SadadGateway({ merchantId: c('SADAD_MERCHANT_ID'), terminalId: c('SADAD_TERMINAL_ID'), key: c('SADAD_KEY') }));
    }
    if (c('PAYMENT_SANDBOX')) this.gateways.set('sandbox', new SandboxGateway());
  }

  gatewayList() {
    return [...this.gateways.values()].map((g) => ({ id: g.id, label: g.label }));
  }

  sandbox(): SandboxGateway | null {
    return (this.gateways.get('sandbox') as SandboxGateway | undefined) ?? null;
  }

  private async next(name: 'order' | 'payment'): Promise<number> {
    const r = await this.conn
      .collection<{ _id: string; seq: number }>('counters')
      .findOneAndUpdate({ _id: name }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: 'after' });
    return (name === 'order' ? 1000 : 100_000) + (r?.seq ?? 1);
  }

  /* ───────── Cart ───────── */

  /** Current prices and availability for cart lines (duplicates merged). */
  async price(lines: { slug: string; sku: string; qty: number }[], lang: Lang): Promise<PricedLine[]> {
    const merged = new Map<string, { slug: string; sku: string; qty: number }>();
    for (const l of lines) {
      const key = `${l.slug}|${l.sku.toUpperCase()}`;
      const prev = merged.get(key);
      merged.set(key, { ...l, qty: (prev?.qty ?? 0) + l.qty });
    }
    const slugs = [...new Set([...merged.values()].map((l) => l.slug))];
    const docs = await this.products.find({ slug: trusted({ $in: slugs }), published: true }).lean();
    const bySlug = new Map(docs.map((d) => [d.slug, d]));
    return [...merged.values()].map((l) => {
      const p = bySlug.get(l.slug);
      const v: ProductVariant | undefined = p?.variants?.find((x) => x.sku.toUpperCase() === l.sku.toUpperCase() && x.active);
      const title = p ? ((p.i18n?.[lang] as { title?: string } | undefined)?.title || p.title) : '';
      const base = { slug: l.slug, sku: v?.sku ?? l.sku, qty: l.qty, productTitle: title, image: p?.image ?? '' };
      if (!p || !v) return { ...base, title: '', unit: 'piece', price: 0, total: 0, minQty: 1, stock: 0, error: 'این کالا دیگر برای فروش آنلاین موجود نیست.' };
      let error = '';
      if (l.qty < v.minQty) error = 'مقدار سفارش کمتر از حداقل مجاز است.';
      else if (v.stock !== null && v.stock !== undefined && l.qty > v.stock) error = v.stock > 0 ? 'مقدار سفارش بیشتر از موجودی است.' : 'این کالا در حال حاضر موجود نیست.';
      return { ...base, title: v.title, unit: v.unit, price: v.price, total: v.price * l.qty, minQty: v.minQty, stock: v.stock ?? null, error };
    });
  }

  /* ───────── Orders ───────── */

  async place(userId: Types.ObjectId, input: CheckoutInput, lang: Lang): Promise<OrderDoc> {
    const lines = await this.price(input.items, lang);
    const bad = lines.find((l) => l.error);
    if (bad) throw new BadRequestException({ message: bad.error, field: 'items' });

    // Take stock line by line; undo if any line runs out in the meantime
    const taken: PricedLine[] = [];
    for (const l of lines) {
      if (l.stock === null) continue;
      const r = await this.products.updateOne(
        { slug: l.slug, variants: trusted({ $elemMatch: { sku: l.sku, stock: { $gte: l.qty } } }) },
        { $inc: { 'variants.$.stock': -l.qty } },
      );
      if (!r.modifiedCount) {
        await Promise.all(taken.map((t) => this.giveBack(t.slug, t.sku, t.qty)));
        throw new ConflictException({ message: 'موجودی یکی از اقلام همین حالا تغییر کرد. لطفاً سبد خرید را دوباره بررسی کنید.', field: 'items' });
      }
      taken.push(l);
    }

    const products = await this.products.find({ slug: trusted({ $in: lines.map((l) => l.slug) }) }).select('_id slug').lean();
    const idOf = new Map(products.map((p) => [p.slug, p._id]));
    const subtotal = lines.reduce((s, l) => s + l.total, 0);
    const now = new Date();
    const order = await this.orders.create({
      number: await this.next('order'),
      user: userId,
      status: 'review',
      payMethod: input.payMethod,
      items: lines.map((l) => ({
        product: idOf.get(l.slug), slug: l.slug, productTitle: l.productTitle, sku: l.sku, title: l.title, unit: l.unit, price: l.price, qty: l.qty, total: l.total, stockTaken: l.stock !== null,
      })),
      subtotal,
      vatPercent: (await this.settings.get()).shop?.vatPercent ?? 10,
      address: input.address,
      invoice: input.invoice,
      customerNote: input.note,
      lang,
      history: [{ status: 'review', at: now, by: 'customer' }],
    }).catch(async (e: unknown) => {
      await Promise.all(taken.map((t) => this.giveBack(t.slug, t.sku, t.qty)));
      throw e;
    });
    void this.notify.notifyStaff(
      `سفارش جدید ${order.number}`,
      [
        `سفارش جدید شماره ${order.number}`,
        `خریدار: ${input.invoice.name} — ${input.address.phone}`,
        ...order.items.map((i) => `• ${i.productTitle} | ${i.title} × ${i.qty.toLocaleString('fa-IR')}`),
        `جمع کالاها: ${money(subtotal, 'fa')}`,
        `روش پرداخت: ${input.payMethod === 'online' ? 'آنلاین' : 'واریز بانکی'}`,
        'اقدام: پنل مدیریت › سفارش‌ها (تعیین هزینه ارسال)',
      ].join('\n'),
    );
    return order as OrderDoc;
  }

  private async giveBack(slug: string, sku: string, qty: number) {
    await this.products.updateOne({ slug, variants: trusted({ $elemMatch: { sku, stock: { $ne: null } } }) }, { $inc: { 'variants.$.stock': qty } });
  }

  /** Recompute VAT and total once the shipping cost is known. */
  private finalize(o: OrderDoc, shipping: number) {
    o.shipping = shipping;
    o.vat = Math.round(((o.subtotal + shipping) * o.vatPercent) / 100);
    o.total = o.subtotal + shipping + o.vat;
  }

  private push(o: OrderDoc, status: OrderStatus, by: string) {
    o.status = status;
    o.history.push({ status, at: new Date(), by });
    if (status === 'paid' && !o.paidAt) o.paidAt = new Date();
  }

  async adminUpdate(o: OrderDoc, body: { status?: OrderStatus; shipping?: number; shippingNote?: string; staffNote?: string; trackingCode?: string }, by: string) {
    if (o.status === 'cancelled' && body.status && body.status !== 'cancelled') throw new BadRequestException('سفارش لغوشده را نمی‌توان دوباره فعال کرد.');
    if (body.staffNote !== undefined) o.staffNote = body.staffNote;
    if (body.shippingNote !== undefined) o.shippingNote = body.shippingNote;
    if (body.trackingCode !== undefined) o.trackingCode = body.trackingCode;
    let mail: 'awaiting_payment' | 'paid' | 'shipped' | null = null;

    if (body.shipping !== undefined) {
      if (o.status !== 'review' && o.status !== 'awaiting_payment') throw new BadRequestException('هزینه ارسال فقط پیش از پرداخت قابل تغییر است.');
      this.finalize(o, body.shipping);
      if (o.status === 'review') this.push(o, 'awaiting_payment', by);
      mail = 'awaiting_payment';
    }
    if (body.status && body.status !== o.status) {
      if ((body.status === 'awaiting_payment' || body.status === 'paid') && o.total === null) throw new BadRequestException('ابتدا هزینه ارسال را تعیین کنید.');
      if (body.status === 'cancelled') await this.releaseStock(o);
      this.push(o, body.status, by);
      if (body.status === 'paid' || body.status === 'shipped') mail = body.status;
    }
    await o.save();
    if (mail) void this.mailCustomer(o, mail);
    return o;
  }

  async cancelByCustomer(o: OrderDoc) {
    if (o.status !== 'review' && o.status !== 'awaiting_payment') throw new BadRequestException('این سفارش دیگر قابل لغو نیست.');
    if (o.payments.some((p) => p.status === 'paid')) throw new BadRequestException('این سفارش پرداخت شده است؛ برای لغو با پشتیبانی تماس بگیرید.');
    await this.releaseStock(o);
    this.push(o, 'cancelled', 'customer');
    await o.save();
    void this.notify.notifyStaff(`لغو سفارش ${o.number}`, `سفارش شماره ${o.number} توسط مشتری لغو شد.`);
  }

  private async releaseStock(o: OrderDoc) {
    if (o.status === 'shipped' || o.status === 'delivered') throw new BadRequestException('سفارش ارسال‌شده را نمی‌توان لغو کرد.');
    for (const i of o.items) {
      if (!i.stockTaken) continue;
      await this.giveBack(i.slug, i.sku, i.qty);
      i.stockTaken = false;
    }
  }

  async reportTransfer(o: OrderDoc, body: { ref: string; paidOn: string; note: string }) {
    if (o.status !== 'awaiting_payment') throw new BadRequestException('این سفارش در انتظار پرداخت نیست.');
    if (o.payMethod !== 'transfer') o.payMethod = 'transfer';
    o.transfer = { ...body, at: new Date() };
    await o.save();
    void this.notify.notifyStaff(
      `گزارش واریز سفارش ${o.number}`,
      [`مشتری واریز سفارش ${o.number} را گزارش کرد.`, `مبلغ: ${money(o.total ?? 0, 'fa')}`, `شماره پیگیری: ${body.ref}`, body.paidOn && `تاریخ واریز: ${body.paidOn}`, 'اقدام: بررسی حساب و تأیید پرداخت در پنل › سفارش‌ها']
        .filter(Boolean)
        .join('\n'),
    );
  }

  /* ───────── Online payment ───────── */

  async startPayment(o: OrderDoc, gatewayId: GatewayId, origin: string, mobile: string): Promise<Redirect> {
    const gw = this.gateways.get(gatewayId);
    if (!gw) throw new BadRequestException('این درگاه پرداخت فعال نیست.');
    if (o.status !== 'awaiting_payment' || o.total === null) throw new BadRequestException('این سفارش در انتظار پرداخت نیست.');
    const payNo = await this.next('payment');
    const amountRial = o.total * 10;
    const base = this.config.get('SITE_URL', { infer: true }) || origin;
    let started;
    try {
      started = await gw.start({ payNo, amountRial, callbackUrl: `${base}/api/payments/${gw.id}/callback`, mobile });
    } catch (e) {
      this.log.error(`Payment start failed (${gw.id}): ${String(e)}`);
      throw new BadRequestException('ارتباط با درگاه پرداخت برقرار نشد. لطفاً چند دقیقه بعد دوباره تلاش کنید یا درگاه دیگری را انتخاب کنید.');
    }
    o.payMethod = 'online';
    o.payments.push({ payNo, gateway: gw.id, amountRial, status: 'pending', token: started.token, rrn: '', trace: '', card: '', message: '', startedAt: new Date() });
    await o.save();
    return started.redirect;
  }

  /** The bank sent the customer back: verify, record, and say where to send the browser. */
  async callback(gatewayId: string, body: Record<string, string>): Promise<string> {
    const gw = this.gateways.get(gatewayId as GatewayId);
    if (!gw) throw new NotFoundException();
    const cb = gw.parseCallback(body);
    const o = (await this.orders.findOne({ 'payments.payNo': cb.payNo })) as OrderDoc | null;
    if (!o) throw new NotFoundException('پرداخت پیدا نشد.');
    const pay = o.payments.find((p) => p.payNo === cb.payNo)!;
    const back = (ok: boolean) => `${prefix(o.lang)}/account/orders/${String(o._id)}?pay=${ok ? 'ok' : 'failed'}`;
    if (pay.status !== 'pending') return back(pay.status === 'paid'); // refresh / double post

    let v = { ok: false, rrn: '', trace: '', card: '', message: cb.message ?? '' };
    if (cb.ok) {
      try {
        v = { ...v, ...(await gw.verify({ payNo: pay.payNo, amountRial: pay.amountRial, token: pay.token, callback: cb, body })) };
      } catch (e) {
        v.message = e instanceof GatewayError ? e.message : String(e);
        this.log.error(`Payment verify failed (${gw.id} #${pay.payNo}): ${v.message}`);
      }
    }
    pay.status = v.ok ? 'paid' : 'failed';
    Object.assign(pay, { rrn: v.rrn, trace: v.trace, card: v.card, message: (v.message ?? '').slice(0, 300), doneAt: new Date() });
    if (v.ok && o.status === 'awaiting_payment') this.push(o, 'paid', 'bank');
    await o.save();
    if (v.ok) {
      void this.notify.notifyStaff(
        `پرداخت آنلاین سفارش ${o.number}`,
        [`سفارش ${o.number} آنلاین پرداخت شد.`, `مبلغ: ${money(pay.amountRial / 10, 'fa')}`, `درگاه: ${gw.label.fa}`, `کد مرجع: ${v.rrn}`, 'اقدام: پنل مدیریت › سفارش‌ها (آماده‌سازی و ارسال)'].join('\n'),
      );
      void this.mailCustomer(o, 'paid');
    }
    return back(v.ok);
  }

  /* ───────── Customer email ───────── */

  private async mailCustomer(o: OrderDoc, kind: 'awaiting_payment' | 'paid' | 'shipped') {
    if (!this.notify.emailEnabled) return;
    try {
      const user = await this.users.findById(o.user).select('email').lean();
      if (!user) return;
      const lang = (['fa', 'en', 'de'].includes(o.lang) ? o.lang : 'fa') as Lang;
      const site = this.config.get('SITE_URL', { infer: true });
      const mail = MAIL[kind][lang](o, `${site}${prefix(lang)}/account/orders/${String(o._id)}`);
      await this.notify.sendEmail(user.email, mail.subject, mail.text);
    } catch (e) {
      this.log.warn(`Order email failed (#${o.number}): ${String(e)}`);
    }
  }
}
