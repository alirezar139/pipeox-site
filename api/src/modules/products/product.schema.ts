import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { z } from 'zod';
import { i18nInput } from '../../common/i18n.js';
import { imagePath, requiredText, slug, text } from '../../common/utils/text.js';

/** The homepage artwork has four fixed label slots: a (top right), b (top left), c (bottom left), d (bottom right). */
export const ORBIT_SLOTS = ['', 'a', 'b', 'c', 'd'] as const;

@Schema({ _id: false })
class ProductType {
  @Prop({ required: true }) name: string;
  @Prop({ default: '' }) desc: string;
}

@Schema({ _id: false })
class ProductSpec {
  @Prop({ required: true }) label: string;
  @Prop({ default: '' }) value: string;
}

/** Sale units of a shop variant (labels live in the website's messages). */
export const UNITS = ['piece', 'meter', 'length', 'kg', 'set'] as const;
export type Unit = (typeof UNITS)[number];

/**
 * A size/grade of the product that is sold online at a fixed price.
 * Products without active variants stay inquiry-only.
 */
@Schema({ _id: false })
export class ProductVariant {
  /** Stock-keeping code, unique within the product (e.g. API5L-B-6-SCH40). */
  @Prop({ required: true }) sku: string;
  /** Technical description shown to buyers (sizes and grades read the same in every language). */
  @Prop({ required: true }) title: string;
  @Prop({ required: true, enum: UNITS, default: 'piece' }) unit: Unit;
  /** Unit price in Toman, before VAT. */
  @Prop({ required: true, min: 0 }) price: number;
  /** Units on hand; null = made to order / not tracked. */
  @Prop({ type: Number, default: null }) stock: number | null;
  @Prop({ default: 1, min: 1 }) minQty: number;
  @Prop({ default: true }) active: boolean;
}

@Schema({ timestamps: true, collection: 'products' })
export class Product {
  @Prop({ required: true, unique: true }) slug: string;
  @Prop({ required: true }) title: string;
  @Prop({ default: '' }) shortTitle: string;
  @Prop({ default: '' }) code: string;
  @Prop({ default: '' }) summary: string;
  @Prop({ default: '' }) intro: string;
  @Prop({ default: '' }) image: string;
  @Prop({ default: '' }) alt: string;
  @Prop({ default: '' }) keywords: string;
  @Prop({ default: '', enum: ORBIT_SLOTS }) orbit: string;
  @Prop({ type: [SchemaFactory.createForClass(ProductType)], default: [] }) types: ProductType[];
  @Prop({ type: [SchemaFactory.createForClass(ProductSpec)], default: [] }) specs: ProductSpec[];
  @Prop({ type: [String], default: [] }) applications: string[];
  @Prop({ type: [SchemaFactory.createForClass(ProductVariant)], default: [] }) variants: ProductVariant[];
  @Prop({ default: 0, index: true }) sort: number;
  @Prop({ default: true, index: true }) published: boolean;
  /** Translations: { en: {...}, de: {...} } with the same text fields (see productTranslation). */
  @Prop({ type: Object, default: {} }) i18n: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}
export const ProductSchema = SchemaFactory.createForClass(Product);

export const productInput = z.object({
  slug,
  title: requiredText(150, 'عنوان محصول را وارد کنید.'),
  shortTitle: text(40).default(''),
  code: text(60).default(''),
  summary: text(400).default(''),
  intro: text(3000).default(''),
  image: imagePath,
  alt: text(150).default(''),
  keywords: text(500).default(''),
  orbit: z.enum(ORBIT_SLOTS).default(''),
  types: z.array(z.object({ name: text(120).pipe(z.string().min(1)), desc: text(300).default('') })).max(30).default([]),
  specs: z.array(z.object({ label: text(120).pipe(z.string().min(1)), value: text(400).default('') })).max(40).default([]),
  applications: z.array(text(150).pipe(z.string().min(1))).max(40).default([]),
  variants: z
    .array(
      z.object({
        sku: z.string().trim().max(40).regex(/^[A-Za-z0-9][A-Za-z0-9._/-]*$/, 'کد کالا (SKU) فقط حروف انگلیسی، عدد و . _ / - است.'),
        title: text(150).pipe(z.string().min(1, 'عنوان هر ردیف فروش را وارد کنید.')),
        unit: z.enum(UNITS).default('piece'),
        price: z.coerce.number().int().min(1000, 'قیمت باید دست‌کم ۱٬۰۰۰ تومان باشد.').max(100_000_000_000),
        stock: z.coerce.number().int().min(0).max(10_000_000).nullable().default(null),
        minQty: z.coerce.number().int().min(1).max(100_000).default(1),
        active: z.boolean().default(true),
      }),
    )
    .max(100)
    .default([])
    .refine((v) => new Set(v.map((x) => x.sku.toUpperCase())).size === v.length, 'کد کالا (SKU) در هر محصول باید یکتا باشد.'),
  sort: z.coerce.number().int().min(-9999).max(9999).default(0),
  published: z.boolean().default(true),
  i18n: i18nInput(
    z.object({
      title: text(150),
      shortTitle: text(40),
      summary: text(400),
      intro: text(3000),
      alt: text(150),
      keywords: text(500),
      types: z.array(z.object({ name: text(120), desc: text(300) }).partial()).max(30),
      specs: z.array(z.object({ label: text(120), value: text(400) }).partial()).max(40),
      applications: z.array(text(150)).max(40),
    }).partial(),
  ),
});
export type ProductInput = z.infer<typeof productInput>;
