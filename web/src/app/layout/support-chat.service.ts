import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { ApiError } from '../core/models';

export interface SupportMessage {
  from: 'visitor' | 'staff';
  text: string;
  at: string;
  by?: string;
}
interface ChatView {
  id: string;
  status: 'open' | 'closed';
  messages: SupportMessage[];
  token?: string;
}

const STORE = 'pipeox:chat';
const SEEN = 'pipeox:chat-seen';
const store = {
  get<T>(key: string): T | null {
    try {
      return JSON.parse(localStorage.getItem(key) ?? 'null') as T | null;
    } catch {
      return null;
    }
  },
  set(key: string, value: unknown) {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* private mode: the conversation lasts for this page view */
    }
  },
};

/**
 * The visitor's side of the live support chat. The conversation id and its secret token are kept
 * in localStorage, so the visitor finds their conversation (and the team's replies) on every page
 * and on later visits. Replies are fetched by polling: often while the window is open, rarely while closed.
 * Browser only (started from afterNextRender).
 */
@Injectable({ providedIn: 'root' })
export class SupportChat {
  private readonly http = inject(HttpClient);
  private session: { id: string; token: string } | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private visible = false;

  readonly messages = signal<SupportMessage[]>([]);
  readonly started = signal(false);
  readonly sending = signal(false);
  readonly error = signal('');
  private readonly seen = signal(0);
  /** Team replies the visitor has not seen yet (badge on the closed button). */
  readonly unseen = computed(() => this.messages().filter((m) => m.from === 'staff').length - this.seen());

  init() {
    this.session = store.get<{ id: string; token: string }>(STORE);
    this.seen.set(store.get<number>(SEEN) ?? 0);
    this.started.set(!!this.session);
    if (this.session) void this.refresh();
  }

  /** The chat window opened or closed: poll faster while it is open. */
  setVisible(open: boolean) {
    this.visible = open;
    if (open) this.markSeen();
    if (this.session) void this.refresh();
  }

  async send(text: string, extra: { name?: string; contact?: string; page?: string; website?: string } = {}) {
    text = text.trim();
    if (!text || this.sending()) return false;
    this.sending.set(true);
    this.error.set('');
    try {
      const view = this.session
        ? await firstValueFrom(this.http.post<ChatView>(`/api/chat/${this.session.id}/messages`, { text }, { headers: { 'x-chat-token': this.session.token } }))
        : await firstValueFrom(this.http.post<ChatView>('/api/chat', { text, ...extra }));
      if (view.token) {
        this.session = { id: view.id, token: view.token };
        store.set(STORE, this.session);
        this.started.set(true);
      }
      this.apply(view);
      this.schedule();
      return true;
    } catch (e) {
      const err = e as ApiError;
      this.error.set(err.message ?? '');
      if (err.statusCode === 404) this.forget();
      return false;
    } finally {
      this.sending.set(false);
    }
  }

  private async refresh() {
    clearTimeout(this.timer);
    if (!this.session) return;
    try {
      const view = await firstValueFrom(this.http.get<ChatView>(`/api/chat/${this.session.id}`, { headers: { 'x-chat-token': this.session.token } }));
      this.apply(view);
    } catch (e) {
      // The team deleted the conversation: start fresh next time
      if ((e as ApiError).statusCode === 404) return this.forget();
    }
    this.schedule();
  }

  private schedule() {
    clearTimeout(this.timer);
    if (!this.session) return;
    const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
    this.timer = setTimeout(() => void this.refresh(), this.visible && !hidden ? 4_000 : 30_000);
  }

  private apply(view: ChatView) {
    this.messages.set(view.messages);
    if (this.visible) this.markSeen();
  }

  private markSeen() {
    const n = this.messages().filter((m) => m.from === 'staff').length;
    this.seen.set(n);
    store.set(SEEN, n);
  }

  private forget() {
    this.session = null;
    store.set(STORE, null);
    store.set(SEEN, null);
    this.seen.set(0);
    this.messages.set([]);
    this.started.set(false);
  }
}
