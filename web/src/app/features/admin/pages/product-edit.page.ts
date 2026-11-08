import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import type { Lang } from '../../../core/i18n';
import type { ApiError, OrbitSlot, Product, TrLang } from '../../../core/models';
import { IconComponent } from '../../../shared/icon.component';
import { AdminApi } from '../admin-api.service';
import { ImageFieldComponent } from '../ui/image-field.component';
import { LangTabsComponent } from '../ui/lang-tabs.component';
import { ToastService } from '../ui/toast.service';

export const ORBIT_LABELS: Record<Exclude<OrbitSlot, ''>, string> = {
  a: 'بالا راست (کنار لوله‌ها)',
  b: 'بالا چپ (کنار فلنج)',
  c: 'پایین چپ (کنار زانویی)',
  d: 'پایین راست (کنار شیر)',
};

const EMPTY: Partial<Product> = {
  slug: '', title: '', shortTitle: '', code: '', summary: '', intro: '', image: '', alt: '', keywords: '',
  orbit: '', types: [], specs: [], applications: [], variants: [], sort: 0, published: true,
};

@Component({
  selector: 'app-admin-product-edit-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, IconComponent, ImageFieldComponent, LangTabsComponent],
  template: `
    <div class="adm-head">
      <div><h1>{{ isNew() ? 'محصول جدید' : 'ویرایش محصول' }}</h1><p>{{ p.title }}</p></div>
      <div class="adm-head-actions">
        @if (!isNew() && p.published) { <a class="adm-btn adm-btn-ghost" [href]="'/products/' + p.slug" target="_blank"><app-icon name="eye" /> مشاهده</a> }
        <a class="adm-btn adm-btn-ghost" routerLink="/admin/products">بازگشت</a>
      </div>
    </div>

    @if (error(); as e) { <p class="adm-error" role="alert">{{ e.message }}</p> }

    @if (!loaded()) { <div class="adm-skeleton"></div> } @else {
    <adm-lang-tabs [(lang)]="lang" />
    <form class="adm-form" (ngSubmit)="save()">
      @if (lang() !== 'fa') {
        @let t = tr(trLang());
        <fieldset class="adm-card">
          <legend>متن‌ها — {{ langName() }}</legend>
          <label class="adm-field"><span class="adm-label">عنوان</span><input class="adm-input" dir="ltr" name="tr-title" [(ngModel)]="t.title" [placeholder]="p.title"></label>
          <label class="adm-field"><span class="adm-label">عنوان کوتاه</span><input class="adm-input" dir="ltr" name="tr-short" [(ngModel)]="t.shortTitle" [placeholder]="p.shortTitle"></label>
          <label class="adm-field adm-wide"><span class="adm-label">خلاصه (کارت محصول)</span><textarea class="adm-input" dir="ltr" name="tr-summary" rows="2" [(ngModel)]="t.summary" [placeholder]="p.summary"></textarea></label>
          <label class="adm-field adm-wide"><span class="adm-label">معرفی (صفحه محصول)</span><textarea class="adm-input" dir="ltr" name="tr-intro" rows="4" [(ngModel)]="t.intro" [placeholder]="p.intro"></textarea></label>
          <label class="adm-field"><span class="adm-label">متن جایگزین تصویر</span><input class="adm-input" dir="ltr" name="tr-alt" [(ngModel)]="t.alt" [placeholder]="p.alt"></label>
          <label class="adm-field"><span class="adm-label">کلیدواژه‌های جستجو</span><input class="adm-input" dir="ltr" name="tr-kw" [(ngModel)]="t.keywords" [placeholder]="p.keywords"></label>
        </fieldset>
        @if (p.types?.length) {
          <fieldset class="adm-card">
            <legend>انواع رایج — {{ langName() }}</legend>
            @for (row of t.types; track $index; let i = $index) {
              <div class="adm-row">
                <input class="adm-input" dir="ltr" [name]="'tr-tn' + i" [(ngModel)]="row.name" [placeholder]="p.types![i].name">
                <input class="adm-input adm-grow" dir="ltr" [name]="'tr-td' + i" [(ngModel)]="row.desc" [placeholder]="p.types![i].desc">
              </div>
            }
          </fieldset>
        }
        @if (p.specs?.length) {
          <fieldset class="adm-card">
            <legend>جدول مشخصات فنی — {{ langName() }}</legend>
            @for (row of t.specs; track $index; let i = $index) {
              <div class="adm-row">
                <input class="adm-input" dir="ltr" [name]="'tr-sl' + i" [(ngModel)]="row.label" [placeholder]="p.specs![i].label">
                <input class="adm-input adm-grow" dir="ltr" [name]="'tr-sv' + i" [(ngModel)]="row.value" [placeholder]="p.specs![i].value">
              </div>
            }
          </fieldset>
        }
        <fieldset class="adm-card">
          <legend>کاربردها — {{ langName() }}</legend>
          <label class="adm-field adm-wide"><span class="adm-label">کاربردها</span>
            <textarea class="adm-input" dir="ltr" name="tr-apps" rows="4" [(ngModel)]="trApps[trLang()]" [placeholder]="applications"></textarea><small>هر خط یک کاربرد؛ خالی = همان فهرست فارسی</small></label>
        </fieldset>
      } @else {
      <fieldset class="adm-card">
        <legend>اطلاعات اصلی</legend>
        <label class="adm-field"><span class="adm-label">عنوان</span><input class="adm-input" name="title" [(ngModel)]="p.title" required></label>
        <label class="adm-field" [class.bad]="error()?.field === 'slug'"><span class="adm-label">نامک (آدرس صفحه)</span>
          <input class="adm-input" name="slug" [(ngModel)]="p.slug" dir="ltr" required placeholder="steel-pipes">
          <small>حروف انگلیسی کوچک، عدد و خط تیره — /products/{{ p.slug || 'slug' }}</small></label>
        <label class="adm-field"><span class="adm-label">عنوان کوتاه</span><input class="adm-input" name="shortTitle" [(ngModel)]="p.shortTitle"><small>روی برچسب‌های تصویر صفحه اصلی؛ مثلاً «لوله‌ها»</small></label>
        <label class="adm-field"><span class="adm-label">کد / زیرعنوان لاتین</span><input class="adm-input" name="code" [(ngModel)]="p.code" dir="ltr" placeholder="STEEL PIPES"></label>
        <label class="adm-field adm-wide"><span class="adm-label">خلاصه (کارت محصول)</span><textarea class="adm-input" name="summary" rows="2" [(ngModel)]="p.summary"></textarea></label>
        <label class="adm-field adm-wide"><span class="adm-label">معرفی (صفحه محصول)</span><textarea class="adm-input" name="intro" rows="4" [(ngModel)]="p.intro"></textarea></label>
        <adm-image-field label="تصویر" [(value)]="image" />
        <label class="adm-field"><span class="adm-label">متن جایگزین تصویر</span><input class="adm-input" name="alt" [(ngModel)]="p.alt"></label>
        <label class="adm-field"><span class="adm-label">کلیدواژه‌های جستجو</span><input class="adm-input" name="keywords" [(ngModel)]="p.keywords"><small>با فاصله؛ جستجوی بالای سایت از این‌ها استفاده می‌کند</small></label>
      </fieldset>

      <fieldset class="adm-card">
        <legend>انواع رایج</legend>
        @for (t of p.types; track $index; let i = $index) {
          <div class="adm-row">
            <input class="adm-input" [name]="'tn' + i" [(ngModel)]="t.name" placeholder="نام">
            <input class="adm-input adm-grow" [name]="'td' + i" [(ngModel)]="t.desc" placeholder="توضیح">
            <button type="button" class="adm-icon-btn" (click)="p.types!.splice(i, 1)" aria-label="حذف"><app-icon name="trash" /></button>
          </div>
        }
        <button type="button" class="adm-btn adm-btn-ghost adm-btn-sm" (click)="p.types!.push({ name: '', desc: '' })"><app-icon name="plus" /> افزودن نوع</button>
      </fieldset>

      <fieldset class="adm-card">
        <legend>جدول مشخصات فنی</legend>
        @for (s of p.specs; track $index; let i = $index) {
          <div class="adm-row">
            <input class="adm-input" [name]="'sl' + i" [(ngModel)]="s.label" placeholder="عنوان">
            <input class="adm-input adm-grow" [name]="'sv' + i" [(ngModel)]="s.value" placeholder="مقدار" dir="auto">
            <button type="button" class="adm-icon-btn" (click)="p.specs!.splice(i, 1)" aria-label="حذف"><app-icon name="trash" /></button>
          </div>
        }
        <button type="button" class="adm-btn adm-btn-ghost adm-btn-sm" (click)="p.specs!.push({ label: '', value: '' })"><app-icon name="plus" /> افزودن ردیف</button>
      </fieldset>

      <fieldset class="adm-card">
        <legend>فروش آنلاین (قیمت و موجودی)</legend>
        <p class="adm-hint">هر ردیف یک سایز یا گرید با قیمت ثابت است که مشتری می‌تواند آن را به سبد خرید اضافه کند. اگر ردیفی نباشد، محصول فقط با استعلام قیمت عرضه می‌شود. قیمت به تومان و بدون مالیات است؛ موجودی خالی یعنی «تأمین طبق سفارش» (بدون کنترل موجودی).</p>
        @if (p.variants?.length) {
          <div class="adm-variants">
            <div class="adm-variant adm-variant-head"><span>کد کالا (SKU)</span><span>مشخصات (سایز، گرید، استاندارد)</span><span>واحد</span><span>قیمت (تومان)</span><span>موجودی</span><span>حداقل</span><span>فعال</span><span></span></div>
            @for (v of p.variants; track $index; let i = $index) {
              <div class="adm-variant">
                <input class="adm-input" [name]="'vs' + i" [(ngModel)]="v.sku" dir="ltr" placeholder="API5L-B-6-SCH40" maxlength="40" aria-label="کد کالا">
                <input class="adm-input" [name]="'vt' + i" [(ngModel)]="v.title" dir="auto" placeholder='6" SCH40 — API 5L Gr.B' maxlength="150" aria-label="مشخصات">
                <select class="adm-input" [name]="'vu' + i" [(ngModel)]="v.unit" aria-label="واحد">
                  @for (u of units; track u[0]) { <option [value]="u[0]">{{ u[1] }}</option> }
                </select>
                <input class="adm-input" type="number" min="1000" step="1000" [name]="'vp' + i" [(ngModel)]="v.price" dir="ltr" aria-label="قیمت">
                <input class="adm-input" type="number" min="0" [name]="'vk' + i" [(ngModel)]="v.stock" dir="ltr" placeholder="—" aria-label="موجودی">
                <input class="adm-input" type="number" min="1" [name]="'vm' + i" [(ngModel)]="v.minQty" dir="ltr" aria-label="حداقل سفارش">
                <input type="checkbox" [name]="'va' + i" [(ngModel)]="v.active" aria-label="فعال">
                <button type="button" class="adm-icon-btn" (click)="p.variants!.splice(i, 1)" aria-label="حذف"><app-icon name="trash" /></button>
              </div>
            }
          </div>
        }
        <button type="button" class="adm-btn adm-btn-ghost adm-btn-sm" (click)="addVariant()"><app-icon name="plus" /> افزودن ردیف فروش</button>
      </fieldset>

      <fieldset class="adm-card">
        <legend>کاربردها و نمایش</legend>
        <label class="adm-field adm-wide"><span class="adm-label">کاربردها</span>
          <textarea class="adm-input" name="applications" rows="4" [(ngModel)]="applications"></textarea><small>هر خط یک کاربرد</small></label>
        <label class="adm-field"><span class="adm-label">جایگاه در تصویر صفحه اصلی</span>
          <select class="adm-input" name="orbit" [(ngModel)]="p.orbit">
            <option value="">— نمایش داده نشود —</option>
            @for (o of orbitKeys; track o) { <option [value]="o">{{ orbitLabels[o] }}</option> }
          </select><small>هر جایگاه فقط یک محصول دارد.</small></label>
        <label class="adm-field"><span class="adm-label">ترتیب نمایش</span><input class="adm-input" type="number" name="sort" [(ngModel)]="p.sort"><small>عدد کمتر = جلوتر</small></label>
        <label class="adm-check"><input type="checkbox" name="published" [(ngModel)]="p.published"> منتشر شود</label>
      </fieldset>
      }

      <div class="adm-savebar">
        <button class="adm-btn" type="submit" [disabled]="busy()">{{ busy() ? 'در حال ذخیره...' : 'ذخیره محصول' }}</button>
        @if (!isNew()) { <button type="button" class="adm-btn adm-btn-danger" (click)="remove()"><app-icon name="trash" /> حذف</button> }
      </div>
    </form>
    }
  `,
})
export class AdminProductEditPage {
  readonly id = input.required<string>();
  private readonly api = inject(AdminApi);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly units = [['piece', 'عدد'], ['meter', 'متر'], ['length', 'شاخه'], ['kg', 'کیلوگرم'], ['set', 'دست']] as const;
  protected readonly orbitLabels = ORBIT_LABELS;
  protected readonly orbitKeys = Object.keys(ORBIT_LABELS) as (keyof typeof ORBIT_LABELS)[];
  protected p: Partial<Product> = structuredClone(EMPTY);
  protected image = '';
  protected applications = '';
  protected readonly busy = signal(false);
  protected readonly error = signal<ApiError | null>(null);
  protected readonly isNew = () => this.id() === 'new';
  protected readonly loaded = signal(false);

