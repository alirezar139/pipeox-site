import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthStore } from '../../core/auth.store';
import { FaDatePipe, FaNumPipe, TomanPipe } from '../../core/format';
import { ApiService, type OrderSummary } from '../../core/http/api.service';
import { I18n, LinkPipe, TPipe } from '../../core/i18n';
import type { MessageKey } from '../../core/messages';
import type { Account, ApiError, InquiryStatus } from '../../core/models';
import { SeoService } from '../../core/seo.service';
import { IconComponent } from '../../shared/icon.component';
import { PageHeroComponent } from '../../shared/page-hero.component';
import { PasswordToggleComponent } from '../../shared/password-toggle.component';

interface MyInquiry {
  _id: string;
  category: string;
  details: string;
  status: InquiryStatus;
  createdAt: string;
  attachment: { name: string } | null;
}

/** How a customer sees each internal status. */
const CUSTOMER_STATUS = {
  new: 'acc.st.new',
  contacted: 'acc.st.contacted',
  quoted: 'acc.st.quoted',
  won: 'acc.st.won',
  closed: 'acc.st.closed',
} as const satisfies Record<InquiryStatus, string>;

@Component({
  selector: 'app-dashboard-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, IconComponent, PageHeroComponent, FaDatePipe, FaNumPipe, TomanPipe, PasswordToggleComponent, TPipe, LinkPipe],
  template: `
    <app-page-hero [heading]="'acc.mine' | t" [eyebrow]="'eb.account' | t" [crumbs]="[{ label: 'nav.home' | t, url: '/' }, { label: 'acc.mine' | t, url: '/account' }]" />
    <section class="section section-tight">
      <div class="wrap account-grid">
        <div class="account-main">
          @if (welcome) { <p class="notice notice-ok">{{ 'acc.welcome' | t }}</p> }
          @if (orders().length) {
            <h2 class="sub-title">{{ 'acc.orders' | t }}</h2>
            <ol class="inq-list order-list">
              @for (o of orders(); track o._id) {
                <li class="inq" [class]="'o-' + o.status">
                  <a class="order-link" [routerLink]="('/account/orders/' + o._id) | link">
                    <div class="inq-top">
                      <span class="inq-id">#{{ o.number | faNum }}</span>
                      <span class="inq-status">{{ stKey(o.status) | t }}</span>
                    </div>
                    <b>{{ (o.total ?? o.subtotal) | toman }}</b>
                    <small>{{ o.createdAt | faDate }} · {{ 'acc.itemsCount' | t: { n: (o.count | faNum) } }} · {{ 'acc.details2' | t }} ←</small>
                  </a>
                </li>
              }
            </ol>
          }
          <div class="account-head">
            <h2 class="sub-title">{{ 'acc.requests' | t }}</h2>
            <a class="pill pill-orange" [routerLink]="'/contact' | link"><app-icon name="plus" /><span>{{ 'acc.newRequest' | t }}</span></a>
          </div>

          @if (loading()) {
            <div class="skeleton-list"><i></i><i></i><i></i></div>
          } @else if (!inquiries().length) {
            <div class="empty-card">
              <b>{{ 'acc.noRequests' | t }}</b>
              <p>{{ 'acc.noRequestsText' | t }}</p>
            </div>
          } @else {
            <ol class="inq-list">
              @for (q of inquiries(); track q._id) {
                <li class="inq" [class]="'s-' + q.status">
                  <div class="inq-top">
                    <span class="inq-id">#{{ q._id.slice(-6).toUpperCase() }}</span>
                    <span class="inq-status">{{ statusLabel[q.status] | t }}</span>
                  </div>
                  <b>{{ q.category || ('acc.request' | t) }}</b>
                  @if (q.details) { <p class="pre-line">{{ q.details.length > 300 ? q.details.slice(0, 300) + '…' : q.details }}</p> }
                  <small>{{ q.createdAt | faDate }}@if (q.attachment) { · {{ q.attachment.name }} }</small>
                </li>
              }
            </ol>
          }
        </div>

        <aside class="account-side">
          <form class="side-card account-card" (ngSubmit)="saveProfile()" novalidate>
            <b>{{ 'acc.details' | t }}</b>
            <p class="account-email" dir="ltr">{{ auth.user()?.email }}</p>
            @if (profileMsg(); as m) { <p class="notice" [class]="m.ok ? 'notice notice-ok' : 'notice notice-error'">{{ m.text }}</p> }
            <label class="field"><app-icon name="user" /><input name="name" [(ngModel)]="profile.name" [placeholder]="'quote.name' | t" [attr.aria-label]="'quote.name' | t" maxlength="100" required></label>
            <label class="field"><app-icon name="phone" /><input type="tel" name="phone" [(ngModel)]="profile.phone" [placeholder]="'quote.phone' | t" [attr.aria-label]="'quote.phone' | t" maxlength="30" required></label>
            <label class="field"><app-icon name="list" /><input name="company" [(ngModel)]="profile.company" [placeholder]="'acc.companyShort' | t" [attr.aria-label]="'acc.companyShort' | t" maxlength="150"></label>
            <button class="btn btn-block" type="submit" [disabled]="busy()"><span>{{ 'acc.save' | t }}</span></button>
          </form>

          <form class="side-card account-card" (ngSubmit)="changePassword()" novalidate>
            <b>{{ 'acc.changePassword' | t }}</b>
            @if (passwordMsg(); as m) { <p class="notice" [class]="m.ok ? 'notice notice-ok' : 'notice notice-error'">{{ m.text }}</p> }
            <label class="field"><app-icon name="lock" /><input #pwCur type="password" name="current" [(ngModel)]="pw.current" [placeholder]="'acc.currentPassword' | t" [attr.aria-label]="'acc.currentPassword' | t" autocomplete="current-password" required><app-pw-toggle [for]="pwCur" /></label>
            <label class="field"><app-icon name="lock" /><input #pwNew type="password" name="password" [(ngModel)]="pw.password" [placeholder]="'acc.newPassword8' | t" [attr.aria-label]="'acc.newPassword8' | t" autocomplete="new-password" minlength="8" required><app-pw-toggle [for]="pwNew" /></label>
            <button class="btn btn-block btn-ghost" type="submit" [disabled]="busy()"><span>{{ 'acc.changeBtn' | t }}</span></button>
            <small class="muted-note">{{ 'acc.otherDevices' | t }}</small>
          </form>

          <button type="button" class="link-more logout-btn" (click)="logout()"><app-icon name="logout" />{{ 'acc.logout' | t }}</button>
        </aside>
      </div>
    </section>
  `,
})
export class DashboardPage {
  protected readonly auth = inject(AuthStore);
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18n);

  protected readonly statusLabel = CUSTOMER_STATUS;
  protected readonly welcome = !!this.router.currentNavigation()?.extras.state?.['welcome'];
  protected readonly inquiries = signal<MyInquiry[]>([]);
  protected readonly orders = signal<OrderSummary[]>([]);
  protected stKey = (s: string) => `order.st.${s}` as MessageKey;
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly profileMsg = signal<{ ok: boolean; text: string } | null>(null);
  protected readonly passwordMsg = signal<{ ok: boolean; text: string } | null>(null);

  protected profile = { name: '', phone: '', company: '' };
  protected pw = { current: '', password: '' };

  constructor() {
    inject(SeoService).set({ title: this.i18n.t('acc.mine'), path: '/account', noindex: true });
    const u = this.auth.user();
    if (u) this.profile = { name: u.name, phone: u.phone, company: u.company };
    this.load();
  }

  private async load() {
    try {
      const [inquiries, orders] = await Promise.all([this.api.get<MyInquiry[]>('/api/account/inquiries'), this.api.myOrders().catch(() => [])]);
      this.inquiries.set(inquiries);
      this.orders.set(orders);
    } finally {
      this.loading.set(false);
    }
  }

  async saveProfile() {
    this.busy.set(true);
    try {
      const r = await this.api.patch<{ user: Account }>('/api/account/profile', this.profile);
      this.auth.set(r.user);
      this.profileMsg.set({ ok: true, text: this.i18n.t('acc.saved') });
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
      this.passwordMsg.set({ ok: true, text: this.i18n.t('acc.changed') });
    } catch (e) {
      this.passwordMsg.set({ ok: false, text: (e as ApiError).message });
    } finally {
      this.busy.set(false);
    }
  }

  async logout() {
    await this.auth.logout();
    await this.router.navigateByUrl(this.i18n.link('/'));
  }
}
