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
    @if (api.isSupport()) {
      <div class="adm-head"><div><h1>تغییر رمز من</h1><p>رمز ورود خودتان به پنل را عوض کنید.</p></div></div>
    } @else {
      <div class="adm-head">
        <div><h1>کاربران پنل ({{ items().length | faNum }})</h1><p>هر کس با نام کاربری و رمز خودش وارد می‌شود. «برنامه‌نویس» علاوه بر همه بخش‌ها، صفحه «سیستم» را هم می‌بیند. «پشتیبان» فقط استعلام‌ها و گفت‌وگوها را می‌بیند و جواب می‌دهد.</p></div>
      </div>
    }

    <div class="adm-grid-2">
      @if (!api.isSupport()) {
      <form class="adm-card" (ngSubmit)="create()" novalidate>
        <h2>افزودن کاربر</h2>
        @if (createError(); as e) { <p class="adm-error" role="alert">{{ e.message }}</p> }
        <label class="adm-field"><span class="adm-label">نام کاربری (انگلیسی)</span><input class="adm-input" name="username" [(ngModel)]="f.username" dir="ltr" autocomplete="off" autocapitalize="off" spellcheck="false" required></label>
        <label class="adm-field"><span class="adm-label">نام نمایشی</span><input class="adm-input" name="name" [(ngModel)]="f.name" required></label>
        <label class="adm-field"><span class="adm-label">نقش</span>
          <select class="adm-input" name="role" [(ngModel)]="f.role"><option value="admin">مدیر</option><option value="developer">برنامه‌نویس</option><option value="support">پشتیبان</option></select>
        </label>
        <label class="adm-field adm-field-pw"><span class="adm-label">رمز (حداقل ۱۰ کاراکتر)</span><input #npw class="adm-input" type="password" name="password" [(ngModel)]="f.password" autocomplete="new-password" required><app-pw-toggle [for]="npw" /></label>
        <button class="adm-btn" type="submit" [disabled]="busy()"><app-icon name="plus" /> افزودن</button>
      </form>
      }

      <form class="adm-card" (ngSubmit)="changeMine()" novalidate>
        <h2>تغییر رمز من</h2>
        @if (pwError(); as e) { <p class="adm-error" role="alert">{{ e.message }}</p> }
        <label class="adm-field adm-field-pw"><span class="adm-label">رمز فعلی</span><input #cpw class="adm-input" type="password" name="current" [(ngModel)]="mine.current" autocomplete="current-password" required><app-pw-toggle [for]="cpw" /></label>
        <label class="adm-field adm-field-pw"><span class="adm-label">رمز جدید (حداقل ۱۰ کاراکتر)</span><input #mpw class="adm-input" type="password" name="password" [(ngModel)]="mine.password" autocomplete="new-password" required><app-pw-toggle [for]="mpw" /></label>
        <p class="adm-hint">با تغییر رمز، نشست‌های دیگر شما (دستگاه‌های دیگر) بسته می‌شوند.</p>
        <button class="adm-btn" type="submit" [disabled]="busy()"><app-icon name="lock" /> ذخیره رمز</button>
      </form>
    </div>

    @if (api.isSupport()) {}
    @else if (loading()) { <div class="adm-skeleton"></div> }
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
                      <option value="admin">مدیر</option><option value="developer">برنامه‌نویس</option><option value="support">پشتیبان</option>
                    </select>
                  }
                </td>
                <td>{{ u.lastLoginAt ? (u.lastLoginAt | faDate) : '—' }}</td>
                <td>{{ u.createdAt | faDate }}</td>
                <td>@if (u.active) { <span class="adm-badge s-won">فعال</span> } @else { <span class="adm-badge s-closed">غیرفعال</span> }</td>
                <td class="adm-actions">
                  @if (u.id !== api.current()?.id) {
                    <button type="button" class="adm-btn adm-btn-ghost adm-btn-sm" (click)="toggle(u)">{{ u.active ? 'غیرفعال‌سازی' : 'فعال‌سازی' }}</button>
                    <button type="button" class="adm-btn adm-btn-ghost adm-btn-sm" [class.on]="pwFor() === u.id" (click)="openPassword(u)"><app-icon name="lock" /> رمز جدید</button>
                    <button type="button" class="adm-icon-btn danger" (click)="remove(u)" aria-label="حذف"><app-icon name="trash" /></button>
                  }
                </td>
              </tr>
              @if (pwFor() === u.id) {
                <tr class="adm-pw-row">
                  <td colspan="7">
                    <form class="adm-pw-form" (ngSubmit)="savePassword(u)">
                      <label class="adm-field"><span class="adm-label">رمز جدید {{ u.username }} (حداقل ۱۰ کاراکتر)</span>
                        <input class="adm-input" name="newpw" [(ngModel)]="newPw" dir="ltr" autocomplete="off" spellcheck="false" minlength="10" maxlength="200"></label>
                      <button type="button" class="adm-btn adm-btn-ghost adm-btn-sm" (click)="newPw = randomPassword()"><app-icon name="refresh" /> رمز تصادفی</button>
                      <button type="button" class="adm-btn adm-btn-ghost adm-btn-sm" (click)="copy()" [disabled]="!newPw"><app-icon name="doc" /> کپی</button>
                      <button type="submit" class="adm-btn adm-btn-sm" [disabled]="busy() || newPw.length < 10">ذخیره رمز</button>
                      <button type="button" class="adm-btn adm-btn-ghost adm-btn-sm" (click)="pwFor.set(null)">بستن</button>
                    </form>
                    <p class="adm-hint">رمز فقط همین حالا دیده می‌شود؛ پس از ذخیره، به‌صورت رمزنگاری‌شده نگهداری می‌شود و دیگر قابل نمایش نیست. آن را از راه امن به کاربر بدهید. نشست‌های فعلی این کاربر بسته می‌شوند.</p>
                  </td>
                </tr>
              }
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
    if (!this.api.isSupport()) void this.load();
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

  /** The user whose new-password form is open. */
  protected readonly pwFor = signal<string | null>(null);
  protected newPw = '';

  /** 16 characters without look-alikes (0/O, 1/l/I). */
  protected randomPassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, (b) => chars[b % chars.length]).join('');
  }

  protected openPassword(u: AdminUser) {
    this.newPw = this.randomPassword();
    this.pwFor.set(this.pwFor() === u.id ? null : u.id);
  }

  protected async copy() {
    await navigator.clipboard.writeText(this.newPw).then(() => this.toast.show('رمز کپی شد.'), () => this.toast.show('کپی انجام نشد؛ رمز را دستی انتخاب و کپی کنید.'));
  }

  async savePassword(u: AdminUser) {
    this.busy.set(true);
    try {
      await this.api.setUserPassword(u.id, this.newPw);
      this.toast.show(`رمز جدید ${u.username} ثبت شد؛ آن را از راه امن اعلام کنید.`);
      this.pwFor.set(null);
      this.newPw = '';
    } catch (e) {
      this.toast.error(e);
    } finally {
      this.busy.set(false);
    }
  }

  async remove(u: AdminUser) {
    if (!confirm(`کاربر ${u.username} حذف شود؟`)) return;
    await this.api.deleteUser(u.id).then(() => this.toast.show('کاربر حذف شد.'), (e) => this.toast.error(e));
    await this.load();
  }
}