  /* ───── Translations ───── */
  protected readonly lang = signal<Lang>('fa');
  protected readonly trLang = () => this.lang() as TrLang;
  protected readonly langName = () => (this.lang() === 'en' ? 'English' : 'Deutsch');
  protected trApps: Record<TrLang, string> = { en: '', de: '' };

  /** The translation being edited, with one type/spec row per Persian row. */
  protected tr(l: TrLang) {
    const i18n = (this.p.i18n ??= {});
    const t = (i18n[l] ??= {});
    t.types = (this.p.types ?? []).map((_, i) => t.types?.[i] ?? { name: '', desc: '' });
    t.specs = (this.p.specs ?? []).map((_, i) => t.specs?.[i] ?? { label: '', value: '' });
    return t;
  }

  constructor() {
    effect(() => {
      if (this.isNew()) return this.loaded.set(true);
      this.api.product(this.id()).then((p) => {
        this.p = { ...p, variants: p.variants ?? [] };
        this.image = p.image;
        this.applications = p.applications.join('\n');
        this.trApps = { en: (p.i18n?.en?.applications ?? []).join('\n'), de: (p.i18n?.de?.applications ?? []).join('\n') };
        this.loaded.set(true);
      }, (e) => this.toast.error(e));
    });
  }

  protected addVariant() {
    (this.p.variants ??= []).push({ sku: '', title: '', unit: 'piece', price: 0, stock: null, minQty: 1, active: true });
  }

