import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { FaDatePipe, FaNumPipe, TomanPipe } from '../../core/format';
import { ApiService } from '../../core/http/api.service';
import { I18n, LinkPipe, TPipe } from '../../core/i18n';
import type { MessageKey } from '../../core/messages';
import type { ApiError, Gateway, Order, OrderItem } from '../../core/models';
import { SeoService } from '../../core/seo.service';
import { SiteStore } from '../../core/site.store';
import { IconComponent } from '../../shared/icon.component';
import { PageHeroComponent } from '../../shared/page-hero.component';

const STEPS = ['review', 'awaiting_payment', 'paid', 'processing', 'shipped', 'delivered'] as const;

/** A customer's order: status, payment (bank gateway or transfer), printable proforma / invoice. */
@Component({
  selector: 'app-order-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, IconComponent, PageHeroComponent, TPipe, LinkPipe, TomanPipe, FaNumPipe, FaDatePipe],
  template: `
    <app-page-hero class="no-print" [heading]="o() ? ('order.title' | t: { n: (o()!.number | faNum) }) : ('acc.orders' | t)" [eyebrow]="'eb.account' | t"
      [crumbs]="[{ label: 'nav.home' | t, url: '/' }, { label: 'acc.mine' | t, url: '/account' }, { label: 'acc.orders' | t, url: '/account' }]" />
    <section class="section section-tight">
      <div class="wrap">
        @if (loading()) { <div class="skeleton-list"><i></i><i></i></div> }
        @else if (o(); as o) {
          <div class="no-print">
            @if (placed) { <p class="notice notice-ok">{{ 'order.placed' | t }}</p> }
            @if (payResult === 'ok' && o.status !== 'awaiting_payment') { <p class="notice notice-ok">{{ 'order.paidOk' | t }}</p> }
            @if (payResult === 'failed' && o.status === 'awaiting_payment') { <p class="notice notice-error">{{ 'order.payFailed' | t }}</p> }
            @if (error(); as e) { <p class="notice notice-error" role="alert">{{ e }}</p> }

            @if (o.status !== 'cancelled') {
              <ol class="order-steps">
                @for (s of steps; track s; let i = $index) {
                  <li [class.done]="i < stepIndex()" [class.now]="i === stepIndex()">{{ stKey(s) | t }}</li>
                }
              </ol>
            } @else {
              <p class="notice notice-error">{{ 'order.st.cancelled' | t }}</p>
            }

            @if (o.status === 'review') { <div class="side-card order-box"><b>{{ 'order.st.review' | t }}</b><p>{{ 'order.reviewText' | t }}</p></div> }

            @if (o.status === 'awaiting_payment') {
              <div class="order-pay">
                <div class="side-card order-box">
                  <b>{{ 'order.payOnline' | t }} — {{ o.total | toman }}</b>
                  @if (gateways().length) {
                    <p>{{ 'order.chooseGateway' | t }}</p>
                    <div class="gw-list">
                      @for (g of gateways(); track g.id) {
                        <button type="button" class="btn" [disabled]="busy()" (click)="pay(g.id)">{{ g.label[i18n.lang()] }}</button>
                      }
                    </div>
                    @if (busy()) { <p class="shop-note">{{ 'order.redirecting' | t }}</p> }
                  } @else {
                    <p class="shop-note">{{ 'order.noGateway' | t }}</p>
                  }
                </div>

                <div class="side-card order-box">
                  <b>{{ 'order.transferTitle' | t }}</b>
                  <p>{{ 'order.transferText' | t }}</p>
                  @if (bank(); as b) {
                    <dl class="sum bank">
                      @if (b.name) { <div><dt>{{ 'order.bank' | t }}</dt><dd>{{ b.name }}</dd></div> }
                      @if (b.holder) { <div><dt>{{ 'order.holder' | t }}</dt><dd>{{ b.holder }}</dd></div> }
                      @if (b.account) { <div><dt>{{ 'order.account' | t }}</dt><dd dir="ltr">{{ b.account }}</dd></div> }
                      @if (b.sheba) { <div><dt>{{ 'order.sheba' | t }}</dt><dd dir="ltr">{{ b.sheba }}</dd></div> }
                      @if (b.card) { <div><dt>{{ 'order.card' | t }}</dt><dd dir="ltr">{{ b.card }}</dd></div> }
                    </dl>
                  }
                  @if (o.transfer) {
                    <p class="notice notice-ok">{{ 'order.transferReported' | t: { ref: o.transfer.ref } }}</p>
                  } @else {
                    <form class="co-grid" (ngSubmit)="sendTransfer()" novalidate>
                      <label class="field"><app-icon name="doc" /><input name="ref" dir="ltr" [(ngModel)]="tr.ref" [placeholder]="'order.transferRef' | t" [attr.aria-label]="'order.transferRef' | t" maxlength="40" required></label>
                      <label class="field"><app-icon name="calendar" /><input name="paidOn" [(ngModel)]="tr.paidOn" [placeholder]="'order.transferDate' | t" [attr.aria-label]="'order.transferDate' | t" maxlength="30"></label>
                      <button type="submit" class="btn" [disabled]="busy() || !tr.ref.trim()"><span>{{ 'order.transferSend' | t }}</span></button>
                    </form>
                  }
                </div>
              </div>
            }

            @if (o.trackingCode) { <p class="notice notice-ok">{{ 'order.tracking' | t }}: <b dir="ltr">{{ o.trackingCode }}</b></p> }
            @if (o.shippingNote) { <p class="notice">{{ o.shippingNote }}</p> }

            <div class="order-actions">
              <button type="button" class="pill pill-ghost" (click)="print()"><app-icon name="download" /><span>{{ 'order.print' | t }}</span></button>
              @if (o.status === 'review' || (o.status === 'awaiting_payment' && !o.transfer)) {
                <button type="button" class="pill pill-ghost danger" (click)="cancel()" [disabled]="busy()"><app-icon name="close" /><span>{{ 'order.cancel' | t }}</span></button>
              }
              <a class="pill pill-ghost" [routerLink]="'/account' | link"><span>{{ 'order.backToAccount' | t }}</span></a>
            </div>
          </div>

          <!-- Proforma / invoice (also the printed page) -->
          <article class="invoice" [attr.dir]="i18n.rtl() ? 'rtl' : 'ltr'">
            <header class="inv-head">
              <div>
                <h2>{{ (isPaid() ? 'order.invoiceTitle' : 'order.proforma') | t }}</h2>
                <p>{{ 'order.number' | t }}: <b>{{ o.number | faNum }}</b> · {{ 'order.date' | t }}: {{ o.createdAt | faDate }}</p>
                <p>{{ 'order.status' | t }}: <b>{{ stKey(o.status) | t }}</b></p>
              </div>
              <div class="inv-brand"><b>PIPEOX</b><span>{{ site.settings().site.nameFa }}</span></div>
            </header>
            <div class="inv-parties">
              <section>
                <h3>{{ 'order.seller' | t }}</h3>
                @if (seller(); as s) {
                  <p><b>{{ s.legalName || site.settings().site.name }}</b></p>
                  @if (s.nationalId) { <p>{{ 'order.nationalId' | t }}: {{ s.nationalId | faNum }}</p> }
                  @if (s.economicCode) { <p>{{ 'order.economicCode' | t }}: {{ s.economicCode | faNum }}</p> }
                  @if (s.address) { <p>{{ s.address }}@if (s.postalCode) { — {{ s.postalCode | faNum }} }</p> }
                  @if (s.phone) { <p dir="ltr">{{ s.phone }}</p> }
                }
              </section>
              <section>
                <h3>{{ 'order.buyer' | t }}</h3>
                <p><b>{{ o.invoice.name }}</b></p>
                @if (o.invoice.nationalId) { <p>{{ 'order.nationalId' | t }}: {{ o.invoice.nationalId | faNum }}</p> }
                @if (o.invoice.economicCode) { <p>{{ 'order.economicCode' | t }}: {{ o.invoice.economicCode | faNum }}</p> }
                <p>{{ o.address.province }}، {{ o.address.city }} — {{ o.address.address }}@if (o.address.postalCode) { — {{ o.address.postalCode | faNum }} }</p>
                <p>{{ o.address.name }} · <span dir="ltr">{{ o.address.phone }}</span></p>
              </section>
            </div>
            <table class="inv-table">
              <thead><tr><th>{{ 'order.row' | t }}</th><th>{{ 'order.desc' | t }}</th><th>{{ 'shop.colQty' | t }}</th><th>{{ 'shop.colPrice' | t }}</th><th>{{ 'order.lineTotal' | t }}</th></tr></thead>
              <tbody>
                @for (i of o.items; track i.sku; let n = $index) {
                  <tr>
                    <td>{{ n + 1 | faNum }}</td>
                    <td><b>{{ i.productTitle }}</b><br><span dir="auto">{{ i.title }}</span> <small dir="ltr">({{ i.sku }})</small></td>
                    <td>{{ i.qty | faNum }} {{ unitKey(i) | t }}</td>
                    <td>{{ i.price | toman }}</td>
                    <td>{{ i.total | toman }}</td>
                  </tr>
                }
              </tbody>
            </table>
            <dl class="sum inv-sum">
              <div><dt>{{ 'cart.subtotal' | t }}</dt><dd>{{ o.subtotal | toman }}</dd></div>
              <div><dt>{{ 'cart.shipping' | t }}</dt><dd>@if (o.shipping === null) { {{ 'cart.shippingLater' | t }} } @else { {{ o.shipping | toman }} }</dd></div>
              <div><dt>{{ 'cart.vat' | t: { n: (o.vatPercent | faNum) } }}</dt><dd>{{ o.vat | toman }}</dd></div>
              <div class="grand"><dt>{{ 'order.total' | t }}</dt><dd>{{ o.total | toman }}</dd></div>
            </dl>
            @if (paidRef(); as p) { <p class="inv-paid">{{ 'order.payOk' | t }} — {{ 'order.ref' | t }}: <span dir="ltr">{{ p }}</span></p> }
          </article>

          @if (o.payments.length) {
            <div class="no-print">
              <h2 class="sub-title">{{ 'order.payments' | t }}</h2>
              <ul class="pay-list">
                @for (p of o.payments; track $index) {
                  <li><span>{{ p.startedAt | faDate: 'time' }}</span><span>{{ gwLabel(p.gateway) }}</span><span>{{ p.amountRial / 10 | toman }}</span>
                    <b [class]="'pay-' + p.status">{{ (p.status === 'paid' ? 'order.payOk' : p.status === 'failed' ? 'order.payFail' : 'order.payPending') | t }}</b>
                    @if (p.rrn) { <small dir="ltr">{{ p.rrn }}</small> }</li>
                }
              </ul>
            </div>
          }
        } @else {
          <div class="empty-card"><b>{{ 'order.title' | t: { n: '' } }}</b><p>{{ 'common.error' | t }}</p></div>
        }
      </div>
    </section>
  `,
})
export class OrderPage {
  readonly id = input.required<string>();
  readonly pay_ = input<string>(undefined, { alias: 'pay' });
  readonly placed_ = input<string>(undefined, { alias: 'placed' });
  private readonly api = inject(ApiService);
  protected readonly i18n = inject(I18n);
  protected readonly site = inject(SiteStore);
  protected readonly o = signal<Order | null>(null);
  protected readonly gateways = signal<Gateway[]>([]);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly steps = STEPS;
  protected tr = { ref: '', paidOn: '', note: '' };

