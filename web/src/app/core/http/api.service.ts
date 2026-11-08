import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { Account, Article, ArticleSummary, Gateway, Order, OrderStatus, Product, Project, SiteSettings, Unit } from '../models';

/** A cart line priced by the server (error = why it cannot be ordered as is). */
export interface PricedLine {
  slug: string;
  sku: string;
  qty: number;
  productTitle: string;
  title: string;
  unit: Unit;
  price: number;
  total: number;
  minQty: number;
  stock: number | null;
  image: string;
  error: string;
}

export interface OrderSummary {
  _id: string;
  number: number;
  status: OrderStatus;
  total: number | null;
  subtotal: number;
  count: number;
  createdAt: string;
}

/** Typed access to the public and customer API. Admin endpoints: features/admin/admin-api.service.ts. */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  get<T>(url: string, params?: Record<string, string | number | undefined>) {
    const p = new HttpParams({ fromObject: Object.fromEntries(Object.entries(params ?? {}).filter(([, v]) => v !== undefined)) as Record<string, string> });
    return firstValueFrom(this.http.get<T>(url, { params: p }));
  }
  post<T>(url: string, body: unknown) {
    return firstValueFrom(this.http.post<T>(url, body));
  }
  put<T>(url: string, body: unknown) {
    return firstValueFrom(this.http.put<T>(url, body));
  }
  patch<T>(url: string, body: unknown) {
    return firstValueFrom(this.http.patch<T>(url, body));
  }
  delete<T>(url: string) {
    return firstValueFrom(this.http.delete<T>(url));
  }

  /* ───────── Public content ───────── */
  site = () => this.get<SiteSettings>('/api/site');
  products = () => this.get<Product[]>('/api/products');
  product = (slug: string) => this.get<Product>(`/api/products/${encodeURIComponent(slug)}`);
  articles = (limit?: number) => this.get<ArticleSummary[]>('/api/articles', { limit });
  article = (slug: string) => this.get<Article>(`/api/articles/${encodeURIComponent(slug)}`);
  projects = () => this.get<Project[]>('/api/projects');

  /* ───────── Forms ───────── */
  sendInquiry = (data: FormData) => this.post<{ ok: true }>('/api/inquiries', data);
  subscribe = (email: string, website: string, captcha: object) => this.post<{ ok: true }>('/api/subscribers', { email, website, ...captcha });

  /* ───────── Customer account ───────── */
  me = () => this.get<{ user: Account | null }>('/api/auth/me');

  /* ───────── Shop ───────── */
  priceCart = (items: { slug: string; sku: string; qty: number }[]) => this.post<{ lines: PricedLine[]; gateways: Gateway[] }>('/api/cart/price', { items });
  gateways = () => this.get<Gateway[]>('/api/shop/gateways');
  placeOrder = (body: unknown) => this.post<Order>('/api/orders', body);
  myOrders = () => this.get<OrderSummary[]>('/api/account/orders');
  myOrder = (id: string) => this.get<Order>(`/api/account/orders/${id}`);
  payOrder = (id: string, gateway: string) => this.post<{ method: 'GET' | 'POST'; url: string; fields: Record<string, string> }>(`/api/orders/${id}/pay`, { gateway });
  reportTransfer = (id: string, body: { ref: string; paidOn: string; note: string }) => this.post<Order>(`/api/orders/${id}/transfer`, body);
  cancelOrder = (id: string) => this.post<Order>(`/api/orders/${id}/cancel`, {});
}
