import { supabase } from '@/lib/supabase/client'
import { RealtimeChannel } from '@supabase/supabase-js'

export interface Message {
  id: string
  sender_id: string
  receiver_id: string
  content: string
  message_type: 'text' | 'image' | 'video' | 'audio' | 'file'
  is_read: boolean
  read_at: string | null
  created_at: string
  updated_at: string
  sender?: {
    id: string
    username: string
    avatar_url: string | null
  }
  receiver?: {
    id: string
    username: string
    avatar_url: string | null
  }
}

export interface Conversation {
  user: {
    id: string
    username: string
    full_name: string | null
    avatar_url: string | null
    is_online?: boolean
  }
  lastMessage: Message | null
  unreadCount: number
}

// Send a message (text or audio)
export async function sendMessage(
  receiverId: string, 
  content: string, 
  messageType: 'text' | 'audio' = 'text'
): Promise<Message | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('messages')
    .insert({
      sender_id: user.id,
      receiver_id: receiverId,
      content: content.trim(),
      message_type: messageType
    })
    .select(`
      *,
      sender:profiles!messages_sender_id_fkey(id, username, avatar_url),
      receiver:profiles!messages_receiver_id_fkey(id, username, avatar_url)
    `)
    .single()

  if (error) {
    console.error('Error sending message:', error)
    return null
  }

  return data
}

// Get messages between two users
export async function getMessages(otherUserId: string, limit = 50, offset = 0): Promise<Message[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('messages')
    .select(`
      *,
      sender:profiles!messages_sender_id_fkey(id, username, avatar_url),
      receiver:profiles!messages_receiver_id_fkey(id, username, avatar_url)
    `)
    .or(`and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id})`)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    console.error('Error fetching messages:', error)
    return []
  }

  return (data || []).reverse()
}

// Get all conversations (list of users you've messaged)
export async function getConversations(): Promise<Conversation[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  // Get all messages where user is sender or receiver
  const { data: messages, error } = await supabase
    .from('messages')
    .select(`
      *,
      sender:profiles!messages_sender_id_fkey(id, username, full_name, avatar_url, is_online),
      receiver:profiles!messages_receiver_id_fkey(id, username, full_name, avatar_url, is_online)
    `)
    .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching conversations:', error)
    return []
  }

  // Group by conversation partner
  const conversationMap = new Map<string, Conversation>()

  for (const msg of messages || []) {
    const otherUser = msg.sender_id === user.id ? msg.receiver : msg.sender
    if (!otherUser) continue

    if (!conversationMap.has(otherUser.id)) {
      // Count unread messages from this user
      const unreadCount = (messages || []).filter(
        m => m.sender_id === otherUser.id && m.receiver_id === user.id && !m.is_read
      ).length

      conversationMap.set(otherUser.id, {
        user: {
          id: otherUser.id,
          username: otherUser.username,
          full_name: otherUser.full_name || null,
          avatar_url: otherUser.avatar_url,
          is_online: otherUser.is_online
        },
        lastMessage: msg,
        unreadCount
      })
    }
  }

  return Array.from(conversationMap.values())
}

// Mark messages as read
export async function markMessagesAsRead(senderId: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { error } = await supabase
    .from('messages')
    .update({ 
      is_read: true,
      read_at: new Date().toISOString()
    })
    .eq('sender_id', senderId)
    .eq('receiver_id', user.id)
    .eq('is_read', false)

  if (error) {
    console.error('Error marking messages as read:', error)
    return false
  }

  return true
}

// Delete a message
export async function deleteMessage(messageId: string): Promise<boolean> {
  const { error } = await supabase
    .from('messages')
    .delete()
    .eq('id', messageId)

  if (error) {
    console.error('Error deleting message:', error)
    return false
  }

  return true
}

// Get unread message count
export async function getUnreadCount(): Promise<number> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 0

  const { count, error } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('receiver_id', user.id)
    .eq('is_read', false)

  if (error) {
    console.error('Error getting unread count:', error)
    return 0
  }

  return count || 0
}

// Subscribe to new messages (real-time)
export function subscribeToMessages(
  userId: string,
  onNewMessage: (message: Message) => void,
  onMessageRead: (messageId: string) => void
): RealtimeChannel {
  const channel = supabase
    .channel(`messages:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `receiver_id=eq.${userId}`
      },
      async (payload) => {
        // Fetch the full message with sender info
        const { data } = await supabase
          .from('messages')
          .select(`
            *,
            sender:profiles!messages_sender_id_fkey(id, username, avatar_url),
            receiver:profiles!messages_receiver_id_fkey(id, username, avatar_url)
          `)
          .eq('id', payload.new.id)
          .single()

        if (data) {
          onNewMessage(data)
        }
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `sender_id=eq.${userId}`
      },
      (payload) => {
        if (payload.new.is_read && !payload.old.is_read) {
          onMessageRead(payload.new.id)
        }
      }
    )
    .subscribe()

  return channel
}

// Unsubscribe from messages
export function unsubscribeFromMessages(channel: RealtimeChannel) {
  supabase.removeChannel(channel)
}
