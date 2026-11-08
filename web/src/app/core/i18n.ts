import { DOCUMENT } from '@angular/common';
import { computed, inject, Injectable, Pipe, PipeTransform, REQUEST, signal } from '@angular/core';
import { MESSAGES, type MessageKey } from './messages';

/**
 * Site languages. Persian lives at /, English at /en/..., German at /de/...
 * Everything a visitor sees switches with the language: UI texts (messages.ts), content from
 * the API (?lang=), dates and digits, text direction. The admin panel stays Persian.
 */
export type Lang = 'fa' | 'en' | 'de';
export const LANG_LIST: Lang[] = ['fa', 'en', 'de'];
export const LANG_META: Record<Lang, { label: string; short: string; dir: 'rtl' | 'ltr'; locale: string; og: string }> = {
  fa: { label: 'فارسی', short: 'FA', dir: 'rtl', locale: 'fa-IR', og: 'fa_IR' },
  en: { label: 'English', short: 'EN', dir: 'ltr', locale: 'en-GB', og: 'en_GB' },
  de: { label: 'Deutsch', short: 'DE', dir: 'ltr', locale: 'de-DE', og: 'de_DE' },
};

/** Language of a URL path: /en/... → en, /de/... → de, anything else → fa. */
export function langFromPath(path: string): Lang {
  const m = /^\/(en|de)(?=\/|\?|#|$)/.exec(path);
  return (m?.[1] as Lang | undefined) ?? 'fa';
}

/** The same page without its language prefix: /en/products/x → /products/x. */
export function stripLang(url: string): string {
  const rest = url.replace(/^\/(en|de)(?=\/|\?|#|$)/, '');
  return rest.startsWith('/') ? rest : `/${rest}`;
}

@Injectable({ providedIn: 'root' })
export class I18n {
  private readonly doc = inject(DOCUMENT);
  private readonly request = inject(REQUEST, { optional: true });

  /** Set from the URL at startup and by the language route guard on every navigation. */
  readonly lang = signal<Lang>(langFromPath(this.request ? new URL(this.request.url).pathname : (this.doc.location?.pathname ?? '/')));
  readonly meta = computed(() => LANG_META[this.lang()]);
  readonly rtl = computed(() => this.meta().dir === 'rtl');

  /** Switch language; updates <html lang dir> (also during server rendering). */
  set(lang: Lang) {
    this.lang.set(lang);
    const html = this.doc.documentElement;
    html.setAttribute('lang', lang);
    html.setAttribute('dir', LANG_META[lang].dir);
  }

  /** Translated UI text. `{name}` placeholders are filled from params. Missing keys fall back to Persian. */
  t(key: MessageKey, params?: Record<string, string | number>): string {
    const entry = MESSAGES[key] as { fa: string; en: string; de: string } | undefined;
    let text: string = entry ? (entry[this.lang()] ?? entry.fa) : key;
    if (params) for (const [k, v] of Object.entries(params)) text = text.replaceAll(`{${k}}`, String(v));
    return text;
  }

  /** Site path in the current language: /products → /en/products (Persian keeps it as is). */
  link(path: string, lang: Lang = this.lang()): string {
    if (lang === 'fa') return path;
    return path === '/' ? `/${lang}` : `/${lang}${path}`;
  }

  /** The current page in another language (keeps query and fragment). */
  switchUrl(currentUrl: string, lang: Lang): string {
    return this.link(stripLang(currentUrl), lang).replace(/^\/(en|de)\/(?=[?#]|$)/, '/$1');
  }
}

/** {{ 'key' | t }} · {{ 'key' | t: { n: 3 } }} */
@Pipe({ name: 't', pure: false })
export class TPipe implements PipeTransform {
  private readonly i18n = inject(I18n);
  transform(key: MessageKey, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }
}

/** [routerLink]="'/products' | link" — adds the language prefix. */
@Pipe({ name: 'link', pure: false })
export class LinkPipe implements PipeTransform {
  private readonly i18n = inject(I18n);
  transform(path: string): string {
    return this.i18n.link(path);
  }
}
