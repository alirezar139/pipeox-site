import { computed, inject, Injectable, signal } from '@angular/core';
import { ApiService } from '../../core/http/api.service';
import type { ArticleSummary, Article, Inquiry, InquiryStatus, Product, Project, SiteSettings, Order, OrderStatus } from '../../core/models';

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

export type AdminRole = 'admin' | 'developer' | 'support';
export const ROLE_LABELS: Record<AdminRole, string> = { admin: 'مدیر', developer: 'برنامه‌نویس', support: 'پشتیبان' };

export interface AdminUser {
  id: string;
  username: string;
  name: string;
  role: AdminRole;
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface SystemInfo {
  app: { version: string; node: string; env: string; uptimeSec: number; memoryMb: number; pid: number };
  host: { platform: string; cpus: number; loadAvg: number[]; freeMemMb: number; totalMemMb: number };
  database: { name: string; version: string; collections: { name: string; count: number }[] };
  config: { siteUrl: string; dataDir: string; trustProxy: string; idleMinutes: number; email: boolean; bale: boolean; telegram: boolean };
}

export interface AdminOrderRow {
  _id: string;
  number: number;
  status: OrderStatus;
  payMethod: 'online' | 'transfer';
  subtotal: number;
  total: number | null;
  createdAt: string;
  invoice: { name: string };
  address: { phone: string; city: string };
  user: { _id: string; email: string; name: string } | null;
  transfer: { ref: string } | null;
  items: { qty: number }[];
}
export interface AdminOrder extends Omit<Order, 'user' | 'payments'> {
  user: { _id: string; email: string; name: string; phone: string; company: string } | null;
  staffNote: string;
  payments: (Order['payments'][number] & { payNo: number; trace: string; message: string })[];
}
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  review: 'در انتظار بررسی',
  awaiting_payment: 'در انتظار پرداخت',
  paid: 'پرداخت‌شده',
  processing: 'در حال آماده‌سازی',
  shipped: 'ارسال‌شده',
  delivered: 'تحویل‌شده',
  cancelled: 'لغوشده',
};
export const ORDER_STATUSES = Object.keys(ORDER_STATUS_LABELS) as OrderStatus[];

export interface ChatMsg {
  from: 'visitor' | 'staff';
  text: string;
  at: string;
  by?: string;
}
export interface ChatSummary {
  _id: string;
  name: string;
  contact: string;
  status: 'open' | 'closed';
  unread: number;
  lastAt: string;
  createdAt: string;
  count: number;
  last?: ChatMsg;
}
export interface ChatFull extends Omit<ChatSummary, 'count' | 'last'> {
  messages: ChatMsg[];
  lang: string;
  page: string;
  ip?: string;
  user: { _id: string; email: string; name: string } | null;
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
  /** Support conversations with unanswered visitor messages (sidebar badge). */
  readonly chatUnread = signal(0);

  /** The signed-in panel user (set by the route guard and the login page). */
  readonly current = signal<AdminUser | null>(null);
  /** Support accounts only answer inquiries and chats; the API enforces the same. */
  readonly isSupport = computed(() => this.current()?.role === 'support');

  me = async () => {
    const r = await this.api.get<{ admin: AdminUser | null }>('/api/admin/me');
    this.current.set(r.admin);
    return r.admin;
  };
  login = async (body: { username: string; password: string; captchaId?: string; captcha?: string }) => {
    const r = await this.api.post<{ admin: AdminUser }>('/api/admin/login', body);
    this.current.set(r.admin);
    return r.admin;
  };
  logout = async () => {
    await this.api.post('/api/admin/logout', {});
    this.current.set(null);
  };
  changeMyPassword = (current: string, password: string) => this.api.post('/api/admin/password', { current, password });

  users = () => this.api.get<AdminUser[]>('/api/admin/users');
  createUser = (body: { username: string; name: string; role: AdminRole; password: string }) => this.api.post<AdminUser>('/api/admin/users', body);
  updateUser = (id: string, body: Partial<Pick<AdminUser, 'name' | 'role' | 'active'>>) => this.api.patch<AdminUser>(`/api/admin/users/${id}`, body);
  setUserPassword = (id: string, password: string) => this.api.post(`/api/admin/users/${id}/password`, { password });
  deleteUser = (id: string) => this.api.delete(`/api/admin/users/${id}`);
  system = () => this.api.get<SystemInfo>('/api/admin/system');

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

  /** Orders waiting for the team (review + transfer to confirm): sidebar badge. */
  readonly orderTodo = signal(0);
  orders = async (status?: OrderStatus) => {
    const r = await this.api.get<{ items: AdminOrderRow[]; counts: Partial<Record<OrderStatus, number>> }>('/api/admin/orders', { status });
    this.orderTodo.set(r.counts.review ?? 0);
    return r;
  };
  order = (id: string) => this.api.get<AdminOrder>(`/api/admin/orders/${id}`);
  updateOrder = (id: string, body: Partial<{ status: OrderStatus; shipping: number; shippingNote: string; staffNote: string; trackingCode: string }>) =>
    this.api.patch<AdminOrder>(`/api/admin/orders/${id}`, body);

  chats = async () => {
    const r = await this.api.get<{ items: ChatSummary[]; unread: number }>('/api/admin/chats');
    this.chatUnread.set(r.unread);
    return r.items;
  };
  refreshChatUnread = async () => this.chatUnread.set((await this.api.get<{ unread: number }>('/api/admin/chats/unread')).unread);
  chat = (id: string) => this.api.get<ChatFull>(`/api/admin/chats/${id}`);
  replyChat = (id: string, text: string) => this.api.post<ChatFull>(`/api/admin/chats/${id}/messages`, { text });
  setChatStatus = (id: string, status: 'open' | 'closed') => this.api.patch(`/api/admin/chats/${id}`, { status });
  deleteChat = (id: string) => this.api.delete(`/api/admin/chats/${id}`);

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
