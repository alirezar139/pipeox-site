import { afterNextRender, ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { watchIdle } from '../../core/idle-watch';
import { SeoService } from '../../core/seo.service';
import { IconComponent, type IconName } from '../../shared/icon.component';
import { AdminApi, ROLE_LABELS } from './admin-api.service';
import { ToastService } from './ui/toast.service';

const SECTIONS: { path: string; label: string; icon: IconName; exact?: boolean; developer?: boolean }[] = [
  { path: '/admin', label: 'داشبورد', icon: 'home', exact: true },
  { path: '/admin/inquiries', label: 'استعلام‌ها', icon: 'inbox' },
  { path: '/admin/products', label: 'محصولات', icon: 'box' },
  { path: '/admin/articles', label: 'مقالات و اخبار', icon: 'news' },
  { path: '/admin/projects', label: 'پروژه‌ها', icon: 'folder' },
  { path: '/admin/customers', label: 'مشتریان', icon: 'users' },
  { path: '/admin/subscribers', label: 'خبرنامه', icon: 'mail' },
  { path: '/admin/settings', label: 'تنظیمات سایت', icon: 'settings' },
  { path: '/admin/users', label: 'کاربران پنل', icon: 'lock' },
  { path: '/admin/system', label: 'سیستم', icon: 'code', developer: true },
];

@Component({
  selector: 'app-admin-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IconComponent],
  host: { class: 'admin-app' },
  template: `
    <aside class="adm-side" [class.open]="menu()">
      <a class="adm-brand" routerLink="/admin">
        <svg viewBox="0 0 46 39" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" d="M6 1H33a12 12 0 0 1 0 24H18.4L14 36.4a3 3 0 0 1-2.8 2H3.4a2 2 0 0 1-1.9-2.7L4 3a2.6 2.6 0 0 1 2-2ZM3.42 10.6H31a2.2 2.2 0 0 1 0 4.4H3.08Z"/></svg>
        <span><b>PIPEOX</b><small>پنل مدیریت</small></span>
      </a>
      <nav class="adm-nav">
        @for (s of sections(); track s.path) {
          <a [routerLink]="s.path" routerLinkActive="on" [routerLinkActiveOptions]="{ exact: !!s.exact }">
            <app-icon [name]="s.icon" /><span>{{ s.label }}</span>
            @if (s.path === '/admin/inquiries' && api.newCount()) { <em>{{ api.newCount() }}</em> }
          </a>
        }
      </nav>
      @if (api.current(); as me) {
        <div class="adm-me">
          <span class="adm-me-avatar" aria-hidden="true">{{ me.name.charAt(0) }}</span>
          <span><b>{{ me.name }}</b><small>{{ roleLabels[me.role] }} · <span dir="ltr">{{ me.username }}</span></small></span>
        </div>
      }
      <div class="adm-side-foot">
        <a href="/" target="_blank" rel="noopener"><app-icon name="eye" /><span>مشاهده سایت</span></a>
        <button type="button" (click)="logout()"><app-icon name="logout" /><span>خروج</span></button>
      </div>
    </aside>
    <div class="adm-main">
      <header class="adm-topbar">
        <button type="button" class="adm-menu-btn" aria-label="منو" (click)="menu.update((v) => !v)"><app-icon name="menu" /></button>
        <span class="adm-topbar-title">پنل مدیریت PIPEOX</span>
      </header>
      <div class="adm-content"><router-outlet /></div>
    </div>
    <div class="adm-toasts" aria-live="polite">
      @for (t of toasts.items(); track t.id) { <div class="adm-toast" [class.err]="t.error">{{ t.text }}</div> }
    </div>
  `,
})
export class AdminShellComponent {
  protected readonly api = inject(AdminApi);
  protected readonly roleLabels = ROLE_LABELS;
  protected readonly sections = computed(() => SECTIONS.filter((s) => !s.developer || this.api.current()?.role === 'developer'));
  protected readonly toasts = inject(ToastService);
  private readonly router = inject(Router);
  protected readonly menu = signal(false);

  constructor() {
    inject(SeoService).set({ title: 'پنل مدیریت', path: '/admin', noindex: true });
    void this.api.dashboard().catch(() => {});
    this.router.events.subscribe((e) => e instanceof NavigationEnd && this.menu.set(false));
    // 30 minutes without activity → sign out (the server enforces the same limit)
    const destroy = inject(DestroyRef);
    afterNextRender(() => {
      const stop = watchIdle('admin', {
        ping: () => this.api.me(),
        timeout: () => void this.signOut('idle'),
      });
      destroy.onDestroy(stop);
    });
  }

  private async signOut(reason?: 'idle') {
    await this.api.logout().catch(() => {});
    await this.router.navigate(['/admin/login'], { queryParams: reason ? { reason } : {} });
  }

  logout() {
    return this.signOut();
  }
}
