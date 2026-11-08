import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import type { ArticleSummary } from '../../core/models';
import { SeoService } from '../../core/seo.service';
import { StoryCardComponent } from '../../shared/cards';
import { PageHeroComponent } from '../../shared/page-hero.component';

const CRUMBS = [
  { label: 'خانه', url: '/' },
  { label: 'دانش فنی', url: '/insights' },
];

@Component({
  selector: 'app-insights-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeroComponent, StoryCardComponent],
  template: `
    <app-page-hero heading="دانش فنی و تازه‌ها" eyebrow="INSIGHTS & UPDATES" [crumbs]="crumbs"
      lead="راهنماهای انتخاب محصول، استانداردها و نکاتی که به تعریف دقیق‌تر نیاز پروژه کمک می‌کند." />
    <section class="section section-tight">
      <div class="wrap">
        @if (!articles().length) { <p class="no-results">هنوز مطلبی منتشر نشده است.</p> }
        <div class="news news-list">
          @for (a of articles(); track a._id) { <app-story-card [article]="a" /> }
        </div>
      </div>
    </section>
  `,
})
export class InsightsPage {
  readonly articles = input.required<ArticleSummary[]>();
  protected readonly crumbs = CRUMBS;

  constructor() {
    inject(SeoService).set({
      title: 'دانش فنی و تازه‌ها',
      description: 'راهنماهای فنی PIPEOX درباره انتخاب لوله، اتصالات، فلنج و شیرآلات صنعتی، استانداردها و نکات استعلام.',
      path: '/insights',
      breadcrumbs: CRUMBS,
    });
  }
}
