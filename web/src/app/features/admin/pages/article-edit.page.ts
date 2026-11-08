import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { faDate } from '../../../core/format';
import type { Lang } from '../../../core/i18n';
import type { ApiError, Article, TrLang } from '../../../core/models';
import { IconComponent } from '../../../shared/icon.component';
import { AdminApi } from '../admin-api.service';
import { ImageFieldComponent } from '../ui/image-field.component';
import { LangTabsComponent } from '../ui/lang-tabs.component';
import { RichEditorComponent } from '../ui/rich-editor.component';
import { ToastService } from '../ui/toast.service';

const today = () => new Date().toISOString().slice(0, 10);

@Component({
  selector: 'app-admin-article-edit-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, IconComponent, ImageFieldComponent, RichEditorComponent, LangTabsComponent],
  template: `
    <div class="adm-head">
      <div><h1>{{ isNew() ? 'مطلب جدید' : 'ویرایش مطلب' }}</h1><p>{{ a.title }}</p></div>
      <div class="adm-head-actions">
        @if (!isNew() && a.published) { <a class="adm-btn adm-btn-ghost" [href]="'/insights/' + a.slug" target="_blank"><app-icon name="eye" /> مشاهده</a> }
        <a class="adm-btn adm-btn-ghost" routerLink="/admin/articles">بازگشت</a>
      </div>
    </div>
    @if (error(); as e) { <p class="adm-error" role="alert">{{ e.message }}</p> }

    @if (!loaded()) { <div class="adm-skeleton"></div> } @else {
      <adm-lang-tabs [(lang)]="lang" />
      <form class="adm-form adm-form-article" (ngSubmit)="save()">
        <div class="adm-article-main">
          @switch (lang()) {
            @case ('fa') {
              <input class="adm-input adm-title-input" name="title" [(ngModel)]="a.title" placeholder="عنوان مطلب" required>
              <textarea class="adm-input" name="description" rows="2" [(ngModel)]="a.description" placeholder="خلاصه — در فهرست مطالب و نتایج گوگل نمایش داده می‌شود (حدود ۱۵۰ کاراکتر)"></textarea>
              <adm-rich-editor [(value)]="body" />
            }
            @default {
              @let t = tr(trLang());
              <input class="adm-input adm-title-input" dir="ltr" name="tr-title" [(ngModel)]="t.title" [placeholder]="a.title ?? ''">
              <textarea class="adm-input" dir="ltr" name="tr-description" rows="2" [(ngModel)]="t.description" [placeholder]="a.description ?? ''"></textarea>
              <div class="adm-field-row">
                <input class="adm-input" dir="ltr" name="tr-category" [(ngModel)]="t.category" [placeholder]="'دسته: ' + (a.category ?? '')">
                <input class="adm-input" dir="ltr" name="tr-alt" [(ngModel)]="t.imageAlt" [placeholder]="'متن جایگزین تصویر: ' + (a.imageAlt ?? '')">
              </div>
              @if (lang() === 'en') { <adm-rich-editor class="adm-ltr-editor" [(value)]="bodyEn" /> } @else { <adm-rich-editor class="adm-ltr-editor" [(value)]="bodyDe" /> }
              <small class="adm-hint">متن خالی = همان متن فارسی روی سایت نمایش داده می‌شود.</small>
            }
          }
        </div>
        <aside class="adm-article-side">
          <fieldset class="adm-card">
            <legend>انتشار</legend>
            <label class="adm-check"><input type="checkbox" name="published" [(ngModel)]="a.published"> منتشر شود</label>
            <label class="adm-field"><span class="adm-label">تاریخ انتشار</span>
              <input class="adm-input" type="date" name="date" [(ngModel)]="dateSig">
              <small>{{ dateFa() }} — تاریخ آینده = انتشار خودکار در آن روز</small></label>
            <label class="adm-field"><span class="adm-label">دسته</span>
              <input class="adm-input" name="category" [(ngModel)]="a.category" list="cats" placeholder="مثلاً راهنمای فنی">
              <datalist id="cats">@for (c of categories(); track c) { <option [value]="c"></option> }</datalist></label>
            <label class="adm-field" [class.bad]="error()?.field === 'slug'"><span class="adm-label">نامک (آدرس)</span>
              <input class="adm-input" name="slug" [(ngModel)]="a.slug" dir="ltr" placeholder="خالی = خودکار">
              <small>حروف انگلیسی کوچک، عدد و خط تیره</small></label>
            <button class="adm-btn adm-btn-block" type="submit" [disabled]="busy()">{{ busy() ? 'در حال ذخیره...' : 'ذخیره مطلب' }}</button>
          </fieldset>
          <fieldset class="adm-card">
            <legend>تصویر شاخص</legend>
            <adm-image-field label="تصویر" [(value)]="image" />
            <label class="adm-field"><span class="adm-label">متن جایگزین</span><input class="adm-input" name="imageAlt" [(ngModel)]="a.imageAlt"></label>
            <label class="adm-check"><input type="checkbox" name="showCover" [(ngModel)]="a.showCover"> بالای متن مطلب هم نمایش داده شود</label>
          </fieldset>
          @if (!isNew()) { <button type="button" class="adm-btn adm-btn-danger adm-btn-block" (click)="remove()"><app-icon name="trash" /> حذف مطلب</button> }
        </aside>
      </form>
    }
  `,
})
export class AdminArticleEditPage {
  readonly id = input.required<string>();
  private readonly api = inject(AdminApi);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected a: Partial<Article> = { title: '', slug: '', description: '', category: '', imageAlt: '', showCover: true, published: true };
  protected image = '';
  protected readonly body = signal('');
  protected readonly dateSig = signal(today());
  protected readonly dateFa = computed(() => faDate(this.dateSig()));
  protected readonly categories = signal<string[]>([]);
  protected readonly loaded = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal<ApiError | null>(null);
  protected readonly isNew = () => this.id() === 'new';

