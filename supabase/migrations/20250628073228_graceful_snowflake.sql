/*
  # Fix Row Level Security Policies

  This migration fixes the RLS policies that are causing authentication issues.
  The main problem is that some policies are using auth.uid() which may not work
  correctly in all contexts. We'll update them to be more robust.

  1. Fix user table policies
  2. Fix trends table policies  
  3. Fix posts table policies
  4. Add missing policies for better data access
*/

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can read own data" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;

-- Create better user policies
CREATE POLICY "Users can read own data" ON users
  FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users can update own data" ON users
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Allow users to insert their own data (for registration)
CREATE POLICY "Users can insert own data" ON users
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- Fix trends policies - make them more permissive for authenticated users
DROP POLICY IF EXISTS "Authenticated users can read trends" ON trends;
CREATE POLICY "Authenticated users can read trends" ON trends
  FOR SELECT TO authenticated
  USING (true);

-- Fix posts policies
DROP POLICY IF EXISTS "Users can manage own posts" ON posts;

CREATE POLICY "Users can read own posts" ON posts
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own posts" ON posts
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own posts" ON posts
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own posts" ON posts
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Fix user_social_accounts policies
DROP POLICY IF EXISTS "Users can manage own social accounts" ON user_social_accounts;

CREATE POLICY "Users can read own social accounts" ON user_social_accounts
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own social accounts" ON user_social_accounts
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own social accounts" ON user_social_accounts
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own social accounts" ON user_social_accounts
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Fix user_streaks policies
DROP POLICY IF EXISTS "Users can manage own streaks" ON user_streaks;

CREATE POLICY "Users can read own streaks" ON user_streaks
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own streaks" ON user_streaks
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own streaks" ON user_streaks
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Fix user_settings policies
DROP POLICY IF EXISTS "Users can manage own settings" ON user_settings;

CREATE POLICY "Users can read own settings" ON user_settings
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own settings" ON user_settings
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own settings" ON user_settings
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Allow public read access to trends and trend_contexts for better UX
-- Users shouldn't be logged out just because they can't access trends
ALTER TABLE trends DISABLE ROW LEVEL SECURITY;
ALTER TABLE trend_contexts DISABLE ROW LEVEL SECURITY;

-- Re-enable with more permissive policies
ALTER TABLE trends ENABLE ROW LEVEL SECURITY;
ALTER TABLE trend_contexts ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read trends
CREATE POLICY "Allow authenticated users to read trends" ON trends
  FOR SELECT TO authenticated
  USING (true);

-- Allow service role to manage trends
CREATE POLICY "Service role can manage trends" ON trends
  FOR ALL TO service_role
  USING (true);

-- Allow all authenticated users to read trend contexts
CREATE POLICY "Allow authenticated users to read trend contexts" ON trend_contexts
  FOR SELECT TO authenticated
  USING (true);

-- Allow service role to manage trend contexts
CREATE POLICY "Service role can manage trend contexts" ON trend_contexts
  FOR ALL TO service_role
  USING (true);