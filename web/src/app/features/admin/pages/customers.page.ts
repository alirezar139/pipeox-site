import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FaDatePipe, FaNumPipe } from '../../../core/format';
import { IconComponent } from '../../../shared/icon.component';
import { AdminApi, type Customer } from '../admin-api.service';
import { ToastService } from '../ui/toast.service';

@Component({
  selector: 'app-admin-customers-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent, FaDatePipe, FaNumPipe],
  template: `
    <div class="adm-head">
      <div><h1>مشتریان ({{ items().length | faNum }})</h1><p>حساب‌هایی که از «ورود / ثبت‌نام» سایت ساخته شده‌اند.</p></div>
      <a class="adm-btn adm-btn-ghost" href="/api/admin/customers/export.csv" download><app-icon name="download" /> خروجی Excel</a>
    </div>
    @if (loading()) { <div class="adm-skeleton"></div> }
    @else if (!items().length) { <p class="adm-empty">هنوز کسی در سایت ثبت‌نام نکرده است.</p> }
    @else {
      <div class="adm-table-wrap">
        <table class="adm-table">
          <thead><tr><th>نام</th><th>ایمیل</th><th>تلفن</th><th>شرکت</th><th>ثبت‌نام</th><th>آخرین ورود</th><th>استعلام</th><th>وضعیت</th><th></th></tr></thead>
          <tbody>
            @for (c of items(); track c.id) {
              <tr>
                <td><b>{{ c.name }}</b></td>
                <td dir="ltr"><a [href]="'mailto:' + c.email">{{ c.email }}</a></td>
                <td dir="ltr">{{ c.phone }}</td>
                <td>{{ c.company }}</td>
                <td>{{ c.createdAt | faDate }}</td>
                <td>{{ c.lastLoginAt ? (c.lastLoginAt | faDate) : '—' }}</td>
                <td>@if (c.inquiries) { <a routerLink="/admin/inquiries" [queryParams]="{ user: c.id }">{{ c.inquiries | faNum }}</a> } @else { ۰ }</td>
                <td>@if (c.active) { <span class="adm-badge s-won">فعال</span> } @else { <span class="adm-badge s-closed">غیرفعال</span> }</td>
                <td class="adm-actions">
                  <button type="button" class="adm-btn adm-btn-ghost adm-btn-sm" (click)="toggle(c)">{{ c.active ? 'غیرفعال‌سازی' : 'فعال‌سازی' }}</button>
                  <button type="button" class="adm-btn adm-btn-ghost adm-btn-sm" (click)="setPassword(c)"><app-icon name="lock" /> رمز جدید</button>
                  <button type="button" class="adm-icon-btn danger" (click)="remove(c)" aria-label="حذف"><app-icon name="trash" /></button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
})
export class AdminCustomersPage {
  private readonly api = inject(AdminApi);
  private readonly toast = inject(ToastService);
  protected readonly items = signal<Customer[]>([]);
  protected readonly loading = signal(true);

  constructor() {
    void this.load();
  }

  private async load() {
    try {
      this.items.set(await this.api.customers());
    } finally {
      this.loading.set(false);
    }
  }

  async toggle(c: Customer) {
    await this.api.setCustomerActive(c.id, !c.active).then(() => this.toast.show('وضعیت حساب تغییر کرد.'), (e) => this.toast.error(e));
    await this.load();
  }

  async setPassword(c: Customer) {
    const pw = prompt(`رمز جدید برای ${c.email} (حداقل ۸ کاراکتر):`);
    if (!pw) return;
    await this.api.setCustomerPassword(c.id, pw).then(
      () => this.toast.show('رمز جدید ثبت شد؛ آن را از راه امن به مشتری اعلام کنید.'),
      (e) => this.toast.error(e),
    );
  }

  async remove(c: Customer) {
    if (!confirm(`حساب ${c.email} حذف شود؟ استعلام‌های این مشتری در صندوق باقی می‌مانند.`)) return;
    await this.api.deleteCustomer(c.id).then(() => this.toast.show('حساب حذف شد.'), (e) => this.toast.error(e));
    await this.load();
  }
}
