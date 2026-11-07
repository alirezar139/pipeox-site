import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import type { ApiError, OrbitSlot, Product } from '../../../core/models';
import { IconComponent } from '../../../shared/icon.component';
import { AdminApi } from '../admin-api.service';
import { ImageFieldComponent } from '../ui/image-field.component';
import { ToastService } from '../ui/toast.service';

export const ORBIT_LABELS: Record<Exclude<OrbitSlot, ''>, string> = {
  a: 'بالا راست (کنار لوله‌ها)',
  b: 'بالا چپ (کنار فلنج)',
  c: 'پایین چپ (کنار زانویی)',
  d: 'پایین راست (کنار شیر)',
};

const EMPTY: Partial<Product> = {
  slug: '', title: '', shortTitle: '', code: '', summary: '', intro: '', image: '', alt: '', keywords: '',
  orbit: '', types: [], specs: [], applications: [], sort: 0, published: true,
};

@Component({
  selector: 'app-admin-product-edit-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, IconComponent, ImageFieldComponent],
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
    <form class="adm-form" (ngSubmit)="save()">
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

  protected readonly orbitLabels = ORBIT_LABELS;
  protected readonly orbitKeys = Object.keys(ORBIT_LABELS) as (keyof typeof ORBIT_LABELS)[];
  protected p: Partial<Product> = structuredClone(EMPTY);
  protected image = '';
  protected applications = '';
  protected readonly busy = signal(false);
  protected readonly error = signal<ApiError | null>(null);
  protected readonly isNew = () => this.id() === 'new';
  protected readonly loaded = signal(false);

  constructor() {
    effect(() => {
      if (this.isNew()) return this.loaded.set(true);
      this.api.product(this.id()).then((p) => {
        this.p = p;
        this.image = p.image;
        this.applications = p.applications.join('\n');
        this.loaded.set(true);
      }, (e) => this.toast.error(e));
    });
  }

  async save() {
    this.busy.set(true);
    this.error.set(null);
    const body: Partial<Product> = {
      ...this.p,
      image: this.image,
      types: (this.p.types ?? []).filter((t) => t.name.trim()),
      specs: (this.p.specs ?? []).filter((s) => s.label.trim()),
      applications: this.applications.split('\n').map((s) => s.trim()).filter(Boolean),
      sort: Number(this.p.sort) || 0,
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
