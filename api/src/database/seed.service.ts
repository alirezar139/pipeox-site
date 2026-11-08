import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import matter from 'gray-matter';
import { marked } from 'marked';
import { trusted, type Model } from 'mongoose';
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { TRANSLATIONS } from '../common/i18n.js';
import { sanitizeArticleHtml } from '../common/utils/html.js';
import { fromRoot } from '../config/env.js';
import { Article } from '../modules/articles/article.schema.js';
import { Product } from '../modules/products/product.schema.js';
import { Project } from '../modules/projects/project.schema.js';
import type { SiteSettings } from '../modules/settings/settings.schema.js';
import { SettingsService } from '../modules/settings/settings.service.js';

/**
 * First run on an empty database: imports the starter content from /seed.
 * After that the database (edited in the admin panel) is the only source of truth.
 */
@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly log = new Logger(SeedService.name);

  constructor(
    private readonly settings: SettingsService,
    @InjectModel(Product.name) private readonly products: Model<Product>,
    @InjectModel(Article.name) private readonly articles: Model<Article>,
    @InjectModel(Project.name) private readonly projects: Model<Project>,
  ) {}

  async onApplicationBootstrap() {
    if (!(await this.settings.exists())) await this.seed();
    await this.seedTranslations();
  }

  /**
   * Starter translations from /seed/i18n/<lang>: fills a language only where a document has
   * none yet, so translations edited in the panel are never overwritten.
   */
  private async seedTranslations() {
    for (const lang of TRANSLATIONS) {
      const dir = fromRoot(`seed/i18n/${lang}`);
      if (!existsSync(path.join(dir, 'content.json'))) continue;
      const content = JSON.parse(await readFile(path.join(dir, 'content.json'), 'utf8')) as {
        settings?: Record<string, unknown>;
        products?: Record<string, Record<string, unknown>>;
      };
      let filled = 0;

      const site = (await this.settings.get()) as SiteSettings & { i18n?: Record<string, unknown> };
      if (content.settings && !site.i18n?.[lang]) {
        await this.settings.save({ ...site, i18n: { ...site.i18n, [lang]: content.settings } });
        filled++;
      }
      for (const [slug, tr] of Object.entries(content.products ?? {})) {
        const r = await this.products.updateOne({ slug, [`i18n.${lang}`]: trusted({ $exists: false }) }, { $set: { [`i18n.${lang}`]: tr } });
        filled += r.modifiedCount;
      }
      const mdDir = path.join(dir, 'insights');
      for (const f of existsSync(mdDir) ? (await readdir(mdDir)).filter((x) => x.endsWith('.md')) : []) {
        const { data, content: md } = matter(await readFile(path.join(mdDir, f), 'utf8'));
        const tr = {
          title: data.title ?? '',
          description: data.description ?? '',
          category: data.category ?? '',
          imageAlt: data.imageAlt ?? '',
          body: sanitizeArticleHtml(await marked.parse(md)),
        };
        const r = await this.articles.updateOne({ slug: f.replace(/\.md$/, ''), [`i18n.${lang}`]: trusted({ $exists: false }) }, { $set: { [`i18n.${lang}`]: tr } });
        filled += r.modifiedCount;
      }
      if (filled) this.log.log(`Seeded ${filled} ${lang} translation(s)`);
    }
  }

  private async seed() {
    const dir = fromRoot('seed');
    if (!existsSync(path.join(dir, 'site.json'))) throw new Error(`Database is empty and ${dir}/site.json was not found.`);

    const json = async <T>(f: string): Promise<T> => JSON.parse(await readFile(path.join(dir, f), 'utf8')) as T;
    const img = (name = '') => (!name || name.startsWith('/') ? name : `/assets/img/${name}`);

    const site = await json<Record<string, unknown>>('site.json');
    const { _note, ...home } = await json<Record<string, unknown>>('home.json');
    void _note;
    await this.settings.save({ ...site, ...home });

    const products = await json<Array<Record<string, any>>>('products.json');
    await this.products.insertMany(
      products.map((p, i) => ({
        ...p,
        image: img(p.image),
        specs: (p.specs ?? []).map(([label, value]: [string, string]) => ({ label, value })),
        sort: i + 1,
      })),
    );

    const projects = await json<Array<Record<string, any>>>('projects.json');
    if (projects.length) await this.projects.insertMany(projects.map((p, i) => ({ ...p, image: img(p.image), year: String(p.year ?? ''), sort: i + 1 })));

    const files = (await readdir(path.join(dir, 'insights'))).filter((f) => f.endsWith('.md'));
    for (const f of files) {
      const { data, content } = matter(await readFile(path.join(dir, 'insights', f), 'utf8'));
      await this.articles.create({
        slug: f.replace(/\.md$/, ''),
        title: data.title,
        description: data.description ?? '',
        category: data.category ?? '',
        image: img(data.image),
        imageAlt: data.imageAlt ?? '',
        showCover: data.cover !== false,
        body: sanitizeArticleHtml(await marked.parse(content)),
        publishedAt: new Date(data.date),
      });
    }
    this.log.log(`Seeded: settings, ${products.length} products, ${files.length} articles, ${projects.length} projects`);
  }
}
