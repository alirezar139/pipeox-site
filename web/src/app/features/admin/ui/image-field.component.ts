import { ChangeDetectionStrategy, Component, inject, input, model, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../../../shared/icon.component';
import { AdminApi } from '../admin-api.service';
import { ToastService } from './toast.service';

/** Image picker: uploads immediately and stores the returned URL; the path can also be typed. */
@Component({
  selector: 'adm-image-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, IconComponent],
  host: { class: 'adm-field adm-wide' },
  template: `
    <span class="adm-label">{{ label() }}</span>
    <div class="adm-image">
      <div class="adm-image-preview">
        @if (value()) { <img [src]="value()" alt=""> } @else { <app-icon name="image" /> }
      </div>
      <div class="adm-image-controls">
        <label class="adm-btn adm-btn-ghost adm-btn-sm">
          <app-icon name="download" /> {{ busy() ? 'در حال بارگذاری...' : 'انتخاب تصویر' }}
          <input type="file" accept="image/jpeg,image/png,image/webp" hidden (change)="pick($event)" [disabled]="busy()">
        </label>
        @if (value()) { <button type="button" class="adm-btn adm-btn-ghost adm-btn-sm" (click)="value.set('')"><app-icon name="trash" /> حذف</button> }
        <input class="adm-input" dir="ltr" [ngModel]="value()" (ngModelChange)="value.set($event)" placeholder="/api/media/… یا /assets/img/…">
        <small>JPG، PNG یا WebP تا ۵ مگابایت</small>
      </div>
    </div>
  `,
})
export class ImageFieldComponent {
  readonly label = input('تصویر');
  readonly value = model('');
  private readonly api = inject(AdminApi);
  private readonly toast = inject(ToastService);
  protected readonly busy = signal(false);

  async pick(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return this.toast.show('حجم تصویر حداکثر ۵ مگابایت است.', true);
    this.busy.set(true);
    try {
      this.value.set((await this.api.upload(file)).url);
    } catch (err) {
      this.toast.error(err);
    } finally {
      this.busy.set(false);
    }
  }
}
