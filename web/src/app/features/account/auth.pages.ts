import { ChangeDetectionStrategy, Component, Directive, inject, input, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthStore } from '../../core/auth.store';
import { ApiService } from '../../core/http/api.service';
import { I18n, LinkPipe, TPipe } from '../../core/i18n';
import type { Account, ApiError } from '../../core/models';
import { SeoService } from '../../core/seo.service';
import { CaptchaComponent } from '../../shared/captcha.component';
import { IconComponent } from '../../shared/icon.component';
import { PageHeroComponent } from '../../shared/page-hero.component';
import { PasswordToggleComponent } from '../../shared/password-toggle.component';

/** Only same-site paths after login (no open redirects); default: the account page in the current language. */
const safeNext = (next: string | undefined, fallback: string) => (next && /^\/(?![/\\])/.test(next) ? next : fallback);

@Directive()
abstract class FormPage {
  protected readonly api = inject(ApiService);
  protected readonly auth = inject(AuthStore);
  protected readonly router = inject(Router);
  protected readonly i18n = inject(I18n);
  protected readonly busy = signal(false);
  protected readonly error = signal<ApiError | null>(null);
  protected readonly captcha = viewChild(CaptchaComponent);

  /** The captcha fields to send with the request (empty when the form has no captcha). */
  protected cap = () => this.captcha()?.fields() ?? {};

  protected async run(fn: () => Promise<void>) {
    this.busy.set(true);
    this.error.set(null);
    try {
      await fn();
    } catch (e) {
      this.error.set(e as ApiError);
      void this.captcha()?.reload(); // each captcha is single-use
    } finally {
      this.busy.set(false);
    }
  }
  protected bad = (field: string) => this.error()?.field === field || null;
}

const SHARED = [FormsModule, RouterLink, IconComponent, PageHeroComponent, CaptchaComponent, PasswordToggleComponent, TPipe, LinkPipe];

@Component({
  selector: 'app-login-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: SHARED,
  template: `
    <app-page-hero [heading]="'acc.hero' | t" [eyebrow]="'eb.account' | t" [lead]="'acc.heroLead' | t" />
    <section class="section section-tight">
      <div class="wrap auth-wrap">
        <form class="auth-card glass" (ngSubmit)="submit()" novalidate>
          <h2>{{ 'acc.login' | t }}</h2>
          @if (reason() === 'idle' && !error()) { <p class="notice notice-ok" role="status">{{ 'acc.idle' | t }}</p> }
          @if (error(); as e) { <p class="notice notice-error" role="alert">{{ e.message }}</p> }
          <label class="field"><app-icon name="user" /><input name="login" [(ngModel)]="login" dir="ltr" [placeholder]="'acc.emailOrUser' | t" [attr.aria-label]="'acc.emailOrUser' | t" autocomplete="username" autocapitalize="off" spellcheck="false" maxlength="190" required></label>
          <label class="field"><app-icon name="lock" /><input #pw type="password" name="password" [(ngModel)]="password" [placeholder]="'acc.password' | t" [attr.aria-label]="'acc.password' | t" autocomplete="current-password" required><app-pw-toggle [for]="pw" /></label>
          <app-captcha [invalid]="!!bad('captcha')" />
          <button class="btn btn-block" type="submit" [disabled]="busy()"><span>{{ (busy() ? 'acc.loggingIn' : 'acc.login') | t }}</span></button>
          <div class="auth-links">
            <a [routerLink]="'/account/forgot' | link">{{ 'acc.forgotLink' | t }}</a>
            <span>{{ 'acc.noAccount' | t }} <a [routerLink]="'/account/register' | link" [queryParams]="{ next: next() }">{{ 'acc.registerLink' | t }}</a></span>
          </div>
        </form>
      </div>
    </section>
  `,
})
export class LoginPage extends FormPage {
  readonly next = input<string>();
  readonly reason = input<string>();
  /** Email (customers) or username (panel staff: admin, support, developer). */
  protected login = '';
  protected password = '';

  constructor() {
    super();
    inject(SeoService).set({ title: this.i18n.t('acc.hero'), path: '/account/login', noindex: true });
  }

  submit() {
    return this.run(async () => {
      const id = this.login.trim();
      if (id.includes('@')) {
        const r = await this.api.post<{ user: Account }>('/api/auth/login', { email: id, password: this.password, ...this.cap() });
        this.auth.set(r.user);
        await this.router.navigateByUrl(safeNext(this.next(), this.i18n.link('/account')));
      } else {
        // Panel staff: their own session, then into the admin panel
        await this.api.post('/api/admin/login', { username: id, password: this.password, ...this.cap() });
        const next = this.next();
        await this.router.navigateByUrl(next?.startsWith('/admin') ? next : '/admin');
      }
    });
  }
}

