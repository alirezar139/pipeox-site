import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FaDatePipe } from '../core/format';
import type { ArticleSummary, Product } from '../core/models';

@Component({
  selector: 'app-product-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  host: { class: 'product' },
  template: `
    <div class="visual">
      @if (p().image) { <img [src]="p().image" [alt]="p().alt" loading="lazy" decoding="async" width="600" height="400"> }
    </div>
    <small>{{ index().toString().padStart(2, '0') }} / {{ p().code }}</small>
    <h3><a class="card-link" [routerLink]="['/products', p().slug]">{{ p().title }}</a></h3>
    <p>{{ p().summary }}</p>
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
    @if (a().image) { <img [src]="a().image" [alt]="a().imageAlt" loading="lazy" decoding="async" width="600" height="340"> }
    <div class="storybody">
      <small>{{ a().category }} · <time [attr.datetime]="a().publishedAt">{{ a().publishedAt | faDate }}</time></small>
      <h3><a class="card-link" [routerLink]="['/insights', a().slug]">{{ a().title }}</a></h3>
      <p>{{ a().description.length > 110 ? a().description.slice(0, 110) + '…' : a().description }}</p>
    </div>
  `,
})
export class StoryCardComponent {
  readonly a = input.required<ArticleSummary>({ alias: 'article' });
}

/** Closing call-to-action band shared by inner pages. */
