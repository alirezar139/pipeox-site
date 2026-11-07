import { BadRequestException, StandardSchemaValidationPipe, type INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import express, { type Express } from 'express';
import { AppModule } from './app.module.js';
import { ApiExceptionFilter } from './common/http/exception.filter.js';

/**
 * Builds the API and mounts it on a host Express app:
 *   /api/*        → Nest controllers
 *   /sitemap.xml  → SeoController
 *   /robots.txt   → SeoController
 * Used by the production server (one process with the Angular SSR app) and by `npm run dev`.
 */
export async function mountApi(host: Express): Promise<INestApplication> {
  const api = express();
  api.set('trust proxy', host.get('trust proxy'));
  api.disable('x-powered-by');

  const app = await NestFactory.create(AppModule, new ExpressAdapter(api), {
    bufferLogs: true,
    bodyParser: false,
  });
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));
  app.use(cookieParser());
  app.use((_req: unknown, res: express.Response, next: () => void) => {
    res.setHeader('Cache-Control', 'no-store'); // API answers are per-user; controllers override for public files
    next();
  });
  app.useGlobalPipes(
    new StandardSchemaValidationPipe({
      exceptionFactory: (issues) => {
        const first = issues[0];
        const field = first?.path?.[0];
        return new BadRequestException({
          message: first?.message ?? 'درخواست نامعتبر است.',
          field: typeof field === 'object' ? String(field.key) : field !== undefined ? String(field) : undefined,
        });
      },
    }),
  );
  app.useGlobalFilters(new ApiExceptionFilter());
  app.enableShutdownHooks();
  await app.init();

  host.use('/api', api);
  host.get(['/sitemap.xml', '/robots.txt'], (req, res, next) => {
    req.url = '/seo' + req.path;
    api(req, res, next);
  });
  return app;
}
