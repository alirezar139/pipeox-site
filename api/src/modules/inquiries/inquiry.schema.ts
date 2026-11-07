import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { z } from 'zod';
import { phone, requiredText, text } from '../../common/utils/text.js';

/** Internal workflow; customers see CUSTOMER_STATUS labels instead. */
export const STATUSES = ['new', 'contacted', 'quoted', 'won', 'closed'] as const;
export type InquiryStatus = (typeof STATUSES)[number];

@Schema({ _id: false })
class Attachment {
  @Prop({ required: true }) stored: string;
  @Prop({ required: true }) name: string;
  @Prop({ required: true }) size: number;
}

@Schema({ timestamps: true, collection: 'inquiries' })
export class Inquiry {
  @Prop({ required: true }) name: string;
  @Prop({ required: true }) phone: string;
  @Prop({ default: '' }) category: string;
  @Prop({ default: '' }) details: string;
  @Prop({ type: SchemaFactory.createForClass(Attachment), default: null }) attachment: Attachment | null;
  @Prop({ default: '' }) page: string;
  @Prop({ default: '', index: true }) ip: string;
  @Prop({ default: '' }) userAgent: string;
  @Prop({ default: 'new', enum: STATUSES, index: true }) status: InquiryStatus;
  /** Internal note — never shown to the customer. */
  @Prop({ default: '' }) notes: string;
  @Prop({ type: Types.ObjectId, ref: 'User', default: null, index: true }) user: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}
export const InquirySchema = SchemaFactory.createForClass(Inquiry);

export const inquiryInput = z.object({
  name: requiredText(100, 'لطفاً نام خود را وارد کنید.'),
  phone,
  category: text(100).default(''),
  details: text(3000).default(''),
  page: text(200).default(''),
  website: z.string().max(200).optional(), // honeypot
});
export type InquiryInput = z.infer<typeof inquiryInput>;

export const inquiryUpdate = z.object({ status: z.enum(STATUSES), notes: text(2000).default('') });
