import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CartStore } from '../../core/cart.store';
import { FaNumPipe, TomanPipe } from '../../core/format';
import { LinkPipe, TPipe } from '../../core/i18n';
import type { MessageKey } from '../../core/messages';
import type { Product, ProductVariant } from '../../core/models';
import { IconComponent } from '../../shared/icon.component';

/** Product page: the sizes/grades sold online at a fixed price, with quantity and "add to cart". */
@Component({
  selector: 'app-buy-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent, TPipe, LinkPipe, TomanPipe, FaNumPipe],
  template: `
    <h2 class="sub-title" id="buy">{{ 'shop.buyTitle' | t }}</h2>
    <p class="shop-lead">{{ 'shop.buyLead' | t }}</p>
    @if (added(); as a) {
      <p class="notice notice-ok shop-added" role="status">
        {{ 'shop.added' | t: { name: a } }} <a [routerLink]="'/cart' | link">{{ 'shop.viewCart' | t }} ←</a>
      </p>
    }
    <div class="buy-table" role="table" [attr.aria-label]="'shop.buyTitle' | t">
      <div class="buy-row buy-head" role="row">
        <span role="columnheader">{{ 'shop.colItem' | t }}</span>
        <span role="columnheader">{{ 'shop.colPrice' | t }}</span>
        <span role="columnheader">{{ 'shop.colStock' | t }}</span>
        <span role="columnheader">{{ 'shop.colQty' | t }}</span>
      </div>
      @for (v of product().variants; track v.sku) {
        <div class="buy-row" role="row" [class.off]="v.stock === 0">
          <span role="cell" class="buy-item">
            <b dir="auto">{{ v.title }}</b>
            <small dir="ltr">{{ v.sku }}</small>
            @if (v.minQty > 1) { <small>{{ 'shop.min' | t: { n: (v.minQty | faNum), unit: (unitKey(v) | t) } }}</small> }
          </span>
          <span role="cell" class="buy-price"><b>{{ v.price | toman }}</b><small>/ {{ unitKey(v) | t }}</small></span>
          <span role="cell" class="buy-stock">
            @if (v.stock === null) { <i class="dot ok"></i>{{ 'shop.toOrder' | t }} }
            @else if (v.stock > 0) { <i class="dot ok"></i>{{ 'shop.left' | t: { n: (v.stock | faNum), unit: (unitKey(v) | t) } }} }
            @else { <i class="dot no"></i>{{ 'shop.outOfStock' | t }} }
          </span>
          <span role="cell" class="buy-qty">
            @if (v.stock !== 0) {
              <input type="number" inputmode="numeric" [min]="v.minQty" [max]="v.stock ?? 1000000" [value]="qty(v)"
                (input)="setQty(v, $any($event.target).value)" [attr.aria-label]="('shop.colQty' | t) + ' — ' + v.title">
              <button type="button" class="btn btn-sm" (click)="add(v)"><app-icon name="plus" /><span>{{ 'shop.add' | t }}</span></button>
            }
          </span>
        </div>
      }
    </div>
  `,
})
export class BuyTableComponent {
  readonly product = input.required<Product>();
  private readonly cart = inject(CartStore);
  private readonly qtys = signal<Record<string, number>>({});
  protected readonly added = signal('');

  protected unitKey = (v: ProductVariant) => `unit.${v.unit}` as MessageKey;
  protected qty = (v: ProductVariant) => this.qtys()[v.sku] ?? v.minQty;

  protected setQty(v: ProductVariant, raw: string) {
    const n = Math.floor(Number(String(raw).replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))));
    this.qtys.update((m) => ({ ...m, [v.sku]: Number.isFinite(n) && n > 0 ? n : v.minQty }));
  }

  protected add(v: ProductVariant) {
    let q = Math.max(this.qty(v), v.minQty);
    if (v.stock !== null) q = Math.min(q, v.stock);
    this.cart.add(this.product().slug, v.sku, q);
    this.added.set(`${this.product().title} — ${v.title}`);
  }
}
