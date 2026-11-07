import { inject, Injectable, signal } from '@angular/core';
import { ApiService } from '../../core/http/api.service';
import type { ArticleSummary, Article, Inquiry, InquiryStatus, Product, Project, SiteSettings } from '../../core/models';

export interface Dashboard {
  newInquiries: number;
  weekInquiries: number;
  totalInquiries: number;
  customers: number;
  subscribers: number;
  products: number;
  articles: number;
  latest: { _id: string; name: string; category: string; status: InquiryStatus; createdAt: string }[];
}

export interface Customer {
  id: string;
  email: string;
  name: string;
  phone: string;
  company: string;
  active: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  inquiries: number;
}

/** Internal sales workflow labels (admin side). */
export const STATUS_LABELS: Record<InquiryStatus, string> = {
  new: 'جدید',
  contacted: 'تماس گرفته شد',
  quoted: 'پیشنهاد ارسال شد',
  won: 'منجر به فروش',
  closed: 'بسته شد',
};

@Injectable({ providedIn: 'root' })
export class AdminApi {
  private readonly api = inject(ApiService);
  /** Count shown on the sidebar badge; refreshed by the dashboard and inbox. */
  readonly newCount = signal(0);

  me = () => this.api.get<{ admin: boolean }>('/api/admin/me');
  login = (password: string) => this.api.post<{ admin: true }>('/api/admin/login', { password });
  logout = () => this.api.post('/api/admin/logout', {});

  dashboard = async () => {
    const d = await this.api.get<Dashboard>('/api/admin/dashboard');
    this.newCount.set(d.newInquiries);
    return d;
  };

  inquiries = (q: { status?: string; user?: string }) =>
    this.api.get<{ items: Inquiry[]; counts: Partial<Record<InquiryStatus, number>> }>('/api/admin/inquiries', q);
  updateInquiry = (id: string, body: { status: InquiryStatus; notes: string }) => this.api.patch(`/api/admin/inquiries/${id}`, body);

  products = () => this.api.get<Product[]>('/api/admin/products');
  product = (id: string) => this.api.get<Product>(`/api/admin/products/${id}`);
  saveProduct = (id: string | null, body: Partial<Product>) =>
    id ? this.api.put<Product>(`/api/admin/products/${id}`, body) : this.api.post<Product>('/api/admin/products', body);
  deleteProduct = (id: string) => this.api.delete(`/api/admin/products/${id}`);

  articles = () => this.api.get<ArticleSummary[]>('/api/admin/articles');
  article = (id: string) => this.api.get<Article>(`/api/admin/articles/${id}`);
  categories = () => this.api.get<string[]>('/api/admin/articles/categories');
  saveArticle = (id: string | null, body: Partial<Article>) =>
    id ? this.api.put<Article>(`/api/admin/articles/${id}`, body) : this.api.post<Article>('/api/admin/articles', body);
  deleteArticle = (id: string) => this.api.delete(`/api/admin/articles/${id}`);

  projects = () => this.api.get<Project[]>('/api/admin/projects');
  saveProject = (id: string | null, body: Partial<Project>) =>
    id ? this.api.put<Project>(`/api/admin/projects/${id}`, body) : this.api.post<Project>('/api/admin/projects', body);
  deleteProject = (id: string) => this.api.delete(`/api/admin/projects/${id}`);

  customers = () => this.api.get<Customer[]>('/api/admin/customers');
  setCustomerActive = (id: string, active: boolean) => this.api.patch(`/api/admin/customers/${id}`, { active });
  setCustomerPassword = (id: string, password: string) => this.api.post(`/api/admin/customers/${id}/password`, { password });
  deleteCustomer = (id: string) => this.api.delete(`/api/admin/customers/${id}`);

  subscribers = () => this.api.get<{ _id: string; email: string; createdAt: string }[]>('/api/admin/subscribers');
  deleteSubscriber = (id: string) => this.api.delete(`/api/admin/subscribers/${id}`);

  settings = () => this.api.get<{ settings: SiteSettings; icons: string[] }>('/api/admin/settings');
  saveSettings = (s: SiteSettings) => this.api.put<SiteSettings>('/api/admin/settings', s);

  upload = (file: File) => {
    const data = new FormData();
    data.set('image', file);
    return this.api.post<{ url: string }>('/api/admin/uploads', data);
  };
}
