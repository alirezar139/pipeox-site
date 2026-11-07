/** API data shapes (mirror api/src/modules/*). */

export interface SiteSettings {
  site: { name: string; nameFa: string; url: string; title: string; description: string };
  contact: { phone: string; email: string; whatsapp: string; address: string; hours: string };
  hero: { kicker: string; title: string; titleAccent: string; text: string };
  showcase: { title: string; text: string };
  stats: { value: number; label: string; icon: string }[];
  features: { title: string; text: string; icon: string }[];
  projects: { title: string; text: string; video: string };
  newsletter: { title: string; text: string };
}

export type OrbitSlot = '' | 'a' | 'b' | 'c' | 'd';

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
  sort: number;
  published?: boolean;
  updatedAt: string;
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
