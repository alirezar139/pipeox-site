import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { z } from 'zod';
import { text } from '../../common/utils/text.js';

export const CHAT_STATUSES = ['open', 'closed'] as const;
export type ChatStatus = (typeof CHAT_STATUSES)[number];
/** A conversation stops accepting messages beyond this (start a new one). */
export const MAX_MESSAGES = 300;

@Schema({ _id: false })
export class ChatMessage {
  @Prop({ required: true, enum: ['visitor', 'staff'] }) from: 'visitor' | 'staff';
  @Prop({ required: true, maxlength: 2000 }) text: string;
  @Prop({ required: true }) at: Date;
  /** Panel user's display name on staff replies. */
  @Prop({ default: '' }) by: string;
}

/** Live support conversation between a site visitor and the team (answered from the panel). */
@Schema({ timestamps: true, collection: 'chats' })
export class Chat {
  /** sha256 of the visitor's secret token; the token itself only lives in the visitor's browser. */
  @Prop({ required: true, select: false }) tokenHash: string;
  @Prop({ default: '' }) name: string;
  /** Phone or email, so the team can follow up if the visitor leaves. */
  @Prop({ default: '' }) contact: string;
  @Prop({ default: 'fa' }) lang: string;
  @Prop({ default: '' }) page: string;
  @Prop({ default: '', select: false }) ip: string;
  @Prop({ default: '', select: false }) userAgent: string;
  @Prop({ type: Types.ObjectId, ref: 'User', default: null }) user: Types.ObjectId | null;
  @Prop({ type: [SchemaFactory.createForClass(ChatMessage)], default: [] }) messages: ChatMessage[];
  /** Visitor messages the team has not opened yet. */
  @Prop({ default: 0, index: true }) unread: number;
  @Prop({ default: 'open', enum: CHAT_STATUSES, index: true }) status: ChatStatus;
  @Prop({ default: () => new Date(), index: true }) lastAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
export const ChatSchema = SchemaFactory.createForClass(Chat);

const message = text(2000).pipe(z.string().min(1, 'پیام خالی است.'));

export const startInput = z.object({
  text: message,
  name: text(100).default(''),
  contact: text(190).default(''),
  page: text(200).default(''),
  website: z.string().max(200).optional(), // honeypot
});
export const messageInput = z.object({ text: message });
export const statusInput = z.object({ status: z.enum(CHAT_STATUSES) });
