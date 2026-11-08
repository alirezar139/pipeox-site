import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { Product } from '../../core/models';
import { I18n, LinkPipe, TPipe } from '../../core/i18n';
import { SeoService } from '../../core/seo.service';
import { ProductCardComponent } from '../../shared/cards';
import { PageHeroComponent } from '../../shared/page-hero.component';


@Component({
  selector: 'app-products-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeroComponent, ProductCardComponent, RouterLink, TPipe, LinkPipe],
  template: `
    <app-page-hero [heading]="'products.title' | t" [eyebrow]="'eb.products' | t" [crumbs]="crumbs" [lead]="'products.lead' | t" />
    <section class="section section-tight">
      <div class="wrap">
        @if (q()) {
          <p class="search-note">{{ 'products.results' | t: { q: q() } }} — <a [routerLink]="'/products' | link">{{ 'products.showAll' | t }}</a></p>
        }
        <div class="products">
          @for (p of filtered(); track p._id) {
            <app-product-card [product]="p" [index]="indexOf(p)" />
          }
        </div>
        @if (!filtered().length) {
          <p class="no-results">{{ 'products.none' | t }} <a [routerLink]="'/contact' | link">{{ 'products.direct' | t }}</a></p>
        }
      </div>
    </section>
  `,
})
export class ProductsPage {
  readonly products = input.required<Product[]>();
  /** ?q= from the header search box. */
  readonly q = input<string>('');
  private readonly i18n = inject(I18n);
  protected readonly crumbs = [
    { label: this.i18n.t('nav.home'), url: '/' },
    { label: this.i18n.t('nav.products'), url: '/products' },
  ];

  protected readonly filtered = computed(() => {
    const q = (this.q() ?? '').trim().toLowerCase();
    if (!q) return this.products();
    return this.products().filter((p) => [p.title, p.keywords, p.summary, p.code].join(' ').toLowerCase().includes(q));
  });
  protected indexOf = (p: Product) => this.products().indexOf(p) + 1;

  constructor() {
    inject(SeoService).set({
      title: this.i18n.t('products.title'),
      description: this.i18n.t('products.seoDesc'),
      path: '/products',
      breadcrumbs: this.crumbs,
    });
  }
}
