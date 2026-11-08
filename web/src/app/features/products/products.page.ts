import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { Product } from '../../core/models';
import { SeoService } from '../../core/seo.service';
import { ProductCardComponent } from '../../shared/cards';
import { PageHeroComponent } from '../../shared/page-hero.component';

const CRUMBS = [
  { label: 'خانه', url: '/' },
  { label: 'محصولات', url: '/products' },
];

@Component({
  selector: 'app-products-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeroComponent, ProductCardComponent, RouterLink],
  template: `
    <app-page-hero heading="محصولات و راهکارها" eyebrow="PRODUCT PORTFOLIO" [crumbs]="crumbs"
      lead="برای انتخاب درست، فقط نام محصول کافی نیست. جنس، گرید، ابعاد، ضخامت، فشار و استاندارد باید با شرایط واقعی پروژه هم‌خوانی داشته باشند. هر گروه را برای مشاهده مشخصات فنی باز کنید." />
    <section class="section section-tight">
      <div class="wrap">
        @if (q()) {
          <p class="search-note">نتایج جستجو برای «{{ q() }}» — <a routerLink="/products">نمایش همه</a></p>
        }
        <div class="products">
          @for (p of filtered(); track p._id) {
            <app-product-card [product]="p" [index]="indexOf(p)" />
          }
        </div>
        @if (!filtered().length) {
          <p class="no-results">محصولی با این عبارت پیدا نشد. <a routerLink="/contact">درخواست خود را مستقیم ثبت کنید ←</a></p>
        }
      </div>
    </section>
  `,
})
export class ProductsPage {
  readonly products = input.required<Product[]>();
  /** ?q= from the header search box. */
  readonly q = input<string>('');
  protected readonly crumbs = CRUMBS;

  protected readonly filtered = computed(() => {
    const q = (this.q() ?? '').trim().toLowerCase();
    if (!q) return this.products();
    return this.products().filter((p) => [p.title, p.keywords, p.summary, p.code].join(' ').toLowerCase().includes(q));
  });
  protected indexOf = (p: Product) => this.products().indexOf(p) + 1;

  constructor() {
    inject(SeoService).set({
      title: 'محصولات و راهکارها',
      description: 'کاتالوگ PIPEOX — لوله‌های فولادی، اتصالات صنعتی، فلنج و متعلقات، شیرآلات و تجهیزات خطوط انتقال؛ همراه با استانداردها و مشخصات فنی هر گروه.',
      path: '/products',
      breadcrumbs: CRUMBS,
    });
  }
}