@Component({
  selector: 'app-register-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: SHARED,
  template: `
    <app-page-hero [heading]="'acc.registerHero' | t" [eyebrow]="'eb.account' | t" [lead]="'acc.registerLead' | t" />
    <section class="section section-tight">
      <div class="wrap auth-wrap">
        <form class="auth-card glass" (ngSubmit)="submit()" novalidate>
          <h2>{{ 'acc.register' | t }}</h2>
          @if (error(); as e) { <p class="notice notice-error" role="alert">{{ e.message }}</p> }
          <label class="field"><app-icon name="user" /><input name="name" [(ngModel)]="f.name" [placeholder]="'quote.name' | t" [attr.aria-label]="'quote.name' | t" autocomplete="name" maxlength="100" required [attr.aria-invalid]="bad('name')"></label>
          <label class="field"><app-icon name="mail" /><input type="email" name="email" [(ngModel)]="f.email" dir="ltr" [placeholder]="'acc.email' | t" [attr.aria-label]="'acc.email' | t" autocomplete="email" maxlength="190" required [attr.aria-invalid]="bad('email')"></label>
          <label class="field"><app-icon name="phone" /><input type="tel" name="phone" [(ngModel)]="f.phone" inputmode="tel" [placeholder]="'quote.phone' | t" [attr.aria-label]="'quote.phone' | t" autocomplete="tel" maxlength="30" required [attr.aria-invalid]="bad('phone')"></label>
          <label class="field"><app-icon name="list" /><input name="company" [(ngModel)]="f.company" [placeholder]="'acc.company' | t" [attr.aria-label]="'acc.company' | t" autocomplete="organization" maxlength="150"></label>
          <label class="field"><app-icon name="lock" /><input #pw type="password" name="password" [(ngModel)]="f.password" [placeholder]="'acc.passwordNew8' | t" [attr.aria-label]="'acc.passwordNew8' | t" autocomplete="new-password" minlength="8" required [attr.aria-invalid]="bad('password')"><app-pw-toggle [for]="pw" /></label>
          <div class="hp" aria-hidden="true"><label>Website <input name="website" [(ngModel)]="f.website" tabindex="-1" autocomplete="off"></label></div>
          <app-captcha [invalid]="!!bad('captcha')" />
          <button class="btn btn-block" type="submit" [disabled]="busy()"><span>{{ (busy() ? 'acc.creating' : 'acc.create') | t }}</span></button>
          <div class="auth-links"><span>{{ 'acc.haveAccount' | t }} <a [routerLink]="'/account/login' | link">{{ 'acc.loginLink' | t }}</a></span></div>
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
    inject(SeoService).set({ title: this.i18n.t('acc.registerHero'), path: '/account/register', noindex: true });
  }

  submit() {
    return this.run(async () => {
      const r = await this.api.post<{ user: Account }>('/api/auth/register', { ...this.f, ...this.cap() });
      this.auth.set(r.user);
      await this.router.navigateByUrl(safeNext(this.next(), this.i18n.link('/account')), { state: { welcome: true } });
    });
  }
}

@Component({
  selector: 'app-forgot-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, IconComponent, PageHeroComponent, CaptchaComponent, TPipe, LinkPipe],
  template: `
    <app-page-hero [heading]="'acc.forgotHero' | t" [eyebrow]="'eb.account' | t" />
    <section class="section section-tight">
      <div class="wrap auth-wrap">
        <form class="auth-card glass" (ngSubmit)="submit()" novalidate>
          <h2>{{ 'acc.forgotHero' | t }}</h2>
          @if (done(); as d) {
            @if (d.emailEnabled) {
              <p class="notice notice-ok">{{ 'acc.forgotSent' | t }}</p>
            } @else {
              <p class="notice notice-error">{{ 'acc.forgotNoEmail' | t }}</p>
            }
          } @else {
            @if (error(); as e) { <p class="notice notice-error" role="alert">{{ e.message }}</p> }
            <p class="auth-hint">{{ 'acc.forgotHint' | t }}</p>
            <label class="field"><app-icon name="mail" /><input type="email" name="email" [(ngModel)]="email" dir="ltr" [placeholder]="'acc.email' | t" [attr.aria-label]="'acc.email' | t" autocomplete="email" required></label>
            <app-captcha [invalid]="!!bad('captcha')" />
            <button class="btn btn-block" type="submit" [disabled]="busy()"><span>{{ 'acc.sendLink' | t }}</span></button>
          }
          <div class="auth-links"><a [routerLink]="'/account/login' | link">{{ 'acc.backToLogin' | t }}</a></div>
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
    inject(SeoService).set({ title: this.i18n.t('acc.forgotHero'), path: '/account/forgot', noindex: true });
  }

  submit() {
    return this.run(async () => {
      this.done.set(await this.api.post<{ emailEnabled: boolean }>('/api/auth/forgot', { email: this.email, ...this.cap() }));
    });
  }
}

@Component({
  selector: 'app-reset-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, IconComponent, PageHeroComponent, PasswordToggleComponent, TPipe, LinkPipe],
  template: `
    <app-page-hero [heading]="'acc.resetHero' | t" [eyebrow]="'eb.account' | t" />
    <section class="section section-tight">
      <div class="wrap auth-wrap">
        <form class="auth-card glass" (ngSubmit)="submit()" novalidate>
          <h2>{{ 'acc.resetTitle' | t }}</h2>
          @if (!token()) {
            <p class="notice notice-error">{{ 'acc.resetInvalid' | t }}</p>
            <div class="auth-links"><a [routerLink]="'/account/forgot' | link">{{ 'acc.newLink' | t }}</a></div>
          } @else {
            @if (error(); as e) { <p class="notice notice-error" role="alert">{{ e.message }}</p> }
            <label class="field"><app-icon name="lock" /><input #pw type="password" name="password" [(ngModel)]="password" [placeholder]="'acc.passwordNew' | t" [attr.aria-label]="'acc.passwordNew' | t" autocomplete="new-password" minlength="8" required><app-pw-toggle [for]="pw" /></label>
            <button class="btn btn-block" type="submit" [disabled]="busy()"><span>{{ 'acc.savePassword' | t }}</span></button>
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
    inject(SeoService).set({ title: this.i18n.t('acc.resetHero'), path: '/account/reset', noindex: true });
  }

  submit() {
    return this.run(async () => {
      const r = await this.api.post<{ user: Account }>('/api/auth/reset', { token: this.token(), password: this.password });
      this.auth.set(r.user);
      await this.router.navigateByUrl(this.i18n.link('/account'));
    });
  }
}
