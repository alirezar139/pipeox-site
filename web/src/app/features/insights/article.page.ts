import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { FaDatePipe, FaNumPipe } from '../../core/format';
import type { Article, ArticleSummary } from '../../core/models';
import { SeoService } from '../../core/seo.service';
import { PageHeroComponent } from '../../shared/page-hero.component';
import { NotFoundPage } from '../pages/not-found.page';

@Component({
  selector: 'app-article-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeroComponent, RouterLink, FaDatePipe, FaNumPipe, NotFoundPage],
  template: `
    @if (article(); as a) {
    <app-page-hero [heading]="a.title" eyebrow="INSIGHTS" [crumbs]="crumbs()" />
    <section class="section section-tight">
      <div class="wrap article-grid">
        <article class="prose">
          <p class="article-meta">
            @if (a.category) { <span class="tag">{{ a.category }}</span> }
            <time [attr.datetime]="a.publishedAt">{{ a.publishedAt | faDate }}</time> · {{ a.readingMinutes | faNum }} دقیقه مطالعه
          </p>
          @if (a.image && a.showCover) {
            <img class="article-cover" [src]="a.image" [alt]="a.imageAlt" decoding="async" width="1200" height="630">
          }
          <div [innerHTML]="body()"></div>
        </article>
        <aside class="article-side">
          <div class="side-card">
            <b>استعلام با اطلاعات فنی کامل</b>
            <p>لیست متریال یا دیتاشیت پروژه را ارسال کنید تا کارشناسان ما بررسی کنند.</p>
            <a class="btn" routerLink="/contact">ثبت درخواست ←</a>
          </div>
          @if (more().length) {
            <div class="side-card">
              <b>مطالب دیگر</b>
              <ul>
                @for (m of more(); track m._id) { <li><a [routerLink]="['/insights', m.slug]">{{ m.title }}</a></li> }
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
  protected readonly crumbs = computed(() => [
    { label: 'خانه', url: '/' },
    { label: 'دانش فنی', url: '/insights' },
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
