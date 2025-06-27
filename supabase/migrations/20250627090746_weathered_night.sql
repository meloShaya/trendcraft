/*
  # Complete TrendCraft Database Schema (Fixed)

  This schema has been corrected to resolve the "generation expression is not immutable" error.
  The fix involves explicitly setting the timezone to 'UTC' when generating the `collection_date`
  column in the `post_analytics` table.

  1. New Tables
     - `users` - Core user accounts with profile information
     - `user_social_accounts` - Connected social media accounts for publishing
     - `user_auth_providers` - Social authentication providers used by users
     - `trends` - Cached trending topics from various platforms
     - `trend_contexts` - Firecrawl search context data for trends
     - `posts` - User-generated content posts
     - `post_analytics` - Performance metrics for published posts
     - `user_streaks` - Daily posting streak tracking
     - `user_settings` - User preferences and notification settings
     - `api_usage_logs` - API usage tracking for rate limiting and billing

  2. Security
     - Enable RLS on all tables
     - Add policies for user data access
     - Service role policies for system operations

  3. Performance
     - Strategic indexes for common queries
     - Automatic cleanup functions for expired data
     - Analytics views for dashboard insights
*/

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================
-- USERS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  username text UNIQUE NOT NULL,
  full_name text,
  avatar_url text,
  bio text,
  is_active boolean DEFAULT true,
  is_premium boolean DEFAULT false,
  last_login_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Users can read and update their own data
CREATE POLICY "Users can read own data" ON users
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own data" ON users
  FOR UPDATE TO authenticated
  USING (auth.uid() = id);

-- =============================================
-- USER SOCIAL ACCOUNTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS user_social_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  platform text NOT NULL CHECK (platform IN ('twitter', 'instagram', 'facebook', 'linkedin', 'tiktok', 'youtube')),
  platform_user_id text NOT NULL,
  platform_username text NOT NULL,
  platform_display_name text,
  access_token text, -- Encrypted in production
  refresh_token text, -- Encrypted in production
  token_expires_at timestamptz,
  follower_count integer DEFAULT 0,
  following_count integer DEFAULT 0,
  is_connected boolean DEFAULT true,
  last_sync_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(user_id, platform)
);

-- Enable RLS
ALTER TABLE user_social_accounts ENABLE ROW LEVEL SECURITY;

-- Users can manage their own social accounts
CREATE POLICY "Users can manage own social accounts" ON user_social_accounts
  FOR ALL TO authenticated
  USING (user_id = auth.uid());

-- =============================================
-- USER AUTH PROVIDERS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS user_auth_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  provider text NOT NULL CHECK (provider IN ('email', 'google', 'github', 'facebook', 'twitter')),
  provider_user_id text NOT NULL,
  provider_email text,
  is_primary boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  
  UNIQUE(user_id, provider),
  UNIQUE(provider, provider_user_id)
);

-- Enable RLS
ALTER TABLE user_auth_providers ENABLE ROW LEVEL SECURITY;

-- Users can read their own auth providers
CREATE POLICY "Users can read own auth providers" ON user_auth_providers
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- =============================================
-- TRENDS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS trends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword text NOT NULL,
  platform text NOT NULL CHECK (platform IN ('twitter', 'instagram', 'facebook', 'linkedin', 'tiktok', 'youtube')),
  location_woeid text NOT NULL DEFAULT '1',
  location_name text NOT NULL DEFAULT 'Worldwide',
  category text DEFAULT 'General',
  trend_score integer DEFAULT 50 CHECK (trend_score >= 0 AND trend_score <= 100),
  volume integer DEFAULT 0,
  growth_percentage text DEFAULT '+0%',
  related_hashtags text[] DEFAULT '{}',
  peak_time text DEFAULT '14:00-16:00 UTC',
  demographics jsonb DEFAULT '{"age": "18-34", "interests": []}',
  api_data jsonb, -- Store raw API response
  expires_at timestamptz DEFAULT (now() + interval '2 hours'),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(keyword, platform, location_woeid)
);

-- Enable RLS
ALTER TABLE trends ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read trends
CREATE POLICY "Authenticated users can read trends" ON trends
  FOR SELECT TO authenticated
  USING (true);

-- Only system can insert/update trends (via service role)
CREATE POLICY "Service role can manage trends" ON trends
  FOR ALL TO service_role
  USING (true);

-- Index for efficient querying
CREATE INDEX IF NOT EXISTS idx_trends_platform_location ON trends(platform, location_woeid);
CREATE INDEX IF NOT EXISTS idx_trends_expires_at ON trends(expires_at);
CREATE INDEX IF NOT EXISTS idx_trends_keyword ON trends(keyword);

