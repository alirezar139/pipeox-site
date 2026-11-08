import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FaNumPipe } from '../../../core/format';
import { IconComponent } from '../../../shared/icon.component';
import { AdminApi, type SystemInfo } from '../admin-api.service';

/** Developer-only: what is running, where, and how it is configured (no secrets). */
@Component({
  selector: 'app-admin-system-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, FaNumPipe],
  template: `
    <div class="adm-head">
      <div><h1>سیستم</h1><p>وضعیت فنی سرور و برنامه — فقط برای حساب برنامه‌نویس.</p></div>
      <button type="button" class="adm-btn adm-btn-ghost" (click)="load()"><app-icon name="refresh" /> به‌روزرسانی</button>
    </div>
    @if (info(); as i) {
      <div class="adm-grid-2">
        <section class="adm-card">
          <h2>برنامه</h2>
          <dl class="adm-dl" dir="ltr">
            <dt>Node.js</dt><dd>{{ i.app.node }}</dd>
            <dt>NODE_ENV</dt><dd>{{ i.app.env }}</dd>
            <dt>Uptime</dt><dd>{{ uptime(i.app.uptimeSec) }}</dd>
            <dt>Memory (RSS)</dt><dd>{{ i.app.memoryMb }} MB</dd>
            <dt>PID</dt><dd>{{ i.app.pid }}</dd>
          </dl>
        </section>
        <section class="adm-card">
          <h2>سرور</h2>
          <dl class="adm-dl" dir="ltr">
            <dt>OS</dt><dd>{{ i.host.platform }}</dd>
            <dt>CPUs</dt><dd>{{ i.host.cpus }}</dd>
            <dt>Load avg</dt><dd>{{ i.host.loadAvg.join(' · ') }}</dd>
            <dt>Free / total RAM</dt><dd>{{ i.host.freeMemMb }} / {{ i.host.totalMemMb }} MB</dd>
          </dl>
        </section>
        <section class="adm-card">
          <h2>پایگاه داده</h2>
          <dl class="adm-dl" dir="ltr">
            <dt>Database</dt><dd>{{ i.database.name }}</dd>
            <dt>MongoDB</dt><dd>{{ i.database.version }}</dd>
            @for (c of i.database.collections; track c.name) { <dt>{{ c.name }}</dt><dd>{{ c.count }}</dd> }
          </dl>
        </section>
        <section class="adm-card">
          <h2>تنظیمات</h2>
          <dl class="adm-dl">
            <dt>آدرس سایت</dt><dd dir="ltr">{{ i.config.siteUrl }}</dd>
            <dt>پوشه فایل‌ها</dt><dd dir="ltr">{{ i.config.dataDir }}</dd>
            <dt>TRUST_PROXY</dt><dd dir="ltr">{{ i.config.trustProxy }}</dd>
            <dt>خروج خودکار</dt><dd>{{ i.config.idleMinutes | faNum }} دقیقه بی‌کاری</dd>
            <dt>ایمیل (SMTP)</dt><dd>{{ i.config.email ? 'فعال' : 'تنظیم نشده' }}</dd>
            <dt>ربات بله</dt><dd>{{ i.config.bale ? 'فعال' : 'تنظیم نشده' }}</dd>
            <dt>ربات تلگرام</dt><dd>{{ i.config.telegram ? 'فعال' : 'تنظیم نشده' }}</dd>
          </dl>
        </section>
      </div>
    } @else { <div class="adm-skeleton"></div> }
  `,
})
export class AdminSystemPage {
  private readonly api = inject(AdminApi);
  protected readonly info = signal<SystemInfo | null>(null);

  constructor() {
    void this.load();
  }

  async load() {
    this.info.set(await this.api.system());
  }

  protected uptime(sec: number) {
    const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60);
    return `${d}d ${h}h ${m}m`;
  }
}
