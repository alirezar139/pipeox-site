import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthStore } from '../../core/auth.store';
import { ApiService } from '../../core/http/api.service';
import type { Account, ApiError } from '../../core/models';
import { SeoService } from '../../core/seo.service';
import { IconComponent } from '../../shared/icon.component';
import { PageHeroComponent } from '../../shared/page-hero.component';

/** Only same-site paths after login (no open redirects). */
const safeNext = (next: string | undefined) => (next && /^\/(?![/\\])/.test(next) ? next : '/account');

abstract class FormPage {
  protected readonly api = inject(ApiService);
  protected readonly auth = inject(AuthStore);
  protected readonly router = inject(Router);
  protected readonly busy = signal(false);
  protected readonly error = signal<ApiError | null>(null);

  protected async run(fn: () => Promise<void>) {
    this.busy.set(true);
    this.error.set(null);
    try {
      await fn();
    } catch (e) {
      this.error.set(e as ApiError);
    } finally {
      this.busy.set(false);
    }
  }
  protected bad = (field: string) => this.error()?.field === field || null;
}

const SHARED = [FormsModule, RouterLink, IconComponent, PageHeroComponent];

@Component({
  selector: 'app-login-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: SHARED,
  template: `
    <app-page-hero heading="ورود به حساب کاربری" eyebrow="CUSTOMER ACCOUNT" lead="درخواست‌های استعلام خود را یک‌جا ببینید و وضعیت آن‌ها را پیگیری کنید." />
    <section class="section section-tight">
      <div class="wrap auth-wrap">
        <form class="auth-card glass" (ngSubmit)="submit()" novalidate>
          <h2>ورود</h2>
          @if (error(); as e) { <p class="notice notice-error" role="alert">{{ e.message }}</p> }
          <label class="field"><app-icon name="mail" /><input type="email" name="email" [(ngModel)]="email" dir="ltr" placeholder="ایمیل" aria-label="ایمیل" autocomplete="email" required></label>
          <label class="field"><app-icon name="lock" /><input type="password" name="password" [(ngModel)]="password" placeholder="رمز عبور" aria-label="رمز عبور" autocomplete="current-password" required></label>
          <button class="btn btn-block" type="submit" [disabled]="busy()"><span>{{ busy() ? 'در حال ورود...' : 'ورود' }}</span></button>
          <div class="auth-links">
            <a routerLink="/account/forgot">رمز عبور را فراموش کرده‌ام</a>
            <span>حساب ندارید؟ <a routerLink="/account/register" [queryParams]="{ next: next() }">ثبت‌نام کنید</a></span>
          </div>
        </form>
      </div>
    </section>
  `,
})
export class LoginPage extends FormPage {
  readonly next = input<string>();
  protected email = '';
  protected password = '';

  constructor() {
    super();
    inject(SeoService).set({ title: 'ورود به حساب کاربری', path: '/account/login', noindex: true });
  }

  submit() {
    return this.run(async () => {
      const r = await this.api.post<{ user: Account }>('/api/auth/login', { email: this.email, password: this.password });
      this.auth.set(r.user);
      await this.router.navigateByUrl(safeNext(this.next()));
    });
  }
}

@Component({
  selector: 'app-register-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: SHARED,
  template: `
    <app-page-hero heading="ساخت حساب کاربری" eyebrow="CUSTOMER ACCOUNT" lead="با حساب کاربری، استعلام‌های شما به‌صورت خودکار ثبت می‌شود و وضعیت هر درخواست را می‌بینید." />
    <section class="section section-tight">
      <div class="wrap auth-wrap">
        <form class="auth-card glass" (ngSubmit)="submit()" novalidate>
          <h2>ثبت‌نام</h2>
          @if (error(); as e) { <p class="notice notice-error" role="alert">{{ e.message }}</p> }
          <label class="field"><app-icon name="user" /><input name="name" [(ngModel)]="f.name" placeholder="نام و نام خانوادگی" aria-label="نام و نام خانوادگی" autocomplete="name" maxlength="100" required [attr.aria-invalid]="bad('name')"></label>
          <label class="field"><app-icon name="mail" /><input type="email" name="email" [(ngModel)]="f.email" dir="ltr" placeholder="ایمیل" aria-label="ایمیل" autocomplete="email" maxlength="190" required [attr.aria-invalid]="bad('email')"></label>
          <label class="field"><app-icon name="phone" /><input type="tel" name="phone" [(ngModel)]="f.phone" inputmode="tel" placeholder="شماره تماس" aria-label="شماره تماس" autocomplete="tel" maxlength="30" required [attr.aria-invalid]="bad('phone')"></label>
          <label class="field"><app-icon name="list" /><input name="company" [(ngModel)]="f.company" placeholder="شرکت / سازمان (اختیاری)" aria-label="شرکت یا سازمان" autocomplete="organization" maxlength="150"></label>
          <label class="field"><app-icon name="lock" /><input type="password" name="password" [(ngModel)]="f.password" placeholder="رمز عبور (حداقل ۸ کاراکتر)" aria-label="رمز عبور" autocomplete="new-password" minlength="8" required [attr.aria-invalid]="bad('password')"></label>
          <div class="hp" aria-hidden="true"><label>Website <input name="website" [(ngModel)]="f.website" tabindex="-1" autocomplete="off"></label></div>
          <button class="btn btn-block" type="submit" [disabled]="busy()"><span>{{ busy() ? 'در حال ساخت حساب...' : 'ساخت حساب' }}</span></button>
          <div class="auth-links"><span>حساب دارید؟ <a routerLink="/account/login">وارد شوید</a></span></div>
        </form>
      </div>
    </section>
  `,
})
export class RegisterPage extends FormPage {
  readonly next = input<string>();
  protected f = { name: '', email: '', phone: '', company: '', password: '', website: '' };

