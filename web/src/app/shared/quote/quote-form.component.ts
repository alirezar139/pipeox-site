import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthStore } from '../../core/auth.store';
import { toAsciiDigits } from '../../core/format';
import { ApiService } from '../../core/http/api.service';
import { I18n, LinkPipe, TPipe } from '../../core/i18n';
import type { ApiError, Product } from '../../core/models';
import { SiteStore } from '../../core/site.store';
import { CaptchaComponent } from '../captcha.component';
import { IconComponent } from '../icon.component';

const MAX_MB = 8;
const ACCEPT = '.pdf,.xlsx,.xls,.docx,.doc,.csv,.jpg,.jpeg,.png';

/**
 * Inquiry card (contact page and product pages).
 * Logged-in customers get name/phone prefilled and the inquiry is linked to their account.
 */
@Component({
  selector: 'app-quote-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, IconComponent, RouterLink, CaptchaComponent, TPipe, LinkPipe],
  host: { class: 'quote glass', '[attr.id]': 'anchor() ? "contact" : null' },
  template: `
    <h2>{{ title() }}</h2>
    <p>{{ 'quote.lead' | t }}</p>

    @if (sent()) {
      <div class="quote-done" role="status">
        <span class="quote-done-icon"><app-icon name="check-circle" /></span>
        <b>{{ 'quote.sent' | t }}</b>
        <p>{{ 'quote.sentText' | t }}@if (auth.user()) {{{ 'quote.trackPre' | t }}<a [routerLink]="'/account' | link">{{ 'acc.mine' | t }}</a>{{ 'quote.trackPost' | t }}}</p>
        <button type="button" class="btn btn-ghost btn-block" (click)="reset()">{{ 'quote.another' | t }}</button>
      </div>
    } @else {
      <form class="formgrid" (ngSubmit)="submit()" novalidate>
        <label class="field" [class.invalid]="error()?.field === 'name'">
          <app-icon name="user" />
          <input name="name" [(ngModel)]="name" required maxlength="100" autocomplete="name" [placeholder]="'quote.name' | t" [attr.aria-label]="'quote.name' | t" [attr.aria-invalid]="error()?.field === 'name' || null">
        </label>
        <label class="field" [class.invalid]="error()?.field === 'phone'">
          <app-icon name="phone" />
          <input name="phone" [(ngModel)]="phone" required type="tel" inputmode="tel" maxlength="30" autocomplete="tel" [placeholder]="'quote.phone' | t" [attr.aria-label]="'quote.phone' | t" [attr.aria-invalid]="error()?.field === 'phone' || null">
        </label>
        <label class="field">
          <app-icon name="list" />
          <select name="category" [(ngModel)]="category" [attr.aria-label]="'quote.category' | t">
            <option value="">{{ 'quote.category' | t }}</option>
            @for (p of products(); track p._id) { <option [value]="p.title">{{ p.title }}</option> }
            <option [value]="'quote.projectSupply' | t">{{ 'quote.projectSupply' | t }}</option>
          </select>
        </label>
        <label class="field field-area">
          <app-icon name="doc" />
          <textarea name="details" [(ngModel)]="details" rows="3" maxlength="3000" [attr.aria-label]="'quote.details' | t"
            [placeholder]="'quote.detailsHint' | t"></textarea>
        </label>
        <label class="field file-field" [class.has-file]="file()" [class.invalid]="error()?.field === 'attachment'">
          <app-icon name="clip" />
          <input type="file" [accept]="accept" (change)="pick($event)">
          <span class="file-label">{{ file()?.name ?? ('quote.attach' | t) }}</span>
        </label>
        <div class="hp" aria-hidden="true"><label>Website <input name="website" [(ngModel)]="website" tabindex="-1" autocomplete="off"></label></div>
        <app-captcha [invalid]="error()?.field === 'captcha'" />
        <button class="btn btn-block" type="submit" [disabled]="busy()">
          <app-icon name="send" /><span>{{ (busy() ? 'quote.sending' : 'quote.send') | t }}</span>
        </button>
      </form>
      <div class="formnote">{{ 'quote.fileNote' | t }}</div>
      @if (error(); as e) { <div class="status" data-type="error" role="alert">{{ e.message }}</div> }
    }
  `,
})
export class QuoteFormComponent {
  protected readonly auth = inject(AuthStore);
  private readonly api = inject(ApiService);
  private readonly site = inject(SiteStore);
  private readonly i18n = inject(I18n);

  readonly heading = input<string>();
  readonly selectedProduct = input('');
  readonly products = input<Product[]>([]);
  /** Gives the card id="contact" (target of in-page links). */
  readonly anchor = input(false);

  protected readonly title = computed(() => this.heading() ?? this.i18n.t('quote.title'));
  protected readonly accept = ACCEPT;

  protected readonly name = signal('');
  protected readonly phone = signal('');
  protected readonly category = signal('');
  protected readonly details = signal('');
  protected readonly website = signal('');
  protected readonly file = signal<File | null>(null);
  protected readonly busy = signal(false);
  protected readonly sent = signal(false);
  protected readonly error = signal<ApiError | null>(null);
  private readonly captcha = viewChild(CaptchaComponent);

  constructor() {
    effect(() => this.category.set(this.selectedProduct()));
    effect(() => {
      const u = this.auth.user();
      if (u) {
        if (!untracked(this.name)) this.name.set(u.name);
        if (!untracked(this.phone)) this.phone.set(u.phone);
      }
    });
  }

  pick(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0] ?? null;
    this.error.set(f && f.size > MAX_MB * 1024 * 1024 ? { statusCode: 413, message: this.i18n.t('quote.fileTooBig', { n: MAX_MB }), field: 'attachment' } : null);
    this.file.set(this.error() ? null : f);
  }

  async submit() {
    const phoneDigits = toAsciiDigits(this.phone()).replace(/\D/g, '');
    if (this.name().trim().length < 2) return this.error.set({ statusCode: 400, message: this.i18n.t('quote.needName'), field: 'name' });
    if (phoneDigits.length < 8) return this.error.set({ statusCode: 400, message: this.i18n.t('quote.badPhone'), field: 'phone' });

    const data = new FormData();
    data.set('name', this.name());
    data.set('phone', this.phone());
    data.set('category', this.category());
    data.set('details', this.details());
    data.set('page', location.pathname);
    data.set('website', this.website());
    const cap = this.captcha()?.fields();
    if (cap) {
      data.set('captchaId', cap.captchaId);
      data.set('captcha', cap.captcha);
    }
    const f = this.file();
    if (f) data.set('attachment', f);

    this.busy.set(true);
    this.error.set(null);
    try {
      await this.api.sendInquiry(data);
      this.sent.set(true);
    } catch (e) {
      const err = e as ApiError;
      void this.captcha()?.reload(); // each captcha is single-use
      const tel = this.site.settings().contact.phone;
      this.error.set({ ...err, message: err.message + (tel && err.statusCode >= 500 ? this.i18n.t('quote.urgent', { tel }) : '') });
    } finally {
      this.busy.set(false);
    }
  }

  reset() {
    this.details.set('');
    this.file.set(null);
    this.sent.set(false);
  }
}
