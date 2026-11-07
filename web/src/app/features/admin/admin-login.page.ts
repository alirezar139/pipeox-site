import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import type { ApiError } from '../../core/models';
import { SeoService } from '../../core/seo.service';
import { IconComponent } from '../../shared/icon.component';
import { AdminApi } from './admin-api.service';

@Component({
  selector: 'app-admin-login-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, IconComponent],
  host: { class: 'admin-app admin-login' },
  template: `
    <form class="adm-login-card" (ngSubmit)="submit()">
      <div class="adm-login-mark">
        <svg viewBox="0 0 46 39" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" d="M6 1H33a12 12 0 0 1 0 24H18.4L14 36.4a3 3 0 0 1-2.8 2H3.4a2 2 0 0 1-1.9-2.7L4 3a2.6 2.6 0 0 1 2-2ZM3.42 10.6H31a2.2 2.2 0 0 1 0 4.4H3.08Z"/></svg>
      </div>
      <h1>ورود به پنل مدیریت</h1>
      <p>PIPEOX · Steel Pipeline Solutions</p>
      @if (error(); as e) { <p class="adm-error" role="alert">{{ e.message }}</p> }
      <!-- single admin account: fixed username so password managers can save the login -->
      <input type="text" name="username" value="admin" autocomplete="username" hidden>
      <label class="adm-input-icon">
        <app-icon name="lock" />
        <input type="password" name="password" [(ngModel)]="password" placeholder="رمز عبور" aria-label="رمز عبور" autocomplete="current-password" required autofocus>
      </label>
      <button class="adm-btn adm-btn-block" type="submit" [disabled]="busy() || !password">{{ busy() ? 'در حال ورود...' : 'ورود' }}</button>
    </form>
  `,
})
export class AdminLoginPage {
  private readonly api = inject(AdminApi);
  private readonly router = inject(Router);
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
      await this.api.login(this.password);
      await this.router.navigateByUrl('/admin');
    } catch (e) {
      this.error.set(e as ApiError);
      this.password = '';
    } finally {
      this.busy.set(false);
    }
  }
}
