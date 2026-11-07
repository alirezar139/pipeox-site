import { Injectable, signal } from '@angular/core';

/** Small status messages in the corner of the admin panel. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly items = signal<{ id: number; text: string; error: boolean }[]>([]);
  private seq = 0;

  show(text: string, error = false) {
    const id = ++this.seq;
    this.items.update((list) => [...list, { id, text, error }]);
    setTimeout(() => this.items.update((list) => list.filter((t) => t.id !== id)), error ? 6000 : 3000);
  }
  error(e: unknown) {
    this.show((e as { message?: string })?.message ?? 'خطایی رخ داد.', true);
  }
}
