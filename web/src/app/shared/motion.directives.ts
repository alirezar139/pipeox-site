import { isPlatformBrowser } from '@angular/common';
import { afterNextRender, DestroyRef, Directive, ElementRef, inject, input, PLATFORM_ID } from '@angular/core';
import { formatNumber } from '../core/format';
import { I18n } from '../core/i18n';

const reducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** One shared observer for every [appReveal] element on the page. */
let observer: IntersectionObserver | null = null;
const callbacks = new WeakMap<Element, () => void>();
function observe(el: Element, onEnter: () => void) {
  observer ??= new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        callbacks.get(e.target)?.();
        observer!.unobserve(e.target);
      }),
    { threshold: 0.15, rootMargin: '0px 0px -40px 0px' },
  );
  callbacks.set(el, onEnter);
  observer.observe(el);
}

/**
 * Fades the element in when it scrolls into view. Server-rendered HTML is fully visible
 * (no "js" class yet), so crawlers and no-JS visitors always see the content.
 */
@Directive({ selector: '[appReveal]', host: { class: 'reveal' } })
export class RevealDirective {
  constructor() {
    const el = inject(ElementRef<HTMLElement>).nativeElement;
    const destroy = inject(DestroyRef);
    afterNextRender(() => {
      if (!('IntersectionObserver' in window)) return el.classList.add('in');
      observe(el, () => el.classList.add('in'));
      destroy.onDestroy(() => observer?.unobserve(el));
    });
  }
}

/** Counts up to the value once visible: «۰» → «۲۵» (digits in the site language). Renders the final value on the server. */
@Directive({ selector: '[appCountUp]', host: { '[textContent]': 'initial()' } })
export class CountUpDirective {
  readonly appCountUp = input.required<number>();
  private readonly el = inject(ElementRef<HTMLElement>).nativeElement;
  private readonly i18n = inject(I18n);
  protected initial = () => formatNumber(this.appCountUp(), this.i18n.lang());

  constructor() {
    afterNextRender(() => {
      if (reducedMotion() || !('IntersectionObserver' in window)) return;
      observe(this.el, () => {
        const target = this.appCountUp();
        const start = performance.now();
        const tick = (now: number) => {
          const p = Math.min(1, (now - start) / 1600);
          this.el.textContent = formatNumber(Math.round(target * (1 - Math.pow(1 - p, 3))), this.i18n.lang());
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    });
  }
}

/** Soft orange glow that follows the pointer (sets --mx / --my). */
@Directive({ selector: '[appGlow]', host: { '(pointermove)': 'move($event)' } })
export class GlowDirective {
  private readonly el = inject(ElementRef<HTMLElement>).nativeElement;
  private readonly enabled = isPlatformBrowser(inject(PLATFORM_ID)) && !reducedMotion();

  move(e: PointerEvent) {
    if (!this.enabled) return;
    const r = this.el.getBoundingClientRect();
    this.el.style.setProperty('--mx', `${e.clientX - r.left}px`);
    this.el.style.setProperty('--my', `${e.clientY - r.top}px`);
  }
}
