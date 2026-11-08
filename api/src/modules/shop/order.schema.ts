import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { z } from 'zod';
import { normalizeDigits, phone, requiredText, text } from '../../common/utils/text.js';
import { UNITS, type Unit } from '../products/product.schema.js';

/**
 * review            → the team checks the order and sets the shipping cost
 * awaiting_payment  → totals are final; the customer pays online or by bank transfer
 * paid → processing → shipped → delivered;  cancelled at any point before shipping
 */
export const ORDER_STATUSES = ['review', 'awaiting_payment', 'paid', 'processing', 'shipped', 'delivered', 'cancelled'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export const PAY_METHODS = ['online', 'transfer'] as const;
export type PayMethod = (typeof PAY_METHODS)[number];

@Schema({ _id: false })
export class OrderItem {
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true }) product: Types.ObjectId;
  @Prop({ required: true }) slug: string;
  @Prop({ required: true }) productTitle: string;
  @Prop({ required: true }) sku: string;
  @Prop({ required: true }) title: string;
  @Prop({ required: true, enum: UNITS }) unit: Unit;
  /** Toman, at the time of ordering. */
  @Prop({ required: true }) price: number;
  @Prop({ required: true }) qty: number;
  @Prop({ required: true }) total: number;
  /** Whether stock was taken for this line (given back on cancel). */
  @Prop({ default: false }) stockTaken: boolean;
}

@Schema({ _id: false })
export class Address {
  @Prop({ required: true }) name: string;
  @Prop({ required: true }) phone: string;
  @Prop({ required: true }) province: string;
  @Prop({ required: true }) city: string;
  @Prop({ required: true }) address: string;
  @Prop({ default: '' }) postalCode: string;
}

@Schema({ _id: false })
export class InvoiceInfo {
  @Prop({ required: true, enum: ['personal', 'company'] }) type: 'personal' | 'company';
  /** Person or company name on the invoice. */
  @Prop({ required: true }) name: string;
  /** National code (person) or national ID (company). */
  @Prop({ default: '' }) nationalId: string;
  @Prop({ default: '' }) economicCode: string;
  @Prop({ default: '' }) regNo: string;
}

@Schema({ _id: false })
export class Payment {
  /** Unique number sent to the bank as its order id. */
  @Prop({ required: true }) payNo: number;
  @Prop({ required: true }) gateway: string;
  @Prop({ required: true }) amountRial: number;
  @Prop({ required: true, enum: ['pending', 'paid', 'failed'], default: 'pending' }) status: 'pending' | 'paid' | 'failed';
  @Prop({ default: '' }) token: string;
  @Prop({ default: '' }) rrn: string;
  @Prop({ default: '' }) trace: string;
  @Prop({ default: '' }) card: string;
  @Prop({ default: '' }) message: string;
  @Prop({ required: true }) startedAt: Date;
  @Prop() doneAt?: Date;
}

@Schema({ _id: false })
export class TransferReport {
  /** Bank reference / tracking number the customer reports. */
  @Prop({ required: true }) ref: string;
  @Prop({ default: '' }) paidOn: string;
  @Prop({ default: '' }) note: string;
  @Prop({ required: true }) at: Date;
}

@Schema({ _id: false })
export class StatusChange {
  @Prop({ required: true }) status: string;
  @Prop({ required: true }) at: Date;
  /** Panel user's name, or "customer" / "bank". */
  @Prop({ default: '' }) by: string;
}

