-- =====================================================
-- NEW FEATURES DATABASE SETUP
-- Run this in Supabase SQL Editor
-- =====================================================

-- 1. STORIES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  media_url TEXT NOT NULL,
  media_type TEXT NOT NULL DEFAULT 'image' CHECK (media_type IN ('image', 'video')),
  caption TEXT,
  views_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours')
);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_stories_user ON stories(user_id);
CREATE INDEX IF NOT EXISTS idx_stories_expires ON stories(expires_at);

-- RLS for stories
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view stories from people they follow or their own"
ON stories FOR SELECT
USING (
  user_id = auth.uid() OR
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

-- 2. STORY VIEWS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS story_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  viewer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(story_id, viewer_id)
);

CREATE INDEX IF NOT EXISTS idx_story_views_story ON story_views(story_id);

ALTER TABLE story_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Story owner can view who watched"
ON story_views FOR SELECT
USING (
  story_id IN (SELECT id FROM stories WHERE user_id = auth.uid())
);

CREATE POLICY "Users can record their views"
ON story_views FOR INSERT
WITH CHECK (viewer_id = auth.uid());

-- 3. BLOCKS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(blocker_id, blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_blocks_blocker ON blocks(blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocks_blocked ON blocks(blocked_id);

ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own blocks"
ON blocks FOR SELECT
USING (blocker_id = auth.uid());

CREATE POLICY "Users can block others"
ON blocks FOR INSERT
WITH CHECK (blocker_id = auth.uid());

CREATE POLICY "Users can unblock"
ON blocks FOR DELETE
USING (blocker_id = auth.uid());

-- 4. MESSAGE DELETIONS TABLE (for delete for me)
-- =====================================================
CREATE TABLE IF NOT EXISTS message_deletions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  deleted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_message_deletions_user ON message_deletions(user_id);

ALTER TABLE message_deletions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see their deletions"
ON message_deletions FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can delete messages for themselves"
ON message_deletions FOR INSERT
WITH CHECK (user_id = auth.uid());

-- 5. ADD deleted_for_everyone TO MESSAGES
-- =====================================================
ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_for_everyone BOOLEAN DEFAULT FALSE;

-- 6. CHAT DELETIONS TABLE (delete entire chat)
-- =====================================================
CREATE TABLE IF NOT EXISTS chat_deletions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  other_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  deleted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, other_user_id)
);

ALTER TABLE chat_deletions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their chat deletions"
ON chat_deletions FOR ALL
USING (user_id = auth.uid());

-- 7. FUNCTION TO AUTO-DELETE EXPIRED STORIES
-- =====================================================
CREATE OR REPLACE FUNCTION delete_expired_stories()
RETURNS void AS $$
BEGIN
  DELETE FROM stories WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- 8. UPDATE PROFILES TABLE FOR MORE SETTINGS
-- =====================================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS show_online_status BOOLEAN DEFAULT TRUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS allow_messages_from TEXT DEFAULT 'everyone' CHECK (allow_messages_from IN ('everyone', 'followers', 'nobody'));

-- 9. ENABLE REALTIME FOR NEW TABLES
-- =====================================================
ALTER PUBLICATION supabase_realtime ADD TABLE stories;
ALTER PUBLICATION supabase_realtime ADD TABLE story_views;

-- =====================================================
-- RUN THIS AFTER CREATING TABLES
-- =====================================================
-- To auto-delete expired stories, set up a cron job in Supabase:
-- Go to Database > Extensions > Enable pg_cron
-- Then run:
-- SELECT cron.schedule('delete-expired-stories', '*/5 * * * *', 'SELECT delete_expired_stories()');