  constructor() {
    super();
    inject(SeoService).set({ title: 'ساخت حساب کاربری', path: '/account/register', noindex: true });
  }

  submit() {
    return this.run(async () => {
      const r = await this.api.post<{ user: Account }>('/api/auth/register', this.f);
      this.auth.set(r.user);
      await this.router.navigateByUrl(safeNext(this.next()), { state: { welcome: true } });
    });
  }
}

@Component({
  selector: 'app-forgot-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: SHARED,
  template: `
    <app-page-hero heading="بازیابی رمز عبور" eyebrow="CUSTOMER ACCOUNT" />
    <section class="section section-tight">
      <div class="wrap auth-wrap">
        <form class="auth-card glass" (ngSubmit)="submit()" novalidate>
          <h2>بازیابی رمز عبور</h2>
          @if (done(); as d) {
            @if (d.emailEnabled) {
              <p class="notice notice-ok">اگر حسابی با این ایمیل وجود داشته باشد، پیوند تعیین رمز جدید تا چند دقیقه دیگر ارسال می‌شود. پوشه هرزنامه را هم بررسی کنید.</p>
            } @else {
              <p class="notice notice-error">ارسال ایمیل هنوز روی سایت فعال نشده است. برای بازیابی رمز با پشتیبانی تماس بگیرید.</p>
            }
          } @else {
            @if (error(); as e) { <p class="notice notice-error" role="alert">{{ e.message }}</p> }
            <p class="auth-hint">ایمیل حساب خود را وارد کنید تا پیوند تعیین رمز جدید برایتان ارسال شود.</p>
            <label class="field"><app-icon name="mail" /><input type="email" name="email" [(ngModel)]="email" dir="ltr" placeholder="ایمیل" aria-label="ایمیل" autocomplete="email" required></label>
            <button class="btn btn-block" type="submit" [disabled]="busy()"><span>ارسال پیوند</span></button>
          }
          <div class="auth-links"><a routerLink="/account/login">بازگشت به ورود</a></div>
        </form>
      </div>
    </section>
  `,
})
export class ForgotPage extends FormPage {
  protected email = '';
  protected readonly done = signal<{ emailEnabled: boolean } | null>(null);

  constructor() {
    super();
    inject(SeoService).set({ title: 'بازیابی رمز عبور', path: '/account/forgot', noindex: true });
  }

  submit() {
    return this.run(async () => {
      this.done.set(await this.api.post<{ emailEnabled: boolean }>('/api/auth/forgot', { email: this.email }));
    });
  }
}

@Component({
  selector: 'app-reset-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: SHARED,
  template: `
    <app-page-hero heading="تعیین رمز عبور جدید" eyebrow="CUSTOMER ACCOUNT" />
    <section class="section section-tight">
      <div class="wrap auth-wrap">
        <form class="auth-card glass" (ngSubmit)="submit()" novalidate>
          <h2>رمز عبور جدید</h2>
          @if (!token()) {
            <p class="notice notice-error">این پیوند نامعتبر است یا منقضی شده است.</p>
            <div class="auth-links"><a routerLink="/account/forgot">درخواست پیوند جدید</a></div>
          } @else {
            @if (error(); as e) { <p class="notice notice-error" role="alert">{{ e.message }}</p> }
            <label class="field"><app-icon name="lock" /><input type="password" name="password" [(ngModel)]="password" placeholder="رمز عبور جدید (حداقل ۸ کاراکتر)" aria-label="رمز عبور جدید" autocomplete="new-password" minlength="8" required></label>
            <button class="btn btn-block" type="submit" [disabled]="busy()"><span>ذخیره رمز</span></button>
          }
        </form>
      </div>
    </section>
  `,
})
export class ResetPage extends FormPage {
  readonly token = input<string>();
  protected password = '';

  constructor() {
    super();
    inject(SeoService).set({ title: 'تعیین رمز عبور جدید', path: '/account/reset', noindex: true });
  }

  submit() {
    return this.run(async () => {
      const r = await this.api.post<{ user: Account }>('/api/auth/reset', { token: this.token(), password: this.password });
      this.auth.set(r.user);
      await this.router.navigateByUrl('/account');
    });
  }
}
