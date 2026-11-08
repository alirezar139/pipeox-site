import {
  afterNextRender, ChangeDetectionStrategy, Component, DestroyRef, effect, ElementRef, inject, signal, viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { I18n, LinkPipe, TPipe } from '../core/i18n';
import { SiteStore } from '../core/site.store';
import { IconComponent } from '../shared/icon.component';
import { SupportChat } from './support-chat.service';

const LOCALES = { fa: 'fa-IR', en: 'en-GB', de: 'de-DE' } as const;

/**
 * Floating "Support" button (bottom corner, every public page except Contact).
 * Opens a live chat with the team (answered from the panel), plus quick links:
 * inquiry form and whichever of phone / WhatsApp / email are set in the panel.
 */
@Component({
  selector: 'app-support-fab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, IconComponent, TPipe, LinkPipe],
  host: {
    class: 'support-fab',
    '[class.open]': 'open()',
    '[class.hidden]': 'hidden()',
    '[style.--fab-lift.px]': 'lift()',
    '(document:click)': 'outside($event)',
    '(document:keydown.escape)': 'toggle(false)',
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

        <div class="support-body" #body aria-live="polite">
          <div class="support-msg staff">
            <span class="support-bubble">{{ 'support.welcome' | t }}</span>
          </div>
          @if (!chat.started()) {
            <div class="support-links">
              <a [routerLink]="'/contact' | link" (click)="toggle(false)"><app-icon name="send" />{{ 'support.formShort' | t }}</a>
              @if (c().phone) { <a [href]="'tel:' + tel(c().phone)"><app-icon name="phone" />{{ 'contact.phone' | t }}</a> }
              @if (c().whatsapp) { <a [href]="'https://wa.me/' + tel(c().whatsapp)" target="_blank" rel="noopener"><app-icon name="headset" />{{ 'footer.whatsapp' | t }}</a> }
              @if (c().email) { <a [href]="'mailto:' + c().email"><app-icon name="mail" />{{ 'contact.email' | t }}</a> }
            </div>
          }
          @for (m of chat.messages(); track $index) {
            <div class="support-msg" [class.staff]="m.from === 'staff'" [class.me]="m.from === 'visitor'">
              @if (m.from === 'staff') { <small class="support-by">{{ m.by || ('support.team' | t) }}</small> }
              <span class="support-bubble">{{ m.text }}</span>
              <time class="support-time" [attr.datetime]="m.at">{{ time(m.at) }}</time>
            </div>
          }
          @if (waiting()) { <p class="support-note"><app-icon name="check-circle" />{{ 'support.waiting' | t }}</p> }
        </div>

        <form class="support-compose" (ngSubmit)="send()">
          @if (!chat.started()) {
            <div class="support-who">
              <input name="name" [(ngModel)]="name" [placeholder]="'support.name' | t" autocomplete="name" maxlength="100">
              <input name="contact" [(ngModel)]="contact" [placeholder]="'support.contact' | t" autocomplete="email" maxlength="190" dir="auto">
            </div>
            <input class="hp" name="website" [(ngModel)]="website" tabindex="-1" autocomplete="off" aria-hidden="true">
          }
          @if (chat.error()) { <p class="support-error" role="alert">{{ chat.error() }}</p> }
          <div class="support-input">
            <textarea #input name="text" rows="1" [(ngModel)]="draft" [placeholder]="'support.placeholder' | t" maxlength="2000"
              [attr.aria-label]="'support.placeholder' | t" (keydown.enter)="enter($event)" (input)="grow()"></textarea>
            <button type="submit" class="support-send" [disabled]="!draft.trim() || chat.sending()" [attr.aria-label]="'support.send' | t">
              <app-icon name="send" />
            </button>
          </div>
        </form>
      </div>
    }
    <button type="button" class="support-btn" [attr.aria-expanded]="open()" aria-controls="support-card" (click)="toggle()">
      <span class="support-ico"><app-icon [name]="open() ? 'close' : 'headset'" /></span>
      <span class="support-label">{{ 'support.label' | t }}</span>
      @if (!open() && chat.unseen() > 0) {
        <span class="support-badge">{{ chat.unseen() }}</span>
      } @else {
        <span class="support-dot" aria-hidden="true"></span>
      }
    </button>
  `,
})
export class SupportFabComponent {
  protected readonly open = signal(false);
  protected readonly hidden = signal(false);
  /** How far the footer has scrolled into view, so the button rides above it instead of covering it. */
  protected readonly lift = signal(0);
  protected readonly chat = inject(SupportChat);
  private readonly site = inject(SiteStore);
  private readonly i18n = inject(I18n);
  private readonly router = inject(Router);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly body = viewChild<ElementRef<HTMLElement>>('body');
  private readonly input = viewChild<ElementRef<HTMLTextAreaElement>>('input');
  protected readonly c = () => this.site.settings().contact;
  protected tel = (v: string) => v.replace(/[^\d+]/g, '');

  protected draft = '';
  protected name = '';
  protected contact = '';
  protected website = '';

  /** The visitor wrote last and nobody has answered yet. */
  protected readonly waiting = () => {
    const m = this.chat.messages();
    return m.length > 0 && !m.some((x) => x.from === 'staff');
  };

  constructor() {
    const destroyRef = inject(DestroyRef);
    // The Contact page already is the support page — no floating button there
    const check = (url: string) => this.hidden.set(/^\/((en|de)\/)?contact/.test(url.split(/[?#]/)[0]));
    check(this.router.url);
    this.router.events.subscribe((e) => {
      if (e instanceof NavigationEnd) {
        check(e.urlAfterRedirects);
        this.toggle(false);
      }
    });

    // Keep the newest message in view
    effect(() => {
      this.chat.messages();
      const el = this.body()?.nativeElement;
      if (el) requestAnimationFrame(() => (el.scrollTop = el.scrollHeight));
    });

    afterNextRender(() => {
      this.chat.init();
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

  protected toggle(open = !this.open()) {
    if (open === this.open()) return;
    this.open.set(open);
    this.chat.setVisible(open);
    if (open) setTimeout(() => this.input()?.nativeElement.focus({ preventScroll: true }), 60);
  }

  protected async send() {
    const ok = await this.chat.send(this.draft, { name: this.name, contact: this.contact, page: this.router.url, website: this.website });
    if (ok) {
      this.draft = '';
      const el = this.input()?.nativeElement;
      if (el) {
        el.value = '';
        el.style.height = '';
      }
    }
  }

  /** Enter sends; Shift+Enter starts a new line. */
  protected enter(e: Event) {
    const k = e as KeyboardEvent;
    if (k.shiftKey || k.isComposing) return;
    e.preventDefault();
    void this.send();
  }

  protected grow() {
    const el = this.input()?.nativeElement;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }

  protected time(at: string) {
    return new Intl.DateTimeFormat(LOCALES[this.i18n.lang()], { hour: '2-digit', minute: '2-digit' }).format(new Date(at));
  }

  protected outside(e: Event) {
    if (this.open() && !this.host.nativeElement.contains(e.target as Node)) this.toggle(false);
  }
}
