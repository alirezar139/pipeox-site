import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FaNumPipe } from '../../../core/format';
import type { Product } from '../../../core/models';
import { IconComponent } from '../../../shared/icon.component';
import { AdminApi } from '../admin-api.service';
import { ORBIT_LABELS } from './product-edit.page';

@Component({
  selector: 'app-admin-products-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent, FaNumPipe],
  template: `
    <div class="adm-head">
      <div><h1>محصولات</h1><p>کاتالوگ، صفحه هر محصول و برچسب‌های صفحه اصلی</p></div>
      <a class="adm-btn" routerLink="/admin/products/new"><app-icon name="plus" /> محصول جدید</a>
    </div>
    @if (loading()) { <div class="adm-skeleton"></div> }
    @else if (!items().length) { <p class="adm-empty">هنوز محصولی ثبت نشده است.</p> }
    @else {
      <div class="adm-table-wrap">
        <table class="adm-table">
          <thead><tr><th></th><th>عنوان</th><th>آدرس</th><th>صفحه اصلی</th><th>ترتیب</th><th>وضعیت</th><th></th></tr></thead>
          <tbody>
            @for (p of items(); track p._id) {
              <tr>
                <td class="adm-thumb">@if (p.image) { <img [src]="p.image" alt=""> }</td>
                <td><a [routerLink]="['/admin/products', p._id]"><b>{{ p.title }}</b></a><small>{{ p.code }}</small></td>
                <td dir="ltr" class="adm-muted">/products/{{ p.slug }}</td>
                <td>@if (p.orbit) { <span class="adm-badge s-new">{{ orbit[p.orbit] }}</span> } @else { <span class="adm-muted">—</span> }</td>
                <td>{{ p.sort | faNum }}</td>
                <td>@if (p.published) { <span class="adm-badge s-won">منتشر شده</span> } @else { <span class="adm-badge s-closed">پیش‌نویس</span> }</td>
                <td class="adm-actions">
                  <a class="adm-btn adm-btn-ghost adm-btn-sm" [routerLink]="['/admin/products', p._id]"><app-icon name="edit" /> ویرایش</a>
                  @if (p.published) { <a class="adm-btn adm-btn-ghost adm-btn-sm" [href]="'/products/' + p.slug" target="_blank"><app-icon name="eye" /></a> }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
})
export class AdminProductsPage {
  protected readonly items = signal<Product[]>([]);
  protected readonly loading = signal(true);
  protected readonly orbit = ORBIT_LABELS;

  constructor() {
    inject(AdminApi)
      .products()
      .then((p) => this.items.set(p))
      .finally(() => this.loading.set(false));
  }
}
