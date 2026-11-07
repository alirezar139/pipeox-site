import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { faDigits } from '../../../core/format';
import type { ApiError, SiteSettings } from '../../../core/models';
import { SiteStore } from '../../../core/site.store';
import { IconComponent } from '../../../shared/icon.component';
import { AdminApi } from '../admin-api.service';
import { ToastService } from '../ui/toast.service';

const ICON_LABELS: Record<string, string> = {
  trophy: 'جام', 'check-circle': 'تیک', 'users-solid': 'افراد', users: 'افراد (خطی)', headset: 'هدست', gear: 'چرخ‌دنده',
  shield: 'سپر', doc: 'سند', list: 'فهرست', phone: 'تلفن', mail: 'ایمیل', calendar: 'تقویم', send: 'ارسال', user: 'کاربر',
};

@Component({
  selector: 'app-admin-settings-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, IconComponent],
  template: `
    <div class="adm-head">
      <div><h1>تنظیمات سایت</h1><p>متن‌ها، آمار و اطلاعات تماس — بلافاصله روی سایت اعمال می‌شود.</p></div>
      <a class="adm-btn adm-btn-ghost" href="/" target="_blank"><app-icon name="eye" /> مشاهده سایت</a>
    </div>
    @if (error(); as e) { <p class="adm-error" role="alert">{{ e.message }}</p> }

    @if (s(); as s) {
      <form class="adm-form" (ngSubmit)="save(s)">
        <fieldset class="adm-card">
          <legend>هویت سایت</legend>
          <label class="adm-field"><span class="adm-label">نام لاتین</span><input class="adm-input" name="name" [(ngModel)]="s.site.name"></label>
          <label class="adm-field"><span class="adm-label">نام فارسی</span><input class="adm-input" name="nameFa" [(ngModel)]="s.site.nameFa"></label>
          <label class="adm-field"><span class="adm-label">آدرس سایت (دامنه)</span><input class="adm-input" name="url" [(ngModel)]="s.site.url" dir="ltr" placeholder="https://pipeox.ir"><small>برای canonical، نقشه سایت و پیوندهای اشتراک‌گذاری</small></label>
          <label class="adm-field"><span class="adm-label">عنوان صفحه اصلی (تب مرورگر و گوگل)</span><input class="adm-input" name="title" [(ngModel)]="s.site.title"></label>
          <label class="adm-field adm-wide"><span class="adm-label">توضیح سایت (نتایج گوگل)</span><textarea class="adm-input" name="description" rows="2" [(ngModel)]="s.site.description"></textarea></label>
        </fieldset>

        <fieldset class="adm-card">
          <legend>اطلاعات تماس</legend>
          <label class="adm-field"><span class="adm-label">تلفن</span><input class="adm-input" name="phone" [(ngModel)]="s.contact.phone" dir="ltr" placeholder="021-12345678"></label>
          <label class="adm-field"><span class="adm-label">ایمیل</span><input class="adm-input" type="email" name="email" [(ngModel)]="s.contact.email" dir="ltr"></label>
          <label class="adm-field"><span class="adm-label">واتساپ (با کد کشور)</span><input class="adm-input" name="whatsapp" [(ngModel)]="s.contact.whatsapp" dir="ltr" placeholder="989121234567"></label>
          <label class="adm-field"><span class="adm-label">ساعات پاسخ‌گویی</span><input class="adm-input" name="hours" [(ngModel)]="s.contact.hours" placeholder="شنبه تا چهارشنبه ۸ تا ۱۷"></label>
          <label class="adm-field adm-wide"><span class="adm-label">نشانی</span><input class="adm-input" name="address" [(ngModel)]="s.contact.address"></label>
          <p class="adm-hint adm-wide">موارد خالی در سایت نمایش داده نمی‌شوند.</p>
        </fieldset>

        <fieldset class="adm-card">
          <legend>صفحه اصلی — بخش اول</legend>
          <label class="adm-field"><span class="adm-label">عبارت بالای تیتر</span><input class="adm-input" name="kicker" [(ngModel)]="s.hero.kicker"></label>
          <label class="adm-field"><span class="adm-label">تیتر — خط اول</span><input class="adm-input" name="htitle" [(ngModel)]="s.hero.title"></label>
          <label class="adm-field"><span class="adm-label">تیتر — خط دوم (نارنجی)</span><input class="adm-input" name="accent" [(ngModel)]="s.hero.titleAccent"></label>
          <label class="adm-field adm-wide"><span class="adm-label">متن</span><textarea class="adm-input" name="htext" rows="2" [(ngModel)]="s.hero.text"></textarea></label>
        </fieldset>

        <fieldset class="adm-card">
          <legend>صفحه اصلی — آمار</legend>
          <p class="adm-hint adm-wide">این اعداد ادعای رسمی شرکت‌اند؛ فقط ارقام قابل اثبات را وارد کنید.</p>
          @for (st of s.stats; track $index; let i = $index) {
            <div class="adm-row adm-wide">
              <label class="adm-field"><span class="adm-label">عدد {{ fa(i + 1) }}</span><input class="adm-input" type="number" min="0" [name]="'sv' + i" [(ngModel)]="st.value"></label>
              <label class="adm-field adm-grow"><span class="adm-label">عنوان</span><input class="adm-input" [name]="'sl' + i" [(ngModel)]="st.label"></label>
              <label class="adm-field"><span class="adm-label">آیکن</span>
                <select class="adm-input" [name]="'si' + i" [(ngModel)]="st.icon">@for (ic of icons(); track ic) { <option [value]="ic">{{ iconLabel(ic) }}</option> }</select></label>
            </div>
          }
        </fieldset>

        <fieldset class="adm-card">
          <legend>صفحه اصلی — محصولات و ویژگی‌ها</legend>
          <label class="adm-field"><span class="adm-label">عنوان بخش محصولات</span><input class="adm-input" name="stitle" [(ngModel)]="s.showcase.title"></label>
          <label class="adm-field"><span class="adm-label">متن بخش محصولات</span><input class="adm-input" name="stext" [(ngModel)]="s.showcase.text"></label>
          @for (f of s.features; track $index; let i = $index) {
            <div class="adm-row adm-wide">
              <label class="adm-field adm-grow"><span class="adm-label">ویژگی {{ fa(i + 1) }}</span><input class="adm-input" [name]="'ft' + i" [(ngModel)]="f.title"></label>
              <label class="adm-field adm-grow"><span class="adm-label">توضیح</span><input class="adm-input" [name]="'fx' + i" [(ngModel)]="f.text"></label>
              <label class="adm-field"><span class="adm-label">آیکن</span>
                <select class="adm-input" [name]="'fi' + i" [(ngModel)]="f.icon">@for (ic of icons(); track ic) { <option [value]="ic">{{ iconLabel(ic) }}</option> }</select></label>
            </div>
          }
          <p class="adm-hint adm-wide">ویژگی‌ها در صفحه «درباره ما» هم نمایش داده می‌شوند.</p>
        </fieldset>

        <fieldset class="adm-card">
          <legend>صفحه اصلی — پروژه‌ها و خبرنامه</legend>
          <label class="adm-field"><span class="adm-label">عنوان کادر پروژه‌ها</span><input class="adm-input" name="ptitle" [(ngModel)]="s.projects.title"></label>
          <label class="adm-field"><span class="adm-label">لینک ویدیو (اختیاری)</span><input class="adm-input" name="video" [(ngModel)]="s.projects.video" dir="ltr" placeholder="https://www.aparat.com/v/…"><small>خالی = دکمه پخش به صفحه پروژه‌ها می‌رود</small></label>
          <label class="adm-field adm-wide"><span class="adm-label">متن کادر پروژه‌ها</span><input class="adm-input" name="ptext" [(ngModel)]="s.projects.text"></label>
          <label class="adm-field"><span class="adm-label">عنوان خبرنامه (فوتر)</span><input class="adm-input" name="ntitle" [(ngModel)]="s.newsletter.title"></label>
          <label class="adm-field"><span class="adm-label">متن خبرنامه</span><input class="adm-input" name="ntext" [(ngModel)]="s.newsletter.text"></label>
        </fieldset>

        <div class="adm-savebar adm-sticky">
          <button class="adm-btn" type="submit" [disabled]="busy()">{{ busy() ? 'در حال ذخیره...' : 'ذخیره تنظیمات' }}</button>
        </div>
      </form>
    } @else {
      <div class="adm-skeleton"></div>
    }
  `,
})
export class AdminSettingsPage {
  private readonly api = inject(AdminApi);
  private readonly toast = inject(ToastService);
  private readonly site = inject(SiteStore);
  protected readonly s = signal<SiteSettings | null>(null);
  protected readonly icons = signal<string[]>([]);
  protected readonly busy = signal(false);
  protected readonly error = signal<ApiError | null>(null);
  protected fa = faDigits;
  protected iconLabel = (ic: string) => ICON_LABELS[ic] ?? ic;

  constructor() {
    this.api.settings().then((r) => {
      // always three stats / features rows to edit
      const pad = <T>(arr: T[], make: () => T) => [...arr, ...Array.from({ length: Math.max(0, 3 - arr.length) }, make)].slice(0, 3);
      r.settings.stats = pad(r.settings.stats, () => ({ value: 0, label: '', icon: 'check-circle' }));
      r.settings.features = pad(r.settings.features, () => ({ title: '', text: '', icon: 'shield' }));
      this.icons.set(r.icons);
      this.s.set(r.settings);
    }, (e) => this.toast.error(e));
  }

  async save(s: SiteSettings) {
    this.busy.set(true);
    this.error.set(null);
    try {
      const saved = await this.api.saveSettings({
        ...s,
        stats: s.stats.filter((x) => x.label.trim()).map((x) => ({ ...x, value: Number(x.value) || 0 })),
        features: s.features.filter((x) => x.title.trim()),
      });
      this.site.set(saved);
      this.toast.show('تنظیمات ذخیره شد و روی سایت اعمال شد.');
    } catch (e) {
      this.error.set(e as ApiError);
      scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      this.busy.set(false);
    }
  }
}
