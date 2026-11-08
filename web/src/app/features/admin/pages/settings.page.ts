import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { faDigits } from '../../../core/format';
import type { Lang } from '../../../core/i18n';
import type { ApiError, SettingsTranslation, SiteSettings, TrLang } from '../../../core/models';
import { SiteStore } from '../../../core/site.store';
import { IconComponent } from '../../../shared/icon.component';
import { AdminApi } from '../admin-api.service';
import { LangTabsComponent } from '../ui/lang-tabs.component';
import { ToastService } from '../ui/toast.service';

const ICON_LABELS: Record<string, string> = {
  trophy: 'جام', 'check-circle': 'تیک', 'users-solid': 'افراد', users: 'افراد (خطی)', headset: 'هدست', gear: 'چرخ‌دنده',
  shield: 'سپر', doc: 'سند', list: 'فهرست', phone: 'تلفن', mail: 'ایمیل', calendar: 'تقویم', send: 'ارسال', user: 'کاربر',
};

@Component({
  selector: 'app-admin-settings-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, IconComponent, LangTabsComponent],
  template: `
    <div class="adm-head">
      <div><h1>تنظیمات سایت</h1><p>متن‌ها، آمار و اطلاعات تماس — بلافاصله روی سایت اعمال می‌شود.</p></div>
      <a class="adm-btn adm-btn-ghost" href="/" target="_blank"><app-icon name="eye" /> مشاهده سایت</a>
    </div>
    @if (error(); as e) { <p class="adm-error" role="alert">{{ e.message }}</p> }

    @if (s(); as s) {
      <adm-lang-tabs [(lang)]="lang" />
      <form class="adm-form" (ngSubmit)="save(s)">
        @if (lang() !== 'fa') {
          @let t = tr(s, trLang());
          <fieldset class="adm-card">
            <legend>هویت سایت</legend>
            <label class="adm-field"><span class="adm-label">نام سایت</span><input class="adm-input" dir="ltr" name="t-name" [(ngModel)]="t.site.name" [placeholder]="s.site.name"></label>
            <label class="adm-field"><span class="adm-label">عنوان صفحه اصلی (تب مرورگر و گوگل)</span><input class="adm-input" dir="ltr" name="t-title" [(ngModel)]="t.site.title" [placeholder]="s.site.title"></label>
            <label class="adm-field adm-wide"><span class="adm-label">توضیح سایت (نتایج گوگل)</span><textarea class="adm-input" dir="ltr" name="t-desc" rows="2" [(ngModel)]="t.site.description" [placeholder]="s.site.description"></textarea></label>
          </fieldset>
          <fieldset class="adm-card">
            <legend>اطلاعات تماس</legend>
            <label class="adm-field"><span class="adm-label">ساعات پاسخ‌گویی</span><input class="adm-input" dir="ltr" name="t-hours" [(ngModel)]="t.contact.hours" [placeholder]="s.contact.hours"></label>
            <label class="adm-field adm-wide"><span class="adm-label">نشانی</span><input class="adm-input" dir="ltr" name="t-address" [(ngModel)]="t.contact.address" [placeholder]="s.contact.address"></label>
            <p class="adm-hint adm-wide">تلفن، ایمیل و واتساپ بین زبان‌ها مشترک‌اند.</p>
          </fieldset>
          <fieldset class="adm-card">
            <legend>صفحه اصلی — بخش اول</legend>
            <label class="adm-field"><span class="adm-label">عبارت بالای تیتر</span><input class="adm-input" dir="ltr" name="t-kicker" [(ngModel)]="t.hero.kicker" [placeholder]="s.hero.kicker"></label>
            <label class="adm-field"><span class="adm-label">تیتر — خط اول</span><input class="adm-input" dir="ltr" name="t-htitle" [(ngModel)]="t.hero.title" [placeholder]="s.hero.title"></label>
            <label class="adm-field"><span class="adm-label">تیتر — خط دوم (نارنجی)</span><input class="adm-input" dir="ltr" name="t-accent" [(ngModel)]="t.hero.titleAccent" [placeholder]="s.hero.titleAccent"></label>
            <label class="adm-field adm-wide"><span class="adm-label">متن</span><textarea class="adm-input" dir="ltr" name="t-htext" rows="2" [(ngModel)]="t.hero.text" [placeholder]="s.hero.text"></textarea></label>
          </fieldset>
          <fieldset class="adm-card">
            <legend>صفحه اصلی — آمار و ویژگی‌ها</legend>
            @for (st of t.stats; track $index; let i = $index) {
              <label class="adm-field"><span class="adm-label">عنوان آمار {{ fa(i + 1) }} ({{ s.stats[i].value }})</span><input class="adm-input" dir="ltr" [name]="'t-sl' + i" [(ngModel)]="st.label" [placeholder]="s.stats[i].label"></label>
            }
            <label class="adm-field"><span class="adm-label">عنوان بخش محصولات</span><input class="adm-input" dir="ltr" name="t-stitle" [(ngModel)]="t.showcase.title" [placeholder]="s.showcase.title"></label>
            <label class="adm-field"><span class="adm-label">متن بخش محصولات</span><input class="adm-input" dir="ltr" name="t-stext" [(ngModel)]="t.showcase.text" [placeholder]="s.showcase.text"></label>
            @for (f of t.features; track $index; let i = $index) {
              <div class="adm-row adm-wide">
                <label class="adm-field adm-grow"><span class="adm-label">ویژگی {{ fa(i + 1) }}</span><input class="adm-input" dir="ltr" [name]="'t-ft' + i" [(ngModel)]="f.title" [placeholder]="s.features[i].title"></label>
                <label class="adm-field adm-grow"><span class="adm-label">توضیح</span><input class="adm-input" dir="ltr" [name]="'t-fx' + i" [(ngModel)]="f.text" [placeholder]="s.features[i].text"></label>
              </div>
            }
          </fieldset>
          <fieldset class="adm-card">
            <legend>صفحه اصلی — پروژه‌ها و خبرنامه</legend>
            <label class="adm-field"><span class="adm-label">عنوان کادر پروژه‌ها</span><input class="adm-input" dir="ltr" name="t-ptitle" [(ngModel)]="t.projects.title" [placeholder]="s.projects.title"></label>
            <label class="adm-field adm-wide"><span class="adm-label">متن کادر پروژه‌ها</span><input class="adm-input" dir="ltr" name="t-ptext" [(ngModel)]="t.projects.text" [placeholder]="s.projects.text"></label>
            <label class="adm-field"><span class="adm-label">عنوان خبرنامه (فوتر)</span><input class="adm-input" dir="ltr" name="t-ntitle" [(ngModel)]="t.newsletter.title" [placeholder]="s.newsletter.title"></label>
            <label class="adm-field"><span class="adm-label">متن خبرنامه</span><input class="adm-input" dir="ltr" name="t-ntext" [(ngModel)]="t.newsletter.text" [placeholder]="s.newsletter.text"></label>
          </fieldset>
        } @else {
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

        @if (s.shop; as shop) {
        <fieldset class="adm-card">
          <legend>فروشگاه — فاکتور و پرداخت</legend>
          <label class="adm-field"><span class="adm-label">نرخ مالیات بر ارزش افزوده (٪)</span><input class="adm-input" type="number" min="0" max="30" step="0.5" name="vat" [(ngModel)]="shop.vatPercent" dir="ltr"><small>روی جمع کالا و هزینه ارسال محاسبه می‌شود؛ برای سفارش‌های بعدی اعمال می‌شود.</small></label>
          <p class="adm-hint adm-wide"><b>اطلاعات فروشنده</b> — روی پیش‌فاکتور و فاکتور چاپ می‌شود.</p>
          <label class="adm-field"><span class="adm-label">نام حقوقی شرکت</span><input class="adm-input" name="slegal" [(ngModel)]="shop.seller.legalName"></label>
          <label class="adm-field"><span class="adm-label">شناسه ملی</span><input class="adm-input" name="snid" [(ngModel)]="shop.seller.nationalId" dir="ltr"></label>
          <label class="adm-field"><span class="adm-label">کد اقتصادی</span><input class="adm-input" name="seco" [(ngModel)]="shop.seller.economicCode" dir="ltr"></label>
          <label class="adm-field"><span class="adm-label">شماره ثبت</span><input class="adm-input" name="sreg" [(ngModel)]="shop.seller.regNo" dir="ltr"></label>
          <label class="adm-field"><span class="adm-label">تلفن</span><input class="adm-input" name="sphone" [(ngModel)]="shop.seller.phone" dir="ltr"></label>
          <label class="adm-field"><span class="adm-label">کد پستی</span><input class="adm-input" name="spost" [(ngModel)]="shop.seller.postalCode" dir="ltr"></label>
          <label class="adm-field adm-wide"><span class="adm-label">نشانی</span><input class="adm-input" name="saddr" [(ngModel)]="shop.seller.address"></label>
          <p class="adm-hint adm-wide"><b>حساب بانکی برای واریز</b> — به مشتریانی که روش «واریز به حساب» را انتخاب کرده‌اند نمایش داده می‌شود.</p>
          <label class="adm-field"><span class="adm-label">نام بانک</span><input class="adm-input" name="bname" [(ngModel)]="shop.bank.name"></label>
          <label class="adm-field"><span class="adm-label">صاحب حساب</span><input class="adm-input" name="bholder" [(ngModel)]="shop.bank.holder"></label>
          <label class="adm-field"><span class="adm-label">شماره حساب</span><input class="adm-input" name="bacc" [(ngModel)]="shop.bank.account" dir="ltr"></label>
          <label class="adm-field"><span class="adm-label">شماره شبا</span><input class="adm-input" name="bsheba" [(ngModel)]="shop.bank.sheba" dir="ltr" placeholder="IR000000000000000000000000"></label>
          <label class="adm-field"><span class="adm-label">شماره کارت (اختیاری)</span><input class="adm-input" name="bcard" [(ngModel)]="shop.bank.card" dir="ltr"></label>
          <p class="adm-hint adm-wide">درگاه‌های پرداخت اینترنتی (ملت، سامان، ملی) با اطلاعات قرارداد بانک در فایل <code>.env</code> سرور فعال می‌شوند؛ راهنما در مستند فنی.</p>
        </fieldset>
        }
        }

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

  /* ───── Translations ───── */
  protected readonly lang = signal<Lang>('fa');
  protected readonly trLang = () => this.lang() as TrLang;
  /** The translation being edited, with every section present and one stat/feature row per Persian row. */
  protected tr(s: SiteSettings, l: TrLang): SettingsTranslation {
    const i18n = (s.i18n ??= {});
    const t = (i18n[l] ??= {}) as Partial<SettingsTranslation>;
    for (const k of ['site', 'contact', 'hero', 'showcase', 'projects', 'newsletter'] as const) t[k] ??= {};
    t.stats = s.stats.map((_, i) => t.stats?.[i] ?? {});
    t.features = s.features.map((_, i) => t.features?.[i] ?? {});
    return t as SettingsTranslation;
  }

  constructor() {
    this.api.settings().then((r) => {
      // always three stats / features rows to edit
      const pad = <T>(arr: T[], make: () => T) => [...arr, ...Array.from({ length: Math.max(0, 3 - arr.length) }, make)].slice(0, 3);
      r.settings.stats = pad(r.settings.stats, () => ({ value: 0, label: '', icon: 'check-circle' }));
      r.settings.features = pad(r.settings.features, () => ({ title: '', text: '', icon: 'shield' }));
      this.icons.set(r.icons);
      r.settings.shop ??= { vatPercent: 10, seller: { legalName: '', nationalId: '', economicCode: '', regNo: '', address: '', postalCode: '', phone: '' }, bank: { name: '', holder: '', account: '', sheba: '', card: '' } };
      this.s.set(r.settings);
    }, (e) => this.toast.error(e));
  }

  async save(s: SiteSettings) {
    this.busy.set(true);
    this.error.set(null);
    try {
      // Empty rows are dropped — drop the same rows from the translations so they stay aligned
      const keepStats = s.stats.map((x, i) => (x.label.trim() ? i : -1)).filter((i) => i >= 0);
      const keepFeatures = s.features.map((x, i) => (x.title.trim() ? i : -1)).filter((i) => i >= 0);
      const i18n: SiteSettings['i18n'] = {};
      for (const l of ['en', 'de'] as const) {
        const t = this.tr(s, l);
        i18n[l] = { ...t, stats: keepStats.map((i) => t.stats[i]), features: keepFeatures.map((i) => t.features[i]) };
      }
      const saved = await this.api.saveSettings({
        ...s,
        i18n,
        stats: keepStats.map((i) => ({ ...s.stats[i], value: Number(s.stats[i].value) || 0 })),
        features: keepFeatures.map((i) => s.features[i]),
        ...(s.shop ? { shop: { ...s.shop, vatPercent: Number(s.shop.vatPercent) || 0, bank: { ...s.shop.bank, sheba: s.shop.bank.sheba.replace(/\s/g, '').toUpperCase() } } } : {}),
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
