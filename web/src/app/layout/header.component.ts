import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthStore } from '../core/auth.store';
import { IconComponent } from '../shared/icon.component';
import { QuoteModal } from '../shared/quote/quote-modal';
import { LogoComponent } from './logo.component';
import { HEADER_NAV } from './nav';

@Component({
  selector: 'app-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, IconComponent, LogoComponent],
  host: {
    class: 'site-header',
    '[class.scrolled]': 'scrolled() || menuOpen()',
    '(window:scroll)': 'onScroll()',
    '(document:keydown.escape)': 'menuOpen.set(false)',
  },
  template: `
    <div class="wrap-header nav">
      <app-logo />
      <nav class="links" id="navlinks" [class.open]="menuOpen()" aria-label="منوی اصلی">
        @for (item of nav; track item.path) {
          <a [routerLink]="item.path" routerLinkActive="active" ariaCurrentWhenActive="page"
            [routerLinkActiveOptions]="{ exact: item.exact }" (click)="menuOpen.set(false)">{{ item.label }}</a>
        }
      </nav>
      <div class="nav-actions">
        <form class="search" role="search" (submit)="search($event, q.value)">
          <app-icon name="search" />
          <input #q type="search" name="q" placeholder="جستجو در محصولات..." aria-label="جستجو در محصولات" autocomplete="off">
        </form>
        <a class="pill pill-ghost nav-account" routerLinkActive="is-active" [routerLink]="auth.user() ? '/account' : '/account/login'"
          [attr.title]="auth.user()?.email ?? null">
          <app-icon name="user" /><span>{{ auth.user() ? 'حساب من' : 'ورود / ثبت‌نام' }}</span>
        </a>
        <a class="btn-cta" routerLink="/contact" (click)="openQuote($event)">
          <span>درخواست استعلام قیمت</span><i class="btn-dot"><app-icon name="arrow" /></i>
        </a>
        <button class="hamb" type="button" [attr.aria-label]="menuOpen() ? 'بستن منو' : 'باز کردن منو'" aria-controls="navlinks"
          [attr.aria-expanded]="menuOpen()" (click)="menuOpen.update((v) => !v)">
          <app-icon [name]="menuOpen() ? 'close' : 'menu'" />
        </button>
      </div>
    </div>
  `,
})
export class HeaderComponent {
  protected readonly nav = HEADER_NAV;
  protected readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly quote = inject(QuoteModal);
  protected readonly scrolled = signal(false);
  protected readonly menuOpen = signal(false);

  constructor() {
    this.router.events.subscribe((e) => e instanceof NavigationEnd && this.menuOpen.set(false));
  }

  onScroll() {
    this.scrolled.set(window.scrollY > 24);
  }

  search(e: Event, value: string) {
    e.preventDefault();
    this.router.navigate(['/products'], { queryParams: { q: value.trim() || null } });
  }

  /** The contact page already shows the full form; everywhere else open the popup. */
  openQuote(e: MouseEvent) {
    if (this.router.url.startsWith('/contact') || e.ctrlKey || e.metaKey) return;
    e.preventDefault();
    this.quote.show();
  }
}
