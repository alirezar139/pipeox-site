import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import type { ArticleSummary } from '../../core/models';
import { I18n, TPipe } from '../../core/i18n';
import { SeoService } from '../../core/seo.service';
import { StoryCardComponent } from '../../shared/cards';
import { PageHeroComponent } from '../../shared/page-hero.component';


@Component({
  selector: 'app-insights-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeroComponent, StoryCardComponent, TPipe],
  template: `
    <app-page-hero [heading]="'insights.title' | t" [eyebrow]="'eb.insightsAll' | t" [crumbs]="crumbs" [lead]="'insights.lead' | t" />
    <section class="section section-tight">
      <div class="wrap">
        @if (!articles().length) { <p class="no-results">{{ 'insights.none' | t }}</p> }
        <div class="news news-list">
          @for (a of articles(); track a._id) { <app-story-card [article]="a" /> }
        </div>
      </div>
    </section>
  `,
})
export class InsightsPage {
  readonly articles = input.required<ArticleSummary[]>();
  private readonly i18n = inject(I18n);
  protected readonly crumbs = [
    { label: this.i18n.t('nav.home'), url: '/' },
    { label: this.i18n.t('nav.insights'), url: '/insights' },
  ];

  constructor() {
    inject(SeoService).set({
      title: this.i18n.t('insights.title'),
      description: this.i18n.t('insights.seoDesc'),
      path: '/insights',
      breadcrumbs: this.crumbs,
    });
  }
}
