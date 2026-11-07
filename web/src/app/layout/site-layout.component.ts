import { DOCUMENT } from '@angular/common';
import { afterNextRender, ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { AuthStore } from '../core/auth.store';
import { QuoteModalComponent } from '../shared/quote/quote-modal';
import { FooterComponent } from './footer.component';
import { HeaderComponent } from './header.component';

/** Public website shell: header, page, footer, inquiry popup. */
@Component({
  selector: 'app-site-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, HeaderComponent, FooterComponent, QuoteModalComponent],
  template: `
    <a class="skip-link" href="#main">پرش به محتوای اصلی</a>
    <app-header />
    <main id="main"><router-outlet /></main>
    <app-footer />
    <app-quote-modal />
  `,
})
export class SiteLayoutComponent {
  constructor() {
    const doc = inject(DOCUMENT);
    const router = inject(Router);
    // The homepage header floats over the hero (styles keyed on body.is-home)
    const mark = (url: string) => doc.body.classList.toggle('is-home', url.split(/[?#]/)[0] === '/');
    mark(router.url);
    router.events.subscribe((e) => e instanceof NavigationEnd && mark(e.urlAfterRedirects));
    const auth = inject(AuthStore);
    afterNextRender(() => void auth.refresh());
  }
}
