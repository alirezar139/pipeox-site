import { z } from 'zod';
import { i18nInput } from '../../common/i18n.js';
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
  /** Online shop: VAT, the seller block printed on invoices, and the account for bank transfers. */
  shop: z
    .object({
      vatPercent: z.coerce.number().min(0).max(30).default(10),
      seller: z
        .object({
          legalName: text(150).default(''),
          nationalId: text(20).default(''),
          economicCode: text(20).default(''),
          regNo: text(20).default(''),
          address: text(300).default(''),
          postalCode: text(20).default(''),
          phone: text(40).default(''),
        })
        .prefault({}),
      bank: z
        .object({
          name: text(80).default(''),
          holder: text(150).default(''),
          account: text(40).default(''),
          sheba: z.string().trim().max(40).regex(/^$|^IR\d{24}$/, 'شماره شبا باید با IR و ۲۴ رقم باشد.').default(''),
          card: text(30).default(''),
        })
        .prefault({}),
    })
    .prefault({}),
  /** Translations of the text fields (numbers, icons, links and contact details are shared). */
  i18n: i18nInput(
    z
      .object({
        site: z.object({ name: text(60), title: text(150), description: text(300) }).partial(),
        contact: z.object({ address: text(300), hours: text(150) }).partial(),
        hero: z.object({ kicker: text(80), title: text(80), titleAccent: text(80), text: text(400) }).partial(),
        showcase: z.object({ title: text(80), text: text(300) }).partial(),
        stats: z.array(z.object({ label: text(60) }).partial()).max(3),
        features: z.array(z.object({ title: text(60), text: text(80) }).partial()).max(3),
        projects: z.object({ title: text(80), text: text(300) }).partial(),
        newsletter: z.object({ title: text(80), text: text(300) }).partial(),
      })
      .partial(),
  ),
});

export type SiteSettings = z.infer<typeof settingsSchema>;
export const SETTINGS_ICONS = ICONS;
