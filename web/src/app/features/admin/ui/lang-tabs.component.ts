import { ChangeDetectionStrategy, Component, model } from '@angular/core';
import type { Lang } from '../../../core/i18n';

/**
 * فارسی | English | Deutsch — switches an editor between the Persian content (all fields)
 * and its translations (text fields only). Empty translated fields show the Persian text on the site.
 */
@Component({
  selector: 'adm-lang-tabs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'adm-lang-tabs', role: 'tablist', 'aria-label': 'زبان محتوا' },
  template: `
    @for (t of tabs; track t.lang) {
      <button type="button" role="tab" [class.on]="lang() === t.lang" [attr.aria-selected]="lang() === t.lang" (click)="lang.set(t.lang)">
        <b>{{ t.short }}</b>{{ t.label }}
      </button>
    }
    @if (lang() !== 'fa') { <p class="adm-hint">فقط متن‌ها ترجمه می‌شوند؛ تصویر، نامک، ترتیب و وضعیت انتشار بین زبان‌ها مشترک است. هر فیلدی خالی بماند، روی سایت همان متن فارسی نمایش داده می‌شود.</p> }
  `,
})
export class LangTabsComponent {
  readonly lang = model<Lang>('fa');
  protected readonly tabs: { lang: Lang; short: string; label: string }[] = [
    { lang: 'fa', short: 'FA', label: 'فارسی' },
    { lang: 'en', short: 'EN', label: 'English' },
    { lang: 'de', short: 'DE', label: 'Deutsch' },
  ];
}