  /* ───── Translations ───── */
  protected readonly lang = signal<Lang>('fa');
  protected readonly trLang = () => this.lang() as TrLang;
  protected readonly bodyEn = signal('');
  protected readonly bodyDe = signal('');
  protected tr(l: TrLang) {
    const i18n = (this.a.i18n ??= {});
    return (i18n[l] ??= {});
  }

  constructor() {
    this.api.categories().then((c) => this.categories.set(c), () => {});
    effect(() => {
      if (this.isNew()) return this.loaded.set(true);
      this.api.article(this.id()).then((a) => {
        this.a = a;
        this.image = a.image;
        this.body.set(a.body);
        this.bodyEn.set(a.i18n?.en?.body ?? '');
        this.bodyDe.set(a.i18n?.de?.body ?? '');
        this.dateSig.set(a.publishedAt.slice(0, 10));
        this.loaded.set(true);
      }, (e) => this.toast.error(e));
    });
  }

  async save() {
    this.busy.set(true);
    this.error.set(null);
    const body: Partial<Article> = {
      slug: this.a.slug ?? '',
      title: this.a.title,
      description: this.a.description,
      category: this.a.category,
      image: this.image,
      imageAlt: this.a.imageAlt,
      showCover: this.a.showCover,
      body: this.body(),
      publishedAt: this.dateSig() || today(),
      published: this.a.published,
      i18n: {
        en: { ...this.tr('en'), body: this.bodyEn() },
        de: { ...this.tr('de'), body: this.bodyDe() },
      },
    };
    try {
      const saved = await this.api.saveArticle(this.isNew() ? null : this.id(), body);
      this.a.slug = saved.slug;
      this.toast.show('مطلب ذخیره شد.');
      if (this.isNew()) await this.router.navigate(['/admin/articles', saved._id], { replaceUrl: true });
    } catch (e) {
      this.error.set(e as ApiError);
    } finally {
      this.busy.set(false);
    }
  }

  async remove() {
    if (!confirm(`«${this.a.title}» برای همیشه حذف شود؟`)) return;
    try {
      await this.api.deleteArticle(this.id());
      this.toast.show('مطلب حذف شد.');
      await this.router.navigateByUrl('/admin/articles');
    } catch (e) {
      this.toast.error(e);
    }
  }
}
