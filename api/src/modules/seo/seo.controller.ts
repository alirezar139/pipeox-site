import { Controller, Get, Header, Req } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection } from '@nestjs/mongoose';
import type { Request } from 'express';
import type { Connection } from 'mongoose';
import type { Env } from '../../config/env.js';
import { SettingsService } from '../settings/settings.service.js';

const xmlEscape = (s: string) => s.replace(/[<>&'"]/g, (c) => `&#${c.charCodeAt(0)};`);
const STATIC_PAGES = ['/', '/products', '/projects', '/insights', '/about', '/contact'];

/**
 * Served at /sitemap.xml and /robots.txt (mapped in bootstrap.ts).
 * The base URL is SITE_URL, else the domain set in the panel, else the request host.
 */
@Controller('seo')
export class SeoController {
  constructor(
    @InjectConnection() private readonly conn: Connection,
    private readonly settings: SettingsService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  private async base(req: Request): Promise<string> {
    const fromEnv = this.config.get('SITE_URL', { infer: true });
    const fromPanel = (await this.settings.get()).site.url;
    return (fromEnv || fromPanel || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
  }

  @Get('sitemap.xml')
  @Header('Content-Type', 'application/xml; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=3600')
  async sitemap(@Req() req: Request) {
    const base = await this.base(req);
    const [products, articles] = await Promise.all([
      this.conn.collection('products').find({ published: true }, { projection: { slug: 1, updatedAt: 1 } }).toArray(),
      this.conn.collection('articles').find({ published: true, publishedAt: { $lte: new Date() } }, { projection: { slug: 1, updatedAt: 1 } }).toArray(),
    ]);
    const urls = [
      ...STATIC_PAGES.map((p) => ({ loc: p, mod: null as Date | null })),
      ...products.map((p) => ({ loc: `/products/${p.slug}`, mod: p.updatedAt as Date })),
      ...articles.map((a) => ({ loc: `/insights/${a.slug}`, mod: a.updatedAt as Date })),
    ];
    const body = urls
      .map((u) => `  <url><loc>${xmlEscape(base + u.loc)}</loc>${u.mod ? `<lastmod>${u.mod.toISOString().slice(0, 10)}</lastmod>` : ''}</url>`)
      .join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
  }

  @Get('robots.txt')
  @Header('Content-Type', 'text/plain; charset=utf-8')
  async robots(@Req() req: Request) {
    return `User-agent: *\nAllow: /api/media/\nDisallow: /api/\nDisallow: /account\nDisallow: /admin\n\nSitemap: ${await this.base(req)}/sitemap.xml\n`;
  }
}
