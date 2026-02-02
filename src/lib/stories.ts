import { supabase } from '@/lib/supabase/client'

export interface Story {
  id: string
  user_id: string
  media_url: string
  media_type: 'image' | 'video'
  caption: string | null
  views_count: number
  created_at: string
  expires_at: string
  user?: {
    id: string
    username: string
    full_name: string | null
    avatar_url: string | null
  }
}

export interface StoryView {
  id: string
  story_id: string
  viewer_id: string
  viewed_at: string
  viewer?: {
    id: string
    username: string
    avatar_url: string | null
  }
}

// Get stories from people you follow (including your own)
export async function getStories(): Promise<{ userId: string; user: any; stories: Story[] }[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  // Get stories from followed users and self
  const { data, error } = await supabase
    .from('stories')
    .select(`
      *,
      user:profiles!stories_user_id_fkey(id, username, full_name, avatar_url)
    `)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching stories:', error)
    return []
  }

  // Group stories by user
  const grouped: { [key: string]: { user: any; stories: Story[] } } = {}
  
  for (const story of (data || [])) {
    const userId = story.user_id
    if (!grouped[userId]) {
      grouped[userId] = {
        user: story.user,
        stories: []
      }
    }
    grouped[userId].stories.push(story)
  }

  // Convert to array, put current user first
  const result = Object.entries(grouped).map(([userId, data]) => ({
    userId,
    user: data.user,
    stories: data.stories
  }))

  // Sort: current user first, then others
  result.sort((a, b) => {
    if (a.userId === user.id) return -1
    if (b.userId === user.id) return 1
    return 0
  })

  return result
}

// Get my own stories
export async function getMyStories(): Promise<Story[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('stories')
    .select('*')
    .eq('user_id', user.id)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching my stories:', error)
    return []
  }

  return data || []
}

// Create a new story
export async function createStory(mediaUrl: string, mediaType: 'image' | 'video', caption?: string): Promise<Story | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    console.error('No user found for story creation')
    return null
  }

  console.log('Creating story with:', { user_id: user.id, mediaUrl, mediaType })

  const { data, error } = await supabase
    .from('stories')
    .insert({
      user_id: user.id,
      media_url: mediaUrl,
      media_type: mediaType,
      caption: caption || null
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating story:', error)
    return null
  }

  console.log('Story created successfully:', data)
  return data
}

// Delete a story
export async function deleteStory(storyId: string): Promise<boolean> {
  const { error } = await supabase
    .from('stories')
    .delete()
    .eq('id', storyId)

  return !error
}

// View a story
export async function viewStory(storyId: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { error } = await supabase
    .from('story_views')
    .upsert({ story_id: storyId, viewer_id: user.id })

  if (!error) {
    // Increment view count
    await supabase.rpc('increment_story_views', { story_id: storyId })
  }

  return !error
}

// Get viewers of a story
export async function getStoryViewers(storyId: string): Promise<StoryView[]> {
  const { data, error } = await supabase
    .from('story_views')
    .select(`
      *,
      viewer:profiles!story_views_viewer_id_fkey(id, username, avatar_url)
    `)
    .eq('story_id', storyId)
    .order('viewed_at', { ascending: false })

  if (error) {
    console.error('Error fetching story viewers:', error)
    return []
  }

  return data || []
}

// Upload story media
export async function uploadStoryMedia(file: File): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    console.error('No user found for story upload')
    return null
  }

  const fileExt = file.name.split('.').pop()
  const fileName = `story-${user.id}-${Date.now()}.${fileExt}`

  // Upload to the 'avatars' bucket
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: true
    })

  if (uploadError) {
    console.error('Error uploading story media:', uploadError)
    // Try alternative approach
    const { error: retryError } = await supabase.storage
      .from('avatars')
      .upload(`stories/${fileName}`, file, {
        cacheControl: '3600',
        upsert: true
      })
    
    if (retryError) {
      console.error('Retry upload also failed:', retryError)
      return null
    }
    
    const { data } = supabase.storage
      .from('avatars')
      .getPublicUrl(`stories/${fileName}`)
    
    return data.publicUrl
  }

  const { data } = supabase.storage
    .from('avatars')
    .getPublicUrl(fileName)

  console.log('Story uploaded successfully:', data.publicUrl)
  return data.publicUrl
}

// Check if user has viewed a story
export async function hasViewedStory(storyId: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { data } = await supabase
    .from('story_views')
    .select('id')
    .eq('story_id', storyId)
    .eq('viewer_id', user.id)
    .single()

  return !!data
}
