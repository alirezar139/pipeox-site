import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

@Schema({ timestamps: true, collection: 'users' })
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true, maxlength: 190 })
  email: string;

  @Prop({ required: true, select: false })
  passwordHash: string;

  @Prop({ required: true, maxlength: 100 })
  name: string;

  @Prop({ default: '', maxlength: 40 })
  phone: string;

  @Prop({ default: '', maxlength: 150 })
  company: string;

  @Prop({ default: true })
  active: boolean;

  /** Bumped on password change/reset — invalidates every existing session. */
  @Prop({ default: 0 })
  tokenVersion: number;

  @Prop()
  lastLoginAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);

/** One-time password-reset tokens (only the SHA-256 is stored). Expire automatically. */
@Schema({ collection: 'password_resets' })
export class PasswordReset {
  @Prop({ required: true, unique: true })
  tokenHash: string;

  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true, expires: 0 })
  expiresAt: Date;
}
export const PasswordResetSchema = SchemaFactory.createForClass(PasswordReset);

/** Public shape of an account (never the hash). */
export const toAccount = (u: User & { _id: unknown }) => ({
  id: String(u._id),
  email: u.email,
  name: u.name,
  phone: u.phone,
  company: u.company,
});
