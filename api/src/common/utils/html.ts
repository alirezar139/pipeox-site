import sanitizeHtml from 'sanitize-html';

/**
 * Article body allow-list. Everything else (scripts, styles, event handlers,
 * iframes, javascript: URLs) is removed before the HTML is stored.
 */
export function sanitizeArticleHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      'p', 'br', 'hr', 'h2', 'h3', 'h4', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'blockquote',
      'code', 'pre', 'figure', 'figcaption', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'a', 'img',
    ],
    allowedAttributes: { a: ['href', 'target', 'rel'], img: ['src', 'alt', 'loading'] },
    allowedSchemes: ['https', 'http', 'mailto', 'tel'],
    allowedSchemesByTag: { img: ['https'] },
    allowProtocolRelative: false,
    transformTags: {
      a: (tagName, attribs) => {
        const href = attribs.href ?? '#';
        const out: Record<string, string> = { href };
        if (/^https?:\/\//i.test(href)) Object.assign(out, { target: '_blank', rel: 'noopener nofollow' });
        return { tagName, attribs: out };
      },
      img: (tagName, attribs) => ({ tagName, attribs: { src: attribs.src ?? '', alt: attribs.alt ?? '', loading: 'lazy' } }),
      b: 'strong',
      i: 'em',
    },
    exclusiveFilter: (frame) => frame.tag === 'img' && !/^(\/(assets|api\/media)\/|https:\/\/)/.test(frame.attribs.src ?? ''),
  }).trim();
}

/** Plain text of an HTML fragment (for reading time / excerpts). */
export const htmlToText = (html: string) => sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} }).replace(/\s+/g, ' ').trim();
