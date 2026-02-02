-- ============================================
-- MIMI INSTA - COMPLETE DATABASE SCHEMA
-- Instagram-Style Calling System
-- Single SQL File - Production Ready
-- ============================================

-- ============================================
-- DATASET NAMES (Supabase Tables):
-- 1. profiles
-- 2. follows  
-- 3. call_logs
-- 4. blocked_users
-- 5. user_settings (optional)
-- ============================================

-- ============================================
-- ENABLE EXTENSIONS
-- ============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- TABLE 1: PROFILES
-- Core user information linked to Supabase Auth
-- ============================================
CREATE TABLE IF NOT EXISTS public.profiles (
    -- Primary Key (links to auth.users)
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- User Identity
    username TEXT UNIQUE NOT NULL,
    email TEXT NOT NULL,
    full_name TEXT,
    
    -- Profile Information
    avatar_url TEXT,
    bio TEXT,
    phone_number TEXT,
    date_of_birth DATE,
    
    -- Status & Presence
    status TEXT CHECK (status IN ('available', 'busy', 'offline', 'do_not_disturb')) DEFAULT 'offline',
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    is_online BOOLEAN DEFAULT false,
    
    -- Privacy Settings
    is_private BOOLEAN DEFAULT false,
    allow_calls_from TEXT CHECK (allow_calls_from IN ('everyone', 'following', 'mutual', 'nobody')) DEFAULT 'following',
    
    -- Verification & Metadata
    is_verified BOOLEAN DEFAULT false,
    account_type TEXT CHECK (account_type IN ('personal', 'business', 'creator')) DEFAULT 'personal',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT username_length CHECK (char_length(username) >= 3 AND char_length(username) <= 30),
    CONSTRAINT username_format CHECK (username ~ '^[a-zA-Z0-9_]+$'),
    CONSTRAINT bio_length CHECK (char_length(bio) <= 500)
);

-- Indexes for profiles
CREATE INDEX idx_profiles_username ON public.profiles(username);
CREATE INDEX idx_profiles_email ON public.profiles(email);
CREATE INDEX idx_profiles_status ON public.profiles(status);
CREATE INDEX idx_profiles_is_online ON public.profiles(is_online);
CREATE INDEX idx_profiles_last_seen ON public.profiles(last_seen DESC);
CREATE INDEX idx_profiles_created_at ON public.profiles(created_at DESC);

-- ============================================
-- TABLE 2: FOLLOWS
-- Follow/Following relationships with approval system
-- ============================================
CREATE TABLE IF NOT EXISTS public.follows (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Relationship
    follower_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    
    -- Status
    status TEXT CHECK (status IN ('pending', 'accepted', 'rejected', 'blocked')) DEFAULT 'accepted',
    
    -- Metadata
    is_close_friend BOOLEAN DEFAULT false,
    notification_enabled BOOLEAN DEFAULT true,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT no_self_follow CHECK (follower_id != following_id),
    CONSTRAINT unique_follow UNIQUE (follower_id, following_id)
);

-- Indexes for follows
CREATE INDEX idx_follows_follower ON public.follows(follower_id);
CREATE INDEX idx_follows_following ON public.follows(following_id);
CREATE INDEX idx_follows_status ON public.follows(status);
CREATE INDEX idx_follows_mutual ON public.follows(follower_id, following_id, status) WHERE status = 'accepted';
CREATE INDEX idx_follows_created_at ON public.follows(created_at DESC);

-- ============================================
-- TABLE 3: CALL_LOGS
-- Comprehensive call history and state management
-- ============================================
CREATE TABLE IF NOT EXISTS public.call_logs (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Participants
    caller_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    
    -- Call Details
    call_type TEXT CHECK (call_type IN ('voice', 'video')) DEFAULT 'voice',
    status TEXT CHECK (status IN ('calling', 'ringing', 'accepted', 'rejected', 'missed', 'ended', 'failed', 'cancelled', 'busy')) DEFAULT 'calling',
    
    -- Timing
    started_at TIMESTAMPTZ DEFAULT NOW(),
    answered_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER DEFAULT 0,
    ring_duration_seconds INTEGER DEFAULT 0,
    
    -- WebRTC Signaling Data
    offer JSONB,
    answer JSONB,
    ice_candidates JSONB DEFAULT '[]'::jsonb,
    
    -- Quality Metrics
    connection_quality TEXT CHECK (connection_quality IN ('excellent', 'good', 'fair', 'poor')),
    packet_loss_percentage DECIMAL(5,2),
    average_latency_ms INTEGER,
    
    -- Context
    is_online_when_called BOOLEAN DEFAULT true,
    rejection_reason TEXT,
    failure_reason TEXT,
    device_info JSONB,
    
    -- Metadata
    is_deleted_by_caller BOOLEAN DEFAULT false,
    is_deleted_by_receiver BOOLEAN DEFAULT false,
    rating SMALLINT CHECK (rating >= 1 AND rating <= 5),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT no_self_call CHECK (caller_id != receiver_id),
    CONSTRAINT valid_duration CHECK (duration_seconds >= 0),
    CONSTRAINT answered_before_ended CHECK (answered_at IS NULL OR ended_at IS NULL OR answered_at <= ended_at)
);

