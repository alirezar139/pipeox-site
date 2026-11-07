import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FaDatePipe } from '../../core/format';
import type { ArticleSummary, Product } from '../../core/models';
import { SeoService } from '../../core/seo.service';
import { SiteStore } from '../../core/site.store';
import { IconComponent } from '../../shared/icon.component';
import { CountUpDirective, GlowDirective, RevealDirective } from '../../shared/motion.directives';
import { QuoteFormComponent } from '../../shared/quote/quote-form.component';

/** Homepage — 1:1 with design/mockup-home.png (1536px reference). Artwork is cut from the mockup. */
@Component({
  selector: 'app-home-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent, QuoteFormComponent, RevealDirective, CountUpDirective, GlowDirective, FaDatePipe],
  template: `
    <section class="hero">
      <div class="hero-photo" aria-hidden="true">
        <img src="/assets/img/home/hero-pipes.jpg" alt="" width="1490" height="856" fetchpriority="high">
      </div>
      <div class="hero-stripes" aria-hidden="true"><i></i><i></i><i></i></div>
      <div class="wrap-header hero-grid">
        <app-quote-form [compact]="true" [anchor]="true" />
        <div class="hero-copy">
          <p class="kicker">{{ s().hero.kicker }}</p>
          <h1>{{ s().hero.title }}<br><span class="accent">{{ s().hero.titleAccent }}</span></h1>
          <p class="hero-text">{{ s().hero.text }}</p>
          <div class="actions">
            <a class="pill pill-orange" routerLink="/products"><app-icon name="arrow" /><span>مشاهده محصولات</span></a>
            <a class="pill pill-ghost" routerLink="/about"><app-icon name="play" /><span>درباره ما</span></a>
          </div>
        </div>
      </div>
    </section>

    <section class="band" aria-label="محصولات و آمار">
      <div class="wrap-wide band-grid">
        <ul class="stats" appReveal>
          @for (st of s().stats; track $index) {
            <li>
              <span class="stat-icon"><app-icon [name]="st.icon" /></span>
              <div><b>+<span class="count" [appCountUp]="st.value"></span></b><small>{{ st.label }}</small></div>
            </li>
          }
        </ul>

        <div class="orbit-art">
          <img src="/assets/img/home/orbit-art.jpg" alt="" width="1720" height="596" loading="lazy">
          <div class="orbit-glint" aria-hidden="true"></div>
          @for (p of orbit(); track p._id) {
            <a class="orbit-label" [class]="'label-' + p.orbit" [routerLink]="['/products', p.slug]">
              <b>{{ p.shortTitle || p.title }}</b>
              <small>مشاهده بیشتر <app-icon name="chevron" /></small>
            </a>
          }
        </div>

        <div class="band-intro" appReveal>
          <h2>{{ s().showcase.title }}</h2>
          <p>{{ s().showcase.text }}</p>
          <a class="pill pill-outline" routerLink="/products"><app-icon name="doc" /><span>مشاهده کاتالوگ کامل</span></a>
        </div>
      </div>
    </section>

    <section class="tiles">
      <div class="wrap-wide tiles-grid">
        <article class="tile tile-news" appReveal appGlow>
          <header class="tile-head">
            <h2>آخرین اخبار و اطلاعیه‌ها</h2>
            <a class="link-more" routerLink="/insights"><app-icon name="arrow" />مشاهده همه</a>
          </header>
          @if (latest(); as a) {
            <a class="news-item" [routerLink]="['/insights', a.slug]">
              <span class="news-thumb"><img src="/assets/img/home/news.jpg" alt="" width="208" height="184" loading="lazy"></span>
              <span class="news-body">
                <b>{{ a.title }}</b>
                <small><time [attr.datetime]="a.publishedAt">{{ a.publishedAt | faDate: 'short' }}</time><app-icon name="calendar" /></small>
              </span>
            </a>
          }
        </article>

        <div class="tile tile-features" appReveal appGlow>
          @for (f of s().features; track $index) {
            <div class="feature">
              <span class="feature-icon"><app-icon [name]="f.icon" /></span>
              <b>{{ f.title }}</b>
              <small>{{ f.text }}</small>
            </div>
          }
        </div>

        <article class="tile tile-projects" appReveal appGlow>
          <div class="projects-copy">
            <h2>{{ s().projects.title }}</h2>
            <p>{{ s().projects.text }}</p>
            <a class="link-more link-underline" routerLink="/projects"><app-icon name="arrow-right" />مشاهده پروژه‌ها</a>
          </div>
          @if (s().projects.video) {
            <a class="projects-media" [href]="s().projects.video" target="_blank" rel="noopener" [attr.aria-label]="s().projects.title">
              <img src="/assets/img/home/projects.jpg" alt="" width="654" height="258" loading="lazy">
            </a>
          } @else {
            <a class="projects-media" routerLink="/projects" [attr.aria-label]="s().projects.title">
              <img src="/assets/img/home/projects.jpg" alt="" width="654" height="258" loading="lazy">
            </a>
          }
        </article>
      </div>
    </section>
  `,
})
export class HomePage {
  /** From the route resolver (home.routes). */
  readonly data = input.required<{ products: Product[]; latest: ArticleSummary | null }>();
  protected readonly s = inject(SiteStore).settings;
  protected readonly orbit = computed(() => this.data().products.filter((p) => p.orbit));
  protected readonly latest = computed(() => this.data().latest);

  constructor() {
    const seo = inject(SeoService);
    seo.set({ path: '/', jsonLd: [seo.organization()] });
  }
}
