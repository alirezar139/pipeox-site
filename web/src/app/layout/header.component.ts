import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthStore } from '../core/auth.store';
import { CartStore } from '../core/cart.store';
import { FaNumPipe } from '../core/format';
import { I18n, LANG_LIST, LANG_META, LinkPipe, TPipe, type Lang } from '../core/i18n';
import { IconComponent } from '../shared/icon.component';
import { LogoComponent } from './logo.component';
import { HEADER_NAV } from './nav';

@Component({
  selector: 'app-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, IconComponent, LogoComponent, TPipe, LinkPipe, FaNumPipe],
  host: {
    class: 'site-header',
    '[class.scrolled]': 'scrolled() || menuOpen()',
    '(window:scroll)': 'onScroll()',
    '(document:keydown.escape)': 'menuOpen.set(false); langOpen.set(false)',
    '(document:click)': 'langOpen.set(false)',
  },
  template: `
    <div class="wrap-header nav">
      <app-logo />
      <nav class="links" id="navlinks" [class.open]="menuOpen()" [attr.aria-label]="'nav.main' | t">
        @for (item of nav; track item.path) {
          <a [routerLink]="item.path | link" routerLinkActive="active" ariaCurrentWhenActive="page"
            [routerLinkActiveOptions]="{ exact: item.exact }" (click)="menuOpen.set(false)">{{ item.key | t }}</a>
        }
      </nav>
      <div class="nav-actions">
        <form class="search" role="search" (submit)="search($event, q.value)">
          <label for="site-search" class="search-ico"><app-icon name="search" /></label>
          <input #q id="site-search" type="search" name="q" [placeholder]="'nav.search' | t" [attr.aria-label]="'nav.searchLabel' | t" autocomplete="off">
        </form>
        <div class="lang-switch" (click)="$event.stopPropagation()">
          <button type="button" class="lang-btn" (click)="langOpen.update((v) => !v)" [attr.aria-expanded]="langOpen()" aria-haspopup="true"
            [attr.aria-label]="('nav.language' | t) + ': ' + meta[i18n.lang()].label">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z"/></svg>
            <span>{{ meta[i18n.lang()].short }}</span>
          </button>
          @if (langOpen()) {
            <ul class="lang-menu" role="menu">
              @for (l of langs; track l) {
                <li role="none">
                  <a role="menuitem" [attr.href]="i18n.switchUrl(router.url, l)" [attr.hreflang]="l" [attr.lang]="l" [class.on]="l === i18n.lang()"
                    (click)="switchTo($event, l)">
                    <b>{{ meta[l].short }}</b><span>{{ meta[l].label }}</span>
                  </a>
                </li>
              }
            </ul>
          }
        </div>
        <a class="pill pill-ghost nav-account" routerLinkActive="is-active" [routerLink]="(auth.user() ? '/account' : '/account/login') | link"
          [attr.title]="auth.user()?.email ?? null">
          <app-icon name="user" /><span>{{ (auth.user() ? 'nav.myAccount' : 'nav.login') | t }}</span>
        </a>
        @if (cart.count()) {
          <a class="pill pill-ghost nav-cart" routerLinkActive="is-active" [routerLink]="'/cart' | link" [attr.aria-label]="('nav.cart' | t) + ' (' + cart.count() + ')'">
            <app-icon name="cart" /><em>{{ cart.count() | faNum }}</em>
          </a>
        }
        <span class="nav-sep" aria-hidden="true"></span>
        <a class="btn-cta" [routerLink]="'/contact' | link" routerLinkActive="is-active" ariaCurrentWhenActive="page">
          <span class="cta-full">{{ 'nav.cta' | t }}</span><span class="cta-short">{{ 'nav.ctaShort' | t }}</span><i class="btn-dot"><app-icon name="arrow" /></i>
        </a>
        <button class="hamb" type="button" [attr.aria-label]="(menuOpen() ? 'nav.closeMenu' : 'nav.openMenu') | t" aria-controls="navlinks"
          [attr.aria-expanded]="menuOpen()" (click)="menuOpen.update((v) => !v)">
          <app-icon [name]="menuOpen() ? 'close' : 'menu'" />
        </button>
      </div>
    </div>
  `,
})
export class HeaderComponent {
  protected readonly nav = HEADER_NAV;
  protected readonly langs = LANG_LIST;
  protected readonly meta = LANG_META;
  protected readonly auth = inject(AuthStore);
  protected readonly cart = inject(CartStore);
  protected readonly i18n = inject(I18n);
  protected readonly router = inject(Router);
  protected readonly scrolled = signal(false);
  protected readonly menuOpen = signal(false);
  protected readonly langOpen = signal(false);

  constructor() {
    this.router.events.subscribe((e) => {
      if (e instanceof NavigationEnd) {
        this.menuOpen.set(false);
        this.langOpen.set(false);
      }
    });
  }

  onScroll() {
    this.scrolled.set(window.scrollY > 24);
  }

  search(e: Event, value: string) {
    e.preventDefault();
    this.router.navigate([this.i18n.link('/products')], { queryParams: { q: value.trim() || null } });
  }

  /** Same page, other language (in-app navigation; the href also works without JS). */
  switchTo(e: MouseEvent, lang: Lang) {
    if (e.ctrlKey || e.metaKey || e.shiftKey) return;
    e.preventDefault();
    this.langOpen.set(false);
    if (lang !== this.i18n.lang()) void this.router.navigateByUrl(this.i18n.switchUrl(this.router.url, lang));
  }
}
