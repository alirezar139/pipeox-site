import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FaDatePipe } from '../../core/format';
import type { ArticleSummary, Product } from '../../core/models';
import { SeoService } from '../../core/seo.service';
import { LinkPipe, TPipe } from '../../core/i18n';
import { SiteStore } from '../../core/site.store';
import { IconComponent } from '../../shared/icon.component';
import { CountUpDirective, GlowDirective, RevealDirective } from '../../shared/motion.directives';

/** Homepage — 1:1 with design/mockup-home.png (1536px reference). Artwork is cut from the mockup. */
@Component({
  selector: 'app-home-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent, RevealDirective, CountUpDirective, GlowDirective, FaDatePipe, TPipe, LinkPipe],
  template: `
    <section class="hero">
      <div class="hero-photo" aria-hidden="true">
        <img src="/assets/img/home/hero-pipes.jpg" alt="" width="1490" height="856" fetchpriority="high">
      </div>
      <div class="hero-stripes" aria-hidden="true"><i></i><i></i><i></i></div>
      <div class="wrap-header hero-grid">
        <div class="hero-copy">
          <p class="kicker">{{ s().hero.kicker }}</p>
          <h1>{{ s().hero.title }}<br><span class="accent">{{ s().hero.titleAccent }}</span></h1>
          <p class="hero-text">{{ s().hero.text }}</p>
        </div>
      </div>
    </section>

    <section class="band" [attr.aria-label]="'home.bandLabel' | t">
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
          <!-- Centre: the P mark turns while the wordmark writes itself, then both hold -->
          <div class="orbit-core" aria-hidden="true">
            <div class="orbit-mark"><svg class="orbit-spin" viewBox="0 0 46 39"><path fill="currentColor" fill-rule="evenodd" d="M6 1H33a12 12 0 0 1 0 24H18.4L14 36.4a3 3 0 0 1-2.8 2H3.4a2 2 0 0 1-1.9-2.7L4 3a2.6 2.6 0 0 1 2-2ZM3.42 10.6H31a2.2 2.2 0 0 1 0 4.4H3.08Z" /></svg></div>
            <svg class="orbit-word" viewBox="0 0 320 64"><text x="160" y="48" text-anchor="middle">PIPEOX</text></svg>
          </div>
          <!-- Hover a product (or its label): the product lights up in the artwork -->
          @for (p of orbit(); track p._id) {
            <a class="orbit-spot" [class]="'spot-' + p.orbit" [routerLink]="'/products/' + p.slug | link" tabindex="-1" [attr.aria-label]="p.title"></a>
          }
          @for (p of orbit(); track p._id) {
            <a class="orbit-label" [class]="'label-' + p.orbit" [routerLink]="'/products/' + p.slug | link">
              <b>{{ p.shortTitle || p.title }}</b>
              <small>{{ 'home.viewMore' | t }} <app-icon name="chevron" /></small>
            </a>
          }
        </div>

        <div class="band-intro" appReveal>
          <h2>{{ s().showcase.title }}</h2>
          <p>{{ s().showcase.text }}</p>
        </div>
      </div>
    </section>

    <section class="tiles">
      <div class="wrap-wide tiles-grid">
        <article class="tile tile-news" appReveal appGlow>
          <header class="tile-head">
            <h2>{{ 'home.news' | t }}</h2>
            <a class="link-more" [routerLink]="'/insights' | link"><app-icon name="arrow" />{{ 'home.viewAll' | t }}</a>
          </header>
          @if (latest(); as a) {
            <a class="news-item" [routerLink]="'/insights/' + a.slug | link">
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
            <a class="link-more link-underline" [routerLink]="'/projects' | link"><app-icon name="arrow-right" />{{ 'home.viewProjects' | t }}</a>
          </div>
          @if (s().projects.video) {
            <a class="projects-media" [href]="s().projects.video" target="_blank" rel="noopener" [attr.aria-label]="s().projects.title">
              <img src="/assets/img/home/projects.jpg" alt="" width="654" height="258" loading="lazy">
            </a>
          } @else {
            <a class="projects-media" [routerLink]="'/projects' | link" [attr.aria-label]="s().projects.title">
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
