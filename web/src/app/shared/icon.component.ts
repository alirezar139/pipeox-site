import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type IconName =
  | 'search' | 'arrow' | 'arrow-right' | 'chevron' | 'play' | 'play-solid' | 'send' | 'user' | 'phone' | 'doc' | 'clip'
  | 'list' | 'trophy' | 'check-circle' | 'users' | 'users-solid' | 'headset' | 'gear' | 'shield' | 'calendar' | 'mail'
  | 'menu' | 'close' | 'logout' | 'edit' | 'trash' | 'plus' | 'eye' | 'download' | 'image' | 'home' | 'box' | 'news'
  | 'folder' | 'settings' | 'inbox' | 'lock' | 'eye-off' | 'refresh' | 'code';

/** Line icons, 24×24, stroke = currentColor. Decorative unless given a label by the parent. */
@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'ico-host' },
  template: `
    <svg class="ico" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8"
      stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      @switch (name()) {
        @case ('search') { <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/> }
        @case ('arrow') { <path d="M19 12H5m6-6-6 6 6 6"/> }
        @case ('arrow-right') { <path d="M5 12h14m-6-6 6 6-6 6"/> }
        @case ('chevron') { <path d="m14 6-6 6 6 6"/> }
        @case ('play') { <circle cx="12" cy="12" r="9"/><path d="m14.5 12-4 2.6V9.4z" fill="currentColor"/> }
        @case ('play-solid') { <path d="M8 5.5v13l10-6.5z" fill="currentColor" stroke="none"/> }
        @case ('send') { <path d="M21 3 3 10.5l7 2.5 2.5 7z" fill="currentColor" stroke="none"/><path d="m10 13 4-4" stroke="#17120e"/> }
        @case ('user') { <circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/> }
        @case ('phone') { <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/> }
        @case ('doc') { <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/> }
        @case ('clip') { <path d="m21 11-8.5 8.5a5 5 0 0 1-7-7L14 4a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L15 7"/> }
        @case ('list') { <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/> }
        @case ('trophy') { <path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4m8-4h3a3 3 0 0 1-3 4M12 13v4m-4 4h8m-6-4h4"/> }
        @case ('check-circle') { <circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.5 2.5L16 9.5"/> }
        @case ('users') { <circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.5"/><path d="M17 14a5 5 0 0 1 4.5 5"/> }
        @case ('users-solid') {
          <g fill="currentColor" stroke="none"><circle cx="12" cy="7.5" r="3.6"/><path d="M5.5 20a6.5 6.5 0 0 1 13 0z"/><circle cx="5" cy="9.5" r="2.6"/><path d="M0.5 18.5a4.6 4.6 0 0 1 6.6-4.1A7.8 7.8 0 0 0 4.3 18.5z"/><circle cx="19" cy="9.5" r="2.6"/><path d="M23.5 18.5a4.6 4.6 0 0 0-6.6-4.1 7.8 7.8 0 0 1 2.8 4.1z"/></g>
        }
        @case ('headset') { <path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="13" width="4" height="6" rx="1.5"/><rect x="17" y="13" width="4" height="6" rx="1.5"/><path d="M19 19a3 3 0 0 1-3 3h-3"/> }
        @case ('gear') { <circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M4.9 4.9 7 7m10 10 2.1 2.1M2 12h3m14 0h3M4.9 19.1 7 17M17 7l2.1-2.1"/> }
        @case ('shield') { <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m8.5 12 2.5 2.5 4.5-5"/> }
        @case ('calendar') { <rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4m8-4v4"/> }
        @case ('mail') { <rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/> }
        @case ('menu') { <path d="M4 7h16M4 12h16M4 17h16"/> }
        @case ('close') { <path d="M6 6l12 12M18 6 6 18"/> }
        @case ('logout') { <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11"/> }
        @case ('edit') { <path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/> }
        @case ('trash') { <path d="M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3"/> }
        @case ('plus') { <path d="M12 5v14M5 12h14"/> }
        @case ('eye') { <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12"/><circle cx="12" cy="12" r="3"/> }
        @case ('download') { <path d="M12 4v11m-5-5 5 5 5-5M4 20h16"/> }
        @case ('image') { <rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/> }
        @case ('home') { <path d="M4 11 12 4l8 7v9H4z"/><path d="M10 20v-5h4v5"/> }
        @case ('box') { <path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z"/><path d="m3 7.5 9 4.5 9-4.5M12 12v9"/> }
        @case ('news') { <rect x="3" y="4" width="15" height="16" rx="2"/><path d="M18 8h3v10a2 2 0 0 1-2 2M7 8h7M7 12h7M7 16h4"/> }
        @case ('folder') { <path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/> }
        @case ('settings') { <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/> }
        @case ('inbox') { <path d="M3 13l3-8h12l3 8v6H3z"/><path d="M3 13h5l1 3h6l1-3h5"/> }
        @case ('lock') { <rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/> }
        @case ('eye-off') { <path d="M3 3l18 18"/><path d="M10.6 5.1A9.7 9.7 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.9 8.4 2 12 2 12s3.5 7 10 7a9.6 9.6 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/> }
        @case ('refresh') { <path d="M20 11a8 8 0 0 0-14.6-4.5L4 8"/><path d="M4 3v5h5"/><path d="M4 13a8 8 0 0 0 14.6 4.5L20 16"/><path d="M20 21v-5h-5"/> }
        @case ('code') { <path d="m8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/> }
      }
    </svg>
  `,
})
export class IconComponent {
  readonly name = input.required<IconName | string>();
}
