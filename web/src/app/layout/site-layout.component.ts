import { DOCUMENT } from '@angular/common';
import { afterNextRender, ChangeDetectionStrategy, Component, DestroyRef, effect, inject, untracked } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { AuthStore } from '../core/auth.store';
import { watchIdle } from '../core/idle-watch';
import { FooterComponent } from './footer.component';
import { HeaderComponent } from './header.component';

/** Public website shell: header, page, footer. */
@Component({
  selector: 'app-site-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, HeaderComponent, FooterComponent],
  template: `
    <a class="skip-link" href="#main">پرش به محتوای اصلی</a>
    <app-header />
    <main id="main"><router-outlet /></main>
    <app-footer />
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

    // Signed-in customers: 30 minutes without activity → sign out (the server enforces the same limit)
    let stop: (() => void) | null = null;
    effect(() => {
      const signedIn = !!auth.user();
      untracked(() => {
        stop?.();
        stop = null;
        if (!signedIn) return;
        stop = watchIdle('customer', {
          ping: () => auth.refresh(true),
          timeout: async () => {
            await auth.logout().catch(() => auth.set(null));
            if (router.url.startsWith('/account')) await router.navigate(['/account/login'], { queryParams: { reason: 'idle' } });
          },
        });
      });
    });
    inject(DestroyRef).onDestroy(() => stop?.());
  }
}
