import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { useResponseStatus } from '../core/http-status';
import { ApiService } from '../core/http/api.service';
import type { ApiError, Article, ArticleSummary, Product, Project } from '../core/models';

/**
 * Route data is loaded before the page renders, so server-rendered HTML is complete for
 * crawlers. On the browser the same responses come from the SSR transfer cache (no refetch).
 */

/* Unknown slug → resolvers return null, the page shows its 404 state, the response status is 404. */

/** Content lists degrade to empty instead of breaking the page when the API hiccups. */
const orEmpty = <T>(p: Promise<T[]>) => p.catch(() => [] as T[]);

export const productsResolver: ResolveFn<Product[]> = () => orEmpty(inject(ApiService).products());

export const productResolver: ResolveFn<Product | null> = async (route) => {
  const api = inject(ApiService);
  const status = useResponseStatus();
  try {
    return await api.product(route.paramMap.get('slug') ?? '');
  } catch (e) {
    if ((e as ApiError).statusCode === 404) {
      status(404);
      return null;
    }
    throw e;
  }
};

export const articlesResolver: ResolveFn<ArticleSummary[]> = () => orEmpty(inject(ApiService).articles());

export const recentArticlesResolver: ResolveFn<ArticleSummary[]> = () => orEmpty(inject(ApiService).articles(8));

export const articleResolver: ResolveFn<Article | null> = async (route) => {
  const api = inject(ApiService);
  const status = useResponseStatus();
  try {
    return await api.article(route.paramMap.get('slug') ?? '');
  } catch (e) {
    if ((e as ApiError).statusCode === 404) {
      status(404);
      return null;
    }
    throw e;
  }
};

export const projectsResolver: ResolveFn<Project[]> = () => orEmpty(inject(ApiService).projects());

export const homeResolver: ResolveFn<{ products: Product[]; latest: ArticleSummary | null }> = async () => {
  const api = inject(ApiService);
  const [products, latest] = await Promise.all([orEmpty(api.products()), orEmpty(api.articles(1))]);
  return { products, latest: latest[0] ?? null };
};
