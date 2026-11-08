import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { z } from 'zod';
import { i18nInput } from '../../common/i18n.js';
import { imagePath, requiredText, text } from '../../common/utils/text.js';

@Schema({ timestamps: true, collection: 'articles' })
export class Article {
  @Prop({ required: true, unique: true }) slug: string;
  @Prop({ required: true }) title: string;
  @Prop({ default: '' }) description: string;
  @Prop({ default: '' }) category: string;
  @Prop({ default: '' }) image: string;
  @Prop({ default: '' }) imageAlt: string;
  @Prop({ default: true }) showCover: boolean;
  /** Sanitized HTML (see common/utils/html.ts). */
  @Prop({ default: '' }) body: string;
  /** Future date = scheduled: hidden until then. */
  @Prop({ required: true, index: true }) publishedAt: Date;
  @Prop({ default: true, index: true }) published: boolean;
  /** Translations: { en: { title, description, category, imageAlt, body }, de: {...} } (body sanitized). */
  @Prop({ type: Object, default: {} }) i18n: Record<string, { body?: string } & Record<string, unknown>>;
  createdAt: Date;
  updatedAt: Date;
}
export const ArticleSchema = SchemaFactory.createForClass(Article);

export const articleInput = z.object({
  slug: z
    .string()
    .max(80)
    .transform((v) => v.trim().toLowerCase())
    .pipe(z.string().regex(/^$|^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'نامک فقط حروف انگلیسی کوچک، عدد و خط تیره است.'))
    .default(''),
  title: requiredText(200, 'عنوان مطلب را وارد کنید.'),
  description: text(400).default(''),
  category: text(60).default(''),
  image: imagePath,
  imageAlt: text(150).default(''),
  showCover: z.boolean().default(true),
  body: z.string().max(400_000).default(''),
  publishedAt: z.coerce.date().default(() => new Date()),
  published: z.boolean().default(true),
  i18n: i18nInput(
    z.object({ title: text(200), description: text(400), category: text(60), imageAlt: text(150), body: z.string().max(400_000) }).partial(),
  ),
});
export type ArticleInput = z.infer<typeof articleInput>;
