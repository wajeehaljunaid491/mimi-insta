import { supabase } from './supabase/client'

export interface GroupChat {
  id: string
  name: string
  description: string | null
  avatar_url: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface GroupMember {
  id: string
  group_id: string
  user_id: string
  role: 'admin' | 'member'
  joined_at: string
  profiles?: {
    id: string
    username: string
    full_name: string | null
    avatar_url: string | null
  }
}

export interface GroupMessage {
  id: string
  group_id: string
  sender_id: string
  content: string
  message_type: 'text' | 'image' | 'video' | 'audio' | 'file'
  is_edited: boolean
  edited_at: string | null
  is_deleted: boolean
  created_at: string
  profiles?: {
    id: string
    username: string
    full_name: string | null
    avatar_url: string | null
  }
}

// Create a new group
export async function createGroup(name: string, description?: string, memberIds?: string[]) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Create the group
  const { data: group, error: groupError } = await supabase
    .from('group_chats')
    .insert({
      name,
      description,
      created_by: user.id
    })
    .select()
    .single()

  if (groupError) throw groupError

  // Add creator as admin
  const { error: creatorError } = await supabase
    .from('group_members')
    .insert({
      group_id: group.id,
      user_id: user.id,
      role: 'admin'
    })

  if (creatorError) throw creatorError

  // Add other members if provided
  if (memberIds && memberIds.length > 0) {
    const memberInserts = memberIds.map(userId => ({
      group_id: group.id,
      user_id: userId,
      role: 'member' as const
    }))

    const { error: membersError } = await supabase
      .from('group_members')
      .insert(memberInserts)

    if (membersError) console.error('Error adding members:', membersError)
  }

  return group
}

// Get user's groups
export async function getUserGroups() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('group_members')
    .select(`
      group_id,
      role,
      group_chats (
        id,
        name,
        description,
        avatar_url,
        created_by,
        created_at,
        updated_at
      )
    `)
    .eq('user_id', user.id)

  if (error) {
    console.error('Error fetching groups:', error)
    return []
  }

  return data?.map(d => ({
    ...d.group_chats,
    role: d.role
  })) || []
}

// Get group details with members
export async function getGroupDetails(groupId: string) {
  const { data, error } = await supabase
    .from('group_chats')
    .select('*')
    .eq('id', groupId)
    .single()

  if (error) throw error
  return data
}

// Get group members
export async function getGroupMembers(groupId: string) {
  const { data, error } = await supabase
    .from('group_members')
    .select(`
      *,
      profiles:user_id (
        id,
        username,
        full_name,
        avatar_url
      )
    `)
    .eq('group_id', groupId)
    .order('role', { ascending: true })

  if (error) throw error
  return data as GroupMember[]
}

// Add member to group
export async function addGroupMember(groupId: string, userId: string) {
  const { data, error } = await supabase
    .from('group_members')
    .insert({
      group_id: groupId,
      user_id: userId,
      role: 'member'
    })
    .select()
    .single()

  if (error) throw error
  return data
}

// Remove member from group
export async function removeGroupMember(groupId: string, userId: string) {
  const { error } = await supabase
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', userId)

  if (error) throw error
}

// Leave group
export async function leaveGroup(groupId: string) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', user.id)

  if (error) throw error
}

// Update group details
export async function updateGroup(groupId: string, updates: { name?: string; description?: string; avatar_url?: string }) {
  const { data, error } = await supabase
    .from('group_chats')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', groupId)
    .select()
    .single()

  if (error) throw error
  return data
}

// Delete group
export async function deleteGroup(groupId: string) {
  const { error } = await supabase
    .from('group_chats')
    .delete()
    .eq('id', groupId)

  if (error) throw error
}

// Get group messages
export async function getGroupMessages(groupId: string, limit = 50, offset = 0) {
  const { data, error } = await supabase
    .from('group_messages')
    .select(`
      *,
      profiles:sender_id (
        id,
        username,
        full_name,
        avatar_url
      )
    `)
    .eq('group_id', groupId)
    .order('created_at', { ascending: true })
    .range(offset, offset + limit - 1)

  if (error) throw error
  return data as GroupMessage[]
}

// Send message to group
export async function sendGroupMessage(groupId: string, content: string, messageType: string = 'text') {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('group_messages')
    .insert({
      group_id: groupId,
      sender_id: user.id,
      content,
      message_type: messageType
    })
    .select(`
      *,
      profiles:sender_id (
        id,
        username,
        full_name,
        avatar_url
      )
    `)
    .single()

  if (error) throw error
  return data as GroupMessage
}

// Edit group message
export async function editGroupMessage(messageId: string, newContent: string) {
  const { data, error } = await supabase
    .from('group_messages')
    .update({
      content: newContent,
      is_edited: true,
      edited_at: new Date().toISOString()
    })
    .eq('id', messageId)
    .select()
    .single()

  if (error) throw error
  return data
}

// Delete group message
export async function deleteGroupMessage(messageId: string) {
  const { error } = await supabase
    .from('group_messages')
    .delete()
    .eq('id', messageId)

  if (error) throw error
}

// Upload group avatar
export async function uploadGroupAvatar(groupId: string, file: File) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const fileExt = file.name.split('.').pop()
  const filePath = `groups/${groupId}/${Date.now()}.${fileExt}`

  const { error: uploadError } = await supabase.storage
    .from('group-avatars')
    .upload(filePath, file)

  if (uploadError) throw uploadError

  const { data: { publicUrl } } = supabase.storage
    .from('group-avatars')
    .getPublicUrl(filePath)

  // Update group with new avatar
  await updateGroup(groupId, { avatar_url: publicUrl })

  return publicUrl
}

// Subscribe to group messages
export function subscribeToGroupMessages(groupId: string, callback: (message: GroupMessage) => void) {
  return supabase
    .channel(`group-messages-${groupId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'group_messages',
        filter: `group_id=eq.${groupId}`
      },
      async (payload) => {
        if (payload.eventType === 'INSERT') {
          // Fetch full message with profile
          const { data } = await supabase
            .from('group_messages')
            .select(`
              *,
              profiles:sender_id (
                id,
                username,
                full_name,
                avatar_url
              )
            `)
            .eq('id', payload.new.id)
            .single()

          if (data) callback(data as GroupMessage)
        }
      }
    )
    .subscribe()
}
