import { isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, PLATFORM_ID, signal } from '@angular/core';
import { ApiService } from '../core/http/api.service';
import { TPipe } from '../core/i18n';
import { IconComponent } from './icon.component';

/** The two fields every captcha-protected request carries. */
export interface CaptchaFields {
  captchaId: string;
  captcha: string;
}

/**
 * Image captcha from the site's own API. Parent forms read `fields()` when submitting and call
 * `reload()` after any failed attempt (each challenge is single-use on the server).
 */
@Component({
  selector: 'app-captcha',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, TPipe],
  host: { class: 'captcha', '[class.captcha-admin]': "variant() === 'admin'", '[class.invalid]': 'invalid()' },
  template: `
    <label class="captcha-input">
      <app-icon name="shield" />
      <input name="captcha" [value]="answer()" (input)="answer.set($any($event.target).value)" inputmode="text" autocomplete="off"
        autocapitalize="off" spellcheck="false" maxlength="8" [placeholder]="'common.captcha' | t" [attr.aria-label]="'common.captchaLabel' | t" required
        [attr.aria-invalid]="invalid() || null">
    </label>
    <span class="captcha-img">
      @if (image(); as src) { <img [src]="src" [alt]="'common.captchaImage' | t" width="150" height="48"> } @else { <i class="captcha-wait"></i> }
    </span>
    <button type="button" class="captcha-refresh" (click)="reload()" [attr.aria-label]="'common.captchaNew' | t" [title]="'common.captchaNew' | t"><app-icon name="refresh" /></button>
  `,
})
export class CaptchaComponent {
  readonly variant = input<'site' | 'admin'>('site');
  readonly invalid = input(false);
  private readonly api = inject(ApiService);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  protected readonly image = signal<string | null>(null);
  protected readonly answer = signal('');
  private id = '';

  constructor() {
    if (this.browser) void this.reload();
  }

  fields(): CaptchaFields {
    return { captchaId: this.id, captcha: this.answer().trim() };
  }

  async reload() {
    this.answer.set('');
    this.image.set(null);
    try {
      const r = await this.api.get<{ id: string; svg: string }>('/api/captcha');
      this.id = r.id;
      this.image.set('data:image/svg+xml;base64,' + btoa(r.svg));
    } catch {
      this.id = '';
    }
  }
}
