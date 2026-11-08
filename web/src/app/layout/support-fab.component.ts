import { afterNextRender, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { LinkPipe, TPipe } from '../core/i18n';
import { SiteStore } from '../core/site.store';
import { IconComponent } from '../shared/icon.component';

/**
 * Floating "Support" button (bottom corner, every public page except Contact).
 * Opens a small card: inquiry form + whichever of phone / WhatsApp / email are set in the panel.
 */
@Component({
  selector: 'app-support-fab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent, TPipe, LinkPipe],
  host: {
    class: 'support-fab',
    '[class.open]': 'open()',
    '[class.hidden]': 'hidden()',
    '[style.--fab-lift.px]': 'lift()',
    '(document:click)': 'outside($event)',
    '(document:keydown.escape)': 'open.set(false)',
  },
  template: `
    @if (open()) {
      <div class="support-card" id="support-card" role="dialog" [attr.aria-label]="'support.title' | t">
        <div class="support-head">
          <span class="support-avatar"><app-icon name="headset" /></span>
          <div class="support-head-txt">
            <b>{{ 'support.title' | t }}</b>
            <small><i class="support-live" aria-hidden="true"></i>{{ c().hours || ('support.text' | t) }}</small>
          </div>
        </div>
        <div class="support-list">
          <a class="support-item primary" [routerLink]="'/contact' | link" (click)="open.set(false)">
            <span class="support-item-ico"><app-icon name="send" /></span>
            <span class="support-item-txt"><b>{{ 'support.form' | t }}</b><small>{{ 'support.formHint' | t }}</small></span>
            <app-icon class="support-go" name="chevron" />
          </a>
          @if (c().phone) {
            <a class="support-item" [href]="'tel:' + tel(c().phone)">
              <span class="support-item-ico"><app-icon name="phone" /></span>
              <span class="support-item-txt"><b>{{ 'contact.phone' | t }}</b><small dir="ltr">{{ c().phone }}</small></span>
              <app-icon class="support-go" name="chevron" />
            </a>
          }
          @if (c().whatsapp) {
            <a class="support-item" [href]="'https://wa.me/' + tel(c().whatsapp)" target="_blank" rel="noopener">
              <span class="support-item-ico"><app-icon name="headset" /></span>
              <span class="support-item-txt"><b>{{ 'footer.whatsapp' | t }}</b><small>{{ 'contact.whatsappText' | t }}</small></span>
              <app-icon class="support-go" name="chevron" />
            </a>
          }
          @if (c().email) {
            <a class="support-item" [href]="'mailto:' + c().email">
              <span class="support-item-ico"><app-icon name="mail" /></span>
              <span class="support-item-txt"><b>{{ 'contact.email' | t }}</b><small dir="ltr">{{ c().email }}</small></span>
              <app-icon class="support-go" name="chevron" />
            </a>
          }
        </div>
      </div>
    }
    <button type="button" class="support-btn" [attr.aria-expanded]="open()" aria-controls="support-card" (click)="open.set(!open())">
      <span class="support-ico"><app-icon [name]="open() ? 'close' : 'headset'" /></span>
      <span class="support-label">{{ 'support.label' | t }}</span>
      <span class="support-dot" aria-hidden="true"></span>
    </button>
  `,
})
export class SupportFabComponent {
  protected readonly open = signal(false);
  protected readonly hidden = signal(false);
  /** How far the footer has scrolled into view, so the button rides above it instead of covering it. */
  protected readonly lift = signal(0);
  protected readonly c = () => this.site.settings().contact;
  private readonly site = inject(SiteStore);
  private readonly host = inject(ElementRef<HTMLElement>);
  protected tel = (v: string) => v.replace(/[^\d+]/g, '');

  constructor() {
    const router = inject(Router);
    const destroyRef = inject(DestroyRef);
    // The Contact page already is the support page — no floating button there
    const check = (url: string) => this.hidden.set(/^\/((en|de)\/)?contact/.test(url.split(/[?#]/)[0]));
    check(router.url);
    router.events.subscribe((e) => {
      if (e instanceof NavigationEnd) {
        check(e.urlAfterRedirects);
        this.open.set(false);
      }
    });

    afterNextRender(() => {
      let raf = 0;
      const update = () => {
        raf = 0;
        const footer = document.querySelector('app-footer');
        const top = footer ? footer.getBoundingClientRect().top : Infinity;
        this.lift.set(Math.max(0, Math.round(window.innerHeight - top)));
      };
      const schedule = () => (raf ||= requestAnimationFrame(update));
      window.addEventListener('scroll', schedule, { passive: true });
      window.addEventListener('resize', schedule);
      update();
      destroyRef.onDestroy(() => {
        window.removeEventListener('scroll', schedule);
        window.removeEventListener('resize', schedule);
        cancelAnimationFrame(raf);
      });
    });
  }

  protected outside(e: Event) {
    if (this.open() && !this.host.nativeElement.contains(e.target as Node)) this.open.set(false);
  }
}
