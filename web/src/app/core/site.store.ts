import { inject, Injectable, signal } from '@angular/core';
import { ApiService } from './http/api.service';
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

/** Site-wide settings (texts, contact, stats), loaded once at startup — see app.config.ts. */
@Injectable({ providedIn: 'root' })
export class SiteStore {
  private readonly api = inject(ApiService);
  readonly settings = signal<SiteSettings>(EMPTY);

  async load(): Promise<void> {
    try {
      this.settings.set(await this.api.site());
    } catch {
      // keep defaults: the page still renders, content sections fill in once the API is back
    }
  }

  /** Replace after the admin saves settings, so the open tab updates without reload. */
  set(value: SiteSettings) {
    this.settings.set(value);
  }
}
