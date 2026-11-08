import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { FaDatePipe, FaNumPipe } from '../../../core/format';
import type { OrderStatus } from '../../../core/models';
import { IconComponent } from '../../../shared/icon.component';
import { AdminApi, ORDER_STATUS_LABELS, ORDER_STATUSES, type AdminOrder } from '../admin-api.service';
import { ToastService } from '../ui/toast.service';

const UNIT_FA: Record<string, string> = { piece: 'عدد', meter: 'متر', length: 'شاخه', kg: 'کیلوگرم', set: 'دست' };
const GATEWAY_FA: Record<string, string> = { mellat: 'بانک ملت', saman: 'بانک سامان', sadad: 'بانک ملی (سداد)', sandbox: 'درگاه آزمایشی' };

/** One order: set the shipping cost, confirm a transfer, move it through preparation and shipping. */
@Component({
  selector: 'app-admin-order-edit-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, IconComponent, FaDatePipe, FaNumPipe],
  template: `
    @if (o(); as o) {
      <div class="adm-head">
        <div><h1>سفارش {{ o.number | faNum }}</h1><p>ثبت: {{ o.createdAt | faDate: 'time' }} · وضعیت: <b>{{ labels[o.status] }}</b> · روش پرداخت: {{ o.payMethod === 'online' ? 'آنلاین' : 'واریز به حساب' }}</p></div>
        <div class="adm-head-actions"><a class="adm-btn adm-btn-ghost" routerLink="/admin/orders">بازگشت</a></div>
      </div>

      <div class="adm-grid-2">
        <section class="adm-card">
          <h2>اقلام</h2>
          <div class="adm-table-wrap">
            <table class="adm-table">
              <thead><tr><th>کالا</th><th>SKU</th><th>مقدار</th><th>فی (تومان)</th><th>جمع (تومان)</th></tr></thead>
              <tbody>
                @for (i of o.items; track i.sku) {
                  <tr><td><b>{{ i.productTitle }}</b><br><span dir="auto">{{ i.title }}</span></td><td dir="ltr">{{ i.sku }}</td><td>{{ i.qty | faNum }} {{ unit(i.unit) }}</td><td>{{ i.price | faNum }}</td><td>{{ i.total | faNum }}</td></tr>
                }
              </tbody>
            </table>
          </div>
          <dl class="adm-dl">
            <dt>جمع کالاها</dt><dd>{{ o.subtotal | faNum }} تومان</dd>
            <dt>هزینه ارسال</dt><dd>@if (o.shipping === null) { <span class="adm-muted">تعیین نشده</span> } @else { {{ o.shipping | faNum }} تومان }</dd>
            <dt>مالیات ({{ o.vatPercent | faNum }}٪)</dt><dd>@if (o.vat !== null) { {{ o.vat | faNum }} تومان } @else { — }</dd>
            <dt><b>مبلغ نهایی</b></dt><dd><b>@if (o.total !== null) { {{ o.total | faNum }} تومان } @else { — }</b></dd>
          </dl>
          @if (o.customerNote) { <p class="adm-hint"><b>توضیح مشتری:</b> {{ o.customerNote }}</p> }
        </section>

        <section class="adm-card">
          <h2>خریدار و ارسال</h2>
          <dl class="adm-dl">
            <dt>فاکتور به نام</dt><dd>{{ o.invoice.name }} ({{ o.invoice.type === 'company' ? 'حقوقی' : 'حقیقی' }})</dd>
            @if (o.invoice.nationalId) { <dt>شناسه/کد ملی</dt><dd dir="ltr">{{ o.invoice.nationalId }}</dd> }
            @if (o.invoice.economicCode) { <dt>کد اقتصادی</dt><dd dir="ltr">{{ o.invoice.economicCode }}</dd> }
            @if (o.invoice.regNo) { <dt>شماره ثبت</dt><dd dir="ltr">{{ o.invoice.regNo }}</dd> }
            <dt>تحویل‌گیرنده</dt><dd>{{ o.address.name }} — <a dir="ltr" [href]="'tel:' + o.address.phone">{{ o.address.phone }}</a></dd>
            <dt>نشانی</dt><dd>{{ o.address.province }}، {{ o.address.city }} — {{ o.address.address }}@if (o.address.postalCode) { — کد پستی <span dir="ltr">{{ o.address.postalCode }}</span> }</dd>
            @if (o.user) { <dt>حساب مشتری</dt><dd><span dir="ltr">{{ o.user.email }}</span>@if (o.user.company) { — {{ o.user.company }} }</dd> }
          </dl>
        </section>
      </div>

      @if (o.status === 'review' || o.status === 'awaiting_payment') {
        <form class="adm-card adm-form-inline" (ngSubmit)="setShipping()">
          <h2>هزینه ارسال</h2>
          <p class="adm-hint">با ثبت هزینه ارسال (صفر برای ارسال رایگان یا پس‌کرایه)، مبلغ نهایی همراه با مالیات محاسبه و سفارش «در انتظار پرداخت» می‌شود؛ در صورت تنظیم ایمیل، به مشتری اطلاع داده می‌شود.</p>
          <div class="adm-row">
            <label class="adm-field"><span class="adm-label">هزینه ارسال (تومان)</span><input class="adm-input" type="number" min="0" step="1000" name="ship" [(ngModel)]="ship" dir="ltr" required></label>
            <label class="adm-field adm-grow"><span class="adm-label">توضیح برای مشتری (اختیاری)</span><input class="adm-input" name="shipNote" [(ngModel)]="shipNote" placeholder="مثلاً: ارسال با باربری، پس‌کرایه"></label>
            <button class="adm-btn" type="submit" [disabled]="busy() || ship === null">ثبت و اعلام مبلغ نهایی</button>
          </div>
        </form>
      }

      @if (o.status === 'awaiting_payment' && o.transfer) {
        <section class="adm-card adm-alert">
          <h2>واریز گزارش‌شده توسط مشتری</h2>
          <p>شماره پیگیری: <b dir="ltr">{{ o.transfer.ref }}</b>@if (o.transfer.paidOn) { · تاریخ: {{ o.transfer.paidOn }} } · ثبت: {{ o.transfer.at | faDate: 'time' }}</p>
          <p class="adm-hint">پس از اطمینان از واریز مبلغ {{ o.total | faNum }} تومان به حساب شرکت، پرداخت را تأیید کنید.</p>
          <button type="button" class="adm-btn" (click)="setStatus('paid')" [disabled]="busy()"><app-icon name="check-circle" /> تأیید پرداخت</button>
        </section>
      }

      <form class="adm-card" (ngSubmit)="saveMeta()">
        <h2>پیگیری سفارش</h2>
        <div class="adm-row">
          <label class="adm-field"><span class="adm-label">وضعیت</span>
            <select class="adm-input" name="status" [(ngModel)]="status">
              @for (s of statuses; track s) { <option [value]="s" [disabled]="!allowed(s)">{{ labels[s] }}</option> }
            </select></label>
          <label class="adm-field"><span class="adm-label">کد رهگیری مرسوله</span><input class="adm-input" name="tracking" [(ngModel)]="tracking" dir="ltr"></label>
        </div>
        <label class="adm-field adm-wide"><span class="adm-label">یادداشت داخلی (مشتری نمی‌بیند)</span><textarea class="adm-input" name="staffNote" rows="2" [(ngModel)]="staffNote"></textarea></label>
        <p class="adm-hint">لغو سفارش، موجودی اقلام را برمی‌گرداند. تغییر وضعیت به «ارسال‌شده» و «پرداخت‌شده» به مشتری ایمیل می‌شود (در صورت تنظیم SMTP).</p>
        <button class="adm-btn" type="submit" [disabled]="busy()">ذخیره</button>
      </form>

      <div class="adm-grid-2">
        <section class="adm-card">
          <h2>پرداخت‌های اینترنتی</h2>
          @if (!o.payments.length) { <p class="adm-muted">تلاشی برای پرداخت اینترنتی ثبت نشده است.</p> }
          @for (p of o.payments; track p.payNo) {
            <p class="adm-pay" [class]="'adm-pay p-' + p.status">
              <b>{{ p.status === 'paid' ? 'موفق' : p.status === 'failed' ? 'ناموفق' : 'نامشخص' }}</b> · {{ gateway(p.gateway) }} · {{ p.amountRial / 10 | faNum }} تومان · {{ p.startedAt | faDate: 'time' }}
              <br><small dir="ltr">#{{ p.payNo }}@if (p.rrn) { · RRN {{ p.rrn }} }@if (p.trace) { · Trace {{ p.trace }} }@if (p.card) { · {{ p.card }} }@if (p.message) { · {{ p.message }} }</small>
            </p>
          }
        </section>
        <section class="adm-card">
          <h2>تاریخچه</h2>
          <ul class="adm-history">
            @for (h of o.history; track $index) { <li>{{ h.at | faDate: 'time' }} — <b>{{ stLabel(h.status) }}</b>@if (h.by) { <span class="adm-muted"> ({{ byLabel(h.by) }})</span> }</li> }
          </ul>
        </section>
      </div>
    } @else {
      <div class="adm-skeleton"></div>
    }
  `,
})
export class AdminOrderEditPage {
  readonly id = input.required<string>();
  private readonly api = inject(AdminApi);
  private readonly toast = inject(ToastService);
  protected readonly o = signal<AdminOrder | null>(null);
  protected readonly busy = signal(false);
  protected readonly labels = ORDER_STATUS_LABELS;
  protected readonly statuses = ORDER_STATUSES;
  protected ship: number | null = null;
  protected shipNote = '';
  protected status: OrderStatus = 'review';
  protected tracking = '';
  protected staffNote = '';
  protected unit = (u: string) => UNIT_FA[u] ?? u;
  protected stLabel = (s: string) => (ORDER_STATUS_LABELS as Record<string, string>)[s] ?? s;
  protected gateway = (g: string) => GATEWAY_FA[g] ?? g;
  protected byLabel = (b: string) => (b === 'customer' ? 'مشتری' : b === 'bank' ? 'بانک' : b);

