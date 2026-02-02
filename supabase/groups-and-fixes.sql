-- =====================================================
-- GROUP CHATS & MESSAGE FIXES
-- Run this in Supabase SQL Editor
-- =====================================================

-- 1. GROUP CHATS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS group_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  avatar_url TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_group_chats_created_by ON group_chats(created_by);

ALTER TABLE group_chats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Group members can view group" ON group_chats;
DROP POLICY IF EXISTS "Users can create groups" ON group_chats;
DROP POLICY IF EXISTS "Group creator can update" ON group_chats;
DROP POLICY IF EXISTS "Group creator can delete" ON group_chats;

CREATE POLICY "Group members can view group"
ON group_chats FOR SELECT
USING (
  id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid())
);

CREATE POLICY "Users can create groups"
ON group_chats FOR INSERT
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Group creator can update"
ON group_chats FOR UPDATE
USING (created_by = auth.uid());

CREATE POLICY "Group creator can delete"
ON group_chats FOR DELETE
USING (created_by = auth.uid());

-- 2. GROUP MEMBERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES group_chats(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id);

ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view group members" ON group_members;
DROP POLICY IF EXISTS "Admins can add members" ON group_members;
DROP POLICY IF EXISTS "Users can leave group" ON group_members;
DROP POLICY IF EXISTS "Admins can remove members" ON group_members;

CREATE POLICY "Members can view group members"
ON group_members FOR SELECT
USING (
  group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid())
);

CREATE POLICY "Admins can add members"
ON group_members FOR INSERT
WITH CHECK (
  group_id IN (
    SELECT group_id FROM group_members 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
  OR
  -- Creator adding first member (themselves)
  group_id IN (SELECT id FROM group_chats WHERE created_by = auth.uid())
);

CREATE POLICY "Users can leave group"
ON group_members FOR DELETE
USING (user_id = auth.uid());

CREATE POLICY "Admins can remove members"
ON group_members FOR DELETE
USING (
  group_id IN (
    SELECT group_id FROM group_members 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- 3. GROUP MESSAGES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS group_messages (
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

CREATE INDEX IF NOT EXISTS idx_group_messages_group ON group_messages(group_id);
CREATE INDEX IF NOT EXISTS idx_group_messages_sender ON group_messages(sender_id);

ALTER TABLE group_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view group messages" ON group_messages;
DROP POLICY IF EXISTS "Members can send messages" ON group_messages;
DROP POLICY IF EXISTS "Sender can update own message" ON group_messages;
DROP POLICY IF EXISTS "Sender can delete own message" ON group_messages;

CREATE POLICY "Members can view group messages"
ON group_messages FOR SELECT
USING (
  group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid())
);

CREATE POLICY "Members can send messages"
ON group_messages FOR INSERT
WITH CHECK (
  sender_id = auth.uid() AND
  group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid())
);

CREATE POLICY "Sender can update own message"
ON group_messages FOR UPDATE
USING (sender_id = auth.uid());

CREATE POLICY "Sender can delete own message"
ON group_messages FOR DELETE
USING (sender_id = auth.uid());

-- 4. ADD is_edited AND edited_at TO MESSAGES TABLE
-- =====================================================
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT FALSE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;

-- 5. GROUP CALLS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS group_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES group_chats(id) ON DELETE CASCADE,
  initiator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  call_type TEXT NOT NULL CHECK (call_type IN ('voice', 'video')),
  status TEXT DEFAULT 'ongoing' CHECK (status IN ('ongoing', 'ended')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  -- For non-group calls (1-on-1 that can add participants)
  is_group_call BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_group_calls_group ON group_calls(group_id);

ALTER TABLE group_calls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants can view calls" ON group_calls;
DROP POLICY IF EXISTS "Users can start calls" ON group_calls;
DROP POLICY IF EXISTS "Initiator can update call" ON group_calls;

CREATE POLICY "Participants can view calls"
ON group_calls FOR SELECT
USING (
  initiator_id = auth.uid() OR
  group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid()) OR
  id IN (SELECT call_id FROM call_participants WHERE user_id = auth.uid())
);

CREATE POLICY "Users can start calls"
ON group_calls FOR INSERT
WITH CHECK (initiator_id = auth.uid());

CREATE POLICY "Initiator can update call"
ON group_calls FOR UPDATE
USING (initiator_id = auth.uid());

-- 6. CALL PARTICIPANTS TABLE (for adding users to calls)
-- =====================================================
CREATE TABLE IF NOT EXISTS call_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL REFERENCES group_calls(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  status TEXT DEFAULT 'ringing' CHECK (status IN ('ringing', 'joined', 'declined', 'left')),
  UNIQUE(call_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_call_participants_call ON call_participants(call_id);
CREATE INDEX IF NOT EXISTS idx_call_participants_user ON call_participants(user_id);

ALTER TABLE call_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants can view" ON call_participants;
DROP POLICY IF EXISTS "Users can join calls" ON call_participants;
DROP POLICY IF EXISTS "Users can update own status" ON call_participants;

CREATE POLICY "Participants can view"
ON call_participants FOR SELECT
USING (
  call_id IN (SELECT id FROM group_calls WHERE initiator_id = auth.uid()) OR
  user_id = auth.uid()
);

CREATE POLICY "Users can join calls"
ON call_participants FOR INSERT
WITH CHECK (
  -- Call initiator can add participants
  call_id IN (SELECT id FROM group_calls WHERE initiator_id = auth.uid()) OR
  user_id = auth.uid()
);

CREATE POLICY "Users can update own status"
ON call_participants FOR UPDATE
USING (user_id = auth.uid());

-- 7. ENABLE REALTIME FOR NEW TABLES
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

-- =====================================================
-- DONE! Group tables and call participants created.
-- =====================================================