  protected get placed() {
    return !!this.placed_();
  }
  protected get payResult() {
    return this.pay_();
  }

  protected readonly stepIndex = computed(() => STEPS.indexOf((this.o()?.status ?? 'review') as (typeof STEPS)[number]));
  protected readonly isPaid = computed(() => ['paid', 'processing', 'shipped', 'delivered'].includes(this.o()?.status ?? ''));
  protected readonly seller = computed(() => this.site.settings().shop?.seller ?? null);
  protected readonly bank = computed(() => {
    const b = this.site.settings().shop?.bank;
    return b && (b.account || b.sheba || b.card) ? b : null;
  });
  protected readonly paidRef = computed(() => {
    const o = this.o();
    return o?.payments.find((p) => p.status === 'paid')?.rrn || (this.isPaid() ? o?.transfer?.ref : '') || '';
  });
  protected stKey = (s: string) => `order.st.${s}` as MessageKey;
  protected unitKey = (i: OrderItem) => `unit.${i.unit}` as MessageKey;
  protected gwLabel = (id: string) => this.gateways().find((g) => g.id === id)?.label[this.i18n.lang()] ?? id;

  constructor() {
    inject(SeoService).set({ title: this.i18n.t('acc.orders'), path: '/account', noindex: true });
    queueMicrotask(() => void this.load());
  }

