import { supabase } from '@/lib/supabase/client'

export async function searchUsers(query: string, limit = 50) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    console.error('Not authenticated for search')
    return []
  }

  if (!query || query.trim().length < 2) {
    return []
  }

  const searchTerm = query.trim()
  console.log('Searching for:', searchTerm, 'by user:', user.id)
  
  // Direct query instead of RPC for better reliability
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, full_name, avatar_url, bio, status, is_online, is_verified')
    .neq('id', user.id)
    .or(`username.ilike.%${searchTerm}%,full_name.ilike.%${searchTerm}%`)
    .limit(limit)

  console.log('Search results:', data, 'error:', error)

  if (error) {
    console.error('Search error:', error)
    return []
  }

  if (!data || data.length === 0) {
    console.log('No users found matching:', searchTerm)
    return []
  }

  // Add follow status info
  const usersWithStatus = await Promise.all((data || []).map(async (profile) => {
    const { data: followData } = await supabase
      .from('follows')
      .select('id')
      .eq('follower_id', user.id)
      .eq('following_id', profile.id)
      .eq('status', 'accepted')
      .maybeSingle()

    return {
      ...profile,
      is_following: !!followData,
      is_follower: false,
      is_blocked: false
    }
  }))

  return usersWithStatus
}

export async function getUserByUsername(username: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, full_name, avatar_url, bio, status, is_online, last_seen, is_verified')
    .eq('username', username)
    .maybeSingle()

  if (error) {
    console.error('Get user error:', error)
    return null
  }

  return data
}
