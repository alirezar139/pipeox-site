/** API data shapes (mirror api/src/modules/*). */

/** Translated languages (Persian is the base content). */
export type TrLang = 'en' | 'de';
/** Translations as stored by the API: { en: {...}, de: {...} } — the admin reads/writes them; the site receives content already translated. */
export type I18nOf<T> = Partial<Record<TrLang, Partial<T>>>;

export interface SettingsTranslation {
  site: Partial<{ name: string; title: string; description: string }>;
  contact: Partial<{ address: string; hours: string }>;
  hero: Partial<{ kicker: string; title: string; titleAccent: string; text: string }>;
  showcase: Partial<{ title: string; text: string }>;
  stats: { label?: string }[];
  features: { title?: string; text?: string }[];
  projects: Partial<{ title: string; text: string }>;
  newsletter: Partial<{ title: string; text: string }>;
}

export interface SiteSettings {
  site: { name: string; nameFa: string; url: string; title: string; description: string };
  contact: { phone: string; email: string; whatsapp: string; address: string; hours: string };
  hero: { kicker: string; title: string; titleAccent: string; text: string };
  showcase: { title: string; text: string };
  stats: { value: number; label: string; icon: string }[];
  features: { title: string; text: string; icon: string }[];
  projects: { title: string; text: string; video: string };
  newsletter: { title: string; text: string };
  shop?: ShopSettings;
  i18n?: I18nOf<SettingsTranslation>;
}

export type OrbitSlot = '' | 'a' | 'b' | 'c' | 'd';

export type Unit = 'piece' | 'meter' | 'length' | 'kg' | 'set';

/** A size/grade sold online at a fixed price (Toman, before VAT). stock null = supplied to order. */
export interface ProductVariant {
  sku: string;
  title: string;
  unit: Unit;
  price: number;
  stock: number | null;
  minQty: number;
  active: boolean;
}

export interface ShopSettings {
  vatPercent: number;
  seller: { legalName: string; nationalId: string; economicCode: string; regNo: string; address: string; postalCode: string; phone: string };
  bank: { name: string; holder: string; account: string; sheba: string; card: string };
}

export type OrderStatus = 'review' | 'awaiting_payment' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
export type PayMethod = 'online' | 'transfer';

export interface OrderItem {
  slug: string;
  productTitle: string;
  sku: string;
  title: string;
  unit: Unit;
  price: number;
  qty: number;
  total: number;
}

export interface Order {
  _id: string;
  number: number;
  status: OrderStatus;
  payMethod: PayMethod;
  items: OrderItem[];
  subtotal: number;
  shipping: number | null;
  vatPercent: number;
  vat: number | null;
  total: number | null;
  address: { name: string; phone: string; province: string; city: string; address: string; postalCode: string };
  invoice: { type: 'personal' | 'company'; name: string; nationalId: string; economicCode: string; regNo: string };
  customerNote: string;
  shippingNote: string;
  trackingCode: string;
  payments: { gateway: string; amountRial: number; status: 'pending' | 'paid' | 'failed'; rrn: string; card: string; startedAt: string; doneAt?: string }[];
  transfer: { ref: string; paidOn: string; note: string; at: string } | null;
  paidAt: string | null;
  history: { status: string; at: string; by: string }[];
  createdAt: string;
}

export interface Gateway {
  id: string;
  label: { fa: string; en: string; de: string };
}

export interface Product {
  _id: string;
  slug: string;
  title: string;
  shortTitle: string;
  code: string;
  summary: string;
  intro: string;
  image: string;
  alt: string;
  keywords: string;
  orbit: OrbitSlot;
  types: { name: string; desc: string }[];
  specs: { label: string; value: string }[];
  applications: string[];
  variants: ProductVariant[];
  sort: number;
  published?: boolean;
  updatedAt: string;
  i18n?: I18nOf<Pick<Product, 'title' | 'shortTitle' | 'summary' | 'intro' | 'alt' | 'keywords' | 'applications'> & { types: Partial<Product['types'][number]>[]; specs: Partial<Product['specs'][number]>[] }>;
}

export interface ArticleSummary {
  _id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  image: string;
  imageAlt: string;
  publishedAt: string;
  updatedAt: string;
  published?: boolean;
}

export interface Article extends ArticleSummary {
  body: string;
  showCover: boolean;
  readingMinutes: number;
  i18n?: I18nOf<Pick<Article, 'title' | 'description' | 'category' | 'imageAlt' | 'body'>>;
}

export interface Project {
  _id: string;
  title: string;
  client: string;
  year: string;
  industry: string;
  scope: string;
  image: string;
  sort: number;
  published?: boolean;
  i18n?: I18nOf<Pick<Project, 'title' | 'client' | 'industry' | 'scope'>>;
}

export interface Account {
  id: string;
  email: string;
  name: string;
  phone: string;
  company: string;
}

export type InquiryStatus = 'new' | 'contacted' | 'quoted' | 'won' | 'closed';

export interface Inquiry {
  _id: string;
  name: string;
  phone: string;
  category: string;
  details: string;
  status: InquiryStatus;
  notes: string;
  page: string;
  attachment: { name: string; size: number } | null;
  user: { _id: string; email: string; name: string } | null;
  createdAt: string;
}

/** Error body of every failed API call. */
export interface ApiError {
  statusCode: number;
  message: string;
  field?: string;
}