@Schema({ timestamps: true, collection: 'orders' })
export class Order {
  /** Human order number (1001, 1002, …). */
  @Prop({ required: true, unique: true }) number: number;
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true }) user: Types.ObjectId;
  @Prop({ required: true, enum: ORDER_STATUSES, default: 'review', index: true }) status: OrderStatus;
  @Prop({ required: true, enum: PAY_METHODS }) payMethod: PayMethod;
  @Prop({ type: [SchemaFactory.createForClass(OrderItem)], default: [] }) items: OrderItem[];
  /** Toman. shipping/vat/total stay null until the team sets the shipping cost. */
  @Prop({ required: true }) subtotal: number;
  @Prop({ type: Number, default: null }) shipping: number | null;
  @Prop({ required: true }) vatPercent: number;
  @Prop({ type: Number, default: null }) vat: number | null;
  @Prop({ type: Number, default: null }) total: number | null;
  @Prop({ type: SchemaFactory.createForClass(Address), required: true }) address: Address;
  @Prop({ type: SchemaFactory.createForClass(InvoiceInfo), required: true }) invoice: InvoiceInfo;
  @Prop({ default: '' }) customerNote: string;
  /** Internal, panel only. */
  @Prop({ default: '' }) staffNote: string;
  /** Shown to the customer (e.g. "freight paid on delivery"). */
  @Prop({ default: '' }) shippingNote: string;
  @Prop({ default: '' }) trackingCode: string;
  @Prop({ type: [SchemaFactory.createForClass(Payment)], default: [] }) payments: Payment[];
  @Prop({ type: SchemaFactory.createForClass(TransferReport), default: null }) transfer: TransferReport | null;
  @Prop() paidAt?: Date;
  @Prop({ default: 'fa' }) lang: string;
  @Prop({ type: [SchemaFactory.createForClass(StatusChange)], default: [] }) history: StatusChange[];
  createdAt: Date;
  updatedAt: Date;
}
export const OrderSchema = SchemaFactory.createForClass(Order);
OrderSchema.index({ 'payments.payNo': 1 }, { unique: true, sparse: true });

/* ───────── Inputs ───────── */

const digits = (max: number, message: string) =>
  z.string().max(max * 2).transform((v) => normalizeDigits(v).replace(/[\s-]/g, '')).pipe(z.string().regex(new RegExp(`^(\\d{1,${max}})?$`), message));

export const cartLines = z
  .array(z.object({ slug: z.string().max(80), sku: z.string().max(40), qty: z.coerce.number().int().min(1).max(1_000_000) }))
  .min(1, 'سبد خرید خالی است.')
  .max(50, 'تعداد اقلام سبد خرید بیش از حد مجاز است.');

export const checkoutInput = z.object({
  items: cartLines,
  payMethod: z.enum(PAY_METHODS),
  address: z.object({
    name: requiredText(100, 'نام تحویل‌گیرنده را وارد کنید.'),
    phone,
    province: requiredText(40, 'استان را وارد کنید.'),
    city: requiredText(60, 'شهر را وارد کنید.'),
    address: requiredText(300, 'نشانی کامل را وارد کنید.'),
    postalCode: digits(10, 'کد پستی باید ۱۰ رقم باشد.').refine((v) => !v || v.length === 10, 'کد پستی باید ۱۰ رقم باشد.').default(''),
  }),
  invoice: z
    .object({
      type: z.enum(['personal', 'company']),
      name: requiredText(150, 'نام خریدار برای فاکتور را وارد کنید.'),
      nationalId: digits(11, 'کد ملی یا شناسه ملی معتبر نیست.').default(''),
      economicCode: digits(14, 'کد اقتصادی معتبر نیست.').default(''),
      regNo: text(20).default(''),
    })
    .refine((v) => v.type === 'personal' || v.nationalId.length === 11, { message: 'شناسه ملی شرکت باید ۱۱ رقم باشد.', path: ['nationalId'] })
    .refine((v) => v.type === 'company' || !v.nationalId || v.nationalId.length === 10, { message: 'کد ملی باید ۱۰ رقم باشد.', path: ['nationalId'] }),
  note: text(1000).default(''),
});
export type CheckoutInput = z.infer<typeof checkoutInput>;

export const transferInput = z.object({
  ref: requiredText(40, 'شماره پیگیری واریز را وارد کنید.'),
  paidOn: text(30).default(''),
  note: text(500).default(''),
});

export const adminOrderUpdate = z.object({
  status: z.enum(ORDER_STATUSES).optional(),
  /** Setting the shipping cost (Toman) finalises the totals and asks the customer to pay. */
  shipping: z.coerce.number().int().min(0).max(10_000_000_000).optional(),
  shippingNote: text(300).optional(),
  staffNote: text(2000).optional(),
  trackingCode: text(80).optional(),
});
