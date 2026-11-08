import { DOCUMENT } from '@angular/common';
import { inject, Injectable, REQUEST } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { I18n, LANG_LIST } from './i18n';
import { SiteStore } from './site.store';

export interface PageMeta {
  /** Page title without the site name; omit on the homepage. */
  title?: string;
  description?: string;
  /** Path of this page without a language prefix, e.g. /products/steel-pipes */
  path: string;
  image?: string;
  type?: 'website' | 'article';
  /** Extra JSON-LD objects (breadcrumbs are built from `breadcrumbs`). */
  jsonLd?: object[];
  breadcrumbs?: { label: string; url: string }[];
  /** Account/admin pages: keep out of search results. */
  noindex?: boolean;
}

/**
 * Per-page <title>, description, canonical, Open Graph / Twitter tags and JSON-LD.
 * Rendered on the server, so crawlers see complete metadata without running JS.
 */
@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly doc = inject(DOCUMENT);
  private readonly titleSvc = inject(Title);
  private readonly meta = inject(Meta);
  private readonly site = inject(SiteStore);
  private readonly request = inject(REQUEST, { optional: true });
  private readonly i18n = inject(I18n);

  /** Public origin: the configured domain, else the current request/page origin. */
  origin(): string {
    const configured = this.site.settings().site.url;
    if (configured) return configured.replace(/\/$/, '');
    if (this.request) return new URL(this.request.url).origin;
    return this.doc.location?.origin ?? '';
  }

  set(page: PageMeta): void {
    const s = this.site.settings();
    const title = page.title ? `${page.title} | ${s.site.name}` : s.site.title;
    const description = page.description || s.site.description;
    const url = this.origin() + this.i18n.link(page.path);
    const image = this.origin() + (page.image || '/assets/img/home/hero-pipes.jpg');

    this.titleSvc.setTitle(title);
    const tags: Record<string, string> = {
      description,
      'og:title': title,
      'og:description': description,
      'og:type': page.type ?? 'website',
      'og:url': url,
      'og:image': image,
      'og:site_name': s.site.name,
      'og:locale': this.i18n.meta().og,
      'twitter:card': 'summary_large_image',
      'twitter:title': title,
      'twitter:description': description,
      'twitter:image': image,
    };
    for (const [key, content] of Object.entries(tags)) {
      const attr = key.startsWith('og:') ? 'property' : 'name';
      this.meta.updateTag({ [attr]: key, content }, `${attr}="${key}"`);
    }
    if (page.noindex) this.meta.updateTag({ name: 'robots', content: 'noindex, nofollow' });
    else this.meta.removeTag('name="robots"');

    this.setLink('canonical', url);
    // The same page in every language (+ x-default → Persian)
    this.doc.head.querySelectorAll('link[rel="alternate"][hreflang]').forEach((n) => n.remove());
    if (!page.noindex) {
      for (const l of [...LANG_LIST, 'x-default' as const]) {
        const el = this.doc.createElement('link');
        el.rel = 'alternate';
        el.hreflang = l;
        el.href = this.origin() + this.i18n.link(page.path, l === 'x-default' ? 'fa' : l);
        this.doc.head.appendChild(el);
      }
    }

    const ld: object[] = [...(page.jsonLd ?? [])];
    if (page.breadcrumbs?.length) {
      ld.push({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: page.breadcrumbs.map((b, i) => ({ '@type': 'ListItem', position: i + 1, name: b.label, item: this.origin() + this.i18n.link(b.url) })),
      });
    }
    this.setJsonLd(ld);
  }

  /** Organization data for the homepage. */
  organization(): object {
    const s = this.site.settings();
    return Object.fromEntries(
      Object.entries({
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: s.site.name,
        alternateName: s.site.nameFa,
        description: s.site.description,
        url: this.origin() + this.i18n.link('/'),
        logo: this.origin() + '/favicon.svg',
        email: s.contact.email,
        telephone: s.contact.phone,
        address: s.contact.address,
      }).filter(([, v]) => v),
    );
  }

  private setLink(rel: string, href: string) {
    let el = this.doc.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
    if (!el) {
      el = this.doc.createElement('link');
      el.rel = rel;
      this.doc.head.appendChild(el);
    }
    el.href = href;
  }

  private setJsonLd(objects: object[]) {
    this.doc.head.querySelectorAll('script[data-seo]').forEach((n) => n.remove());
    for (const obj of objects) {
      const el = this.doc.createElement('script');
      el.type = 'application/ld+json';
      el.setAttribute('data-seo', '');
      // JSON in a script tag: escape "<" so content can never close the tag
      el.textContent = JSON.stringify(obj).replace(/</g, '\\u003c');
      this.doc.head.appendChild(el);
    }
  }
}
