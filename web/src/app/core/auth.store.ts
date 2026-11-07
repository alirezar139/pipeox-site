import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { ApiService } from './http/api.service';
import type { Account } from './models';

/**
 * The signed-in customer. The session itself is an httpOnly cookie the browser
 * holds; this store only mirrors who is signed in for the UI.
 */
@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly api = inject(ApiService);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly user = signal<Account | null>(null);
  /** False until the first /me answer arrives (avoids flashing "login" for signed-in users). */
  readonly ready = signal(false);
  private pending: Promise<Account | null> | null = null;

  /** Resolves the current session once per page load (browser only; SSR renders signed-out). */
  refresh(force = false): Promise<Account | null> {
    if (!this.browser) return Promise.resolve(null);
    if (!this.pending || force) {
      this.pending = this.api
        .me()
        .then((r) => r.user)
        .catch(() => null)
        .then((user) => {
          this.user.set(user);
          this.ready.set(true);
          return user;
        });
    }
    return this.pending;
  }

  set(user: Account | null) {
    this.user.set(user);
    this.ready.set(true);
    this.pending = Promise.resolve(user);
  }

  async logout() {
    await this.api.post('/api/auth/logout', {});
    this.set(null);
  }
}
