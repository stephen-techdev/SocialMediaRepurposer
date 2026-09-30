/**
 * Row shapes shared by the store and the pages.
 *
 * These used to be backed by a live Supabase client that was created whenever
 * `VITE_SUPABASE_*` keys were present. Accounts have been removed, so nothing
 * reads or writes Supabase any more and building a client would only ship an
 * unused dependency to the browser. The types are kept so the existing code
 * still compiles unchanged.
 */

export type Profile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  default_platform: string;
  default_tone: string;
  language: string;
  theme: string;
  font_size: string;
  auto_save: boolean;
  notifications: boolean;
  high_contrast: boolean;
  created_at: string;
  updated_at: string;
};

export type Post = {
  id: string;
  user_id: string;
  original_content: string;
  platform: string;
  tone: string;
  language: string;
  include_emoji: boolean;
  generated_post: string | null;
  hashtags: string[] | null;
  cta: string | null;
  character_count: number;
  is_favorite: boolean;
  template_id: string | null;
  created_at: string;
  updated_at: string;
};

export type Template = {
  id: string;
  name: string;
  category: string;
  content: string;
  tone: string;
  platforms: string[];
  is_public: boolean;
  created_by: string | null;
  created_at: string;
};

export type Analytics = {
  id: string;
  user_id: string;
  week_start: string;
  posts_generated: number;
  platforms_used: string[];
  tones_used: string[];
  templates_used: number;
  created_at: string;
};
