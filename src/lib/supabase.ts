/**
 * Supabase is OPTIONAL.
 *
 * The original code threw on startup when the env vars were missing, which made
 * the app impossible to run locally. Now the client is null when unconfigured
 * and everything in this module transparently falls back to localStorage.
 * Add credentials to .env to turn cloud sync back on - no code changes needed.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl as string, supabaseAnonKey as string, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null;

if (!isSupabaseConfigured) {
  console.info(
    '[supabase] Not configured - running in local-only mode. History, favourites and analytics are stored in this browser.',
  );
}

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
