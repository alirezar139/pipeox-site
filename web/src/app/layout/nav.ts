import type { MessageKey } from '../core/messages';

/** Site navigation (paths without a language prefix). `header: false` items appear only in the footer (in the header, contact is the CTA button). */
export const NAV: readonly { key: MessageKey; path: string; exact: boolean; header: boolean }[] = [
  { key: 'nav.home', path: '/', exact: true, header: true },
  { key: 'nav.products', path: '/products', exact: false, header: true },
  { key: 'nav.projects', path: '/projects', exact: false, header: true },
  { key: 'nav.about', path: '/about', exact: false, header: true },
  { key: 'nav.contact', path: '/contact', exact: false, header: false },
  { key: 'nav.insights', path: '/insights', exact: false, header: false },
];

export const HEADER_NAV = NAV.filter((n) => n.header);
