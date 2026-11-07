import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/http/api.service';
import { SiteStore } from '../core/site.store';
import { LogoComponent } from './logo.component';
import { NAV } from './nav';

@Component({
  selector: 'app-footer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, FormsModule, LogoComponent],
  host: { class: 'site-footer' },
  template: `
    <div class="footer-glow" aria-hidden="true"></div>
    <div class="wrap-footer footer-main">
      <nav class="footer-links" aria-label="پیوندهای پایین صفحه">
        @for (item of nav; track item.path) { <a [routerLink]="item.path">{{ item.label }}</a> }
      </nav>
      <form class="newsletter" (ngSubmit)="subscribe()" novalidate>
        <div class="newsletter-field">
          <input type="email" name="email" [(ngModel)]="email" dir="ltr" placeholder="ایمیل شما" aria-label="ایمیل شما" required autocomplete="email">
          <input class="hp-input" name="website" [(ngModel)]="website" tabindex="-1" autocomplete="off" aria-hidden="true">
          <button type="submit" [disabled]="busy()">عضویت</button>
        </div>
        <div class="newsletter-copy">
          <b>{{ s().newsletter.title }}</b>
          <span>{{ s().newsletter.text }}</span>
        </div>
        @if (status(); as st) { <p class="newsletter-status" role="status" [attr.data-type]="st.type">{{ st.text }}</p> }
      </form>
      <app-logo />
    </div>
    @if (hasContact()) {
      <div class="wrap-footer footer-contact">
        @if (s().contact.phone) { <a [href]="'tel:' + tel(s().contact.phone)" dir="ltr">{{ s().contact.phone }}</a> }
        @if (s().contact.email) { <a [href]="'mailto:' + s().contact.email" dir="ltr">{{ s().contact.email }}</a> }
        @if (s().contact.whatsapp) { <a [href]="'https://wa.me/' + tel(s().contact.whatsapp)" rel="noopener" target="_blank">واتساپ</a> }
        @if (s().contact.address) { <span>{{ s().contact.address }}</span> }
      </div>
    }
    <div class="copyright">
      <div class="wrap-footer"><span dir="ltr">© {{ year }} Pipeox. All rights reserved.</span></div>
    </div>
  `,
})
export class FooterComponent {
  protected readonly nav = NAV;
  protected readonly s = inject(SiteStore).settings;
  private readonly api = inject(ApiService);
  protected readonly year = new Date().getFullYear();
  protected readonly hasContact = computed(() => {
    const c = this.s().contact;
    return !!(c.phone || c.email || c.whatsapp || c.address);
  });
  protected email = '';
  protected website = '';
  protected readonly busy = signal(false);
  protected readonly status = signal<{ type: 'ok' | 'error'; text: string } | null>(null);

  protected tel = (v: string) => v.replace(/[^\d+]/g, '');

  async subscribe() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(this.email.trim())) {
      return this.status.set({ type: 'error', text: 'لطفاً یک ایمیل معتبر وارد کنید.' });
    }
    this.busy.set(true);
    try {
      await this.api.subscribe(this.email.trim(), this.website);
      this.email = '';
      this.status.set({ type: 'ok', text: 'عضویت شما ثبت شد. ممنون!' });
    } catch (e) {
      this.status.set({ type: 'error', text: (e as { message: string }).message });
    } finally {
      this.busy.set(false);
    }
  }
}
