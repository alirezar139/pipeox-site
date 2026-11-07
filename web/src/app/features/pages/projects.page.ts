import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FaNumPipe } from '../../core/format';
import type { Project } from '../../core/models';
import { SeoService } from '../../core/seo.service';
import { CtaBandComponent } from '../../shared/cards';
import { RevealDirective } from '../../shared/motion.directives';
import { PageHeroComponent } from '../../shared/page-hero.component';

const CRUMBS = [
  { label: 'خانه', url: '/' },
  { label: 'پروژه‌ها', url: '/projects' },
];

const MARKETS = [
  { num: '01', tag: 'ENERGY', title: 'نفت، گاز و انرژی', text: 'خطوط انتقال، تجهیزات جانبی و اقلام موردنیاز تأسیسات انرژی.' },
  { num: '02', tag: 'PROCESS', title: 'پتروشیمی و پالایش', text: 'تأمین اقلام خطوط فرایندی با توجه به فشار، دما و سازگاری متریال.' },
  { num: '03', tag: 'INFRASTRUCTURE', title: 'زیرساخت و صنایع سنگین', text: 'شبکه‌های انتقال، تأسیسات صنعتی و پروژه‌های عمرانی بزرگ.' },
];

@Component({
  selector: 'app-projects-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeroComponent, CtaBandComponent, RevealDirective, RouterLink, FaNumPipe],
  template: `
    <app-page-hero heading="پروژه‌ها و صنایع" eyebrow="PROJECTS & MARKETS" [crumbs]="crumbs"
      lead="راهکارهای لوله و اتصالات با توجه به شرایط کاری هر صنعت انتخاب می‌شوند. بازارهای هدف و نمونه پروژه‌های ما را در این صفحه ببینید." />

    <section class="section">
      <div class="wrap">
        <div class="section-head" appReveal>
          <div><div class="eyebrow">MARKETS WE SERVE</div><h2>صنایع و کاربردها</h2></div>
          <p>گروه‌های زیر نمونه‌هایی از بازارهای هدف سبد تأمین پایپ‌اکس هستند.</p>
        </div>
        <div class="markets">
          @for (m of markets; track m.num) {
            <article class="market" appReveal [attr.data-num]="m.num">
              <span class="num">{{ m.num }} / {{ m.tag }}</span><h3>{{ m.title }}</h3><p>{{ m.text }}</p>
            </article>
          }
        </div>
      </div>
    </section>

    @if (projects().length) {
      <div class="flowline" aria-hidden="true"><i></i></div>
      <section class="section">
        <div class="wrap">
          <div class="section-head" appReveal><div><div class="eyebrow">FEATURED PROJECTS</div><h2>پروژه‌های شاخص</h2></div></div>
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
        <div class="capimage" appReveal><img src="/assets/img/refinery-pipeline.webp" alt="پالایشگاه و خطوط انتقال" loading="lazy" width="1180" height="720"></div>
        <div class="capcopy" appReveal>
          <div class="eyebrow">PROJECT SUPPLY</div>
          <h2>تأمین پروژه، یک‌جا و هماهنگ</h2>
          <p>برای پروژه‌هایی با لیست متریال گسترده، اقلام لوله، اتصالات، فلنج و شیرآلات را در یک درخواست بررسی و تأمین آن را هماهنگ می‌کنیم. لیست متریال (MTO) پروژه را ارسال کنید تا بررسی فنی آغاز شود.</p>
          <a class="btn btn-pill" routerLink="/contact"><span>ارسال لیست متریال</span></a>
        </div>
      </div>
    </section>
    <app-cta-band />
  `,
})
export class ProjectsPage {
  readonly projects = input.required<Project[]>();
  protected readonly crumbs = CRUMBS;
  protected readonly markets = MARKETS;

  constructor() {
    inject(SeoService).set({
      title: 'پروژه‌ها و صنایع',
      description: 'صنایع و پروژه‌هایی که پایپ‌اکس برای آن‌ها لوله، اتصالات، فلنج و شیرآلات تأمین می‌کند؛ نفت و گاز، پتروشیمی و پالایش، زیرساخت و صنایع سنگین.',
      path: '/projects',
      breadcrumbs: CRUMBS,
    });
  }
}
