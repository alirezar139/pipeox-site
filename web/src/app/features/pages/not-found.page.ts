import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { useResponseStatus } from '../../core/http-status';
import { SeoService } from '../../core/seo.service';

@Component({
  selector: 'app-not-found-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <section class="section not-found">
      <div class="wrap">
        <div class="code" aria-hidden="true">404</div>
        <h1>این خط لوله به جایی نمی‌رسد.</h1>
        <p>صفحه‌ای که دنبالش هستید وجود ندارد یا جابه‌جا شده است.</p>
        <div class="actions">
          <a class="btn btn-pill" routerLink="/">بازگشت به صفحه اصلی</a>
          <a class="btn btn-pill btn-ghost" routerLink="/products">مشاهده محصولات</a>
        </div>
      </div>
    </section>
  `,
})
export class NotFoundPage {
  constructor() {
    useResponseStatus()(404);
    inject(SeoService).set({ title: 'صفحه پیدا نشد', path: '/404', noindex: true });
  }
}
