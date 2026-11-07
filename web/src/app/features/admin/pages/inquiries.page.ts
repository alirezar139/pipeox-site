import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { FaDatePipe, FaNumPipe } from '../../../core/format';
import type { Inquiry, InquiryStatus } from '../../../core/models';
import { IconComponent } from '../../../shared/icon.component';
import { AdminApi, STATUS_LABELS } from '../admin-api.service';
import { ToastService } from '../ui/toast.service';

@Component({
  selector: 'app-admin-inquiries-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, IconComponent, FaDatePipe, FaNumPipe],
  template: `
    <div class="adm-head">
      <div><h1>استعلام‌ها</h1><p>@if (user() && items().length) { درخواست‌های {{ items()[0].user?.email }} } @else { صندوق درخواست‌های سایت }</p></div>
      <a class="adm-btn adm-btn-ghost" href="/api/admin/inquiries/export.csv" download><app-icon name="download" /> خروجی Excel</a>
    </div>
    <nav class="adm-chips">
      <a routerLink="/admin/inquiries" [class.on]="!status() && !user()">همه ({{ total() | faNum }})</a>
      @for (s of statuses; track s) {
        <a routerLink="/admin/inquiries" [queryParams]="{ status: s }" [class.on]="status() === s">{{ labels[s] }} ({{ (counts()[s] ?? 0) | faNum }})</a>
      }
    </nav>

    @if (loading()) { <div class="adm-skeleton"></div> }
    @else if (!items().length) { <p class="adm-empty">درخواستی وجود ندارد.</p> }
    @for (q of items(); track q._id) {
      <article class="adm-inq" [class]="'adm-inq s-' + q.status">
        <div class="adm-inq-meta">
          <span>#{{ q._id.slice(-6).toUpperCase() }}</span><span>{{ q.createdAt | faDate: 'time' }}</span>
          @if (q.page) { <span dir="ltr">{{ q.page }}</span> }
        </div>
        <h2>
          {{ q.name }}
          <a dir="ltr" [href]="'tel:' + tel(q.phone)">{{ q.phone }}</a>
          @if (q.user) { <a class="adm-badge s-quoted" routerLink="/admin/inquiries" [queryParams]="{ user: q.user._id }" title="همه درخواست‌های این مشتری">{{ q.user.email }}</a> }
        </h2>
        @if (q.category) { <span class="adm-tag">{{ q.category }}</span> }
        @if (q.details) { <p class="adm-inq-details">{{ q.details }}</p> }
        @if (q.attachment) {
          <a class="adm-attach" [href]="'/api/admin/inquiries/' + q._id + '/attachment'"><app-icon name="clip" /> {{ q.attachment.name }}</a>
        }
        <form class="adm-inq-update" (ngSubmit)="save(q)">
          <select class="adm-input" name="status" [(ngModel)]="q.status">
            @for (s of statuses; track s) { <option [value]="s">{{ labels[s] }}</option> }
          </select>
          <input class="adm-input" name="notes" [(ngModel)]="q.notes" placeholder="یادداشت داخلی (مشتری نمی‌بیند)">
          <button class="adm-btn adm-btn-sm" type="submit">ذخیره</button>
        </form>
      </article>
    }
  `,
})
export class AdminInquiriesPage {
  readonly status = input<InquiryStatus>();
  readonly user = input<string>();
  private readonly api = inject(AdminApi);
  private readonly toast = inject(ToastService);
  protected readonly router = inject(Router);

  protected readonly statuses = Object.keys(STATUS_LABELS) as InquiryStatus[];
  protected readonly labels = STATUS_LABELS;
  protected readonly items = signal<Inquiry[]>([]);
  protected readonly counts = signal<Partial<Record<InquiryStatus, number>>>({});
  protected readonly loading = signal(true);
  protected readonly total = computed(() => Object.values(this.counts()).reduce((a, b) => a + (b ?? 0), 0));
  protected tel = (v: string) => v.replace(/[^\d+]/g, '');

  constructor() {
    effect(() => void this.load(this.status(), this.user()));
  }

  private async load(status?: string, user?: string) {
    this.loading.set(true);
    try {
      const r = await this.api.inquiries({ status, user });
      this.items.set(r.items);
      this.counts.set(r.counts);
      this.api.newCount.set(r.counts.new ?? 0);
    } catch (e) {
      this.toast.error(e);
    } finally {
      this.loading.set(false);
    }
  }

  async save(q: Inquiry) {
    try {
      await this.api.updateInquiry(q._id, { status: q.status, notes: q.notes });
      this.toast.show('درخواست به‌روزرسانی شد.');
      await this.load(this.status(), this.user());
    } catch (e) {
      this.toast.error(e);
    }
  }
}
