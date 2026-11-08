import { inject, Injectable, signal } from '@angular/core';
import { ApiService } from './http/api.service';
import { I18n, type Lang } from './i18n';
import type { SiteSettings } from './models';

const EMPTY: SiteSettings = {
  site: { name: 'PIPEOX', nameFa: 'پایپ‌اکس', url: '', title: 'PIPEOX', description: '' },
  contact: { phone: '', email: '', whatsapp: '', address: '', hours: '' },
  hero: { kicker: '', title: '', titleAccent: '', text: '' },
  showcase: { title: '', text: '' },
  stats: [],
  features: [],
  projects: { title: '', text: '', video: '' },
  newsletter: { title: '', text: '' },
};

/** Site-wide settings (texts, contact, stats) in the current language — loaded at startup (app.config.ts) and again on a language switch (app.routes.ts). */
@Injectable({ providedIn: 'root' })
export class SiteStore {
  private readonly api = inject(ApiService);
  private readonly i18n = inject(I18n);
  readonly settings = signal<SiteSettings>(EMPTY);
  /** Language of the loaded texts. */
  loadedLang: Lang | null = null;

  async load(): Promise<void> {
    try {
      const lang = this.i18n.lang();
      this.settings.set(await this.api.site());
      this.loadedLang = lang;
    } catch {
      // keep defaults: the page still renders, content sections fill in once the API is back
    }
  }

  /** Replace after the admin saves settings, so the open tab updates without reload. */
  set(value: SiteSettings) {
    this.settings.set(value);
  }
}
