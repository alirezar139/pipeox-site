import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FaNumPipe } from '../../core/format';
import type { Project } from '../../core/models';
import { I18n, LinkPipe, TPipe } from '../../core/i18n';
import { SeoService } from '../../core/seo.service';
import { RevealDirective } from '../../shared/motion.directives';
import { PageHeroComponent } from '../../shared/page-hero.component';

const MARKETS = [
  { num: '01', tag: 'ENERGY', title: 'projects.m1', text: 'projects.m1Text' },
  { num: '02', tag: 'PROCESS', title: 'projects.m2', text: 'projects.m2Text' },
  { num: '03', tag: 'INFRASTRUCTURE', title: 'projects.m3', text: 'projects.m3Text' },
] as const;

@Component({
  selector: 'app-projects-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeroComponent, RevealDirective, RouterLink, FaNumPipe, TPipe, LinkPipe],
  template: `
    <app-page-hero [heading]="'projects.title' | t" eyebrow="PROJECTS & MARKETS" [crumbs]="crumbs" [lead]="'projects.lead' | t" />

    <section class="section">
      <div class="wrap">
        <div class="section-head" appReveal>
          <div><div class="eyebrow">MARKETS WE SERVE</div><h2>{{ 'projects.markets' | t }}</h2></div>
          <p>{{ 'projects.marketsLead' | t }}</p>
        </div>
        <div class="markets">
          @for (m of markets; track m.num) {
            <article class="market" appReveal [attr.data-num]="m.num">
              <span class="num">{{ m.num }} / {{ m.tag }}</span><h3>{{ m.title | t }}</h3><p>{{ m.text | t }}</p>
            </article>
          }
        </div>
      </div>
    </section>

    @if (projects().length) {
      <div class="flowline" aria-hidden="true"><i></i></div>
      <section class="section">
        <div class="wrap">
          <div class="section-head" appReveal><div><div class="eyebrow">FEATURED PROJECTS</div><h2>{{ 'projects.featured' | t }}</h2></div></div>
          <div class="project-grid">
            @for (pr of projects(); track pr._id) {
              <article class="project-card" appReveal>
                @if (pr.image) { <img [src]="pr.image" [alt]="pr.title" loading="lazy" width="600" height="400"> }
                <div>
                  <small>{{ pr.industry }}@if (pr.year) { · {{ pr.year | faNum }} }</small>
                  <h3>{{ pr.title }}</h3>
                  @if (pr.client) { <p class="project-client">{{ pr.client }}</p> }
                  @if (pr.scope) { <p class="pre-line">{{ pr.scope }}</p> }
                </div>
              </article>
            }
          </div>
        </div>
      </section>
    }

    <section class="section section-alt">
      <div class="wrap capgrid">
        <div class="capimage" appReveal><img src="/assets/img/refinery-pipeline.webp" [alt]="'projects.imgAlt' | t" loading="lazy" width="1180" height="720"></div>
        <div class="capcopy" appReveal>
          <div class="eyebrow">PROJECT SUPPLY</div>
          <h2>{{ 'projects.supply' | t }}</h2>
          <p>{{ 'projects.supplyText' | t }}</p>
          <a class="btn btn-pill" [routerLink]="'/contact' | link"><span>{{ 'projects.sendMto' | t }}</span></a>
        </div>
      </div>
    </section>
  `,
})
export class ProjectsPage {
  readonly projects = input.required<Project[]>();
  private readonly i18n = inject(I18n);
  protected readonly crumbs = [
    { label: this.i18n.t('nav.home'), url: '/' },
    { label: this.i18n.t('nav.projects'), url: '/projects' },
  ];
  protected readonly markets = MARKETS;

  constructor() {
    inject(SeoService).set({
      title: this.i18n.t('projects.title'),
      description: this.i18n.t('projects.seoDesc'),
      path: '/projects',
      breadcrumbs: this.crumbs,
    });
  }
}
