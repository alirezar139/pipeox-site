import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthStore } from '../../core/auth.store';
import { toAsciiDigits } from '../../core/format';
import { ApiService } from '../../core/http/api.service';
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
  imports: [FormsModule, IconComponent, RouterLink, CaptchaComponent],
  host: { class: 'quote glass', '[attr.id]': 'anchor() ? "contact" : null' },
  template: `
    <h2>{{ title() }}</h2>
    <p>برای دریافت اطلاعات بیشتر با ما در ارتباط باشید.</p>

    @if (sent()) {
      <div class="quote-done" role="status">
        <span class="quote-done-icon"><app-icon name="check-circle" /></span>
        <b>درخواست شما ثبت شد.</b>
        <p>کارشناسان ما به‌زودی با شما تماس می‌گیرند.@if (auth.user()) { وضعیت را در <a routerLink="/account">حساب من</a> دنبال کنید.}</p>
        <button type="button" class="btn btn-ghost btn-block" (click)="reset()">ثبت درخواست دیگر</button>
      </div>
    } @else {
      <form class="formgrid" (ngSubmit)="submit()" novalidate>
        <label class="field" [class.invalid]="error()?.field === 'name'">
          <app-icon name="user" />
          <input name="name" [(ngModel)]="name" required maxlength="100" autocomplete="name" placeholder="نام و نام خانوادگی" aria-label="نام و نام خانوادگی" [attr.aria-invalid]="error()?.field === 'name' || null">
        </label>
        <label class="field" [class.invalid]="error()?.field === 'phone'">
          <app-icon name="phone" />
          <input name="phone" [(ngModel)]="phone" required type="tel" inputmode="tel" maxlength="30" autocomplete="tel" placeholder="شماره تماس" aria-label="شماره تماس" [attr.aria-invalid]="error()?.field === 'phone' || null">
        </label>
        <label class="field">
          <app-icon name="list" />
          <select name="category" [(ngModel)]="category" aria-label="گروه محصول موردنظر">
            <option value="">گروه محصول موردنظر</option>
            @for (p of products(); track p._id) { <option [value]="p.title">{{ p.title }}</option> }
            <option value="تأمین پروژه">تأمین پروژه</option>
          </select>
        </label>
        <label class="field field-area">
          <app-icon name="doc" />
          <textarea name="details" [(ngModel)]="details" rows="3" maxlength="3000" aria-label="توضیحات"
            placeholder="استاندارد، سایز، گرید، مقدار یا توضیح پروژه"></textarea>
        </label>
        <label class="field file-field" [class.has-file]="file()" [class.invalid]="error()?.field === 'attachment'">
          <app-icon name="clip" />
          <input type="file" [accept]="accept" (change)="pick($event)">
          <span class="file-label">{{ file()?.name ?? 'پیوست لیست متریال یا دیتاشیت (اختیاری)' }}</span>
        </label>
        <div class="hp" aria-hidden="true"><label>Website <input name="website" [(ngModel)]="website" tabindex="-1" autocomplete="off"></label></div>
        <app-captcha [invalid]="error()?.field === 'captcha'" />
        <button class="btn btn-block" type="submit" [disabled]="busy()">
          <app-icon name="send" /><span>{{ busy() ? 'در حال ارسال...' : 'ارسال درخواست' }}</span>
        </button>
      </form>
      <div class="formnote">PDF، Excel، Word یا تصویر تا ۸ مگابایت</div>
      @if (error(); as e) { <div class="status" data-type="error" role="alert">{{ e.message }}</div> }
    }
  `,
})
export class QuoteFormComponent {
  protected readonly auth = inject(AuthStore);
  private readonly api = inject(ApiService);
  private readonly site = inject(SiteStore);

  readonly heading = input<string>();
  readonly selectedProduct = input('');
  readonly products = input<Product[]>([]);
  /** Gives the card id="contact" (target of in-page links). */
  readonly anchor = input(false);

  protected readonly title = computed(() => this.heading() ?? 'درخواست مشاوره و استعلام');
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
    this.error.set(f && f.size > MAX_MB * 1024 * 1024 ? { statusCode: 413, message: `حداکثر حجم فایل ${MAX_MB} مگابایت است.`, field: 'attachment' } : null);
    this.file.set(this.error() ? null : f);
  }

  async submit() {
    const phoneDigits = toAsciiDigits(this.phone()).replace(/\D/g, '');
    if (this.name().trim().length < 2) return this.error.set({ statusCode: 400, message: 'لطفاً نام خود را وارد کنید.', field: 'name' });
    if (phoneDigits.length < 8) return this.error.set({ statusCode: 400, message: 'شماره تماس معتبر نیست.', field: 'phone' });

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
      this.error.set({ ...err, message: err.message + (tel && err.statusCode >= 500 ? ` در صورت فوریت با ${tel} تماس بگیرید.` : '') });
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
