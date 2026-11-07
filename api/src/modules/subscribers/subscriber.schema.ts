import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ timestamps: { createdAt: true, updatedAt: false }, collection: 'subscribers' })
export class Subscriber {
  @Prop({ required: true, unique: true, lowercase: true, trim: true }) email: string;
  @Prop({ default: '' }) ip: string;
  createdAt: Date;
}
export const SubscriberSchema = SchemaFactory.createForClass(Subscriber);
