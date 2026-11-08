import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import type { Product } from '../../core/models';
import { I18n, TPipe } from '../../core/i18n';
import { SeoService } from '../../core/seo.service';
import { SiteStore } from '../../core/site.store';
import { PageHeroComponent } from '../../shared/page-hero.component';
import { QuoteFormComponent } from '../../shared/quote/quote-form.component';


@Component({
  selector: 'app-contact-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeroComponent, QuoteFormComponent, TPipe],
  template: `
    <app-page-hero [heading]="'contact.title' | t" [eyebrow]="'eb.contact' | t" [crumbs]="crumbs" [lead]="'contact.lead' | t" />
    <section class="section section-tight">
      <div class="wrap detail-grid contact-grid">
        <div class="detail-main">
          @if (hasContact()) {
            <h2 class="sub-title">{{ 'contact.ways' | t }}</h2>
            <div class="type-grid">
              @if (c().phone) { <a class="type-card" [href]="'tel:' + tel(c().phone)"><b>{{ 'contact.phone' | t }}</b><span dir="ltr">{{ c().phone }}</span></a> }
              @if (c().whatsapp) { <a class="type-card" [href]="'https://wa.me/' + tel(c().whatsapp)" rel="noopener" target="_blank"><b>{{ 'footer.whatsapp' | t }}</b><span>{{ 'contact.whatsappText' | t }}</span></a> }
              @if (c().email) { <a class="type-card" [href]="'mailto:' + c().email"><b>{{ 'contact.email' | t }}</b><span dir="ltr">{{ c().email }}</span></a> }
              @if (c().address) { <div class="type-card"><b>{{ 'contact.address' | t }}</b><span>{{ c().address }}</span></div> }
              @if (c().hours) { <div class="type-card"><b>{{ 'contact.hours' | t }}</b><span>{{ c().hours }}</span></div> }
            </div>
          }

          <h2 class="sub-title">{{ 'contact.specify' | t }}</h2>
          <div class="specs">
            <div class="spec"><span>{{ 'contact.sp1' | t }}</span><b>API / ASTM / ASME / EN</b></div>
            <div class="spec"><span>{{ 'contact.sp2' | t }}</span><b>{{ 'contact.sp2v' | t }}</b></div>
            <div class="spec"><span>{{ 'contact.sp3' | t }}</span><b>NPS / OD / WT / SCH</b></div>
            <div class="spec"><span>{{ 'contact.sp4' | t }}</span><b>{{ 'contact.sp4v' | t }}</b></div>
            <div class="spec"><span>{{ 'contact.sp5' | t }}</span><b>{{ 'contact.sp5v' | t }}</b></div>
            <div class="spec"><span>{{ 'contact.sp6' | t }}</span><b>MTC / Test / Inspection</b></div>
          </div>

          <h2 class="sub-title">{{ 'contact.after' | t }}</h2>
          <ol class="mini-steps">
            <li><b>{{ 'contact.a1' | t }}</b><span>{{ 'contact.a1Text' | t }}</span></li>
            <li><b>{{ 'contact.a2' | t }}</b><span>{{ 'contact.a2Text' | t }}</span></li>
            <li><b>{{ 'contact.a3' | t }}</b><span>{{ 'contact.a3Text' | t }}</span></li>
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
  private readonly i18n = inject(I18n);
  protected readonly crumbs = [
    { label: this.i18n.t('nav.home'), url: '/' },
    { label: this.i18n.t('contact.crumb'), url: '/contact' },
  ];
  private readonly site = inject(SiteStore);
  protected tel = (v: string) => v.replace(/[^\d+]/g, '');

  constructor() {
    inject(SeoService).set({
      title: this.i18n.t('contact.title'),
      description: this.i18n.t('contact.seoDesc'),
      path: '/contact',
      breadcrumbs: this.crumbs,
    });
  }
}
