import { ChangeDetectionStrategy, Component, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import type { ApiError } from '../../core/models';
import { SeoService } from '../../core/seo.service';
import { CaptchaComponent } from '../../shared/captcha.component';
import { IconComponent } from '../../shared/icon.component';
import { PasswordToggleComponent } from '../../shared/password-toggle.component';
import { AdminApi } from './admin-api.service';

@Component({
  selector: 'app-admin-login-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, IconComponent, CaptchaComponent, PasswordToggleComponent],
  host: { class: 'admin-app admin-login' },
  template: `
    <form class="adm-login-card" (ngSubmit)="submit()">
      <div class="adm-login-mark">
        <svg viewBox="0 0 46 39" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" d="M6 1H33a12 12 0 0 1 0 24H18.4L14 36.4a3 3 0 0 1-2.8 2H3.4a2 2 0 0 1-1.9-2.7L4 3a2.6 2.6 0 0 1 2-2ZM3.42 10.6H31a2.2 2.2 0 0 1 0 4.4H3.08Z"/></svg>
      </div>
      <h1>ورود به پنل مدیریت</h1>
      <p>PIPEOX · Steel Pipeline Solutions</p>
      @if (idle) { <p class="adm-note" role="status">به‌دلیل ۳۰ دقیقه عدم فعالیت از پنل خارج شدید. دوباره وارد شوید.</p> }
      @if (error(); as e) { <p class="adm-error" role="alert">{{ e.message }}</p> }
      <label class="adm-input-icon">
        <app-icon name="user" />
        <input name="username" [(ngModel)]="username" dir="ltr" placeholder="نام کاربری" aria-label="نام کاربری" autocomplete="username" autocapitalize="off" spellcheck="false" required autofocus>
      </label>
      <label class="adm-input-icon">
        <app-icon name="lock" />
        <input #pw type="password" name="password" [(ngModel)]="password" placeholder="رمز عبور" aria-label="رمز عبور" autocomplete="current-password" required>
        <app-pw-toggle [for]="pw" />
      </label>
      <app-captcha variant="admin" [invalid]="error()?.field === 'captcha'" />
      <button class="adm-btn adm-btn-block" type="submit" [disabled]="busy() || !username || !password">{{ busy() ? 'در حال ورود...' : 'ورود' }}</button>
    </form>
  `,
})
export class AdminLoginPage {
  private readonly api = inject(AdminApi);
  private readonly router = inject(Router);
  private readonly captcha = viewChild.required(CaptchaComponent);
  protected readonly idle = inject(ActivatedRoute).snapshot.queryParamMap.get('reason') === 'idle';
  protected username = '';
  protected password = '';
  protected readonly busy = signal(false);
  protected readonly error = signal<ApiError | null>(null);

  constructor() {
    inject(SeoService).set({ title: 'ورود مدیر', path: '/admin/login', noindex: true });
  }

  async submit() {
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.api.login({ username: this.username.trim(), password: this.password, ...this.captcha().fields() });
      await this.router.navigateByUrl('/admin');
    } catch (e) {
      this.error.set(e as ApiError);
      this.password = '';
      void this.captcha().reload(); // each captcha is single-use
    } finally {
      this.busy.set(false);
    }
  }
}
