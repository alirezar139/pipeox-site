import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FaDatePipe } from '../../../core/format';
import type { ArticleSummary } from '../../../core/models';
import { IconComponent } from '../../../shared/icon.component';
import { AdminApi } from '../admin-api.service';

@Component({
  selector: 'app-admin-articles-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent, FaDatePipe],
  template: `
    <div class="adm-head">
      <div><h1>مقالات و اخبار</h1><p>آخرین مطلب منتشرشده در کادر «آخرین اخبار» صفحه اصلی نمایش داده می‌شود.</p></div>
      <a class="adm-btn" routerLink="/admin/articles/new"><app-icon name="plus" /> مطلب جدید</a>
    </div>
    @if (loading()) { <div class="adm-skeleton"></div> }
    @else if (!items().length) { <p class="adm-empty">هنوز مطلبی ننوشته‌اید.</p> }
    @else {
      <div class="adm-table-wrap">
        <table class="adm-table">
          <thead><tr><th></th><th>عنوان</th><th>دسته</th><th>تاریخ انتشار</th><th>وضعیت</th><th></th></tr></thead>
          <tbody>
            @for (a of items(); track a._id) {
              <tr>
                <td class="adm-thumb">@if (a.image) { <img [src]="a.image" alt=""> }</td>
                <td><a [routerLink]="['/admin/articles', a._id]"><b>{{ a.title }}</b></a></td>
                <td>{{ a.category }}</td>
                <td>{{ a.publishedAt | faDate }}</td>
                <td>
                  @if (!a.published) { <span class="adm-badge s-closed">پیش‌نویس</span> }
                  @else if (isFuture(a)) { <span class="adm-badge s-contacted">زمان‌بندی‌شده</span> }
                  @else { <span class="adm-badge s-won">منتشر شده</span> }
                </td>
                <td class="adm-actions">
                  <a class="adm-btn adm-btn-ghost adm-btn-sm" [routerLink]="['/admin/articles', a._id]"><app-icon name="edit" /> ویرایش</a>
                  @if (a.published && !isFuture(a)) { <a class="adm-btn adm-btn-ghost adm-btn-sm" [href]="'/insights/' + a.slug" target="_blank"><app-icon name="eye" /></a> }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
})
export class AdminArticlesPage {
  protected readonly items = signal<ArticleSummary[]>([]);
  protected readonly loading = signal(true);
  protected isFuture = (a: ArticleSummary) => new Date(a.publishedAt) > new Date();

  constructor() {
    inject(AdminApi)
      .articles()
      .then((a) => this.items.set(a))
      .finally(() => this.loading.set(false));
  }
}
