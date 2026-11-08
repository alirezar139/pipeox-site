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
