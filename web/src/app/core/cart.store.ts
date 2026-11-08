import { isPlatformBrowser } from '@angular/common';
import { computed, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';

export interface CartLine {
  slug: string;
  sku: string;
  qty: number;
}

const KEY = 'pipeox:cart';

/**
 * The shopping cart: product + variant + quantity, kept in the browser (localStorage) and shared
 * between tabs. Prices are never stored here — the server prices the cart on the cart and checkout pages.
 */
@Injectable({ providedIn: 'root' })
export class CartStore {
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  readonly lines = signal<CartLine[]>(this.read());
  /** Number of different items (header badge). */
  readonly count = computed(() => this.lines().length);

  constructor() {
    if (this.browser) window.addEventListener('storage', (e) => e.key === KEY && this.lines.set(this.read()));
  }

  private read(): CartLine[] {
    if (!this.browser) return [];
    try {
      const v = JSON.parse(localStorage.getItem(KEY) ?? '[]') as CartLine[];
      return Array.isArray(v) ? v.filter((l) => l && typeof l.slug === 'string' && typeof l.sku === 'string' && l.qty > 0).slice(0, 50) : [];
    } catch {
      return [];
    }
  }

  private write(lines: CartLine[]) {
    this.lines.set(lines);
    try {
      localStorage.setItem(KEY, JSON.stringify(lines));
    } catch {
      /* private mode: the cart lasts for this page view */
    }
  }

  add(slug: string, sku: string, qty: number) {
    const lines = this.lines();
    const i = lines.findIndex((l) => l.slug === slug && l.sku === sku);
    this.write(i < 0 ? [...lines, { slug, sku, qty }] : lines.map((l, j) => (j === i ? { ...l, qty: l.qty + qty } : l)));
  }

  setQty(slug: string, sku: string, qty: number) {
    this.write(this.lines().map((l) => (l.slug === slug && l.sku === sku ? { ...l, qty: Math.max(1, Math.floor(qty) || 1) } : l)));
  }

  remove(slug: string, sku: string) {
    this.write(this.lines().filter((l) => !(l.slug === slug && l.sku === sku)));
  }

  clear() {
    this.write([]);
  }
}
