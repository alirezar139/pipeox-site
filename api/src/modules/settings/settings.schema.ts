import { z } from 'zod';
import { text } from '../../common/utils/text.js';

/**
 * Site settings — one document. Stored as a validated JSON blob: the shape is owned by
 * this Zod schema, which is also the admin form's contract.
 */
const ICONS = ['trophy', 'check-circle', 'users-solid', 'users', 'headset', 'gear', 'shield', 'doc', 'list', 'phone', 'mail', 'calendar', 'send', 'user'] as const;
const icon = z.enum(ICONS).catch('check-circle');

export const settingsSchema = z.object({
  site: z.object({
    name: text(60),
    nameFa: text(60),
    url: z.string().max(200).regex(/^$|^https?:\/\/[^\s/]+$/, 'آدرس سایت باید فقط دامنه باشد؛ مثلاً https://pipeox.ir'),
    title: text(150),
    description: text(300),
  }),
  contact: z.object({
    phone: text(40),
    email: z.string().max(150).regex(/^$|^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'ایمیل تماس معتبر نیست.'),
    whatsapp: text(40),
    address: text(300),
    hours: text(150),
  }),
  hero: z.object({ kicker: text(80), title: text(80), titleAccent: text(80), text: text(400) }),
  showcase: z.object({ title: text(80), text: text(300) }),
  stats: z.array(z.object({ value: z.coerce.number().int().min(0).max(1_000_000), label: text(60), icon })).max(3),
  features: z.array(z.object({ title: text(60), text: text(80), icon })).max(3),
  projects: z.object({
    title: text(80),
    text: text(300),
    video: z.string().max(500).regex(/^$|^https:\/\//, 'لینک ویدیو باید با https:// شروع شود.'),
  }),
  newsletter: z.object({ title: text(80), text: text(300) }),
});

export type SiteSettings = z.infer<typeof settingsSchema>;
export const SETTINGS_ICONS = ICONS;
