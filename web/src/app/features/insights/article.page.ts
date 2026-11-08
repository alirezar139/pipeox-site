import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { FaDatePipe, formatNumber } from '../../core/format';
import type { Article, ArticleSummary } from '../../core/models';
import { I18n, LinkPipe, TPipe } from '../../core/i18n';
import { SeoService } from '../../core/seo.service';
import { PageHeroComponent } from '../../shared/page-hero.component';
import { NotFoundPage } from '../pages/not-found.page';

@Component({
  selector: 'app-article-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeroComponent, RouterLink, FaDatePipe, NotFoundPage, TPipe, LinkPipe],
  template: `
    @if (article(); as a) {
    <app-page-hero [heading]="a.title" [eyebrow]="'eb.insights' | t" [crumbs]="crumbs()" />
    <section class="section section-tight">
      <div class="wrap article-grid">
        <article class="prose">
          <p class="article-meta">
            @if (a.category) { <span class="tag">{{ a.category }}</span> }
            <time [attr.datetime]="a.publishedAt">{{ a.publishedAt | faDate }}</time> · {{ 'common.minutesRead' | t: { n: minutes() } }}
          </p>
          @if (a.image && a.showCover) {
            <img class="article-cover" [src]="a.image" [alt]="a.imageAlt" decoding="async" width="1200" height="630">
          }
          <div [innerHTML]="body()"></div>
        </article>
        <aside class="article-side">
          <div class="side-card">
            <b>{{ 'article.sideTitle' | t }}</b>
            <p>{{ 'article.sideText' | t }}</p>
            <a class="btn" [routerLink]="'/contact' | link">{{ 'article.sideBtn' | t }}</a>
          </div>
          @if (more().length) {
            <div class="side-card">
              <b>{{ 'article.more' | t }}</b>
              <ul>
                @for (m of more(); track m._id) { <li><a [routerLink]="'/insights/' + m.slug | link">{{ m.title }}</a></li> }
              </ul>
            </div>
          }
        </aside>
      </div>
    </section>
    } @else {
      <app-not-found-page />
    }
  `,
})
export class ArticlePage {
  readonly article = input.required<Article | null>();
  readonly recent = input<ArticleSummary[]>([]);
  private readonly sanitizer = inject(DomSanitizer);

  /** The body is sanitized by the API on save (allow-list); trusted here so links keep target/rel. */
  protected readonly body = computed(() => this.sanitizer.bypassSecurityTrustHtml(this.article()?.body ?? ''));
  protected readonly more = computed(() => this.recent().filter((m) => m.slug !== this.article()?.slug).slice(0, 6));
  private readonly i18n = inject(I18n);
  /** Reading time in the page language's digits. */
  protected readonly minutes = computed(() => formatNumber(this.article()?.readingMinutes ?? 1, this.i18n.lang()));
  protected readonly crumbs = computed(() => [
    { label: this.i18n.t('nav.home'), url: '/' },
    { label: this.i18n.t('nav.insights'), url: '/insights' },
    { label: this.article()?.title ?? '', url: `/insights/${this.article()?.slug}` },
  ]);

  constructor() {
    const seo = inject(SeoService);
    effect(() => {
      const a = this.article();
      if (!a) return;
      seo.set({
        title: a.title,
        description: a.description,
        path: `/insights/${a.slug}`,
        image: a.image || undefined,
        type: 'article',
        breadcrumbs: this.crumbs(),
        jsonLd: [
          {
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: a.title,
            description: a.description,
            datePublished: a.publishedAt,
            dateModified: a.updatedAt,
            ...(a.image ? { image: seo.origin() + a.image } : {}),
            publisher: { '@type': 'Organization', name: 'PIPEOX' },
          },
        ],
      });
    });
  }
}
