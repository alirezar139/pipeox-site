import { ChangeDetectionStrategy, Component, ElementRef, inject, signal } from '@angular/core';
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
    '(document:click)': 'outside($event)',
    '(document:keydown.escape)': 'open.set(false)',
  },
  template: `
    @if (open()) {
      <div class="support-card" id="support-card" role="dialog" [attr.aria-label]="'support.title' | t">
        <div class="support-head">
          <b>{{ 'support.title' | t }}</b>
          <span>{{ (c().hours || ('support.text' | t)) }}</span>
        </div>
        <a class="support-item primary" [routerLink]="'/contact' | link" (click)="open.set(false)">
          <app-icon name="send" /><span>{{ 'support.form' | t }}</span>
        </a>
        @if (c().phone) {
          <a class="support-item" [href]="'tel:' + tel(c().phone)"><app-icon name="phone" /><span dir="ltr">{{ c().phone }}</span></a>
        }
        @if (c().whatsapp) {
          <a class="support-item" [href]="'https://wa.me/' + tel(c().whatsapp)" target="_blank" rel="noopener"><app-icon name="headset" /><span>{{ 'footer.whatsapp' | t }}</span></a>
        }
        @if (c().email) {
          <a class="support-item" [href]="'mailto:' + c().email"><app-icon name="mail" /><span dir="ltr">{{ c().email }}</span></a>
        }
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
  protected readonly c = () => this.site.settings().contact;
  private readonly site = inject(SiteStore);
  private readonly host = inject(ElementRef<HTMLElement>);
  protected tel = (v: string) => v.replace(/[^\d+]/g, '');

  constructor() {
    const router = inject(Router);
    // The Contact page already is the support page — no floating button there
    const check = (url: string) => this.hidden.set(/^\/((en|de)\/)?contact/.test(url.split(/[?#]/)[0]));
    check(router.url);
    router.events.subscribe((e) => {
      if (e instanceof NavigationEnd) {
        check(e.urlAfterRedirects);
        this.open.set(false);
      }
    });
  }

  protected outside(e: Event) {
    if (this.open() && !this.host.nativeElement.contains(e.target as Node)) this.open.set(false);
  }
}
