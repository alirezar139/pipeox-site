import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FaDatePipe, FaNumPipe } from '../../../core/format';
import type { ApiError } from '../../../core/models';
import { IconComponent } from '../../../shared/icon.component';
import { PasswordToggleComponent } from '../../../shared/password-toggle.component';
import { AdminApi, type AdminRole, type AdminUser, ROLE_LABELS } from '../admin-api.service';
import { ToastService } from '../ui/toast.service';

@Component({
  selector: 'app-admin-users-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, IconComponent, FaDatePipe, FaNumPipe, PasswordToggleComponent],
  template: `
    <div class="adm-head">
      <div><h1>کاربران پنل ({{ items().length | faNum }})</h1><p>هر کس با نام کاربری و رمز خودش وارد می‌شود. «برنامه‌نویس» علاوه بر همه بخش‌ها، صفحه «سیستم» را هم می‌بیند.</p></div>
    </div>

    <div class="adm-grid-2">
      <form class="adm-card" (ngSubmit)="create()" novalidate>
        <h2>افزودن کاربر</h2>
        @if (createError(); as e) { <p class="adm-error" role="alert">{{ e.message }}</p> }
        <label class="adm-field"><span class="adm-label">نام کاربری (انگلیسی)</span><input class="adm-input" name="username" [(ngModel)]="f.username" dir="ltr" autocomplete="off" autocapitalize="off" spellcheck="false" required></label>
        <label class="adm-field"><span class="adm-label">نام نمایشی</span><input class="adm-input" name="name" [(ngModel)]="f.name" required></label>
        <label class="adm-field"><span class="adm-label">نقش</span>
          <select class="adm-input" name="role" [(ngModel)]="f.role"><option value="admin">مدیر</option><option value="developer">برنامه‌نویس</option></select>
        </label>
        <label class="adm-field adm-field-pw"><span class="adm-label">رمز (حداقل ۱۰ کاراکتر)</span><input #npw class="adm-input" type="password" name="password" [(ngModel)]="f.password" autocomplete="new-password" required><app-pw-toggle [for]="npw" /></label>
        <button class="adm-btn" type="submit" [disabled]="busy()"><app-icon name="plus" /> افزودن</button>
      </form>

      <form class="adm-card" (ngSubmit)="changeMine()" novalidate>
        <h2>تغییر رمز من</h2>
        @if (pwError(); as e) { <p class="adm-error" role="alert">{{ e.message }}</p> }
        <label class="adm-field adm-field-pw"><span class="adm-label">رمز فعلی</span><input #cpw class="adm-input" type="password" name="current" [(ngModel)]="mine.current" autocomplete="current-password" required><app-pw-toggle [for]="cpw" /></label>
        <label class="adm-field adm-field-pw"><span class="adm-label">رمز جدید (حداقل ۱۰ کاراکتر)</span><input #mpw class="adm-input" type="password" name="password" [(ngModel)]="mine.password" autocomplete="new-password" required><app-pw-toggle [for]="mpw" /></label>
        <p class="adm-hint">با تغییر رمز، نشست‌های دیگر شما (دستگاه‌های دیگر) بسته می‌شوند.</p>
        <button class="adm-btn" type="submit" [disabled]="busy()"><app-icon name="lock" /> ذخیره رمز</button>
      </form>
    </div>

    @if (loading()) { <div class="adm-skeleton"></div> }
    @else {
      <div class="adm-table-wrap">
        <table class="adm-table">
          <thead><tr><th>نام</th><th>نام کاربری</th><th>نقش</th><th>آخرین ورود</th><th>ساخته‌شده</th><th>وضعیت</th><th></th></tr></thead>
          <tbody>
            @for (u of items(); track u.id) {
              <tr>
                <td><b>{{ u.name }}</b>@if (u.id === api.current()?.id) { <span class="adm-badge s-new">شما</span> }</td>
                <td dir="ltr">{{ u.username }}</td>
                <td>
                  @if (u.id === api.current()?.id) { {{ roleLabels[u.role] }} }
                  @else {
                    <select class="adm-select-sm" [ngModel]="u.role" (ngModelChange)="setRole(u, $event)" [name]="'role-' + u.id" aria-label="نقش">
                      <option value="admin">مدیر</option><option value="developer">برنامه‌نویس</option>
                    </select>
                  }
                </td>
                <td>{{ u.lastLoginAt ? (u.lastLoginAt | faDate) : '—' }}</td>
                <td>{{ u.createdAt | faDate }}</td>
                <td>@if (u.active) { <span class="adm-badge s-won">فعال</span> } @else { <span class="adm-badge s-closed">غیرفعال</span> }</td>
                <td class="adm-actions">
                  @if (u.id !== api.current()?.id) {
                    <button type="button" class="adm-btn adm-btn-ghost adm-btn-sm" (click)="toggle(u)">{{ u.active ? 'غیرفعال‌سازی' : 'فعال‌سازی' }}</button>
                    <button type="button" class="adm-btn adm-btn-ghost adm-btn-sm" (click)="setPassword(u)"><app-icon name="lock" /> رمز جدید</button>
                    <button type="button" class="adm-icon-btn danger" (click)="remove(u)" aria-label="حذف"><app-icon name="trash" /></button>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
})
export class AdminUsersPage {
  protected readonly api = inject(AdminApi);
  private readonly toast = inject(ToastService);
  protected readonly roleLabels = ROLE_LABELS;
  protected readonly items = signal<AdminUser[]>([]);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly createError = signal<ApiError | null>(null);
  protected readonly pwError = signal<ApiError | null>(null);
  protected f = { username: '', name: '', role: 'admin' as AdminRole, password: '' };
  protected mine = { current: '', password: '' };

  constructor() {
    void this.load();
  }

  private async load() {
    try {
      this.items.set(await this.api.users());
    } finally {
      this.loading.set(false);
    }
  }

  async create() {
    this.busy.set(true);
    this.createError.set(null);
    try {
      await this.api.createUser(this.f);
      this.toast.show(`کاربر ${this.f.username} ساخته شد.`);
      this.f = { username: '', name: '', role: 'admin', password: '' };
      await this.load();
    } catch (e) {
      this.createError.set(e as ApiError);
    } finally {
      this.busy.set(false);
    }
  }

  async changeMine() {
    this.busy.set(true);
    this.pwError.set(null);
    try {
      await this.api.changeMyPassword(this.mine.current, this.mine.password);
      this.mine = { current: '', password: '' };
      this.toast.show('رمز شما تغییر کرد.');
    } catch (e) {
      this.pwError.set(e as ApiError);
    } finally {
      this.busy.set(false);
    }
  }

  async setRole(u: AdminUser, role: AdminRole) {
    await this.api.updateUser(u.id, { role }).then(() => this.toast.show('نقش تغییر کرد؛ کاربر باید دوباره وارد شود.'), (e) => this.toast.error(e));
    await this.load();
  }

  async toggle(u: AdminUser) {
    await this.api.updateUser(u.id, { active: !u.active }).then(() => this.toast.show('وضعیت حساب تغییر کرد.'), (e) => this.toast.error(e));
    await this.load();
  }

  async setPassword(u: AdminUser) {
    const pw = prompt(`رمز جدید برای ${u.username} (حداقل ۱۰ کاراکتر):`);
    if (!pw) return;
    await this.api.setUserPassword(u.id, pw).then(() => this.toast.show('رمز جدید ثبت شد؛ آن را از راه امن اعلام کنید.'), (e) => this.toast.error(e));
  }

  async remove(u: AdminUser) {
    if (!confirm(`کاربر ${u.username} حذف شود؟`)) return;
    await this.api.deleteUser(u.id).then(() => this.toast.show('کاربر حذف شد.'), (e) => this.toast.error(e));
    await this.load();
  }
}
