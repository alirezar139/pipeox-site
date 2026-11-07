import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

export interface Crumb {
  label: string;
  url: string;
}

/** Inner-page header: breadcrumb, eyebrow, H1, lead. */
@Component({
  selector: 'app-page-hero',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  host: { class: 'page-hero' },
  template: `
    <div class="wrap">
      @if (crumbs().length) {
        <nav class="breadcrumb" aria-label="مسیر صفحه">
          @for (c of crumbs(); track c.url; let last = $last) {
            @if (last) {
              <span aria-current="page">{{ c.label }}</span>
            } @else {
              <a [routerLink]="c.url">{{ c.label }}</a><i aria-hidden="true">/</i>
            }
          }
        </nav>
      }
      @if (eyebrow()) { <div class="eyebrow">{{ eyebrow() }}</div> }
      <h1>{{ heading() }}</h1>
      @if (lead()) { <p class="lead">{{ lead() }}</p> }
    </div>
  `,
})
export class PageHeroComponent {
  readonly heading = input.required<string>();
  readonly eyebrow = input('');
  readonly lead = input('');
  readonly crumbs = input<Crumb[]>([]);
}
