import { supabase } from './supabase/client'

export interface GroupCall {
  id: string
  group_id: string | null
  initiator_id: string
  call_type: 'voice' | 'video'
  status: 'ongoing' | 'ended'
  is_group_call: boolean
  started_at: string
  ended_at: string | null
}

export interface CallParticipant {
  id: string
  call_id: string
  user_id: string
  status: 'ringing' | 'joined' | 'declined' | 'left'
  joined_at: string
  left_at: string | null
  profiles?: {
    id: string
    username: string
    full_name: string | null
    avatar_url: string | null
  }
}

// Start a group call
export async function startGroupCall(groupId: string, callType: 'voice' | 'video') {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: call, error } = await supabase
    .from('group_calls')
    .insert({
      group_id: groupId,
      initiator_id: user.id,
      call_type: callType,
      is_group_call: true
    })
    .select()
    .single()

  if (error) throw error

  // Add initiator as first participant
  await supabase
    .from('call_participants')
    .insert({
      call_id: call.id,
      user_id: user.id,
      status: 'joined'
    })

  return call as GroupCall
}

// Start a multi-party call (not from a group, but can add users)
export async function startMultiPartyCall(callType: 'voice' | 'video', initialUserId: string) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: call, error } = await supabase
    .from('group_calls')
    .insert({
      initiator_id: user.id,
      call_type: callType,
      is_group_call: true
    })
    .select()
    .single()

  if (error) throw error

  // Add initiator and initial user as participants
  await supabase
    .from('call_participants')
    .insert([
      { call_id: call.id, user_id: user.id, status: 'joined' },
      { call_id: call.id, user_id: initialUserId, status: 'ringing' }
    ])

  return call as GroupCall
}

// Add participant to ongoing call
export async function addParticipantToCall(callId: string, userId: string) {
  const { data, error } = await supabase
    .from('call_participants')
    .insert({
      call_id: callId,
      user_id: userId,
      status: 'ringing'
    })
    .select(`
      *,
      profiles:user_id (
        id,
        username,
        full_name,
        avatar_url
      )
    `)
    .single()

  if (error) throw error
  return data as CallParticipant
}

// Get call participants
export async function getCallParticipants(callId: string) {
  const { data, error } = await supabase
    .from('call_participants')
    .select(`
      *,
      profiles:user_id (
        id,
        username,
        full_name,
        avatar_url
      )
    `)
    .eq('call_id', callId)
    .order('joined_at', { ascending: true })

  if (error) throw error
  return data as CallParticipant[]
}

// Update participant status
export async function updateParticipantStatus(callId: string, status: 'joined' | 'declined' | 'left') {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const updates: any = { status }
  if (status === 'joined') {
    updates.joined_at = new Date().toISOString()
  } else if (status === 'left' || status === 'declined') {
    updates.left_at = new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('call_participants')
    .update(updates)
    .eq('call_id', callId)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) throw error
  return data
}

// End a group call
export async function endGroupCall(callId: string) {
  const { data, error } = await supabase
    .from('group_calls')
    .update({
      status: 'ended',
      ended_at: new Date().toISOString()
    })
    .eq('id', callId)
    .select()
    .single()

  if (error) throw error
  return data
}

// Get active call for a group
export async function getActiveGroupCall(groupId: string) {
  const { data, error } = await supabase
    .from('group_calls')
    .select('*')
    .eq('group_id', groupId)
    .eq('status', 'ongoing')
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return data as GroupCall | null
}

// Get current user's active call
export async function getCurrentUserActiveCall(): Promise<GroupCall | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('call_participants')
    .select(`
      call_id,
      status,
      group_calls (
        id,
        group_id,
        initiator_id,
        call_type,
        status,
        started_at
      )
    `)
    .eq('user_id', user.id)
    .in('status', ['ringing', 'joined'])

  if (error) {
    console.error('Error getting active call:', error)
    return null
  }

  // Find an ongoing call
  const activeCall = data?.find(d => (d.group_calls as any)?.status === 'ongoing')
  if (!activeCall || !activeCall.group_calls) return null
  
  // Handle both array and single object cases
  const groupCall = Array.isArray(activeCall.group_calls) 
    ? activeCall.group_calls[0] 
    : activeCall.group_calls
  
  return groupCall as unknown as GroupCall
}

// Subscribe to call participants
export function subscribeToCallParticipants(callId: string, callback: (participant: CallParticipant, eventType: string) => void) {
  return supabase
    .channel(`call-participants-${callId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'call_participants',
        filter: `call_id=eq.${callId}`
      },
      async (payload) => {
        // Fetch full participant with profile
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const { data } = await supabase
            .from('call_participants')
            .select(`
              *,
              profiles:user_id (
                id,
                username,
                full_name,
                avatar_url
              )
            `)
            .eq('id', payload.new.id)
            .single()

          if (data) callback(data as CallParticipant, payload.eventType)
        } else if (payload.eventType === 'DELETE') {
          callback(payload.old as CallParticipant, 'DELETE')
        }
      }
    )
    .subscribe()
}

// Subscribe to incoming calls
export function subscribeToIncomingCalls(callback: (participant: CallParticipant & { group_calls: GroupCall }) => void) {
  return supabase
    .channel('incoming-calls')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'call_participants'
      },
      async (payload) => {
        const participant = payload.new
        // Only notify if we're the recipient and status is ringing
        const { data: { user } } = await supabase.auth.getUser()
        if (participant.user_id === user?.id && participant.status === 'ringing') {
          // Fetch call details
          const { data } = await supabase
            .from('call_participants')
            .select(`
              *,
              group_calls (*)
            `)
            .eq('id', participant.id)
            .single()

          if (data) callback(data as CallParticipant & { group_calls: GroupCall })
        }
      }
    )
    .subscribe()
}
