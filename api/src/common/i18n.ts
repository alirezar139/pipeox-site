import type { Request } from 'express';
import { z } from 'zod';

/**
 * Site languages. Persian is the base language: every document stores its Persian
 * content in the regular fields and its translations in `i18n.en` / `i18n.de`.
 * The admin panel itself stays Persian.
 */
export const LANGS = ['fa', 'en', 'de'] as const;
export type Lang = (typeof LANGS)[number];
export const TRANSLATIONS = ['en', 'de'] as const;

/** The visitor's language: X-Lang header (sent by the website), else ?lang=, else Persian. */
export function langOf(req: Request): Lang {
  const v = String(req.get('x-lang') ?? req.query?.['lang'] ?? 'fa').toLowerCase();
  return (LANGS as readonly string[]).includes(v) ? (v as Lang) : 'fa';
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date);

/**
 * Lays a translation over the Persian base. Empty strings and empty arrays in the
 * translation keep the Persian value, so a half-translated document still renders fully.
 * Arrays of objects merge item by item (e.g. stats keep their number and icon, take the label).
 */
export function mergeLocale<T>(base: T, tr: unknown): T {
  if (tr === undefined || tr === null || tr === '') return base;
  if (Array.isArray(base)) {
    if (!Array.isArray(tr) || !tr.length) return base;
    if (base.some(isObj) || tr.some(isObj)) {
      return tr.map((t, i) => mergeLocale((base[i] ?? {}) as unknown, t)) as T;
    }
    return tr as T;
  }
  if (isObj(base)) {
    if (!isObj(tr)) return base;
    const out: Record<string, unknown> = { ...base };
    for (const [k, v] of Object.entries(tr)) out[k] = mergeLocale(base[k], v);
    return out as T;
  }
  if (isObj(tr) || Array.isArray(tr)) return base;
  return tr as T;
}

/** A document in the requested language, without its `i18n` block. */
export function localize<T extends { i18n?: unknown }>(doc: T, lang: Lang): Omit<T, 'i18n'> {
  const { i18n, ...rest } = doc;
  if (lang === 'fa') return rest;
  return mergeLocale(rest, (i18n as Record<string, unknown> | undefined)?.[lang]);
}

/** `i18n` input for a model: optional en/de objects shaped by the given translation schema. */
export const i18nInput = <S extends z.ZodType>(tr: S) => z.object({ en: tr.optional(), de: tr.optional() }).default({});

/* ───────── API messages shown to visitors ───────── */

const MESSAGES: Record<string, { en: string; de: string }> = {
  'ابتدا وارد حساب خود شوید.': { en: 'Please sign in to your account first.', de: 'Bitte melden Sie sich zuerst an.' },
  'ابتدا وارد شوید.': { en: 'Please sign in first.', de: 'Bitte melden Sie sich zuerst an.' },
  'ایمیل معتبر نیست.': { en: 'The email address is not valid.', de: 'Die E-Mail-Adresse ist ungültig.' },
  'ایمیل یا رمز عبور اشتباه است.': { en: 'Incorrect email or password.', de: 'E-Mail oder Passwort ist falsch.' },
  'این حساب غیرفعال شده است. با پشتیبانی تماس بگیرید.': { en: 'This account has been disabled. Please contact support.', de: 'Dieses Konto wurde deaktiviert. Bitte wenden Sie sich an den Support.' },
  'این پیوند نامعتبر است یا منقضی شده است.': { en: 'This link is invalid or has expired.', de: 'Dieser Link ist ungültig oder abgelaufen.' },
  'با این ایمیل قبلاً حساب ساخته شده است. وارد شوید یا رمز را بازیابی کنید.': {
    en: 'An account with this email already exists. Sign in or reset your password.',
    de: 'Mit dieser E-Mail-Adresse existiert bereits ein Konto. Melden Sie sich an oder setzen Sie Ihr Passwort zurück.',
  },
  'تعداد درخواست‌ها زیاد است. لطفاً کمی بعد دوباره تلاش کنید.': { en: 'Too many requests. Please try again in a little while.', de: 'Zu viele Anfragen. Bitte versuchen Sie es etwas später erneut.' },
  'حجم فایل بیش از حد مجاز است.': { en: 'The file is too large.', de: 'Die Datei ist zu groß.' },
  'خطای داخلی سرور. لطفاً دوباره تلاش کنید.': { en: 'Server error. Please try again.', de: 'Serverfehler. Bitte versuchen Sie es erneut.' },
  'درخواست نامعتبر است.': { en: 'Invalid request.', de: 'Ungültige Anfrage.' },
  'دسترسی مجاز نیست.': { en: 'Access denied.', de: 'Zugriff verweigert.' },
  'رمز عبور باید حداقل ۸ کاراکتر باشد.': { en: 'The password must be at least 8 characters.', de: 'Das Passwort muss mindestens 8 Zeichen lang sein.' },
  'رمز عبور بیش از حد طولانی است.': { en: 'The password is too long.', de: 'Das Passwort ist zu lang.' },
  'رمز عبور فعلی درست نیست.': { en: 'The current password is not correct.', de: 'Das aktuelle Passwort ist nicht korrekt.' },
  'شماره تماس معتبر نیست.': { en: 'The phone number is not valid.', de: 'Die Telefonnummer ist ungültig.' },
  'فقط فایل‌های PDF، Excel، Word، CSV یا تصویر پذیرفته می‌شوند.': { en: 'Only PDF, Excel, Word, CSV or image files are accepted.', de: 'Nur PDF-, Excel-, Word-, CSV- oder Bilddateien werden akzeptiert.' },
  'لطفاً نام خود را وارد کنید.': { en: 'Please enter your name.', de: 'Bitte geben Sie Ihren Namen ein.' },
  'محصول پیدا نشد.': { en: 'Product not found.', de: 'Produkt nicht gefunden.' },
  'مطلب پیدا نشد.': { en: 'Article not found.', de: 'Artikel nicht gefunden.' },
  'گفت‌وگو پیدا نشد.': { en: 'Conversation not found.', de: 'Unterhaltung nicht gefunden.' },
  'پیام خالی است.': { en: 'The message is empty.', de: 'Die Nachricht ist leer.' },
  'این گفت‌وگو طولانی شده است. لطفاً گفت‌وگوی تازه‌ای شروع کنید.': { en: 'This conversation is too long. Please start a new one.', de: 'Diese Unterhaltung ist zu lang. Bitte beginnen Sie eine neue.' },
  'پیدا نشد.': { en: 'Not found.', de: 'Nicht gefunden.' },
  'پیوند نامعتبر است.': { en: 'Invalid link.', de: 'Ungültiger Link.' },
  'کد امنیتی درست نیست. کد جدید را وارد کنید.': { en: 'The security code is not correct. Please enter the new code.', de: 'Der Sicherheitscode ist falsch. Bitte geben Sie den neuen Code ein.' },
};

/** Visitor-facing API messages in the visitor's language (unknown messages stay as they are). */
export function translateMessage(message: string, lang: Lang): string {
  return lang === 'fa' ? message : (MESSAGES[message]?.[lang] ?? message);
}
