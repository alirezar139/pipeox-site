import { afterNextRender, ChangeDetectionStrategy, Component, DestroyRef, effect, ElementRef, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FaDatePipe, FaNumPipe } from '../../../core/format';
import { IconComponent } from '../../../shared/icon.component';
import { AdminApi, type ChatFull, type ChatSummary } from '../admin-api.service';
import { ToastService } from '../ui/toast.service';

const LANG_FA: Record<string, string> = { fa: 'فارسی', en: 'انگلیسی', de: 'آلمانی' };

/** Live support chats from the floating button on the site: read and answer them here. */
@Component({
  selector: 'app-admin-chats-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, IconComponent, FaDatePipe, FaNumPipe],
  template: `
    <div class="adm-head">
      <div><h1>گفت‌وگوها</h1><p>پیام‌هایی که بازدیدکننده‌ها از دکمهٔ «پشتیبانی» سایت فرستاده‌اند؛ پاسخ شما همان لحظه در پنجرهٔ چت آن‌ها نمایش داده می‌شود.</p></div>
    </div>

    @if (!loaded()) { <div class="adm-skeleton"></div> }
    @else if (!items().length) { <p class="adm-empty">هنوز گفت‌وگویی شروع نشده است.</p> }
    @else {
      <div class="adm-chat" [class.has-open]="!!current()">
        <ul class="adm-chat-list">
          @for (c of items(); track c._id) {
            <li>
              <button type="button" [class.on]="current()?._id === c._id" [class.unread]="c.unread > 0" [class.closed]="c.status === 'closed'" (click)="select(c._id)">
                <span class="adm-chat-avatar">{{ (c.name || '?').charAt(0) }}</span>
                <span class="adm-chat-sum">
                  <b>{{ c.name || 'بازدیدکننده' }}</b>
                  <small>@if (c.last?.from === 'staff') { <span class="adm-muted">شما: </span> }{{ c.last?.text }}</small>
                </span>
                <span class="adm-chat-side">
                  <time>{{ c.lastAt | faDate: 'short' }}</time>
                  @if (c.unread) { <em>{{ c.unread | faNum }}</em> }
                </span>
              </button>
            </li>
          }
        </ul>

        <section class="adm-chat-view">
          @if (current(); as c) {
            <header class="adm-chat-top">
              <button type="button" class="adm-icon-btn adm-chat-back" (click)="current.set(null)" aria-label="بازگشت"><app-icon name="arrow-right" /></button>
              <div class="adm-chat-who">
                <b>{{ c.name || 'بازدیدکننده' }}</b>
                <small>
                  @if (c.contact) { <span dir="auto">{{ c.contact }}</span> · }
                  @if (c.user) { حساب: <span dir="ltr">{{ c.user.email }}</span> · }
                  {{ langName(c.lang) }}
                  @if (c.page) { · <span dir="ltr">{{ c.page }}</span> }
                </small>
              </div>
              <div class="adm-head-actions">
                @if (c.status === 'open') {
                  <button type="button" class="adm-btn adm-btn-ghost adm-btn-sm" (click)="setStatus(c, 'closed')"><app-icon name="check-circle" /> بستن</button>
                } @else {
                  <button type="button" class="adm-btn adm-btn-ghost adm-btn-sm" (click)="setStatus(c, 'open')"><app-icon name="refresh" /> بازکردن</button>
                }
                <button type="button" class="adm-icon-btn danger" (click)="remove(c)" aria-label="حذف گفت‌وگو"><app-icon name="trash" /></button>
              </div>
            </header>

            <div class="adm-chat-msgs" #msgs>
              @for (m of c.messages; track $index) {
                <div class="adm-chat-msg" [class.staff]="m.from === 'staff'">
                  <span class="adm-chat-bubble">{{ m.text }}</span>
                  <small>@if (m.from === 'staff') { {{ m.by }} · }{{ m.at | faDate: 'time' }}</small>
                </div>
              }
            </div>

            <form class="adm-chat-reply" (ngSubmit)="reply(c)">
              <textarea class="adm-input" name="reply" rows="2" [(ngModel)]="draft" placeholder="پاسخ خود را بنویسید… (Enter: ارسال، Shift+Enter: خط بعد)" maxlength="2000" (keydown.enter)="enter($event, c)"></textarea>
              <button type="submit" class="adm-btn" [disabled]="!draft.trim() || sending()"><app-icon name="send" /> ارسال</button>
            </form>
          } @else {
            <p class="adm-chat-pick"><app-icon name="headset" /> یک گفت‌وگو را از فهرست انتخاب کنید.</p>
          }
        </section>
      </div>
    }
  `,
})
export class AdminChatsPage {
  private readonly api = inject(AdminApi);
  private readonly toast = inject(ToastService);
  private readonly msgs = viewChild<ElementRef<HTMLElement>>('msgs');
  protected readonly items = signal<ChatSummary[]>([]);
  protected readonly current = signal<ChatFull | null>(null);
  protected readonly loaded = signal(false);
  protected readonly sending = signal(false);
  protected draft = '';
  protected langName = (l: string) => LANG_FA[l] ?? l;

