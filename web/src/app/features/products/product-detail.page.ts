import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import type { Product } from '../../core/models';
import { SeoService } from '../../core/seo.service';
import { ProductCardComponent } from '../../shared/cards';
import { PageHeroComponent } from '../../shared/page-hero.component';
import { NotFoundPage } from '../pages/not-found.page';
import { QuoteFormComponent } from '../../shared/quote/quote-form.component';

@Component({
  selector: 'app-product-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeroComponent, QuoteFormComponent, ProductCardComponent, NotFoundPage],
  template: `
    @if (product(); as p) {
    <app-page-hero [heading]="p.title" [eyebrow]="p.code" [lead]="p.summary" [crumbs]="crumbs()" />
    <section class="section section-tight">
      <div class="wrap detail-grid">
        <div class="detail-main">
          <div class="detail-intro">
            @if (p.image) {
              <div class="detail-image"><img [src]="p.image" [alt]="p.alt" decoding="async" width="800" height="600"></div>
            }
            <p>{{ p.intro }}</p>
          </div>

          @if (p.types.length) {
            <h2 class="sub-title">انواع رایج</h2>
            <div class="type-grid">
              @for (t of p.types; track $index) { <div class="type-card"><b>{{ t.name }}</b><span>{{ t.desc }}</span></div> }
            </div>
          }

          <h2 class="sub-title">مشخصات فنی قابل استعلام</h2>
          <div class="specs">
            @for (row of p.specs; track $index) { <div class="spec"><span>{{ row.label }}</span><b dir="auto">{{ row.value }}</b></div> }
            <div class="spec"><span>مدارک</span><b>MTC طبق EN 10204 (3.1 / 3.2) · بازرسی شخص ثالث در صورت نیاز</b></div>
          </div>
          <p class="spec-note">موجودی، برند و محدوده دقیق هر قلم در زمان استعلام اعلام می‌شود.</p>

          @if (p.applications.length) {
            <h2 class="sub-title">کاربردها</h2>
            <ul class="chips">
              @for (a of p.applications; track $index) { <li>{{ a }}</li> }
            </ul>
          }
        </div>
        <div class="detail-side">
          <app-quote-form [heading]="'استعلام ' + p.title" [selectedProduct]="p.title" [products]="all()" [anchor]="true" />
        </div>
      </div>
    </section>

    @if (others().length) {
      <section class="section section-tight related">
        <div class="wrap">
          <h2 class="sub-title">سایر گروه‌های محصول</h2>
          <div class="products products-3">
            @for (o of others(); track o._id) { <app-product-card [product]="o" [index]="all().indexOf(o) + 1" /> }
          </div>
        </div>
      </section>
    }
    } @else {
      <app-not-found-page />
    }
  `,
})
export class ProductDetailPage {
  readonly product = input.required<Product | null>();
  readonly all = input.required<Product[]>({ alias: 'products' });
  protected readonly others = computed(() => this.all().filter((o) => o.slug !== this.product()?.slug));
  protected readonly crumbs = computed(() => [
    { label: 'خانه', url: '/' },
    { label: 'محصولات', url: '/products' },
    { label: this.product()?.title ?? '', url: `/products/${this.product()?.slug}` },
  ]);

  constructor() {
    const seo = inject(SeoService);
    effect(() => {
      const p = this.product();
      if (!p) return;
      seo.set({
        title: p.title,
        description: (p.intro || p.summary).slice(0, 155),
        path: `/products/${p.slug}`,
        image: p.image || undefined,
        breadcrumbs: this.crumbs(),
        jsonLd: [
          {
            '@context': 'https://schema.org',
            '@type': 'Product',
            name: p.title,
            description: p.intro || p.summary,
            category: p.code,
            ...(p.image ? { image: seo.origin() + p.image } : {}),
            brand: { '@type': 'Brand', name: 'PIPEOX' },
          },
        ],
      });
    });
  }
}