-- =============================================
-- TREND CONTEXTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS trend_contexts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trend_id uuid REFERENCES trends(id) ON DELETE CASCADE,
  topic text NOT NULL,
  location_name text NOT NULL,
  search_query text NOT NULL,
  sources jsonb DEFAULT '[]', -- Array of source objects from Firecrawl
  firecrawl_data jsonb, -- Raw Firecrawl response
  expires_at timestamptz DEFAULT (now() + interval '2 hours'),
  created_at timestamptz DEFAULT now(),
  
  UNIQUE(topic, location_name)
);

-- Enable RLS
ALTER TABLE trend_contexts ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read trend contexts
CREATE POLICY "Authenticated users can read trend contexts" ON trend_contexts
  FOR SELECT TO authenticated
  USING (true);

-- Only system can manage trend contexts
CREATE POLICY "Service role can manage trend contexts" ON trend_contexts
  FOR ALL TO service_role
  USING (true);

-- Index for efficient querying
CREATE INDEX IF NOT EXISTS idx_trend_contexts_topic_location ON trend_contexts(topic, location_name);
CREATE INDEX IF NOT EXISTS idx_trend_contexts_expires_at ON trend_contexts(expires_at);

-- =============================================
-- POSTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  content text NOT NULL,
  platform text NOT NULL CHECK (platform IN ('twitter', 'instagram', 'facebook', 'linkedin', 'tiktok', 'youtube')),
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'published', 'failed')),
  viral_score integer DEFAULT 50 CHECK (viral_score >= 0 AND viral_score <= 100),
  hashtags text[] DEFAULT '{}',
  target_audience text,
  tone text DEFAULT 'professional' CHECK (tone IN ('professional', 'casual', 'humorous', 'inspirational')),
  
  -- AI generation metadata
  trend_analysis text,
  context_data jsonb,
  ai_recommendations jsonb,
  
  -- Scheduling
  scheduled_for timestamptz,
  published_at timestamptz,
  
  -- Social media post IDs (when published)
  platform_post_ids jsonb DEFAULT '{}',
  
  -- Media attachments
  media_urls text[] DEFAULT '{}',
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Users can manage their own posts
CREATE POLICY "Users can manage own posts" ON posts
  FOR ALL TO authenticated
  USING (user_id = auth.uid());

-- Index for efficient querying
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_scheduled_for ON posts(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_posts_platform ON posts(platform);

-- =============================================
-- POST ANALYTICS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS post_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  platform text NOT NULL,
  
  -- Engagement metrics
  likes_count integer DEFAULT 0,
  comments_count integer DEFAULT 0,
  shares_count integer DEFAULT 0,
  retweets_count integer DEFAULT 0,
  saves_count integer DEFAULT 0,
  
  -- Reach metrics
  impressions integer DEFAULT 0,
  reach integer DEFAULT 0,
  click_through_rate decimal(5,2) DEFAULT 0.00,
  engagement_rate decimal(5,2) DEFAULT 0.00,
  
  -- Platform-specific metrics
  platform_metrics jsonb DEFAULT '{}',
  
  -- Data collection timestamp
  collected_at timestamptz DEFAULT now(),
  -- CORRECTED: Explicitly cast to date at a fixed timezone ('utc') to ensure immutability.
  collection_date date GENERATED ALWAYS AS (CAST(timezone('utc', collected_at) AS date)) STORED,
  created_at timestamptz DEFAULT now()
);

-- Add unique constraint using the generated column
ALTER TABLE post_analytics ADD CONSTRAINT unique_post_analytics_daily  
  UNIQUE(post_id, platform, collection_date);

-- Enable RLS
ALTER TABLE post_analytics ENABLE ROW LEVEL SECURITY;

-- Users can read analytics for their own posts
CREATE POLICY "Users can read own post analytics" ON post_analytics
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM posts 
      WHERE posts.id = post_analytics.post_id 
      AND posts.user_id = auth.uid()
    )
  );

-- Only system can insert analytics data
CREATE POLICY "Service role can manage analytics" ON post_analytics
  FOR INSERT TO service_role
  WITH CHECK (true);

-- Index for efficient querying
CREATE INDEX IF NOT EXISTS idx_post_analytics_post_id ON post_analytics(post_id);
CREATE INDEX IF NOT EXISTS idx_post_analytics_collected_at ON post_analytics(collected_at);
CREATE INDEX IF NOT EXISTS idx_post_analytics_collection_date ON post_analytics(collection_date);

-- =============================================
-- USER STREAKS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS user_streaks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  date date NOT NULL,
  posted boolean DEFAULT false,
  post_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  
  UNIQUE(user_id, date)
);