  constructor() {
    void this.load();
    // Keep the newest message in view
    effect(() => {
      this.current();
      const el = this.msgs()?.nativeElement;
      if (el) requestAnimationFrame(() => (el.scrollTop = el.scrollHeight));
    });
    // Live: refresh the list and the open conversation every few seconds
    const destroy = inject(DestroyRef);
    afterNextRender(() => {
      const timer = setInterval(() => void this.poll(), 5_000);
      destroy.onDestroy(() => clearInterval(timer));
    });
  }

  private async load() {
    this.items.set(await this.api.chats().catch(() => []));
    this.loaded.set(true);
  }

  private async poll() {
    if (document.visibilityState === 'hidden') return;
    const before = this.items();
    await this.load();
    const c = this.current();
    if (!c) return;
    const now = this.items().find((x) => x._id === c._id);
    const old = before.find((x) => x._id === c._id);
    // Only re-fetch the open conversation when something new arrived
    if (now && (now.count !== c.messages.length || now.lastAt !== old?.lastAt || now.unread)) {
      this.current.set(await this.api.chat(c._id));
      void this.api.refreshChatUnread();
    }
  }

  async select(id: string) {
    this.draft = '';
    this.current.set(await this.api.chat(id));
    this.items.update((list) => list.map((x) => (x._id === id ? { ...x, unread: 0 } : x)));
    void this.api.refreshChatUnread();
  }

  async reply(c: ChatFull) {
    const text = this.draft.trim();
    if (!text || this.sending()) return;
    this.sending.set(true);
    try {
      this.current.set(await this.api.replyChat(c._id, text));
      this.draft = '';
      await this.load();
    } catch (e) {
      this.toast.error(e);
    } finally {
      this.sending.set(false);
    }
  }

  protected enter(e: Event, c: ChatFull) {
    const k = e as KeyboardEvent;
    if (k.shiftKey || k.isComposing) return;
    e.preventDefault();
    void this.reply(c);
  }

  async setStatus(c: ChatFull, status: 'open' | 'closed') {
    await this.api.setChatStatus(c._id, status).then(() => this.toast.show(status === 'closed' ? 'گفت‌وگو بسته شد.' : 'گفت‌وگو باز شد.'), (e) => this.toast.error(e));
    this.current.set({ ...c, status });
    await this.load();
  }

  async remove(c: ChatFull) {
    if (!confirm(`گفت‌وگو با «${c.name || 'بازدیدکننده'}» برای همیشه حذف شود؟`)) return;
    await this.api.deleteChat(c._id).then(() => this.toast.show('حذف شد.'), (e) => this.toast.error(e));
    this.current.set(null);
    await this.load();
  }
}
