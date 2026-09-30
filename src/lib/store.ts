/**
 * Persistence layer: Supabase when configured, localStorage otherwise.
 *
 * Every page talks to this module instead of to `supabase` directly, which is
 * what makes the app usable with no backend at all (local-only mode) while
 * keeping cloud sync a zero-config upgrade.
 */
import { isSupabaseConfigured, supabase, type Analytics, type Post } from './supabase';

const POSTS_KEY = 'smr:posts:v1';
const ANALYTICS_KEY = 'smr:analytics:v1';
const LOCAL_USER = 'local';
const MAX_LOCAL_POSTS = 300;

export const storageMode: 'cloud' | 'local' = isSupabaseConfigured ? 'cloud' : 'local';

export type NewPost = Omit<Post, 'id' | 'created_at' | 'updated_at' | 'is_favorite' | 'template_id'> & {
  template_id?: string | null;
};

/* ------------------------------- local storage ------------------------------ */

function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeLocal<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn('[store] Could not write to localStorage (quota?)', err);
  }
}

const localPosts = () => readLocal<Post[]>(POSTS_KEY, []);
const saveLocalPosts = (posts: Post[]) => writeLocal(POSTS_KEY, posts);

const localAnalytics = () => readLocal<Analytics[]>(ANALYTICS_KEY, []);
const saveLocalAnalytics = (rows: Analytics[]) => writeLocal(ANALYTICS_KEY, rows);

const uuid = () =>
  crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/** Filters to the current browser's rows when there is no signed-in account. */
const scope = (userId?: string | null) => userId ?? LOCAL_USER;

/* ---------------------------------- posts ----------------------------------- */

export async function listPosts(
  options: { userId?: string | null; onlyFavorites?: boolean; limit?: number } = {},
): Promise<Post[]> {
  const { userId, onlyFavorites = false, limit = 100 } = options;
  const owner = scope(userId);

  if (storageMode === 'cloud' && supabase && userId) {
    let query = supabase
      .from('posts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (onlyFavorites) query = query.eq('is_favorite', true);
    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  }

  return localPosts()
    .filter((p) => p.user_id === owner)
    .filter((p) => (onlyFavorites ? p.is_favorite : true))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit);
}

export async function addPosts(rows: NewPost[], userId?: string | null): Promise<string[]> {
  if (!rows.length) return [];
  const owner = scope(userId);
  const now = new Date().toISOString();

  if (storageMode === 'cloud' && supabase && userId) {
    const payload = rows.map((row) => ({
      ...row,
      user_id: userId,
      is_favorite: false,
      created_at: now,
      updated_at: now,
    }));
    const { data, error } = await supabase.from('posts').insert(payload).select('id');
    if (error) throw error;
    return (data ?? []).map((r) => r.id);
  }

  const created: Post[] = rows.map((row) => ({
    ...row,
    id: uuid(),
    user_id: owner,
    is_favorite: false,
    template_id: row.template_id ?? null,
    created_at: now,
    updated_at: now,
  }));
  saveLocalPosts([...created, ...localPosts()].slice(0, MAX_LOCAL_POSTS));
  return created.map((p) => p.id);
}

export async function setFavorite(
  postId: string,
  isFavorite: boolean,
  userId?: string | null,
): Promise<void> {
  if (storageMode === 'cloud' && supabase && userId) {
    const { error } = await supabase
      .from('posts')
      .update({ is_favorite: isFavorite, updated_at: new Date().toISOString() })
      .eq('id', postId)
      .eq('user_id', userId);
    if (error) throw error;
    return;
  }

  saveLocalPosts(
    localPosts().map((p) =>
      p.id === postId ? { ...p, is_favorite: isFavorite, updated_at: new Date().toISOString() } : p,
    ),
  );
}

export async function deletePost(postId: string, userId?: string | null): Promise<void> {
  if (storageMode === 'cloud' && supabase && userId) {
    const { error } = await supabase.from('posts').delete().eq('id', postId).eq('user_id', userId);
    if (error) throw error;
    return;
  }
  saveLocalPosts(localPosts().filter((p) => p.id !== postId));
}

export async function clearHistory(userId?: string | null): Promise<void> {
  if (storageMode === 'cloud' && supabase && userId) {
    const { error } = await supabase.from('posts').delete().eq('user_id', userId);
    if (error) throw error;
    return;
  }
  const owner = scope(userId);
  saveLocalPosts(localPosts().filter((p) => p.user_id !== owner));
}

/* -------------------------------- analytics --------------------------------- */

export function weekStartOf(date = new Date()): string {
  const start = new Date(date);
  start.setDate(start.getDate() - start.getDay());
  return start.toISOString().split('T')[0];
}

export async function listAnalytics(
  userId?: string | null,
  weeks = 12,
): Promise<Analytics[]> {
  if (storageMode === 'cloud' && supabase && userId) {
    const { data, error } = await supabase
      .from('analytics')
      .select('*')
      .eq('user_id', userId)
      .order('week_start', { ascending: false })
      .limit(weeks);
    if (error) throw error;
    return data ?? [];
  }

  const owner = scope(userId);
  return localAnalytics()
    .filter((a) => a.user_id === owner)
    .sort((a, b) => b.week_start.localeCompare(a.week_start))
    .slice(0, weeks);
}

/** Records one generation run. Never throws - analytics must not break the app. */
export async function recordGeneration(input: {
  userId?: string | null;
  platforms: string[];
  tones: string[];
  count: number;
}): Promise<void> {
  try {
    const owner = scope(input.userId);
    const weekStart = weekStartOf();

    if (storageMode === 'cloud' && supabase && input.userId) {
      const { data: existing } = await supabase
        .from('analytics')
        .select('*')
        .eq('user_id', input.userId)
        .eq('week_start', weekStart)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('analytics')
          .update({
            posts_generated: existing.posts_generated + input.count,
            platforms_used: [...new Set([...(existing.platforms_used ?? []), ...input.platforms])],
            tones_used: [...new Set([...(existing.tones_used ?? []), ...input.tones])],
          })
          .eq('id', existing.id);
      } else {
        await supabase.from('analytics').insert({
          user_id: input.userId,
          week_start: weekStart,
          posts_generated: input.count,
          platforms_used: input.platforms,
          tones_used: input.tones,
        });
      }
      return;
    }

    const rows = localAnalytics();
    const existing = rows.find((a) => a.user_id === owner && a.week_start === weekStart);

    if (existing) {
      existing.posts_generated += input.count;
      existing.platforms_used = [...new Set([...(existing.platforms_used ?? []), ...input.platforms])];
      existing.tones_used = [...new Set([...(existing.tones_used ?? []), ...input.tones])];
    } else {
      rows.push({
        id: uuid(),
        user_id: owner,
        week_start: weekStart,
        posts_generated: input.count,
        platforms_used: input.platforms,
        tones_used: input.tones,
        templates_used: 0,
        created_at: new Date().toISOString(),
      });
    }
    saveLocalAnalytics(rows);
  } catch (err) {
    console.warn('[store] Could not record analytics', err);
  }
}

/* ---------------------------------- profile --------------------------------- */

const PROFILE_KEY = 'smr:profile:v1';

export function loadLocalProfile() {
  return readLocal<Record<string, unknown> | null>(PROFILE_KEY, null);
}

export function saveLocalProfile(profile: Record<string, unknown>) {
  writeLocal(PROFILE_KEY, profile);
}
