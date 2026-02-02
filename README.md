# Instagram-Style Calling System with Supabase

A production-ready social web application with real-time calling capabilities.

## 🎯 Features

- ✅ User Registration & Authentication
- ✅ Unique Username System
- ✅ Follow/Unfollow Users
- ✅ Real-time Online/Offline Presence
- ✅ Username-based Search
- ✅ WebRTC Voice/Video Calls
- ✅ Call State Management (calling, ringing, accepted, rejected, missed, offline)
- ✅ Production-ready Security (RLS, Rate Limiting)

## 🏗️ Tech Stack

- **Backend**: Supabase (Auth, PostgreSQL, Realtime)
- **Frontend**: Vanilla JS + Vite
- **Real-time**: Supabase Realtime Channels & Presence
- **Calling**: WebRTC with Supabase Signaling

## 📦 Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Copy `.env.example` to `.env`
3. Fill in your Supabase URL and Anon Key
4. Run the SQL migrations in `/supabase/migrations/` in your Supabase SQL Editor

### 3. Run the Application

```bash
npm run dev
```

## 🗄️ Database Schema

### Tables

1. **profiles** - User public data
2. **follows** - Follow relationships
3. **call_logs** - Call history and state

See detailed schema in `/supabase/migrations/`

## 🔒 Security

- Row Level Security (RLS) enabled on all tables
- Username uniqueness enforced at database level
- Rate limiting on call requests
- Authenticated-only access to sensitive operations

## 📱 Call Flow

1. User searches for friend by username
2. Checks if friend is online (via Presence)
3. Initiates call (creates call_log entry)
4. Real-time notification sent to receiver
5. Receiver accepts/rejects
6. WebRTC connection established (if accepted)
7. Call state tracked in real-time

## 🧪 Edge Cases Handled

- User goes offline during call
- Multiple simultaneous calls
- Page refresh during call
- Network disconnections
- Blocked/unfollowed users
- Invalid usernames

## 📁 Project Structure

```
├── supabase/
│   ├── migrations/        # Database schema & RLS policies
│   └── functions/         # Edge functions (if needed)
├── src/
│   ├── lib/
│   │   ├── supabase.js   # Supabase client
│   │   ├── auth.js       # Authentication logic
│   │   ├── presence.js   # Online/offline tracking
│   │   ├── calls.js      # Call system logic
│   │   └── webrtc.js     # WebRTC peer connection
│   ├── components/        # UI components
│   └── main.js           # App entry point
├── index.html
└── package.json
```
