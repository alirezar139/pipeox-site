import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { z } from 'zod';
import { imagePath, normalizeDigits, requiredText, text } from '../../common/utils/text.js';

/** Reference projects shown on /projects (the "featured" section appears once there is one). */
@Schema({ timestamps: true, collection: 'projects' })
export class Project {
  @Prop({ required: true }) title: string;
  @Prop({ default: '' }) client: string;
  @Prop({ default: '' }) year: string;
  @Prop({ default: '' }) industry: string;
  @Prop({ default: '' }) scope: string;
  @Prop({ default: '' }) image: string;
  @Prop({ default: 0 }) sort: number;
  @Prop({ default: true }) published: boolean;
}
export const ProjectSchema = SchemaFactory.createForClass(Project);

export const projectInput = z.object({
  title: requiredText(200, 'عنوان پروژه را وارد کنید.'),
  client: text(150).default(''),
  year: text(20).transform(normalizeDigits).default(''),
  industry: text(100).default(''),
  scope: text(2000).default(''),
  image: imagePath,
  sort: z.coerce.number().int().min(-9999).max(9999).default(0),
  published: z.boolean().default(true),
});
export type ProjectInput = z.infer<typeof projectInput>;
