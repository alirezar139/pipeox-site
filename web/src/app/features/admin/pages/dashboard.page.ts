import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FaDatePipe, FaNumPipe } from '../../../core/format';
import { IconComponent } from '../../../shared/icon.component';
import { AdminApi, type Dashboard, STATUS_LABELS } from '../admin-api.service';

@Component({
  selector: 'app-admin-dashboard-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent, FaNumPipe, FaDatePipe],
  template: `
    <div class="adm-head"><div><h1>داشبورد</h1><p>خلاصه وضعیت سایت</p></div></div>
    @if (d(); as d) {
      <div class="adm-stats">
        <a class="adm-stat adm-stat-hot" routerLink="/admin/inquiries" [queryParams]="{ status: 'new' }">
          <app-icon name="inbox" /><b>{{ d.newInquiries | faNum }}</b><span>استعلام جدید</span>
        </a>
        <a class="adm-stat" routerLink="/admin/inquiries"><app-icon name="calendar" /><b>{{ d.weekInquiries | faNum }}</b><span>استعلام در ۷ روز اخیر</span></a>
        <a class="adm-stat" routerLink="/admin/customers"><app-icon name="users" /><b>{{ d.customers | faNum }}</b><span>مشتری ثبت‌نام‌شده</span></a>
        <a class="adm-stat" routerLink="/admin/subscribers"><app-icon name="mail" /><b>{{ d.subscribers | faNum }}</b><span>مشترک خبرنامه</span></a>
        <a class="adm-stat" routerLink="/admin/products"><app-icon name="box" /><b>{{ d.products | faNum }}</b><span>محصول منتشرشده</span></a>
        <a class="adm-stat" routerLink="/admin/articles"><app-icon name="news" /><b>{{ d.articles | faNum }}</b><span>مقاله منتشرشده</span></a>
      </div>

      <section class="adm-card">
        <div class="adm-card-head"><h2>آخرین استعلام‌ها</h2><a routerLink="/admin/inquiries">مشاهده همه ←</a></div>
        @if (!d.latest.length) {
          <p class="adm-empty">هنوز استعلامی ثبت نشده است.</p>
        } @else {
          <ul class="adm-latest">
            @for (q of d.latest; track q._id) {
              <li>
                <span class="adm-dot" [class]="'adm-dot s-' + q.status"></span>
                <b>{{ q.name }}</b><span class="adm-muted">{{ q.category || 'بدون گروه' }}</span>
                <span class="adm-badge" [class]="'adm-badge s-' + q.status">{{ labels[q.status] }}</span>
                <time>{{ q.createdAt | faDate: 'time' }}</time>
              </li>
            }
          </ul>
        }
      </section>

      <section class="adm-card adm-quick">
        <h2>میان‌برها</h2>
        <div>
          <a class="adm-btn" routerLink="/admin/articles/new"><app-icon name="plus" /> مطلب جدید</a>
          <a class="adm-btn adm-btn-ghost" routerLink="/admin/products/new"><app-icon name="plus" /> محصول جدید</a>
          <a class="adm-btn adm-btn-ghost" routerLink="/admin/settings"><app-icon name="settings" /> ویرایش متن‌های سایت</a>
        </div>
      </section>
    } @else {
      <div class="adm-skeleton"></div>
    }
  `,
})
export class AdminDashboardPage {
  private readonly api = inject(AdminApi);
  protected readonly d = signal<Dashboard | null>(null);
  protected readonly labels = STATUS_LABELS;

  constructor() {
    this.api.dashboard().then((d) => this.d.set(d));
  }
}