  private async load() {
    try {
      const [o, g] = await Promise.all([this.api.myOrder(this.id()), this.api.gateways().catch(() => [])]);
      this.o.set(o);
      this.gateways.set(g);
    } catch {
      this.o.set(null);
    } finally {
      this.loading.set(false);
    }
  }

  protected async pay(gateway: string) {
    this.busy.set(true);
    this.error.set('');
    try {
      const r = await this.api.payOrder(this.id(), gateway);
      // Hand the browser to the bank (GET link or auto-submitted form)
      const form = document.createElement('form');
      form.method = r.method;
      form.action = r.url;
      for (const [k, v] of Object.entries(r.fields)) {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = k;
        input.value = v;
        form.appendChild(input);
      }
      document.body.appendChild(form);
      form.submit();
    } catch (e) {
      this.error.set((e as ApiError).message ?? this.i18n.t('common.error'));
      this.busy.set(false);
    }
  }

  protected async sendTransfer() {
    this.busy.set(true);
    this.error.set('');
    try {
      this.o.set(await this.api.reportTransfer(this.id(), this.tr));
    } catch (e) {
      this.error.set((e as ApiError).message ?? this.i18n.t('common.error'));
    } finally {
      this.busy.set(false);
    }
  }

  protected async cancel() {
    if (!confirm(this.i18n.t('order.cancelConfirm'))) return;
    this.busy.set(true);
    try {
      this.o.set(await this.api.cancelOrder(this.id()));
    } catch (e) {
      this.error.set((e as ApiError).message ?? this.i18n.t('common.error'));
    } finally {
      this.busy.set(false);
    }
  }

  protected print() {
    window.print();
  }
}
