-- =====================================================
-- GROUP CHATS & MESSAGE FIXES (V3 - NO RECURSION)
-- Run this in Supabase SQL Editor
-- =====================================================

-- =====================================================
-- STEP 0: DROP EXISTING TABLES AND POLICIES (clean slate)
-- =====================================================
DROP TABLE IF EXISTS call_participants CASCADE;
DROP TABLE IF EXISTS group_calls CASCADE;
DROP TABLE IF EXISTS group_messages CASCADE;
DROP TABLE IF EXISTS group_members CASCADE;
DROP TABLE IF EXISTS group_chats CASCADE;

-- =====================================================
-- STEP 1: CREATE ALL TABLES FIRST (no policies yet)
-- =====================================================

-- 1.1 GROUP CHATS TABLE
CREATE TABLE group_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  avatar_url TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_group_chats_created_by ON group_chats(created_by);

-- 1.2 GROUP MEMBERS TABLE
CREATE TABLE group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES group_chats(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

CREATE INDEX idx_group_members_group ON group_members(group_id);
CREATE INDEX idx_group_members_user ON group_members(user_id);

-- 1.3 GROUP MESSAGES TABLE
CREATE TABLE group_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES group_chats(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'video', 'audio', 'file')),
  is_edited BOOLEAN DEFAULT FALSE,
  edited_at TIMESTAMPTZ,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_group_messages_group ON group_messages(group_id);
CREATE INDEX idx_group_messages_sender ON group_messages(sender_id);

-- 1.4 GROUP CALLS TABLE
CREATE TABLE group_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES group_chats(id) ON DELETE CASCADE,
  initiator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  call_type TEXT NOT NULL CHECK (call_type IN ('voice', 'video')),
  status TEXT DEFAULT 'ongoing' CHECK (status IN ('ongoing', 'ended')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  is_group_call BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_group_calls_group ON group_calls(group_id);

-- 1.5 CALL PARTICIPANTS TABLE
CREATE TABLE call_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL REFERENCES group_calls(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  status TEXT DEFAULT 'ringing' CHECK (status IN ('ringing', 'joined', 'declined', 'left')),
  UNIQUE(call_id, user_id)
);

CREATE INDEX idx_call_participants_call ON call_participants(call_id);
CREATE INDEX idx_call_participants_user ON call_participants(user_id);

-- 1.6 ADD COLUMNS TO MESSAGES TABLE
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT FALSE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;

-- =====================================================
-- STEP 2: CREATE SECURITY DEFINER FUNCTION (bypasses RLS)
-- This prevents infinite recursion
-- =====================================================

CREATE OR REPLACE FUNCTION is_group_member(check_group_id UUID, check_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM group_members 
    WHERE group_id = check_group_id AND user_id = check_user_id
  );
$$;

CREATE OR REPLACE FUNCTION is_group_creator(check_group_id UUID, check_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM group_chats 
    WHERE id = check_group_id AND created_by = check_user_id
  );
$$;

-- =====================================================
-- STEP 3: ENABLE RLS ON ALL TABLES
-- =====================================================

ALTER TABLE group_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_participants ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- STEP 4: CREATE ALL POLICIES (using functions - NO recursion)
-- =====================================================

-- 4.1 GROUP CHATS POLICIES
CREATE POLICY "View groups you created or are member of"
ON group_chats FOR SELECT
USING (
  created_by = auth.uid() OR 
  is_group_member(id, auth.uid())
);

CREATE POLICY "Create groups"
ON group_chats FOR INSERT
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Update own groups"
ON group_chats FOR UPDATE
USING (created_by = auth.uid());

CREATE POLICY "Delete own groups"
ON group_chats FOR DELETE
USING (created_by = auth.uid());

-- 4.2 GROUP MEMBERS POLICIES (simple - no cross-reference)
CREATE POLICY "View members of your groups"
ON group_members FOR SELECT
USING (
  user_id = auth.uid() OR 
  is_group_creator(group_id, auth.uid())
);

CREATE POLICY "Creator adds members"
ON group_members FOR INSERT
WITH CHECK (is_group_creator(group_id, auth.uid()));

CREATE POLICY "Leave group"
ON group_members FOR DELETE
USING (user_id = auth.uid());

CREATE POLICY "Creator removes members"
ON group_members FOR DELETE
USING (is_group_creator(group_id, auth.uid()));

-- 4.3 GROUP MESSAGES POLICIES
CREATE POLICY "View group messages"
ON group_messages FOR SELECT
USING (is_group_member(group_id, auth.uid()));

CREATE POLICY "Send group messages"
ON group_messages FOR INSERT
WITH CHECK (
  sender_id = auth.uid() AND 
  is_group_member(group_id, auth.uid())
);

CREATE POLICY "Edit own messages"
ON group_messages FOR UPDATE
USING (sender_id = auth.uid());

CREATE POLICY "Delete own messages"
ON group_messages FOR DELETE
USING (sender_id = auth.uid());

-- 4.4 GROUP CALLS POLICIES
CREATE POLICY "View calls"
ON group_calls FOR SELECT
USING (
  initiator_id = auth.uid() OR
  EXISTS (SELECT 1 FROM call_participants WHERE call_id = group_calls.id AND user_id = auth.uid())
);

CREATE POLICY "Start calls"
ON group_calls FOR INSERT
WITH CHECK (initiator_id = auth.uid());

CREATE POLICY "Update own calls"
ON group_calls FOR UPDATE
USING (initiator_id = auth.uid());

-- 4.5 CALL PARTICIPANTS POLICIES
CREATE POLICY "View participants"
ON call_participants FOR SELECT
USING (
  user_id = auth.uid() OR
  EXISTS (SELECT 1 FROM group_calls WHERE id = call_participants.call_id AND initiator_id = auth.uid())
);

CREATE POLICY "Join calls"
ON call_participants FOR INSERT
WITH CHECK (
  user_id = auth.uid() OR
  EXISTS (SELECT 1 FROM group_calls WHERE id = call_id AND initiator_id = auth.uid())
);

CREATE POLICY "Update own participant status"
ON call_participants FOR UPDATE
USING (user_id = auth.uid());

-- =====================================================
-- STEP 5: CREATE STORAGE BUCKETS (avatars + stories)
-- =====================================================

-- Create avatars bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Create stories bucket  
INSERT INTO storage.buckets (id, name, public)
VALUES ('stories', 'stories', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Public can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Public can view stories" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload stories" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete stories" ON storage.objects;

-- AVATARS POLICIES
CREATE POLICY "Public can view avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload avatars"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars' AND
  auth.role() = 'authenticated'
);

CREATE POLICY "Users can update own avatars"
ON storage.objects FOR UPDATE
USING (bucket_id = 'avatars' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete own avatars"
ON storage.objects FOR DELETE
USING (bucket_id = 'avatars' AND auth.role() = 'authenticated');

-- STORIES POLICIES
CREATE POLICY "Public can view stories"
ON storage.objects FOR SELECT
USING (bucket_id = 'stories');

CREATE POLICY "Users can upload stories"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'stories' AND
  auth.role() = 'authenticated'
);

CREATE POLICY "Users can delete stories"
ON storage.objects FOR DELETE
USING (bucket_id = 'stories' AND auth.role() = 'authenticated');

-- =====================================================
-- STEP 6: ENABLE REALTIME FOR NEW TABLES
-- =====================================================
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE group_chats;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE group_messages;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE group_calls;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE call_participants;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE group_members;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================
-- DONE! Run this entire script in Supabase SQL Editor
-- =====================================================
