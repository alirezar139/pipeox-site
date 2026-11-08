import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

/** admin: everything in the panel. developer: the same plus the technical "System" page. */
export const ADMIN_ROLES = ['admin', 'developer'] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

@Schema({ timestamps: true, collection: 'admins' })
export class Admin {
  @Prop({ required: true, unique: true, lowercase: true, trim: true, maxlength: 40 })
  username: string;

  @Prop({ required: true, select: false })
  passwordHash: string;

  @Prop({ required: true, maxlength: 100 })
  name: string;

  @Prop({ required: true, enum: ADMIN_ROLES, default: 'admin' })
  role: AdminRole;

  @Prop({ default: true })
  active: boolean;

  /** Bumped on password change, deactivation or role change — ends that user's sessions. */
  @Prop({ default: 0 })
  tokenVersion: number;

  @Prop()
  lastLoginAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

export type AdminDocument = HydratedDocument<Admin>;
export const AdminSchema = SchemaFactory.createForClass(Admin);

/** Public shape of an admin user (never the hash). */
export const toAdmin = (a: Admin & { _id: unknown }) => ({
  id: String(a._id),
  username: a.username,
  name: a.name,
  role: a.role,
  active: a.active,
  lastLoginAt: a.lastLoginAt ?? null,
  createdAt: a.createdAt,
});
