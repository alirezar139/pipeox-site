import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FaNumPipe } from '../../../core/format';
import type { Lang } from '../../../core/i18n';
import type { ApiError, Project, TrLang } from '../../../core/models';
import { IconComponent } from '../../../shared/icon.component';
import { AdminApi } from '../admin-api.service';
import { ImageFieldComponent } from '../ui/image-field.component';
import { LangTabsComponent } from '../ui/lang-tabs.component';
import { ToastService } from '../ui/toast.service';

type Draft = Omit<Project, '_id'> & { _id?: string };
const blank = (): Draft => ({ title: '', client: '', year: '', industry: '', scope: '', image: '', sort: 0, published: true });

/** Projects list with an inline editor (few fields — no separate page needed). */
@Component({
  selector: 'app-admin-projects-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, IconComponent, ImageFieldComponent, FaNumPipe, LangTabsComponent],
  template: `
    <div class="adm-head">
      <div><h1>پروژه‌ها</h1><p>بخش «پروژه‌های شاخص» صفحه پروژه‌ها با اولین پروژه منتشرشده نمایش داده می‌شود.</p></div>
      @if (!draft()) { <button type="button" class="adm-btn" (click)="edit(null)"><app-icon name="plus" /> پروژه جدید</button> }
    </div>

    @if (draft(); as d) {
      <form class="adm-form adm-card" (ngSubmit)="save(d)">
        <h2 class="adm-card-title">{{ d._id ? 'ویرایش پروژه' : 'پروژه جدید' }}</h2>
        @if (error(); as e) { <p class="adm-error adm-wide">{{ e.message }}</p> }
        <adm-lang-tabs class="adm-wide" [(lang)]="lang" />
        @if (lang() !== 'fa') {
          @let t = tr(d, trLang());
          <label class="adm-field adm-wide"><span class="adm-label">عنوان پروژه</span><input class="adm-input" dir="ltr" name="tr-title" [(ngModel)]="t.title" [placeholder]="d.title"></label>
          <label class="adm-field"><span class="adm-label">کارفرما</span><input class="adm-input" dir="ltr" name="tr-client" [(ngModel)]="t.client" [placeholder]="d.client"></label>
          <label class="adm-field"><span class="adm-label">صنعت</span><input class="adm-input" dir="ltr" name="tr-industry" [(ngModel)]="t.industry" [placeholder]="d.industry"></label>
          <label class="adm-field adm-wide"><span class="adm-label">شرح کار و اقلام تأمین‌شده</span><textarea class="adm-input" dir="ltr" name="tr-scope" rows="3" [(ngModel)]="t.scope" [placeholder]="d.scope"></textarea></label>
        } @else {
        <label class="adm-field adm-wide"><span class="adm-label">عنوان پروژه</span><input class="adm-input" name="title" [(ngModel)]="d.title" required></label>
        <label class="adm-field"><span class="adm-label">کارفرما</span><input class="adm-input" name="client" [(ngModel)]="d.client"></label>
        <label class="adm-field"><span class="adm-label">صنعت</span><input class="adm-input" name="industry" [(ngModel)]="d.industry" placeholder="مثلاً نفت و گاز"></label>
        <label class="adm-field"><span class="adm-label">سال</span><input class="adm-input" name="year" [(ngModel)]="d.year" placeholder="۱۴۰۳"></label>
        <label class="adm-field"><span class="adm-label">ترتیب نمایش</span><input class="adm-input" type="number" name="sort" [(ngModel)]="d.sort"></label>
        <label class="adm-field adm-wide"><span class="adm-label">شرح کار و اقلام تأمین‌شده</span><textarea class="adm-input" name="scope" rows="3" [(ngModel)]="d.scope"></textarea></label>
        <adm-image-field label="تصویر" [(value)]="d.image" />
        <label class="adm-check"><input type="checkbox" name="published" [(ngModel)]="d.published"> در سایت نمایش داده شود</label>
        }
        <div class="adm-savebar adm-wide">
          <button class="adm-btn" type="submit" [disabled]="busy()">ذخیره پروژه</button>
          <button type="button" class="adm-btn adm-btn-ghost" (click)="draft.set(null)">انصراف</button>
          @if (d._id) { <button type="button" class="adm-btn adm-btn-danger" (click)="remove(d)"><app-icon name="trash" /> حذف</button> }
        </div>
      </form>
    }

    @if (!items().length && !draft()) {
      <p class="adm-empty">هنوز پروژه‌ای ثبت نشده است.</p>
    } @else if (items().length) {
      <div class="adm-table-wrap">
        <table class="adm-table">
          <thead><tr><th></th><th>عنوان</th><th>کارفرما</th><th>صنعت</th><th>سال</th><th>وضعیت</th><th></th></tr></thead>
          <tbody>
            @for (p of items(); track p._id) {
              <tr>
                <td class="adm-thumb">@if (p.image) { <img [src]="p.image" alt=""> }</td>
                <td><b>{{ p.title }}</b></td><td>{{ p.client }}</td><td>{{ p.industry }}</td><td>{{ p.year | faNum }}</td>
                <td>@if (p.published) { <span class="adm-badge s-won">نمایش</span> } @else { <span class="adm-badge s-closed">مخفی</span> }</td>
                <td class="adm-actions"><button type="button" class="adm-btn adm-btn-ghost adm-btn-sm" (click)="edit(p)"><app-icon name="edit" /> ویرایش</button></td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
})
export class AdminProjectsPage {
  private readonly api = inject(AdminApi);
  private readonly toast = inject(ToastService);
  protected readonly items = signal<Project[]>([]);
  protected readonly draft = signal<Draft | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal<ApiError | null>(null);
  protected readonly lang = signal<Lang>('fa');
  protected readonly trLang = () => this.lang() as TrLang;
  protected tr(d: Draft, l: TrLang) {
    const i18n = (d.i18n ??= {});
    return (i18n[l] ??= {});
  }

  constructor() {
    void this.load();
  }

  private async load() {
    this.items.set(await this.api.projects());
  }

  edit(p: Project | null) {
    this.error.set(null);
    this.lang.set('fa');
    this.draft.set(p ? structuredClone(p) : blank());
    scrollTo({ top: 0, behavior: 'smooth' });
  }

  async save(d: Draft) {
    this.busy.set(true);
    const { _id, ...body } = d;
    try {
      await this.api.saveProject(_id ?? null, { ...body, sort: Number(body.sort) || 0 });
      this.toast.show('پروژه ذخیره شد.');
      this.draft.set(null);
      await this.load();
    } catch (e) {
      this.error.set(e as ApiError);
    } finally {
      this.busy.set(false);
    }
  }

  async remove(d: Draft) {
    if (!d._id || !confirm(`«${d.title}» حذف شود؟`)) return;
    await this.api.deleteProject(d._id).then(() => this.toast.show('پروژه حذف شد.'), (e) => this.toast.error(e));
    this.draft.set(null);
    await this.load();
  }
}
