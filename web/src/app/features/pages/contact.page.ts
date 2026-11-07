import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import type { Product } from '../../core/models';
import { SeoService } from '../../core/seo.service';
import { SiteStore } from '../../core/site.store';
import { PageHeroComponent } from '../../shared/page-hero.component';
import { QuoteFormComponent } from '../../shared/quote/quote-form.component';

const CRUMBS = [
  { label: 'خانه', url: '/' },
  { label: 'تماس با ما', url: '/contact' },
];

@Component({
  selector: 'app-contact-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeroComponent, QuoteFormComponent],
  template: `
    <app-page-hero heading="تماس و درخواست استعلام" eyebrow="CONTACT & INQUIRY" [crumbs]="crumbs"
      lead="مشخصات اولیه را ثبت کنید و در صورت امکان لیست متریال یا دیتاشیت را پیوست کنید تا کارشناسان ما با اطلاعات کامل‌تری با شما تماس بگیرند." />
    <section class="section section-tight">
      <div class="wrap detail-grid contact-grid">
        <div class="detail-main">
          @if (hasContact()) {
            <h2 class="sub-title">راه‌های ارتباطی</h2>
            <div class="type-grid">
              @if (c().phone) { <a class="type-card" [href]="'tel:' + tel(c().phone)"><b>تلفن</b><span dir="ltr">{{ c().phone }}</span></a> }
              @if (c().whatsapp) { <a class="type-card" [href]="'https://wa.me/' + tel(c().whatsapp)" rel="noopener" target="_blank"><b>واتساپ</b><span>گفت‌وگو با کارشناس فروش</span></a> }
              @if (c().email) { <a class="type-card" [href]="'mailto:' + c().email"><b>ایمیل</b><span dir="ltr">{{ c().email }}</span></a> }
              @if (c().address) { <div class="type-card"><b>نشانی</b><span>{{ c().address }}</span></div> }
              @if (c().hours) { <div class="type-card"><b>ساعات پاسخ‌گویی</b><span>{{ c().hours }}</span></div> }
            </div>
          }

          <h2 class="sub-title">برای استعلام دقیق‌تر این موارد را مشخص کنید</h2>
          <div class="specs">
            <div class="spec"><span>استاندارد مرجع</span><b>API / ASTM / ASME / EN</b></div>
            <div class="spec"><span>متریال / گرید</span><b>مطابق مشخصات پروژه</b></div>
            <div class="spec"><span>ابعاد و ضخامت</span><b>NPS / OD / WT / SCH</b></div>
            <div class="spec"><span>شرایط کاری</span><b>فشار، دما و سیال</b></div>
            <div class="spec"><span>مقدار و محل تحویل</span><b>متراژ / تعداد · شهر یا سایت پروژه</b></div>
            <div class="spec"><span>مدارک موردنیاز</span><b>MTC / Test / Inspection</b></div>
          </div>

          <h2 class="sub-title">پس از ثبت درخواست</h2>
          <ol class="mini-steps">
            <li><b>بررسی فنی</b><span>مشخصات، استاندارد و شرایط سرویس بررسی می‌شود.</span></li>
            <li><b>تماس کارشناس</b><span>برای تکمیل یا شفاف‌سازی اطلاعات با شما تماس می‌گیریم.</span></li>
            <li><b>ارائه پیشنهاد</b><span>موجودی، زمان تأمین و پیشنهاد قیمت اعلام می‌شود.</span></li>
          </ol>
        </div>
        <div class="detail-side">
          <app-quote-form [products]="products()" [anchor]="true" />
        </div>
      </div>
    </section>
  `,
})
export class ContactPage {
  readonly products = input.required<Product[]>();
  protected readonly c = computed(() => this.site.settings().contact);
  protected readonly hasContact = computed(() => Object.values(this.c()).some(Boolean));
  protected readonly crumbs = CRUMBS;
  private readonly site = inject(SiteStore);
  protected tel = (v: string) => v.replace(/[^\d+]/g, '');

  constructor() {
    inject(SeoService).set({
      title: 'تماس و درخواست استعلام',
      description: 'درخواست استعلام قیمت و مشاوره فنی لوله، اتصالات، فلنج و شیرآلات صنعتی از PIPEOX. لیست متریال یا دیتاشیت خود را پیوست کنید.',
      path: '/contact',
      breadcrumbs: CRUMBS,
    });
  }
}
