/*
  # Add INSERT policy for users table

  1. Security Changes
    - Add INSERT policy for `users` table to allow authenticated users to create their own profile
    - This fixes the "new row violates row-level security policy" error (403)
    - Policy ensures users can only insert rows where the id matches their auth.uid()

  2. Policy Details
    - Policy name: "Users can insert own data"
    - Applies to: INSERT operations
    - Target: authenticated users
    - Condition: auth.uid() = id (users can only create their own profile)
*/

-- Add INSERT policy for users table
CREATE POLICY "Users can insert own data"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);