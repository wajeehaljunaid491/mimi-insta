import { supabase } from '@/lib/supabase/client'

export async function followUser(userId: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { error } = await supabase
    .from('follows')
    .insert({
      follower_id: user.id,
      following_id: userId,
      status: 'accepted'
    } as any)

  if (error) {
    console.error('Follow error:', error)
    return false
  }

  return true
}

export async function unfollowUser(userId: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    console.error('No user found for unfollow')
    return false
  }

  console.log('Unfollowing user:', userId)

  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', user.id)
    .eq('following_id', userId)

  if (error) {
    console.error('Unfollow error:', error)
    return false
  }

  console.log('Unfollowed successfully')
  return true
}

export async function getFollowers(userId: string) {
  const { data, error } = await supabase
    .from('follows')
    .select(`
      follower:profiles!follows_follower_id_fkey(
        id, username, full_name, avatar_url, is_online, status
      )
    `)
    .eq('following_id', userId)
    .eq('status', 'accepted')

  if (error) {
    console.error('Get followers error:', error)
    return []
  }

  return data?.map((f: any) => f.follower) || []
}

export async function getFollowing(userId: string) {
  const { data, error } = await supabase
    .from('follows')
    .select(`
      following:profiles!follows_following_id_fkey(
        id, username, full_name, avatar_url, is_online, status
      )
    `)
    .eq('follower_id', userId)
    .eq('status', 'accepted')

  if (error) {
    console.error('Get following error:', error)
    return []
  }

  return data?.map((f: any) => f.following) || []
}

export async function checkFollowStatus(targetUserId: string) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { isFollowing: false, isFollower: false }

  const [followingResult, followerResult] = await Promise.all([
    supabase
      .from('follows')
      .select('id')
      .eq('follower_id', user.id)
      .eq('following_id', targetUserId)
      .eq('status', 'accepted')
      .single(),
    supabase
      .from('follows')
      .select('id')
      .eq('follower_id', targetUserId)
      .eq('following_id', user.id)
      .eq('status', 'accepted')
      .single()
  ])

  return {
    isFollowing: !!followingResult.data,
    isFollower: !!followerResult.data
  }
}
// Remove a follower (someone who follows you)
export async function removeFollower(userId: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', userId)
    .eq('following_id', user.id)

  return !error
}

// Block a user
export async function blockUser(userId: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    console.error('No user found for blocking')
    return false
  }

  console.log('Blocking user:', userId)

  // First unfollow them and remove them as follower
  await unfollowUser(userId)
  await removeFollower(userId)

  // Add to blocks table
  const { error } = await supabase
    .from('blocks')
    .insert({ blocker_id: user.id, blocked_id: userId })

  if (error) {
    console.error('Block error:', error)
    return false
  }

  console.log('User blocked successfully')
  return true
}

// Unblock a user
export async function unblockUser(userId: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { error } = await supabase
    .from('blocks')
    .delete()
    .eq('blocker_id', user.id)
    .eq('blocked_id', userId)

  return !error
}

// Check if user is blocked
export async function isUserBlocked(userId: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { data } = await supabase
    .from('blocks')
    .select('id')
    .eq('blocker_id', user.id)
    .eq('blocked_id', userId)
    .single()

  return !!data
}

// Get blocked users list
export async function getBlockedUsers() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('blocks')
    .select(`
      blocked:profiles!blocks_blocked_id_fkey(id, username, full_name, avatar_url)
    `)
    .eq('blocker_id', user.id)

  if (error) return []
  return data?.map((b: any) => b.blocked) || []
}