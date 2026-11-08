import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthStore } from '../../core/auth.store';
import { CartStore } from '../../core/cart.store';
import { FaNumPipe, TomanPipe } from '../../core/format';
import { ApiService, type PricedLine } from '../../core/http/api.service';
import { I18n, LinkPipe, TPipe } from '../../core/i18n';
import type { MessageKey } from '../../core/messages';
import type { ApiError, PayMethod } from '../../core/models';
import { SeoService } from '../../core/seo.service';
import { SiteStore } from '../../core/site.store';
import { IconComponent } from '../../shared/icon.component';
import { PageHeroComponent } from '../../shared/page-hero.component';

/** Checkout (signed-in customers): delivery address, invoice details, payment method. */
@Component({
  selector: 'app-checkout-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, IconComponent, PageHeroComponent, TPipe, LinkPipe, TomanPipe, FaNumPipe],
  template: `
    <app-page-hero [heading]="'checkout.title' | t" [crumbs]="[{ label: 'nav.home' | t, url: '/' }, { label: 'cart.title' | t, url: '/cart' }, { label: 'checkout.title' | t, url: '/checkout' }]" />
    <section class="section section-tight">
      <div class="wrap">
        @if (!cart.count()) {
          <div class="empty-card">
            <b>{{ 'cart.empty' | t }}</b>
            <a class="pill pill-orange" [routerLink]="'/products' | link"><span>{{ 'cart.browse' | t }}</span></a>
          </div>
        } @else {
          <form class="shop-grid" (ngSubmit)="submit()" novalidate>
            <div class="checkout-main">
              @if (error(); as e) { <p class="notice notice-error" role="alert">{{ e }}</p> }

              <fieldset class="co-box">
                <legend>{{ 'checkout.shipTo' | t }}</legend>
                <div class="co-grid">
                  <label class="field"><app-icon name="user" /><input name="aname" [(ngModel)]="f.address.name" [placeholder]="'checkout.recipient' | t" [attr.aria-label]="'checkout.recipient' | t" maxlength="100" required autocomplete="name"></label>
                  <label class="field"><app-icon name="phone" /><input type="tel" name="aphone" [(ngModel)]="f.address.phone" [placeholder]="'quote.phone' | t" [attr.aria-label]="'quote.phone' | t" maxlength="30" required autocomplete="tel"></label>
                  <label class="field"><app-icon name="home" /><input name="province" [(ngModel)]="f.address.province" [placeholder]="'checkout.province' | t" [attr.aria-label]="'checkout.province' | t" maxlength="40" required autocomplete="address-level1"></label>
                  <label class="field"><app-icon name="home" /><input name="city" [(ngModel)]="f.address.city" [placeholder]="'checkout.city' | t" [attr.aria-label]="'checkout.city' | t" maxlength="60" required autocomplete="address-level2"></label>
                </div>
                <label class="field field-area"><app-icon name="home" /><textarea name="address" rows="2" [(ngModel)]="f.address.address" [placeholder]="'checkout.address' | t" [attr.aria-label]="'checkout.address' | t" maxlength="300" required autocomplete="street-address"></textarea></label>
                <label class="field"><app-icon name="mail" /><input name="postal" inputmode="numeric" dir="ltr" [(ngModel)]="f.address.postalCode" [placeholder]="'checkout.postal' | t" [attr.aria-label]="'checkout.postal' | t" maxlength="12" autocomplete="postal-code"></label>
              </fieldset>

              <fieldset class="co-box">
                <legend>{{ 'checkout.invoice' | t }}</legend>
                <div class="co-choice">
                  <label><input type="radio" name="itype" value="personal" [(ngModel)]="f.invoice.type"><span>{{ 'checkout.personal' | t }}</span></label>
                  <label><input type="radio" name="itype" value="company" [(ngModel)]="f.invoice.type"><span>{{ 'checkout.company' | t }}</span></label>
                </div>
                <div class="co-grid">
                  <label class="field"><app-icon name="doc" />
                    <input name="iname" [(ngModel)]="f.invoice.name" [placeholder]="(f.invoice.type === 'company' ? 'checkout.companyName' : 'checkout.invName') | t"
                      [attr.aria-label]="(f.invoice.type === 'company' ? 'checkout.companyName' : 'checkout.invName') | t" maxlength="150" required></label>
                  <label class="field"><app-icon name="doc" />
                    <input name="nid" inputmode="numeric" dir="ltr" [(ngModel)]="f.invoice.nationalId" [placeholder]="(f.invoice.type === 'company' ? 'checkout.nationalId' : 'checkout.nationalCode') | t"
                      [attr.aria-label]="(f.invoice.type === 'company' ? 'checkout.nationalId' : 'checkout.nationalCode') | t" maxlength="14" [required]="f.invoice.type === 'company'"></label>
                  @if (f.invoice.type === 'company') {
                    <label class="field"><app-icon name="doc" /><input name="eco" inputmode="numeric" dir="ltr" [(ngModel)]="f.invoice.economicCode" [placeholder]="'checkout.economicCode' | t" [attr.aria-label]="'checkout.economicCode' | t" maxlength="16"></label>
                    <label class="field"><app-icon name="doc" /><input name="reg" dir="ltr" [(ngModel)]="f.invoice.regNo" [placeholder]="'checkout.regNo' | t" [attr.aria-label]="'checkout.regNo' | t" maxlength="20"></label>
                  }
                </div>
              </fieldset>

              <fieldset class="co-box">
                <legend>{{ 'checkout.payMethod' | t }}</legend>
                <div class="co-pay">
                  <label [class.on]="f.payMethod === 'online'"><input type="radio" name="pay" value="online" [(ngModel)]="f.payMethod">
                    <span><b>{{ 'checkout.online' | t }}</b><small>{{ 'checkout.onlineText' | t }}</small></span></label>
                  <label [class.on]="f.payMethod === 'transfer'"><input type="radio" name="pay" value="transfer" [(ngModel)]="f.payMethod">
                    <span><b>{{ 'checkout.transfer' | t }}</b><small>{{ 'checkout.transferText' | t }}</small></span></label>
                </div>
              </fieldset>

              <label class="field field-area"><app-icon name="list" /><textarea name="note" rows="3" [(ngModel)]="f.note" [placeholder]="'checkout.note' | t" [attr.aria-label]="'checkout.note' | t" maxlength="1000"></textarea></label>
            </div>

            <aside class="side-card cart-sum">
              <b>{{ 'checkout.summary' | t }}</b>
              <ul class="co-items">
                @for (l of lines(); track l.slug + l.sku) {
                  <li [class.bad]="!!l.error"><span>{{ l.productTitle }} — <span dir="auto">{{ l.title }}</span> × {{ l.qty | faNum }} {{ unitKey(l) | t }}</span><b>{{ l.total | toman }}</b>
                    @if (l.error) { <small class="err">{{ l.error }}</small> }</li>
                }
              </ul>
              <dl class="sum">
                <div><dt>{{ 'cart.subtotal' | t }}</dt><dd>{{ subtotal() | toman }}</dd></div>
                <div><dt>{{ 'cart.vat' | t: { n: (vat() | faNum) } }}</dt><dd>{{ vatAmount() | toman }}</dd></div>
                <div><dt>{{ 'cart.shipping' | t }}</dt><dd class="muted">{{ 'cart.shippingLater' | t }}</dd></div>
                <div class="grand"><dt>{{ 'cart.estimate' | t }}</dt><dd>{{ subtotal() + vatAmount() | toman }}</dd></div>
              </dl>
              <p class="shop-note">{{ 'checkout.terms' | t }}</p>
              <button type="submit" class="btn btn-block" [disabled]="busy() || hasErrors()">
                <span>{{ (busy() ? 'checkout.submitting' : 'checkout.submit') | t }}</span>
              </button>
              <a class="shop-back" [routerLink]="'/cart' | link">{{ 'cart.title' | t }}</a>
            </aside>
          </form>
        }
      </div>
    </section>
  `,
})
export class CheckoutPage {
  protected readonly cart = inject(CartStore);
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthStore);
  private readonly site = inject(SiteStore);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18n);
  protected readonly lines = signal<PricedLine[]>([]);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly hasErrors = computed(() => this.lines().some((l) => l.error));
  protected readonly subtotal = computed(() => this.lines().reduce((s, l) => s + l.total, 0));
  protected readonly vat = computed(() => this.site.settings().shop?.vatPercent ?? 10);
  protected readonly vatAmount = computed(() => Math.round((this.subtotal() * this.vat()) / 100));
  protected unitKey = (l: PricedLine) => `unit.${l.unit}` as MessageKey;

  protected f = {
    address: { name: '', phone: '', province: '', city: '', address: '', postalCode: '' },
    invoice: { type: 'personal' as 'personal' | 'company', name: '', nationalId: '', economicCode: '', regNo: '' },
    payMethod: 'online' as PayMethod,
    note: '',
  };

  constructor() {
    inject(SeoService).set({ title: this.i18n.t('checkout.title'), path: '/checkout', noindex: true });
    const me = this.auth.user();
    if (me) {
      this.f.address.name = me.name;
      this.f.address.phone = me.phone;
      this.f.invoice.name = me.company || me.name;
      if (me.company) this.f.invoice.type = 'company';
    }
    void this.load();
  }

  private async load() {
    const items = this.cart.lines();
    if (items.length) this.lines.set((await this.api.priceCart(items)).lines);
  }

  async submit() {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const order = await this.api.placeOrder({ ...this.f, items: this.cart.lines() });
      this.cart.clear();
      await this.router.navigate([this.i18n.link(`/account/orders/${order._id}`)], { queryParams: { placed: 1 } });
    } catch (e) {
      this.error.set((e as ApiError).message ?? this.i18n.t('common.error'));
      window.scrollTo({ top: 0, behavior: 'smooth' });
      void this.load();
    } finally {
      this.busy.set(false);
    }
  }
}
