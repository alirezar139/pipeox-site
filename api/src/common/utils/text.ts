import { z } from 'zod';

const FA_DIGITS: Record<string, string> = {
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
};

/** Persian/Arabic-Indic digits → ASCII ("۰۹۱۲" → "0912"). */
export const normalizeDigits = (s: string) => s.replace(/[۰-۹٠-٩]/g, (d) => FA_DIGITS[d] ?? d);

/** Strips control characters and trims. */
export const cleanText = (s: string) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();

export const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* ───────── Reusable Zod field types ───────── */

/** Trimmed, control-char-free text with a max length. */
export const text = (max: number) => z.string().max(max * 2).transform(cleanText).pipe(z.string().max(max));
export const requiredText = (max: number, message: string) => text(max).pipe(z.string().min(2, message));

/** Phone: Persian digits accepted, 8–15 digits, only + - ( ) and spaces besides digits. */
export const phone = z
  .string()
  .max(40)
  .transform((v) => normalizeDigits(cleanText(v)))
  .refine((v) => /^[\d\s+\-()]+$/.test(v) && v.replace(/\D/g, '').length >= 8 && v.replace(/\D/g, '').length <= 15, {
    message: 'شماره تماس معتبر نیست.',
  });

export const email = z
  .string()
  .max(190)
  .transform((v) => cleanText(v).toLowerCase())
  .pipe(z.email('ایمیل معتبر نیست.'));

export const password = z.string().min(8, 'رمز عبور باید حداقل ۸ کاراکتر باشد.').max(200, 'رمز عبور بیش از حد طولانی است.');

/** URL slug: lowercase latin, digits, hyphens. */
export const slug = z
  .string()
  .max(80)
  .transform((v) => v.trim().toLowerCase())
  .pipe(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'نامک فقط حروف انگلیسی کوچک، عدد و خط تیره است.'));

/** Image reference: a bundled asset or an uploaded file. */
export const imagePath = z
  .string()
  .max(300)
  .regex(/^$|^\/(assets|api\/media)\/[A-Za-z0-9/._-]+$/, 'مسیر تصویر نامعتبر است.')
  .default('');

export const objectId = z.string().regex(/^[a-f0-9]{24}$/, 'شناسه نامعتبر است.');
