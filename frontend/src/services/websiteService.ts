import { auth } from '../config/firebase';

export interface WebsitePage {
  id?: number;
  slug: string;
  title: string;
  is_homepage: boolean;
  sort_order: number;
  show_in_nav: boolean;
  template_id?: string | null;
  template_route?: string | null;
  html_content?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  seo_keywords?: string | null;
  og_image?: string | null;
  status: 'draft' | 'published';
  updated_at?: string | null;
}

export interface WebsiteData {
  id?: number;
  slug?: string;
  custom_domain?: string | null;
  site_title?: string | null;
  site_description?: string | null;
  favicon_url?: string | null;
  og_image_url?: string | null;
  google_analytics_id?: string | null;
  template_id?: string | null;
  template_route?: string | null;
  html_content?: string | null;
  settings?: Record<string, any> | null;
  status: 'draft' | 'published';
  published_at?: string | null;
  updated_at?: string | null;
  public_url?: string;
  pages: WebsitePage[];
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8081/api';
const PREFIX = '/saas/website';

const getAuthToken = async (): Promise<string | null> => {
  try {
    const user = auth.currentUser;
    if (!user) return null;
    return await user.getIdToken();
  } catch {
    return null;
  }
};

const hdrs = async (json = true) => {
  const token = await getAuthToken();
  const h: Record<string, string> = { Accept: 'application/json' };
  if (json) h['Content-Type'] = 'application/json';
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
};

const apiPost = async (path: string, body: any) => {
  const res = await fetch(`${API_BASE_URL}${PREFIX}${path}`, {
    method: 'POST', headers: await hdrs(), body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || json.message || 'Error');
  return json;
};

const apiDelete = async (path: string) => {
  const res = await fetch(`${API_BASE_URL}${PREFIX}${path}`, {
    method: 'DELETE', headers: await hdrs(),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || json.message || 'Error');
  return json;
};

export const websiteService = {
  async get(): Promise<WebsiteData | null> {
    const res = await fetch(`${API_BASE_URL}${PREFIX}`, { headers: await hdrs() });
    if (!res.ok) throw new Error('Error cargando página web');
    const json = await res.json();
    return json.data || null;
  },

  async save(data: { template_id: string; template_route: string; html_content: string; page_id?: number }): Promise<any> {
    return (await apiPost('/save', data)).data;
  },

  async saveSettings(data: {
    slug?: string; custom_domain?: string; site_title?: string;
    site_description?: string; favicon_url?: string; og_image_url?: string;
    google_analytics_id?: string;
  }): Promise<any> {
    return (await apiPost('/settings', data)).data;
  },

  async savePage(data: Partial<WebsitePage> & { page_id?: number }): Promise<any> {
    return (await apiPost('/page', data)).data;
  },

  async deletePage(pageId: number): Promise<void> {
    await apiDelete(`/page/${pageId}`);
  },

  async publish(data: { template_id?: string; template_route?: string; html_content?: string; page_id?: number }): Promise<any> {
    return (await apiPost('/publish', data)).data;
  },

  async unpublish(): Promise<void> {
    await apiPost('/unpublish', {});
  },

  async checkSlug(slug: string): Promise<boolean> {
    return (await apiPost('/check-slug', { slug })).available;
  },
};
