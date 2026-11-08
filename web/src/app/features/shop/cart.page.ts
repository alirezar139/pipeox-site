import { afterNextRender, ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthStore } from '../../core/auth.store';
import { CartStore } from '../../core/cart.store';
import { FaNumPipe, TomanPipe } from '../../core/format';
import { ApiService, type PricedLine } from '../../core/http/api.service';
import { I18n, LinkPipe, TPipe } from '../../core/i18n';
import type { MessageKey } from '../../core/messages';
import { SeoService } from '../../core/seo.service';
import { SiteStore } from '../../core/site.store';
import { IconComponent } from '../../shared/icon.component';
import { PageHeroComponent } from '../../shared/page-hero.component';

/** The cart: lines priced by the server, quantities editable, totals before shipping. */
@Component({
  selector: 'app-cart-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent, PageHeroComponent, TPipe, LinkPipe, TomanPipe, FaNumPipe],
  template: `
    <app-page-hero [heading]="'cart.title' | t" [crumbs]="[{ label: 'nav.home' | t, url: '/' }, { label: 'cart.title' | t, url: '/cart' }]" />
    <section class="section section-tight">
      <div class="wrap">
        @if (!cart.count()) {
          <div class="empty-card">
            <b>{{ 'cart.empty' | t }}</b>
            <p>{{ 'cart.emptyText' | t }}</p>
            <a class="pill pill-orange" [routerLink]="'/products' | link"><span>{{ 'cart.browse' | t }}</span></a>
          </div>
        } @else {
          <div class="shop-grid">
            <div class="cart-lines">
              @if (hasErrors()) { <p class="notice notice-error" role="alert">{{ 'cart.fix' | t }}</p> }
              @for (l of view(); track l.slug + l.sku) {
                <article class="cart-line" [class.bad]="!!l.error">
                  @if (l.image) { <img [src]="l.image" alt="" width="88" height="66" loading="lazy"> }
                  <div class="cart-line-info">
                    <a [routerLink]="('/products/' + l.slug) | link"><b>{{ l.productTitle }}</b></a>
                    <span dir="auto">{{ l.title }}</span>
                    <small dir="ltr">{{ l.sku }}</small>
                    @if (l.price) { <small>{{ 'shop.colPrice' | t }}: {{ l.price | toman }} / {{ unitKey(l) | t }}</small> }
                    @if (l.error) { <small class="err">{{ l.error }}</small> }
                  </div>
                  <div class="cart-line-qty">
                    <input type="number" inputmode="numeric" [min]="l.minQty" [value]="l.qty" (change)="setQty(l, $any($event.target).value)"
                      [attr.aria-label]="('shop.colQty' | t) + ' — ' + l.title">
                    <span>{{ unitKey(l) | t }}</span>
                  </div>
                  <b class="cart-line-total">{{ l.total | toman }}</b>
                  <button type="button" class="icon-btn" (click)="cart.remove(l.slug, l.sku)" [attr.aria-label]="'cart.remove' | t"><app-icon name="trash" /></button>
                </article>
              }
            </div>

            <aside class="side-card cart-sum">
              <b>{{ 'checkout.summary' | t }}</b>
              <dl class="sum">
                <div><dt>{{ 'cart.subtotal' | t }}</dt><dd>{{ subtotal() | toman }}</dd></div>
                <div><dt>{{ 'cart.vat' | t: { n: (vat() | faNum) } }}</dt><dd>{{ vatAmount() | toman }}</dd></div>
                <div><dt>{{ 'cart.shipping' | t }}</dt><dd class="muted">{{ 'cart.shippingLater' | t }}</dd></div>
                <div class="grand"><dt>{{ 'cart.estimate' | t }}</dt><dd>{{ subtotal() + vatAmount() | toman }}</dd></div>
              </dl>
              <p class="shop-note">{{ 'cart.note' | t }}</p>
              @if (!auth.user() && auth.ready()) { <p class="shop-note">{{ 'cart.loginFirst' | t }}</p> }
              <button type="button" class="btn btn-block" [disabled]="hasErrors() || loading()" (click)="checkout()">
                <span>{{ 'cart.checkout' | t }}</span>
              </button>
            </aside>
          </div>
        }
      </div>
    </section>
  `,
})
export class CartPage {
  protected readonly cart = inject(CartStore);
  protected readonly auth = inject(AuthStore);
  private readonly api = inject(ApiService);
  private readonly site = inject(SiteStore);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18n);
  private readonly priced = signal<PricedLine[]>([]);
  protected readonly loading = signal(true);

  /** Server prices in the cart's order; lines not priced yet show without amounts. */
  protected readonly view = computed(() => {
    const priced = this.priced();
    return this.cart.lines().map((l) => {
      const p = priced.find((x) => x.slug === l.slug && x.sku.toUpperCase() === l.sku.toUpperCase());
      return p ? { ...p, qty: l.qty, total: p.price * l.qty } : ({ ...l, productTitle: '', title: '', unit: 'piece', price: 0, total: 0, minQty: 1, stock: null, image: '', error: '' } as PricedLine);
    });
  });
  protected readonly hasErrors = computed(() => this.priced().some((l) => l.error));
  protected readonly subtotal = computed(() => this.view().reduce((s, l) => s + l.total, 0));
  protected readonly vat = computed(() => this.site.settings().shop?.vatPercent ?? 10);
  protected readonly vatAmount = computed(() => Math.round((this.subtotal() * this.vat()) / 100));
  protected unitKey = (l: PricedLine) => `unit.${l.unit}` as MessageKey;

  constructor() {
    inject(SeoService).set({ title: this.i18n.t('cart.title'), path: '/cart', noindex: true });
    afterNextRender(() => void this.auth.refresh());
    // Re-price whenever the cart changes (quantities, removals, other tabs)
    effect(() => {
      const lines = this.cart.lines();
      untracked(() => void this.reprice(lines));
    });
  }

  private async reprice(lines: { slug: string; sku: string; qty: number }[]) {
    if (!lines.length) return this.priced.set([]);
    this.loading.set(true);
    try {
      this.priced.set((await this.api.priceCart(lines)).lines);
    } finally {
      this.loading.set(false);
    }
  }

  protected setQty(l: PricedLine, raw: string) {
    this.cart.setQty(l.slug, l.sku, Number(String(raw).replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))));
  }

  protected checkout() {
    const target = this.i18n.link('/checkout');
    if (this.auth.user()) void this.router.navigateByUrl(target);
    else void this.router.navigate([this.i18n.link('/account/login')], { queryParams: { next: target } });
  }
}