-- Indexes for call_logs
CREATE INDEX idx_call_logs_caller ON public.call_logs(caller_id);
CREATE INDEX idx_call_logs_receiver ON public.call_logs(receiver_id);
CREATE INDEX idx_call_logs_status ON public.call_logs(status);
CREATE INDEX idx_call_logs_call_type ON public.call_logs(call_type);
CREATE INDEX idx_call_logs_started_at ON public.call_logs(started_at DESC);
CREATE INDEX idx_call_logs_active ON public.call_logs(receiver_id, status, started_at DESC) 
    WHERE status IN ('calling', 'ringing', 'accepted');
CREATE INDEX idx_call_logs_participants ON public.call_logs(caller_id, receiver_id, started_at DESC);

-- ============================================
-- TABLE 4: BLOCKED_USERS
-- User blocking functionality
-- ============================================
CREATE TABLE IF NOT EXISTS public.blocked_users (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Relationship
    blocker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    blocked_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    
    -- Metadata
    reason TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT no_self_block CHECK (blocker_id != blocked_id),
    CONSTRAINT unique_block UNIQUE (blocker_id, blocked_id)
);

-- Indexes for blocked_users
CREATE INDEX idx_blocked_users_blocker ON public.blocked_users(blocker_id);
CREATE INDEX idx_blocked_users_blocked ON public.blocked_users(blocked_id);

-- ============================================
-- TABLE 5: USER_SETTINGS
-- User preferences and configuration
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_settings (
    -- Primary Key
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    
    -- Call Settings
    auto_answer_from_favorites BOOLEAN DEFAULT false,
    call_notification_sound TEXT DEFAULT 'default',
    vibration_enabled BOOLEAN DEFAULT true,
    
    -- Privacy Settings
    show_online_status BOOLEAN DEFAULT true,
    show_last_seen BOOLEAN DEFAULT true,
    allow_friend_suggestions BOOLEAN DEFAULT true,
    
    -- Notification Settings
    push_notifications_enabled BOOLEAN DEFAULT true,
    email_notifications_enabled BOOLEAN DEFAULT false,
    call_notifications_enabled BOOLEAN DEFAULT true,
    message_notifications_enabled BOOLEAN DEFAULT true,
    
    -- Media Settings
    auto_download_media BOOLEAN DEFAULT true,
    media_quality TEXT CHECK (media_quality IN ('auto', 'high', 'medium', 'low')) DEFAULT 'auto',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================

-- Generic trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_follows_updated_at
    BEFORE UPDATE ON public.follows
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_call_logs_updated_at
    BEFORE UPDATE ON public.call_logs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_settings_updated_at
    BEFORE UPDATE ON public.user_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- TRIGGER: AUTO-CREATE PROFILE ON SIGNUP
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, username)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || substring(NEW.id::text from 1 for 8))
    );
    
    -- Create default user settings
    INSERT INTO public.user_settings (user_id)
    VALUES (NEW.id);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Check if users are mutual followers
