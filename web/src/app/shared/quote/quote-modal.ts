import {
  ChangeDetectionStrategy, Component, effect, ElementRef, inject, Injectable, signal, viewChild,
} from '@angular/core';
import { NavigationStart, Router } from '@angular/router';
import { ApiService } from '../../core/http/api.service';
import type { Product } from '../../core/models';
import { IconComponent } from '../icon.component';
import { QuoteFormComponent } from './quote-form.component';

/** Opens the price-inquiry popup from anywhere (header CTA, CTA bands, product pages). */
@Injectable({ providedIn: 'root' })
export class QuoteModal {
  readonly open = signal(false);
  readonly product = signal('');
  readonly heading = signal('درخواست استعلام قیمت');

  show(opts: { product?: string; heading?: string } = {}) {
    this.product.set(opts.product ?? '');
    this.heading.set(opts.heading ?? (opts.product ? `استعلام ${opts.product}` : 'درخواست استعلام قیمت'));
    this.open.set(true);
  }
  close() {
    this.open.set(false);
  }
}

@Component({
  selector: 'app-quote-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [QuoteFormComponent, IconComponent],
  template: `
    <dialog #dialog class="quote-modal" aria-labelledby="quoteModalTitle" (close)="modal.close()" (click)="backdrop($event)">
      @if (modal.open()) {
        <button class="modal-close" type="button" aria-label="بستن" (click)="modal.close()"><app-icon name="close" /></button>
        <app-quote-form [heading]="modal.heading()" [selectedProduct]="modal.product()" [products]="products()" titleId="quoteModalTitle" />
      }
    </dialog>
  `,
})
export class QuoteModalComponent {
  protected readonly modal = inject(QuoteModal);
  private readonly api = inject(ApiService);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  protected readonly products = signal<Product[]>([]);

  constructor() {
    effect(() => {
      const el = this.dialog().nativeElement;
      if (this.modal.open() && !el.open) {
        el.showModal();
        if (!this.products().length) this.api.products().then((p) => this.products.set(p), () => {});
      } else if (!this.modal.open() && el.open) {
        el.close();
      }
    });
    inject(Router).events.subscribe((e) => e instanceof NavigationStart && this.modal.close());
  }

  /** Clicking the dimmed backdrop (the dialog element itself) closes it. */
  backdrop(e: MouseEvent) {
    if (e.target === this.dialog().nativeElement) this.modal.close();
  }
}
