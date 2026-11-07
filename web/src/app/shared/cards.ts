import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FaDatePipe } from '../core/format';
import type { ArticleSummary, Product } from '../core/models';
import { IconComponent } from './icon.component';
import { RevealDirective } from './motion.directives';
import { QuoteModal } from './quote/quote-modal';

@Component({
  selector: 'app-product-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  host: { class: 'product' },
  template: `
    <a class="visual" [routerLink]="['/products', p().slug]" tabindex="-1" aria-hidden="true">
      @if (p().image) { <img [src]="p().image" [alt]="p().alt" loading="lazy" decoding="async" width="600" height="400"> }
    </a>
    <small>{{ index().toString().padStart(2, '0') }} / {{ p().code }}</small>
    <h3><a [routerLink]="['/products', p().slug]">{{ p().title }}</a></h3>
    <p>{{ p().summary }}</p>
    <a class="more" [routerLink]="['/products', p().slug]">مشخصات و استعلام <span>←</span></a>
  `,
})
export class ProductCardComponent {
  readonly p = input.required<Product>({ alias: 'product' });
  readonly index = input(1);
}

@Component({
  selector: 'app-story-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, FaDatePipe],
  host: { class: 'story' },
  template: `
    <a [routerLink]="['/insights', a().slug]" tabindex="-1" aria-hidden="true">
      @if (a().image) { <img [src]="a().image" [alt]="a().imageAlt" loading="lazy" decoding="async" width="600" height="340"> }
    </a>
    <div class="storybody">
      <small>{{ a().category }} · <time [attr.datetime]="a().publishedAt">{{ a().publishedAt | faDate }}</time></small>
      <h3><a [routerLink]="['/insights', a().slug]">{{ a().title }}</a></h3>
      <p>{{ a().description.length > 110 ? a().description.slice(0, 110) + '…' : a().description }}</p>
    </div>
  `,
})
export class StoryCardComponent {
  readonly a = input.required<ArticleSummary>({ alias: 'article' });
}

/** Closing call-to-action band shared by inner pages. */
@Component({
  selector: 'app-cta-band',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, RevealDirective],
  host: { class: 'cta-band' },
  template: `
    <div class="wrap">
      <div class="cta-card" appReveal>
        <div>
          <h2>برای پروژه بعدی خود، از همین‌جا شروع کنید.</h2>
          <p>نیاز فنی و اقلام موردنظر را ارسال کنید تا درخواست شما بررسی شود.</p>
        </div>
        <button type="button" class="btn btn-pill btn-cta" (click)="quote.show()">
          <span>درخواست مشاوره و استعلام</span><i class="btn-dot"><app-icon name="arrow" /></i>
        </button>
      </div>
    </div>
  `,
})
export class CtaBandComponent {
  protected readonly quote = inject(QuoteModal);
}
