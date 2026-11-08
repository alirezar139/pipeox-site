import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { useResponseStatus } from '../../core/http-status';
import { I18n, LinkPipe, TPipe } from '../../core/i18n';
import { SeoService } from '../../core/seo.service';

@Component({
  selector: 'app-not-found-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TPipe, LinkPipe],
  template: `
    <section class="section not-found">
      <div class="wrap">
        <div class="code" aria-hidden="true">404</div>
        <h1>{{ 'notFound.title' | t }}</h1>
        <p>{{ 'notFound.text' | t }}</p>
        <div class="actions">
          <a class="btn btn-pill" [routerLink]="'/' | link">{{ 'notFound.home' | t }}</a>
          <a class="btn btn-pill btn-ghost" [routerLink]="'/products' | link">{{ 'notFound.products' | t }}</a>
        </div>
      </div>
    </section>
  `,
})
export class NotFoundPage {
  constructor() {
    useResponseStatus()(404);
    inject(SeoService).set({ title: inject(I18n).t('notFound.seo'), path: '/404', noindex: true });
  }
}
