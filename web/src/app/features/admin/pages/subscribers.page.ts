import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FaDatePipe, FaNumPipe } from '../../../core/format';
import { IconComponent } from '../../../shared/icon.component';
import { AdminApi } from '../admin-api.service';
import { ToastService } from '../ui/toast.service';

@Component({
  selector: 'app-admin-subscribers-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, FaDatePipe, FaNumPipe],
  template: `
    <div class="adm-head">
      <div><h1>خبرنامه ({{ items().length | faNum }})</h1><p>ایمیل‌های ثبت‌شده از فرم پایین سایت</p></div>
      <a class="adm-btn adm-btn-ghost" href="/api/admin/subscribers/export.csv" download><app-icon name="download" /> خروجی Excel</a>
    </div>
    @if (!items().length) { <p class="adm-empty">هنوز کسی عضو خبرنامه نشده است.</p> }
    @else {
      <div class="adm-table-wrap">
        <table class="adm-table">
          <thead><tr><th>ایمیل</th><th>تاریخ عضویت</th><th></th></tr></thead>
          <tbody>
            @for (s of items(); track s._id) {
              <tr>
                <td dir="ltr" class="adm-start">{{ s.email }}</td>
                <td>{{ s.createdAt | faDate: 'time' }}</td>
                <td class="adm-actions"><button type="button" class="adm-icon-btn danger" (click)="remove(s._id, s.email)" aria-label="حذف"><app-icon name="trash" /></button></td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
})
export class AdminSubscribersPage {
  private readonly api = inject(AdminApi);
  private readonly toast = inject(ToastService);
  protected readonly items = signal<{ _id: string; email: string; createdAt: string }[]>([]);

  constructor() {
    void this.load();
  }

  private async load() {
    this.items.set(await this.api.subscribers());
  }

  async remove(id: string, email: string) {
    if (!confirm(`${email} از خبرنامه حذف شود؟`)) return;
    await this.api.deleteSubscriber(id).then(() => this.toast.show('حذف شد.'), (e) => this.toast.error(e));
    await this.load();
  }
}
