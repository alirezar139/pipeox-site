/** Site navigation. `header: false` items appear only in the footer (in the header, contact is the CTA button). */
export const NAV = [
  { label: 'خانه', path: '/', exact: true, header: true },
  { label: 'محصولات', path: '/products', exact: false, header: true },
  { label: 'پروژه‌ها', path: '/projects', exact: false, header: true },
  { label: 'درباره ما', path: '/about', exact: false, header: true },
  { label: 'تماس با ما', path: '/contact', exact: false, header: false },
  { label: 'دانش فنی', path: '/insights', exact: false, header: false },
] as const;

export const HEADER_NAV = NAV.filter((n) => n.header);
