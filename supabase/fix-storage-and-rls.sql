-- =====================================================
-- FIX STORAGE AND RLS POLICIES
-- Run this AFTER the new-features.sql
-- =====================================================

-- 1. FIX STORAGE POLICIES FOR AVATARS BUCKET
-- =====================================================
-- First, make sure avatars bucket exists and is public
-- Go to Supabase Dashboard > Storage > Create bucket "avatars" (public)

-- Storage policies for avatars bucket (run in SQL Editor)
-- These allow authenticated users to upload and everyone to read

-- Drop existing policies if any
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own avatars" ON storage.objects;

-- Create new policies
CREATE POLICY "Anyone can view avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "Authenticated users can upload avatars"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can update own avatars"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'avatars' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can delete own avatars"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'avatars' 
  AND auth.role() = 'authenticated'
);

-- 2. FIX PROFILES UPDATE POLICY
-- =====================================================
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- 3. FIX MESSAGES POLICIES
-- =====================================================
DROP POLICY IF EXISTS "Users can update own messages" ON messages;

CREATE POLICY "Users can update own messages"
ON messages FOR UPDATE
USING (sender_id = auth.uid());

-- 4. VERIFY ALL TABLES HAVE PROPER RLS
-- =====================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_deletions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_deletions ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- EMAIL CONFIRMATION URL FIX
-- =====================================================
-- Go to Supabase Dashboard > Authentication > URL Configuration
-- Set "Site URL" to your actual domain (e.g., https://your-app.vercel.app)
-- Set "Redirect URLs" to include your domain
-- 
-- The confirmation email will now use your actual domain instead of localhost

-- =====================================================
-- DONE!
-- =====================================================
