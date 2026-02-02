-- =====================================================
-- FIX STORIES RLS POLICIES
-- Run this in Supabase SQL Editor to fix story visibility
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view stories from people they follow or their own" ON stories;
DROP POLICY IF EXISTS "Users can view stories" ON stories;
DROP POLICY IF EXISTS "Users can create their own stories" ON stories;
DROP POLICY IF EXISTS "Users can delete their own stories" ON stories;

-- Create new policies
-- Users can view their own stories OR stories from people they follow
CREATE POLICY "Users can view stories"
ON stories FOR SELECT
USING (
  user_id = auth.uid() 
  OR 
  user_id IN (
    SELECT following_id FROM follows WHERE follower_id = auth.uid()
  )
);

CREATE POLICY "Users can create their own stories"
ON stories FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own stories"
ON stories FOR DELETE
USING (user_id = auth.uid());

-- Also update story_views policies
DROP POLICY IF EXISTS "Story owner can view who watched" ON story_views;
DROP POLICY IF EXISTS "Users can record their views" ON story_views;

CREATE POLICY "Story owner can view who watched"
ON story_views FOR SELECT
USING (
  story_id IN (SELECT id FROM stories WHERE user_id = auth.uid())
  OR viewer_id = auth.uid()
);

CREATE POLICY "Users can record their views"
ON story_views FOR INSERT
WITH CHECK (viewer_id = auth.uid());

-- =====================================================
-- TEST: Check if you can see stories
-- =====================================================
-- SELECT * FROM stories WHERE user_id = auth.uid();