CREATE OR REPLACE FUNCTION are_users_mutual_followers(user1_id UUID, user2_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.follows 
        WHERE follower_id = user1_id AND following_id = user2_id AND status = 'accepted'
    ) AND EXISTS (
        SELECT 1 FROM public.follows 
        WHERE follower_id = user2_id AND following_id = user1_id AND status = 'accepted'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user is blocked
CREATE OR REPLACE FUNCTION is_user_blocked(checker_id UUID, target_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.blocked_users 
        WHERE (blocker_id = checker_id AND blocked_id = target_id)
           OR (blocker_id = target_id AND blocked_id = checker_id)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check username availability
CREATE OR REPLACE FUNCTION is_username_available(desired_username TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN NOT EXISTS (
        SELECT 1 FROM public.profiles WHERE username = desired_username
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get user by username
CREATE OR REPLACE FUNCTION get_user_by_username(search_username TEXT)
RETURNS TABLE (
    id UUID,
    username TEXT,
    full_name TEXT,
    avatar_url TEXT,
    bio TEXT,
    status TEXT,
    is_online BOOLEAN,
    last_seen TIMESTAMPTZ,
    is_verified BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id, p.username, p.full_name, p.avatar_url, p.bio, 
        p.status, p.is_online, p.last_seen, p.is_verified
    FROM public.profiles p
    WHERE p.username = search_username;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Rate limiting for calls
CREATE OR REPLACE FUNCTION check_call_rate_limit(user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    recent_calls INTEGER;
BEGIN
    SELECT COUNT(*) INTO recent_calls
    FROM public.call_logs
    WHERE caller_id = user_id
    AND started_at > NOW() - INTERVAL '1 minute';
    
    RETURN recent_calls < 10;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get active call for user
CREATE OR REPLACE FUNCTION get_active_call(for_user_id UUID)
RETURNS TABLE (
    id UUID,
    caller_id UUID,
    caller_username TEXT,
    caller_avatar TEXT,
    receiver_id UUID,
    receiver_username TEXT,
    receiver_avatar TEXT,
    call_type TEXT,
    status TEXT,
    started_at TIMESTAMPTZ,
    is_caller BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cl.id,
        cl.caller_id,
        caller.username as caller_username,
        caller.avatar_url as caller_avatar,
        cl.receiver_id,
        receiver.username as receiver_username,
        receiver.avatar_url as receiver_avatar,
        cl.call_type,
        cl.status,
        cl.started_at,
        cl.caller_id = for_user_id as is_caller
    FROM public.call_logs cl
    JOIN public.profiles caller ON cl.caller_id = caller.id
    JOIN public.profiles receiver ON cl.receiver_id = receiver.id
    WHERE (cl.caller_id = for_user_id OR cl.receiver_id = for_user_id)
    AND cl.status IN ('calling', 'ringing', 'accepted')
    ORDER BY cl.started_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Search users with filters
CREATE OR REPLACE FUNCTION search_users(
    search_query TEXT,
    searcher_id UUID,
    limit_count INTEGER DEFAULT 50
)
RETURNS TABLE (
    id UUID,
    username TEXT,
    full_name TEXT,
    avatar_url TEXT,
    bio TEXT,
    status TEXT,
    is_online BOOLEAN,
    is_verified BOOLEAN,
    is_following BOOLEAN,
    is_follower BOOLEAN,
    is_blocked BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.username,
        p.full_name,
        p.avatar_url,
        p.bio,
        p.status,
        p.is_online,
        p.is_verified,
        EXISTS(
            SELECT 1 FROM public.follows 
            WHERE follower_id = searcher_id 
            AND following_id = p.id 
            AND status = 'accepted'
        ) as is_following,
        EXISTS(
            SELECT 1 FROM public.follows 
            WHERE follower_id = p.id 
            AND following_id = searcher_id 
            AND status = 'accepted'
        ) as is_follower,
        is_user_blocked(searcher_id, p.id) as is_blocked
    FROM public.profiles p
    WHERE p.id != searcher_id
    AND (
        p.username ILIKE '%' || search_query || '%'
        OR p.full_name ILIKE '%' || search_query || '%'
        OR p.bio ILIKE '%' || search_query || '%'
    )
    AND NOT is_user_blocked(searcher_id, p.id)
    ORDER BY 
        p.is_verified DESC,
        CASE WHEN p.username ILIKE search_query || '%' THEN 1 ELSE 2 END,
        p.username
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES: PROFILES
-- ============================================

CREATE POLICY "Public profiles viewable by authenticated users"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
    ON public.profiles FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id);

-- ============================================
-- RLS POLICIES: FOLLOWS
-- ============================================

CREATE POLICY "Users can view their follow relationships"
    ON public.follows FOR SELECT
    TO authenticated
    USING (auth.uid() = follower_id OR auth.uid() = following_id);

CREATE POLICY "Users can follow others"
    ON public.follows FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = follower_id
        AND NOT is_user_blocked(auth.uid(), following_id)
    );

CREATE POLICY "Users can unfollow"
    ON public.follows FOR DELETE
    TO authenticated
    USING (auth.uid() = follower_id);

CREATE POLICY "Users can update follow status"
    ON public.follows FOR UPDATE
    TO authenticated
    USING (auth.uid() = follower_id OR auth.uid() = following_id)
    WITH CHECK (auth.uid() = follower_id OR auth.uid() = following_id);

-- ============================================
-- RLS POLICIES: CALL_LOGS
-- ============================================

CREATE POLICY "Users can view their calls"
    ON public.call_logs FOR SELECT
    TO authenticated
    USING (
        (auth.uid() = caller_id AND NOT is_deleted_by_caller)
        OR (auth.uid() = receiver_id AND NOT is_deleted_by_receiver)
    );

CREATE POLICY "Users can initiate calls"
    ON public.call_logs FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = caller_id
        AND NOT is_user_blocked(auth.uid(), receiver_id)
        AND check_call_rate_limit(auth.uid())
        AND (
            EXISTS (
                SELECT 1 FROM public.follows 
                WHERE follower_id = auth.uid() 
                AND following_id = receiver_id 
                AND status = 'accepted'
            )
            OR EXISTS (
                SELECT 1 FROM public.profiles
                WHERE id = receiver_id
                AND allow_calls_from = 'everyone'
            )
        )
    );

CREATE POLICY "Users can update their calls"
    ON public.call_logs FOR UPDATE
    TO authenticated
    USING (auth.uid() = caller_id OR auth.uid() = receiver_id)
    WITH CHECK (auth.uid() = caller_id OR auth.uid() = receiver_id);

-- ============================================
-- RLS POLICIES: BLOCKED_USERS
-- ============================================

CREATE POLICY "Users can view their blocks"
    ON public.blocked_users FOR SELECT
    TO authenticated
    USING (auth.uid() = blocker_id);

CREATE POLICY "Users can block others"
    ON public.blocked_users FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = blocker_id);

CREATE POLICY "Users can unblock"
    ON public.blocked_users FOR DELETE
    TO authenticated
    USING (auth.uid() = blocker_id);

-- ============================================
-- RLS POLICIES: USER_SETTINGS
-- ============================================

CREATE POLICY "Users can view own settings"
    ON public.user_settings FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
    ON public.user_settings FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings"
    ON public.user_settings FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- ============================================
-- REALTIME PUBLICATION
-- ============================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.follows;

-- ============================================
-- VIEWS FOR COMMON QUERIES
-- ============================================

-- Online users view
CREATE OR REPLACE VIEW online_users AS
SELECT 
    id, username, full_name, avatar_url, status, is_online, last_seen, is_verified
FROM public.profiles
WHERE is_online = true
ORDER BY last_seen DESC;

-- Call history view
CREATE OR REPLACE VIEW user_call_history AS
SELECT 
    cl.id,
    cl.caller_id,
    caller.username as caller_username,
    caller.avatar_url as caller_avatar,
    cl.receiver_id,
    receiver.username as receiver_username,
    receiver.avatar_url as receiver_avatar,
    cl.call_type,
    cl.status,
    cl.started_at,
    cl.answered_at,
    cl.ended_at,
    cl.duration_seconds,
    cl.connection_quality,
    cl.rating
FROM public.call_logs cl
JOIN public.profiles caller ON cl.caller_id = caller.id
JOIN public.profiles receiver ON cl.receiver_id = receiver.id
WHERE cl.is_deleted_by_caller = false AND cl.is_deleted_by_receiver = false
ORDER BY cl.started_at DESC;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'DATABASE SETUP COMPLETED SUCCESSFULLY!';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Tables Created:';
    RAISE NOTICE '  1. profiles';
    RAISE NOTICE '  2. follows';
    RAISE NOTICE '  3. call_logs';
    RAISE NOTICE '  4. blocked_users';
    RAISE NOTICE '  5. user_settings';
    RAISE NOTICE '';
    RAISE NOTICE 'Features Enabled:';
    RAISE NOTICE '  ✓ Row Level Security (RLS)';
    RAISE NOTICE '  ✓ Realtime subscriptions';
    RAISE NOTICE '  ✓ Auto profile creation';
    RAISE NOTICE '  ✓ Rate limiting';
    RAISE NOTICE '  ✓ Username validation';
    RAISE NOTICE '  ✓ Block functionality';
    RAISE NOTICE '';
    RAISE NOTICE 'Next Steps:';
    RAISE NOTICE '  1. Enable Realtime in Supabase Dashboard';
    RAISE NOTICE '  2. Configure authentication settings';
    RAISE NOTICE '  3. Start your Next.js application';
    RAISE NOTICE '========================================';
END $$;
