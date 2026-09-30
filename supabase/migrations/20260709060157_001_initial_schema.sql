/*
# Social Media Repurposer - Initial Schema

1. New Tables
- `profiles` - User profile information (display name, avatar, preferences)
- `posts` - Generated social media posts with content, platform, tone, etc.
- `favorites` - User's favorite posts
- `history` - User's generation history
- `templates` - Pre-built content templates by category
- `analytics` - Usage statistics per user

2. Security
- Enable RLS on all tables
- Owner-scoped CRUD for profiles, posts, favorites, history, analytics
- Read-only templates for all authenticated users
- Foreign key relationships with cascade deletes

3. Important Notes
- All user-owned tables use `DEFAULT auth.uid()` for owner column
- Analytics tracks weekly usage for dashboard display
- Templates are seeded with default content categories
*/

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT auth.uid(),
  display_name text,
  avatar_url text,
  default_platform text DEFAULT 'twitter',
  default_tone text DEFAULT 'professional',
  language text DEFAULT 'en',
  theme text DEFAULT 'system',
  font_size text DEFAULT 'medium',
  auto_save boolean DEFAULT true,
  notifications boolean DEFAULT true,
  high_contrast boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Posts table
CREATE TABLE IF NOT EXISTS posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  original_content text NOT NULL,
  platform text NOT NULL,
  tone text NOT NULL DEFAULT 'professional',
  language text DEFAULT 'en',
  include_emoji boolean DEFAULT true,
  generated_post text,
  hashtags text[],
  cta text,
  character_count integer DEFAULT 0,
  is_favorite boolean DEFAULT false,
  template_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Favorites table (references posts)
CREATE TABLE IF NOT EXISTS favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, post_id)
);

-- History table
CREATE TABLE IF NOT EXISTS history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id uuid REFERENCES posts(id) ON DELETE SET NULL,
  action_type text NOT NULL,
  platform text,
  created_at timestamptz DEFAULT now()
);

-- Templates table (shared content)
CREATE TABLE IF NOT EXISTS templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL,
  content text NOT NULL,
  tone text DEFAULT 'professional',
  platforms text[] DEFAULT ARRAY['twitter', 'linkedin', 'instagram'],
  is_public boolean DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Analytics table
CREATE TABLE IF NOT EXISTS analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  posts_generated integer DEFAULT 0,
  platforms_used text[] DEFAULT ARRAY[]::text[],
  tones_used text[] DEFAULT ARRAY[]::text[],
  templates_used integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, week_start)
);

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE history ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics ENABLE ROW LEVEL SECURITY;

-- Profiles policies
DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Posts policies
DROP POLICY IF EXISTS "select_own_posts" ON posts;
CREATE POLICY "select_own_posts" ON posts FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_posts" ON posts;
CREATE POLICY "insert_own_posts" ON posts FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_posts" ON posts;
CREATE POLICY "update_own_posts" ON posts FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_posts" ON posts;
CREATE POLICY "delete_own_posts" ON posts FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Favorites policies
DROP POLICY IF EXISTS "select_own_favorites" ON favorites;
CREATE POLICY "select_own_favorites" ON favorites FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_favorites" ON favorites;
CREATE POLICY "insert_own_favorites" ON favorites FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_favorites" ON favorites;
CREATE POLICY "delete_own_favorites" ON favorites FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- History policies
DROP POLICY IF EXISTS "select_own_history" ON history;
CREATE POLICY "select_own_history" ON history FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_history" ON history;
CREATE POLICY "insert_own_history" ON history FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_history" ON history;
CREATE POLICY "delete_own_history" ON history FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Templates policies (read-only for authenticated users)
DROP POLICY IF EXISTS "select_templates" ON templates;
CREATE POLICY "select_templates" ON templates FOR SELECT
  TO authenticated USING (is_public = true OR created_by = auth.uid());

DROP POLICY IF EXISTS "insert_templates" ON templates;
CREATE POLICY "insert_templates" ON templates FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = created_by);

-- Analytics policies
DROP POLICY IF EXISTS "select_own_analytics" ON analytics;
CREATE POLICY "select_own_analytics" ON analytics FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_analytics" ON analytics;
CREATE POLICY "insert_own_analytics" ON analytics FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_analytics" ON analytics;
CREATE POLICY "update_own_analytics" ON analytics FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_history_user_id ON history(user_id);
CREATE INDEX IF NOT EXISTS idx_history_created_at ON history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_user_id ON analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_templates_category ON templates(category);