  /** Paid states need final totals; a cancelled order stays cancelled. */
  protected allowed(s: OrderStatus): boolean {
    const o = this.o();
    if (!o) return false;
    if (o.status === 'cancelled') return s === 'cancelled';
    if ((s === 'awaiting_payment' || s === 'paid') && o.total === null) return false;
    if (s === 'cancelled' && (o.status === 'shipped' || o.status === 'delivered')) return false;
    return true;
  }

  constructor() {
    effect(() => void this.load(this.id()));
  }

  private async load(id: string) {
    this.apply(await this.api.order(id));
  }

  private apply(o: AdminOrder) {
    this.o.set(o);
    this.ship = o.shipping;
    this.shipNote = o.shippingNote;
    this.status = o.status;
    this.tracking = o.trackingCode;
    this.staffNote = o.staffNote;
  }

  private async update(body: Parameters<AdminApi['updateOrder']>[1], done: string) {
    this.busy.set(true);
    try {
      this.apply(await this.api.updateOrder(this.id(), body));
      this.toast.show(done);
      void this.api.orders().catch(() => undefined); // refresh the sidebar badge
    } catch (e) {
      this.toast.error(e);
    } finally {
      this.busy.set(false);
    }
  }

  protected setShipping() {
    if (this.ship === null) return;
    void this.update({ shipping: Number(this.ship) || 0, shippingNote: this.shipNote }, 'هزینه ارسال ثبت و مبلغ نهایی اعلام شد.');
  }

  protected setStatus(status: OrderStatus) {
    void this.update({ status }, 'وضعیت سفارش به‌روز شد.');
  }

  protected saveMeta() {
    const o = this.o();
    if (this.status === 'cancelled' && o?.status !== 'cancelled' && !confirm('سفارش لغو شود؟ موجودی اقلام برگردانده می‌شود.')) return;
    void this.update({ status: this.status, trackingCode: this.tracking, staffNote: this.staffNote }, 'سفارش ذخیره شد.');
  }
}
