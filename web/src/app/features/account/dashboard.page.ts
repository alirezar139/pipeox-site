import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthStore } from '../../core/auth.store';
import { FaDatePipe } from '../../core/format';
import { ApiService } from '../../core/http/api.service';
import type { Account, ApiError, InquiryStatus } from '../../core/models';
import { SeoService } from '../../core/seo.service';
import { IconComponent } from '../../shared/icon.component';
import { PageHeroComponent } from '../../shared/page-hero.component';

interface MyInquiry {
  _id: string;
  category: string;
  details: string;
  status: InquiryStatus;
  createdAt: string;
  attachment: { name: string } | null;
}

/** How a customer sees each internal status. */
const CUSTOMER_STATUS: Record<InquiryStatus, string> = {
  new: 'دریافت شد',
  contacted: 'در حال بررسی',
  quoted: 'پیشنهاد ارسال شد',
  won: 'انجام شد',
  closed: 'بسته شد',
};

@Component({
  selector: 'app-dashboard-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, IconComponent, PageHeroComponent, FaDatePipe],
  template: `
    <app-page-hero heading="حساب من" eyebrow="CUSTOMER ACCOUNT" [crumbs]="[{ label: 'خانه', url: '/' }, { label: 'حساب من', url: '/account' }]" />
    <section class="section section-tight">
      <div class="wrap account-grid">
        <div class="account-main">
          @if (welcome) { <p class="notice notice-ok">حساب شما ساخته شد. خوش آمدید!</p> }
          <div class="account-head">
            <h2 class="sub-title">درخواست‌های من</h2>
            <a class="pill pill-orange" routerLink="/contact"><app-icon name="plus" /><span>استعلام جدید</span></a>
          </div>

          @if (loading()) {
            <div class="skeleton-list"><i></i><i></i><i></i></div>
          } @else if (!inquiries().length) {
            <div class="empty-card">
              <b>هنوز درخواستی ثبت نکرده‌اید.</b>
              <p>استعلام‌هایی که بعد از ورود ثبت کنید، این‌جا با وضعیتشان نمایش داده می‌شوند.</p>
            </div>
          } @else {
            <ol class="inq-list">
              @for (q of inquiries(); track q._id) {
                <li class="inq" [class]="'s-' + q.status">
                  <div class="inq-top">
                    <span class="inq-id">#{{ q._id.slice(-6).toUpperCase() }}</span>
                    <span class="inq-status">{{ statusLabel[q.status] }}</span>
                  </div>
                  <b>{{ q.category || 'درخواست استعلام' }}</b>
                  @if (q.details) { <p class="pre-line">{{ q.details.length > 300 ? q.details.slice(0, 300) + '…' : q.details }}</p> }
                  <small>{{ q.createdAt | faDate }}@if (q.attachment) { · {{ q.attachment.name }} }</small>
                </li>
              }
            </ol>
          }
        </div>

        <aside class="account-side">
          <form class="side-card account-card" (ngSubmit)="saveProfile()" novalidate>
            <b>اطلاعات حساب</b>
            <p class="account-email" dir="ltr">{{ auth.user()?.email }}</p>
            @if (profileMsg(); as m) { <p class="notice" [class]="m.ok ? 'notice notice-ok' : 'notice notice-error'">{{ m.text }}</p> }
            <label class="field"><app-icon name="user" /><input name="name" [(ngModel)]="profile.name" placeholder="نام و نام خانوادگی" aria-label="نام و نام خانوادگی" maxlength="100" required></label>
            <label class="field"><app-icon name="phone" /><input type="tel" name="phone" [(ngModel)]="profile.phone" placeholder="شماره تماس" aria-label="شماره تماس" maxlength="30" required></label>
            <label class="field"><app-icon name="list" /><input name="company" [(ngModel)]="profile.company" placeholder="شرکت / سازمان" aria-label="شرکت یا سازمان" maxlength="150"></label>
            <button class="btn btn-block" type="submit" [disabled]="busy()"><span>ذخیره</span></button>
          </form>

          <form class="side-card account-card" (ngSubmit)="changePassword()" novalidate>
            <b>تغییر رمز عبور</b>
            @if (passwordMsg(); as m) { <p class="notice" [class]="m.ok ? 'notice notice-ok' : 'notice notice-error'">{{ m.text }}</p> }
            <label class="field"><app-icon name="lock" /><input type="password" name="current" [(ngModel)]="pw.current" placeholder="رمز فعلی" aria-label="رمز فعلی" autocomplete="current-password" required></label>
            <label class="field"><app-icon name="lock" /><input type="password" name="password" [(ngModel)]="pw.password" placeholder="رمز جدید (حداقل ۸ کاراکتر)" aria-label="رمز جدید" autocomplete="new-password" minlength="8" required></label>
            <button class="btn btn-block btn-ghost" type="submit" [disabled]="busy()"><span>تغییر رمز</span></button>
            <small class="muted-note">با تغییر رمز، از دستگاه‌های دیگر خارج می‌شوید.</small>
          </form>

          <button type="button" class="link-more logout-btn" (click)="logout()"><app-icon name="logout" />خروج از حساب</button>
        </aside>
      </div>
    </section>
  `,
})
export class DashboardPage {
  protected readonly auth = inject(AuthStore);
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  protected readonly statusLabel = CUSTOMER_STATUS;
  protected readonly welcome = !!this.router.currentNavigation()?.extras.state?.['welcome'];
  protected readonly inquiries = signal<MyInquiry[]>([]);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly profileMsg = signal<{ ok: boolean; text: string } | null>(null);
  protected readonly passwordMsg = signal<{ ok: boolean; text: string } | null>(null);

  protected profile = { name: '', phone: '', company: '' };
  protected pw = { current: '', password: '' };

  constructor() {
    inject(SeoService).set({ title: 'حساب من', path: '/account', noindex: true });
    const u = this.auth.user();
    if (u) this.profile = { name: u.name, phone: u.phone, company: u.company };
    this.load();
  }

  private async load() {
    try {
      this.inquiries.set(await this.api.get<MyInquiry[]>('/api/account/inquiries'));
    } finally {
      this.loading.set(false);
    }
  }

  async saveProfile() {
    this.busy.set(true);
    try {
      const r = await this.api.patch<{ user: Account }>('/api/account/profile', this.profile);
      this.auth.set(r.user);
      this.profileMsg.set({ ok: true, text: 'اطلاعات حساب ذخیره شد.' });
    } catch (e) {
      this.profileMsg.set({ ok: false, text: (e as ApiError).message });
    } finally {
      this.busy.set(false);
    }
  }

  async changePassword() {
    this.busy.set(true);
    try {
      await this.api.post('/api/account/password', this.pw);
      this.pw = { current: '', password: '' };
      this.passwordMsg.set({ ok: true, text: 'رمز عبور تغییر کرد.' });
    } catch (e) {
      this.passwordMsg.set({ ok: false, text: (e as ApiError).message });
    } finally {
      this.busy.set(false);
    }
  }

  async logout() {
    await this.auth.logout();
    await this.router.navigateByUrl('/');
  }
}
