import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { SeoService } from '../../core/seo.service';
import { SiteStore } from '../../core/site.store';
import { IconComponent } from '../../shared/icon.component';
import { GlowDirective, RevealDirective } from '../../shared/motion.directives';
import { PageHeroComponent } from '../../shared/page-hero.component';

const CRUMBS = [
  { label: 'خانه', url: '/' },
  { label: 'درباره ما', url: '/about' },
];

@Component({
  selector: 'app-about-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeroComponent, IconComponent, RevealDirective, GlowDirective],
  template: `
    <app-page-hero heading="درباره پایپ‌اکس" eyebrow="WHY PIPEOX" [crumbs]="crumbs"
      lead="در پروژه‌های صنعتی، انتخاب نادرست متریال یا مغایرت مشخصات می‌تواند هزینه و زمان اجرا را افزایش دهد. رویکرد پایپ‌اکس بر دریافت نیاز فنی، بررسی مشخصات و پیگیری تأمین متناسب با کاربرد پروژه متمرکز است." />

    <section class="section">
      <div class="wrap capgrid">
        <div class="capimage" appReveal><img src="/assets/img/steel-pipes-stack.jpg" alt="لوله‌های فولادی صنعتی" loading="lazy" width="1100" height="740"></div>
        <div class="capcopy" appReveal>
          <div class="eyebrow">OUR APPROACH</div>
          <h2>تأمین صنعتی، فراتر از فروش کالا</h2>
          <p>تمرکز ما بر این است که هر قلم، پیش از تأمین، با مشخصات و شرایط واقعی پروژه تطبیق داده شود؛ از استاندارد و گرید تا ابعاد، کلاس فشاری و مدارک کیفیت.</p>
          <div class="caplist">
            <div class="cap"><span class="cap-icon"><app-icon name="check-circle" /></span><b>بررسی مشخصات فنی</b><span>استاندارد، گرید، سایز و ضخامت</span></div>
            <div class="cap"><span class="cap-icon"><app-icon name="list" /></span><b>تأمین چندگروهی</b><span>تجمیع اقلام مرتبط در یک درخواست</span></div>
            <div class="cap"><span class="cap-icon"><app-icon name="doc" /></span><b>مستندسازی درخواست</b><span>شفاف‌سازی نیاز و مدارک مورد انتظار</span></div>
            <div class="cap"><span class="cap-icon"><app-icon name="headset" /></span><b>ارتباط تخصصی</b><span>پیگیری درخواست با تیم مرتبط</span></div>
          </div>
        </div>
      </div>
    </section>

    <div class="flowline" aria-hidden="true"><i></i></div>

    <section class="section">
      <div class="wrap">
        <div class="section-head" appReveal>
          <div><div class="eyebrow">HOW WE WORK</div><h2>مسیر همکاری با پایپ‌اکس</h2></div>
          <p>فرآیند شفاف کمک می‌کند نیاز پروژه از ابتدا درست تعریف شود و استعلام قابل بررسی باشد.</p>
        </div>
        <ol class="steps">
          @for (st of steps; track st.n) {
            <li class="step" appReveal><span class="n">{{ st.n }}</span><h3>{{ st.title }}</h3><p>{{ st.text }}</p></li>
          }
        </ol>
      </div>
    </section>

    <section class="section section-alt">
      <div class="wrap">
        <div class="section-head" appReveal><div><div class="eyebrow">OUR VALUES</div><h2>آنچه برای ما مهم است</h2></div></div>
        <div class="tile-features tile features-wide" appReveal appGlow>
          @for (f of s().features; track $index) {
            <div class="feature"><span class="feature-icon"><app-icon [name]="f.icon" /></span><b>{{ f.title }}</b><small>{{ f.text }}</small></div>
          }
        </div>
      </div>
    </section>
  `,
})
export class AboutPage {
  protected readonly s = inject(SiteStore).settings;
  protected readonly crumbs = CRUMBS;
  protected readonly steps = [
    { n: '01', title: 'ثبت درخواست', text: 'ارسال گروه کالا و اطلاعات اولیه پروژه.' },
    { n: '02', title: 'بررسی فنی', text: 'بررسی مشخصات، استاندارد و شرایط سرویس.' },
    { n: '03', title: 'ارائه پیشنهاد', text: 'پیگیری موجودی، زمان و پیشنهاد تأمین.' },
    { n: '04', title: 'هماهنگی تأمین', text: 'هماهنگی مراحل بعدی بر اساس توافق طرفین.' },
  ];

  constructor() {
    inject(SeoService).set({
      title: 'درباره پایپ‌اکس',
      description: 'پایپ‌اکس؛ تأمین تخصصی لوله، اتصالات، فلنج و شیرآلات صنعتی با تمرکز بر تطبیق فنی، کیفیت و پشتیبانی پروژه از استعلام تا تأمین.',
      path: '/about',
      breadcrumbs: CRUMBS,
    });
  }
}
