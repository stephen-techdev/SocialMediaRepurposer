/**
 * Persistence layer.
 *
 * There are no accounts, so this is localStorage only. Supabase used to back
 * the store whenever somebody was signed in; those branches were removed along
 * with sign-in, since nothing could ever supply a user id. Every row belongs to
 * the single `local` owner.
 */
import type { Analytics, Post } from './supabase';

const POSTS_KEY = 'smr:posts:v1';
const ANALYTICS_KEY = 'smr:analytics:v1';
const PROFILE_KEY = 'smr:profile:v1';
const LOCAL_USER = 'local';
const MAX_LOCAL_POSTS = 300;

/** Always 'local'. Kept so the UI can keep stating where the data lives. */
export const storageMode: 'cloud' | 'local' = 'local';

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

/** Every row belongs to the single local owner, so this collapses to a constant. */
const scope = () => LOCAL_USER;

/* ---------------------------------- posts ----------------------------------- */

export async function listPosts(
  options: { onlyFavorites?: boolean; limit?: number } = {},
): Promise<Post[]> {
  const { onlyFavorites = false, limit = 100 } = options;
  const owner = scope();

  return localPosts()
    .filter((p) => p.user_id === owner)
    .filter((p) => (onlyFavorites ? p.is_favorite : true))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit);
}

export async function addPosts(rows: NewPost[]): Promise<string[]> {
  if (!rows.length) return [];
  const owner = scope();
  const now = new Date().toISOString();

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

export async function setFavorite(postId: string, isFavorite: boolean): Promise<void> {
  saveLocalPosts(
    localPosts().map((p) =>
      p.id === postId ? { ...p, is_favorite: isFavorite, updated_at: new Date().toISOString() } : p,
    ),
  );
}

export async function deletePost(postId: string): Promise<void> {
  saveLocalPosts(localPosts().filter((p) => p.id !== postId));
}

export async function clearHistory(): Promise<void> {
  const owner = scope();
  saveLocalPosts(localPosts().filter((p) => p.user_id !== owner));
}

/* -------------------------------- analytics --------------------------------- */

export function weekStartOf(date = new Date()): string {
  const start = new Date(date);
  start.setDate(start.getDate() - start.getDay());
  return start.toISOString().split('T')[0];
}

export async function listAnalytics(weeks = 12): Promise<Analytics[]> {
  const owner = scope();
  return localAnalytics()
    .filter((a) => a.user_id === owner)
    .sort((a, b) => b.week_start.localeCompare(a.week_start))
    .slice(0, weeks);
}

/** Records one generation run. Never throws - analytics must not break the app. */
export async function recordGeneration(input: {
  platforms: string[];
  tones: string[];
  count: number;
}): Promise<void> {
  try {
    const owner = scope();
    const weekStart = weekStartOf();

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

export function loadLocalProfile() {
  return readLocal<Record<string, unknown> | null>(PROFILE_KEY, null);
}

export function saveLocalProfile(profile: Record<string, unknown>) {
  writeLocal(PROFILE_KEY, profile);
}
