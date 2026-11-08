import { inject, Pipe, PipeTransform } from '@angular/core';
import { I18n, type Lang } from './i18n';

type DateStyle = 'long' | 'short' | 'time';

/** Persian: Solar Hijri calendar, Persian digits, Tehran time. English/German: Gregorian, Latin digits. */
const LOCALE: Record<Lang, string> = { fa: 'fa-IR-u-ca-persian', en: 'en-GB', de: 'de-DE' };
const STYLES: Record<DateStyle, Intl.DateTimeFormatOptions> = {
  long: { day: 'numeric', month: 'long', year: 'numeric' },
  short: { year: 'numeric', month: '2-digit', day: '2-digit' },
  time: { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' },
};
const dateFormats = new Map<string, Intl.DateTimeFormat>();
const numberFormats = new Map<Lang, Intl.NumberFormat>();

/** Persian digits: 1405 → ۱۴۰۵ (keeps other characters). */
export const faDigits = (v: string | number) => String(v).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d]);

export function formatNumber(n: number, lang: Lang = 'fa'): string {
  let f = numberFormats.get(lang);
  if (!f) numberFormats.set(lang, (f = new Intl.NumberFormat(lang === 'fa' ? 'fa-IR' : LOCALE[lang])));
  return f.format(n);
}
export const faNumber = (n: number) => formatNumber(n, 'fa');

/** fa: «۲۱ مهر ۱۴۰۵» · en: «12 October 2026» · de: «12. Oktober 2026» (short/time variants too). */
export function formatDate(value: string | Date | null | undefined, style: DateStyle = 'long', lang: Lang = 'fa'): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const key = `${lang}:${style}`;
  let f = dateFormats.get(key);
  if (!f) dateFormats.set(key, (f = new Intl.DateTimeFormat(LOCALE[lang], { ...STYLES[style], timeZone: 'Asia/Tehran' })));
  return f.format(d);
}
export const faDate = (value: string | Date | null | undefined, style: DateStyle = 'long') => formatDate(value, style, 'fa');

/** Date in the current site language (the admin panel is always Persian). */
@Pipe({ name: 'faDate', pure: false })
export class FaDatePipe implements PipeTransform {
  private readonly i18n = inject(I18n);
  transform(value: string | Date | null | undefined, style: DateStyle = 'long') {
    return formatDate(value, style, this.i18n.lang());
  }
}

/** Number (or digits inside text) in the current site language. */
@Pipe({ name: 'faNum', pure: false })
export class FaNumPipe implements PipeTransform {
  private readonly i18n = inject(I18n);
  transform(value: string | number | null | undefined) {
    if (value === null || value === undefined || value === '') return '';
    const lang = this.i18n.lang();
    if (typeof value === 'number') return formatNumber(value, lang);
    return lang === 'fa' ? faDigits(value) : value;
  }
}

/** Persian/Arabic digits → ASCII (form input). */
export const toAsciiDigits = (s: string) => s.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));

/** Amount in Toman in the site language: «۱۲٬۵۰۰٬۰۰۰ تومان» · «12,500,000 Toman». */
@Pipe({ name: 'toman', pure: false })
export class TomanPipe implements PipeTransform {
  private readonly i18n = inject(I18n);
  transform(value: number | null | undefined): string {
    if (value === null || value === undefined) return '—';
    const lang = this.i18n.lang();
    return `${formatNumber(value, lang)} ${lang === 'fa' ? 'تومان' : 'Toman'}`;
  }
}
