import { Body, ConflictException, Controller, Delete, Get, NotFoundException, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { InjectModel } from '@nestjs/mongoose';
import { trusted, type Model } from 'mongoose';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { langOf, localize, TRANSLATIONS } from '../../common/i18n.js';
import { htmlToText, sanitizeArticleHtml } from '../../common/utils/html.js';
import { objectId, slug } from '../../common/utils/text.js';
import { AdminGuard } from '../auth/guards.js';
import { Article, articleInput, type ArticleInput } from './article.schema.js';

/** Published and not scheduled for later. (`trusted`: server-built operators pass sanitizeFilter.) */
const live = () => ({ published: true, publishedAt: trusted({ $lte: new Date() }) });
const readingMinutes = (html: string) => Math.max(1, Math.round(htmlToText(html).split(' ').length / 200));

@Controller()
export class ArticlesController {
  constructor(@InjectModel(Article.name) private readonly articles: Model<Article>) {}

  /* ───────── Public ───────── */

  @Get('articles')
  async list(@Req() req: Request, @Query('limit', { schema: z.coerce.number().int().min(1).max(50).optional() }) limit?: number) {
    const lang = langOf(req);
    const rows = await this.articles
      .find(live())
      .sort({ publishedAt: -1, _id: -1 })
      .limit(limit ?? 50)
      .select('slug title description category image imageAlt publishedAt updatedAt i18n.en.title i18n.en.description i18n.en.category i18n.en.imageAlt i18n.de.title i18n.de.description i18n.de.category i18n.de.imageAlt')
      .lean();
    return rows.map((a) => localize(a, lang));
  }

  @Get('articles/:slug')
  async one(@Param('slug', { schema: slug }) s: string, @Req() req: Request) {
    const found = await this.articles.findOne({ slug: s, ...live() }).select('-__v -published').lean();
    if (!found) throw new NotFoundException('مطلب پیدا نشد.');
    const a = localize(found, langOf(req));
    return { ...a, readingMinutes: readingMinutes(a.body) };
  }

  /* ───────── Admin ───────── */

  @UseGuards(AdminGuard)
  @Get('admin/articles')
  adminList() {
    return this.articles.find().sort({ publishedAt: -1, _id: -1 }).select('-body').lean();
  }

  @UseGuards(AdminGuard)
  @Get('admin/articles/categories')
  categories() {
    return this.articles.distinct('category', { category: trusted({ $ne: '' }) });
  }

  @UseGuards(AdminGuard)
  @Get('admin/articles/:id')
  async adminOne(@Param('id', { schema: objectId }) id: string) {
    const a = await this.articles.findById(id).lean();
    if (!a) throw new NotFoundException();
    return a;
  }

  @UseGuards(AdminGuard)
  @Post('admin/articles')
  create(@Body({ schema: articleInput }) body: ArticleInput) {
    return this.save(null, body);
  }

  @UseGuards(AdminGuard)
  @Put('admin/articles/:id')
  update(@Param('id', { schema: objectId }) id: string, @Body({ schema: articleInput }) body: ArticleInput) {
    return this.save(id, body);
  }

  @UseGuards(AdminGuard)
  @Delete('admin/articles/:id')
  async remove(@Param('id', { schema: objectId }) id: string) {
    if (!(await this.articles.findByIdAndDelete(id))) throw new NotFoundException();
    return { ok: true };
  }

  private async save(id: string | null, input: ArticleInput) {
    const body = { ...input, body: sanitizeArticleHtml(input.body) };
    for (const l of TRANSLATIONS) {
      const tr = body.i18n?.[l];
      if (tr?.body) tr.body = sanitizeArticleHtml(tr.body);
    }
    if (!body.slug) body.slug = `post-${Date.now().toString(36)}-${randomBytes(2).toString('hex')}`;
    if (await this.articles.exists({ slug: body.slug, ...(id ? { _id: trusted({ $ne: id }) } : {}) })) {
      throw new ConflictException({ message: 'این نامک برای مطلب دیگری استفاده شده است.', field: 'slug' });
    }
    if (!id) return this.articles.create(body);
    const doc = await this.articles.findByIdAndUpdate(id, body, { returnDocument: 'after', runValidators: true });
    if (!doc) throw new NotFoundException();
    return doc;
  }
}
