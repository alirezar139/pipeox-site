import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FaDatePipe, FaNumPipe } from '../../../core/format';
import type { OrderStatus } from '../../../core/models';
import { IconComponent } from '../../../shared/icon.component';
import { AdminApi, ORDER_STATUS_LABELS, ORDER_STATUSES, type AdminOrderRow } from '../admin-api.service';

/** Online shop orders: list by status. */
@Component({
  selector: 'app-admin-orders-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent, FaDatePipe, FaNumPipe],
  template: `
    <div class="adm-head">
      <div><h1>سفارش‌ها</h1><p>سفارش‌های فروشگاه آنلاین. سفارش‌های «در انتظار بررسی» منتظر تعیین هزینه ارسال هستند.</p></div>
      @if (!api.isSupport()) { <a class="adm-btn adm-btn-ghost" href="/api/admin/orders/export.csv" download><app-icon name="download" /> خروجی Excel</a> }
    </div>
    <nav class="adm-chips">
      <a routerLink="/admin/orders" [class.on]="!status()">همه ({{ total() | faNum }})</a>
      @for (s of statuses; track s) {
        <a routerLink="/admin/orders" [queryParams]="{ status: s }" [class.on]="status() === s">{{ labels[s] }} ({{ (counts()[s] ?? 0) | faNum }})</a>
      }
    </nav>

    @if (loading()) { <div class="adm-skeleton"></div> }
    @else if (!items().length) { <p class="adm-empty">سفارشی وجود ندارد.</p> }
    @else {
      <div class="adm-table-wrap">
        <table class="adm-table">
          <thead><tr><th>شماره</th><th>تاریخ</th><th>خریدار</th><th>شهر</th><th>اقلام</th><th>مبلغ (تومان)</th><th>پرداخت</th><th>وضعیت</th><th></th></tr></thead>
          <tbody>
            @for (o of items(); track o._id) {
              <tr>
                <td><b>{{ o.number | faNum }}</b></td>
                <td>{{ o.createdAt | faDate: 'time' }}</td>
                <td>{{ o.invoice.name }}<br><small dir="ltr">{{ o.address.phone }}</small></td>
                <td>{{ o.address.city }}</td>
                <td>{{ o.items.length | faNum }}</td>
                <td>@if (o.total !== null) { {{ o.total | faNum }} } @else { <span class="adm-muted">{{ o.subtotal | faNum }} + ارسال</span> }</td>
                <td>{{ o.payMethod === 'online' ? 'آنلاین' : 'واریز' }}@if (o.transfer?.ref && o.status === 'awaiting_payment') { <br><span class="adm-badge s-new">واریز گزارش شد</span> }</td>
                <td><span class="adm-badge" [class]="'adm-badge o-' + o.status">{{ labels[o.status] }}</span></td>
                <td><a class="adm-btn adm-btn-ghost adm-btn-sm" [routerLink]="['/admin/orders', o._id]">جزئیات</a></td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
})
export class AdminOrdersPage {
  readonly status = input<OrderStatus>();
  protected readonly api = inject(AdminApi);
  protected readonly labels = ORDER_STATUS_LABELS;
  protected readonly statuses = ORDER_STATUSES;
  protected readonly items = signal<AdminOrderRow[]>([]);
  protected readonly counts = signal<Partial<Record<OrderStatus, number>>>({});
  protected readonly total = computed(() => Object.values(this.counts()).reduce((a, b) => a + (b ?? 0), 0));
  protected readonly loading = signal(true);

  constructor() {
    effect(() => {
      const status = this.status();
      this.loading.set(true);
      this.api.orders(status).then(
        (r) => {
          this.items.set(r.items);
          this.counts.set(r.counts);
          this.loading.set(false);
        },
        () => this.loading.set(false),
      );
    });
  }
}