  async save() {
    this.busy.set(true);
    this.error.set(null);
    // Rows without a Persian name are dropped — drop the same rows from the translations so they stay aligned
    const keepTypes = (this.p.types ?? []).map((t, i) => (t.name.trim() ? i : -1)).filter((i) => i >= 0);
    const keepSpecs = (this.p.specs ?? []).map((sp, i) => (sp.label.trim() ? i : -1)).filter((i) => i >= 0);
    const i18n: Product['i18n'] = {};
    for (const l of ['en', 'de'] as const) {
      const t = this.tr(l);
      i18n[l] = {
        ...t,
        types: keepTypes.map((i) => t.types![i]),
        specs: keepSpecs.map((i) => t.specs![i]),
        applications: this.trApps[l].split('\n').map((x) => x.trim()).filter(Boolean),
      };
    }
    const body: Partial<Product> = {
      ...this.p,
      i18n,
      image: this.image,
      types: keepTypes.map((i) => this.p.types![i]),
      specs: keepSpecs.map((i) => this.p.specs![i]),
      applications: this.applications.split('\n').map((s) => s.trim()).filter(Boolean),
      sort: Number(this.p.sort) || 0,
      variants: (this.p.variants ?? [])
        .filter((v) => v.sku.trim() || v.title.trim())
        .map((v) => ({
          ...v,
          sku: v.sku.trim(),
          price: Number(v.price) || 0,
          stock: v.stock === null || (v.stock as unknown) === '' ? null : Number(v.stock),
          minQty: Number(v.minQty) || 1,
        })),
    };
    for (const k of ['_id', 'createdAt', 'updatedAt', '__v'] as const) delete (body as Record<string, unknown>)[k];
    try {
      const saved = await this.api.saveProduct(this.isNew() ? null : this.id(), body);
      this.toast.show('محصول ذخیره شد.');
      if (this.isNew()) await this.router.navigate(['/admin/products', saved._id], { replaceUrl: true });
    } catch (e) {
      this.error.set(e as ApiError);
    } finally {
      this.busy.set(false);
    }
  }

  async remove() {
    if (!confirm(`«${this.p.title}» برای همیشه حذف شود؟`)) return;
    try {
      await this.api.deleteProduct(this.id());
      this.toast.show('محصول حذف شد.');
      await this.router.navigateByUrl('/admin/products');
    } catch (e) {
      this.toast.error(e);
    }
  }
}