-- Enable RLS
ALTER TABLE user_streaks ENABLE ROW LEVEL SECURITY;

-- Users can manage their own streak data
CREATE POLICY "Users can manage own streaks" ON user_streaks
  FOR ALL TO authenticated
  USING (user_id = auth.uid());

-- Index for efficient querying
CREATE INDEX IF NOT EXISTS idx_user_streaks_user_date ON user_streaks(user_id, date);

-- =============================================
-- USER SETTINGS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS user_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  
  -- Notification preferences
  email_notifications boolean DEFAULT true,
  push_notifications boolean DEFAULT true,
  trend_alerts boolean DEFAULT true,
  performance_reports boolean DEFAULT true,
  
  -- UI preferences
  theme text DEFAULT 'light' CHECK (theme IN ('light', 'dark', 'system')),
  language text DEFAULT 'en',
  timezone text DEFAULT 'UTC',
  
  -- Content preferences
  default_platform text DEFAULT 'twitter',
  default_tone text DEFAULT 'professional',
  preferred_hashtag_count integer DEFAULT 3,
  
  -- Privacy settings
  profile_public boolean DEFAULT false,
  analytics_sharing boolean DEFAULT false,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Users can manage their own settings
CREATE POLICY "Users can manage own settings" ON user_settings
  FOR ALL TO authenticated
  USING (user_id = auth.uid());

-- =============================================
-- API USAGE LOGS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS api_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  api_endpoint text NOT NULL,
  api_provider text, -- 'rapidapi', 'firecrawl', 'gemini', 'elevenlabs'
  request_count integer DEFAULT 1,
  tokens_used integer DEFAULT 0,
  cost_cents integer DEFAULT 0, -- Cost in cents
  date date DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now(),
  
  UNIQUE(user_id, api_endpoint, api_provider, date)
);

-- Enable RLS
ALTER TABLE api_usage_logs ENABLE ROW LEVEL SECURITY;

-- Users can read their own usage logs
CREATE POLICY "Users can read own usage logs" ON api_usage_logs
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Only system can insert usage logs
CREATE POLICY "Service role can manage usage logs" ON api_usage_logs
  FOR INSERT TO service_role
  WITH CHECK (true);

-- Index for efficient querying
CREATE INDEX IF NOT EXISTS idx_api_usage_user_date ON api_usage_logs(user_id, date);
CREATE INDEX IF NOT EXISTS idx_api_usage_provider ON api_usage_logs(api_provider);

-- =============================================
-- FUNCTIONS AND TRIGGERS
-- =============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers to relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_social_accounts_updated_at BEFORE UPDATE ON user_social_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trends_updated_at BEFORE UPDATE ON trends
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_posts_updated_at BEFORE UPDATE ON posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON user_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to clean up expired data
CREATE OR REPLACE FUNCTION cleanup_expired_data()
RETURNS void AS $$
BEGIN
  -- Delete expired trends
  DELETE FROM trends WHERE expires_at < now();
  
  -- Delete expired trend contexts
  DELETE FROM trend_contexts WHERE expires_at < now();
  
  -- Delete old API usage logs (keep 90 days)
  DELETE FROM api_usage_logs WHERE date < CURRENT_DATE - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- VIEWS FOR ANALYTICS
-- =============================================

-- View for user analytics summary
CREATE OR REPLACE VIEW user_analytics_summary AS
SELECT 
  u.id as user_id,
  u.username,
  COUNT(p.id) as total_posts,
  COUNT(CASE WHEN p.status = 'published' THEN 1 END) as published_posts,
  COUNT(CASE WHEN p.status = 'scheduled' THEN 1 END) as scheduled_posts,
  AVG(p.viral_score) as avg_viral_score,
  COALESCE(SUM(pa.likes_count), 0) as total_likes,
  COALESCE(SUM(pa.comments_count), 0) as total_comments,
  COALESCE(SUM(pa.shares_count), 0) as total_shares,
  COALESCE(SUM(pa.impressions), 0) as total_impressions
FROM users u
LEFT JOIN posts p ON u.id = p.user_id
LEFT JOIN post_analytics pa ON p.id = pa.post_id
GROUP BY u.id, u.username;

-- View for trending topics summary
CREATE OR REPLACE VIEW trending_summary AS
SELECT 
  platform,
  location_name,
  COUNT(*) as trend_count,
  AVG(trend_score) as avg_trend_score,
  MAX(created_at) as last_updated
FROM trends 
WHERE expires_at > now()
GROUP BY platform, location_name
ORDER BY platform, location_name;
