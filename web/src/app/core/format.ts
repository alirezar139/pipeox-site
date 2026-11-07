import { Pipe, PipeTransform } from '@angular/core';

const numFmt = new Intl.NumberFormat('fa-IR');
const dateLong = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Tehran' });
const dateShort = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Tehran' });
const dateTime = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tehran' });

/** Persian digits: 1405 → ۱۴۰۵ (keeps other characters). */
export const faDigits = (v: string | number) => String(v).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d]);
export const faNumber = (n: number) => numFmt.format(n);

/** «۲۱ مهر ۱۴۰۵» · short: «۱۴۰۵/۰۷/۲۱» · time: «۲۱ مهر ۱۴۰۵، ۱۴:۳۰» */
export function faDate(value: string | Date | null | undefined, style: 'long' | 'short' | 'time' = 'long'): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return (style === 'short' ? dateShort : style === 'time' ? dateTime : dateLong).format(d);
}

@Pipe({ name: 'faDate' })
export class FaDatePipe implements PipeTransform {
  transform(value: string | Date | null | undefined, style: 'long' | 'short' | 'time' = 'long') {
    return faDate(value, style);
  }
}

@Pipe({ name: 'faNum' })
export class FaNumPipe implements PipeTransform {
  transform(value: string | number | null | undefined) {
    if (value === null || value === undefined || value === '') return '';
    return typeof value === 'number' ? faNumber(value) : faDigits(value);
  }
}

/** Persian/Arabic digits → ASCII (form input). */
export const toAsciiDigits = (s: string) => s.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
