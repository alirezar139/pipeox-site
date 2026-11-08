import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { I18n, TPipe } from '../../core/i18n';
import { SeoService } from '../../core/seo.service';
import { SiteStore } from '../../core/site.store';
import { IconComponent } from '../../shared/icon.component';
import { GlowDirective, RevealDirective } from '../../shared/motion.directives';
import { PageHeroComponent } from '../../shared/page-hero.component';


@Component({
  selector: 'app-about-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeroComponent, IconComponent, RevealDirective, GlowDirective, TPipe],
  template: `
    <app-page-hero [heading]="'about.title' | t" eyebrow="WHY PIPEOX" [crumbs]="crumbs" [lead]="'about.lead' | t" />

    <section class="section">
      <div class="wrap capgrid">
        <div class="capimage" appReveal><img src="/assets/img/steel-pipes-stack.jpg" [alt]="'about.imgAlt' | t" loading="lazy" width="1100" height="740"></div>
        <div class="capcopy" appReveal>
          <div class="eyebrow">OUR APPROACH</div>
          <h2>{{ 'about.approach' | t }}</h2>
          <p>{{ 'about.approachText' | t }}</p>
          <div class="caplist">
            <div class="cap"><span class="cap-icon"><app-icon name="check-circle" /></span><b>{{ 'about.c1' | t }}</b><span>{{ 'about.c1Text' | t }}</span></div>
            <div class="cap"><span class="cap-icon"><app-icon name="list" /></span><b>{{ 'about.c2' | t }}</b><span>{{ 'about.c2Text' | t }}</span></div>
            <div class="cap"><span class="cap-icon"><app-icon name="doc" /></span><b>{{ 'about.c3' | t }}</b><span>{{ 'about.c3Text' | t }}</span></div>
            <div class="cap"><span class="cap-icon"><app-icon name="headset" /></span><b>{{ 'about.c4' | t }}</b><span>{{ 'about.c4Text' | t }}</span></div>
          </div>
        </div>
      </div>
    </section>

    <div class="flowline" aria-hidden="true"><i></i></div>

    <section class="section">
      <div class="wrap">
        <div class="section-head" appReveal>
          <div><div class="eyebrow">HOW WE WORK</div><h2>{{ 'about.how' | t }}</h2></div>
          <p>{{ 'about.howLead' | t }}</p>
        </div>
        <ol class="steps">
          @for (st of steps; track st.n) {
            <li class="step" appReveal><span class="n">{{ st.n }}</span><h3>{{ st.title | t }}</h3><p>{{ st.text | t }}</p></li>
          }
        </ol>
      </div>
    </section>

    <section class="section section-alt">
      <div class="wrap">
        <div class="section-head" appReveal><div><div class="eyebrow">OUR VALUES</div><h2>{{ 'about.values' | t }}</h2></div></div>
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
  private readonly i18n = inject(I18n);
  protected readonly crumbs = [
    { label: this.i18n.t('nav.home'), url: '/' },
    { label: this.i18n.t('nav.about'), url: '/about' },
  ];
  protected readonly steps = [
    { n: '01', title: 'about.s1', text: 'about.s1Text' },
    { n: '02', title: 'about.s2', text: 'about.s2Text' },
    { n: '03', title: 'about.s3', text: 'about.s3Text' },
    { n: '04', title: 'about.s4', text: 'about.s4Text' },
  ] as const;

  constructor() {
    inject(SeoService).set({
      title: this.i18n.t('about.title'),
      description: this.i18n.t('about.seoDesc'),
      path: '/about',
      breadcrumbs: this.crumbs,
    });
  }
}
