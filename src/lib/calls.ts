import { supabase } from '@/lib/supabase/client'

export async function initiateCall(receiverId: string, callType: 'voice' | 'video' = 'voice') {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      console.error('Not authenticated')
      alert('You must be logged in to make calls')
      return null
    }

    console.log('Initiating call to:', receiverId, 'type:', callType)

    // Create call log
    const { data: callLog, error } = await supabase
      .from('call_logs')
      .insert({
        caller_id: user.id,
        receiver_id: receiverId,
        call_type: callType,
        status: 'calling'
      } as any)
      .select()
      .single()

    if (error) {
      console.error('Error creating call:', error)
      alert(`Failed to create call: ${error.message}. Make sure you have run the database SQL in Supabase.`)
      return null
    }

    console.log('Call created successfully:', callLog)
    return callLog
  } catch (err) {
    console.error('Exception in initiateCall:', err)
    alert('An error occurred while making the call')
    return null
  }
}

export async function answerCall(callId: string) {
  console.log('Answering call:', callId)
  
  try {
    const { data, error } = await supabase
      .from('call_logs')
      .update({
        status: 'accepted',
        answered_at: new Date().toISOString()
      })
      .eq('id', callId)
      .select()

    if (error) {
      console.error('Error answering call:', error)
      alert(`Failed to answer call: ${error.message}`)
      return false
    }

    console.log('Call answered successfully:', data)
    return true
  } catch (err) {
    console.error('Exception answering call:', err)
    alert('Error answering call')
    return false
  }
}

export async function rejectCall(callId: string) {
  console.log('Rejecting call:', callId)
  
  try {
    const { data, error } = await supabase
      .from('call_logs')
      .update({
        status: 'rejected',
        ended_at: new Date().toISOString()
      })
      .eq('id', callId)
      .select()

    if (error) {
      console.error('Error rejecting call:', error)
      alert(`Failed to reject call: ${error.message}`)
      return false
    }

    console.log('Call rejected successfully:', data)
    return true
  } catch (err) {
    console.error('Exception rejecting call:', err)
    alert('Error rejecting call')
    return false
  }
}

export async function endCall(callId: string) {
  console.log('Ending call:', callId)
  
  try {
    // Get call to calculate duration
    const { data: call, error: fetchError } = await supabase
      .from('call_logs')
      .select('answered_at, status')
      .eq('id', callId)
      .single()

    if (fetchError) {
      console.error('Error fetching call for end:', fetchError)
    }

    // Don't update if already ended
    if (call && ['ended', 'rejected', 'missed', 'cancelled'].includes((call as any).status)) {
      console.log('Call already ended with status:', (call as any).status)
      return true
    }

    let duration = 0
    if ((call as any)?.answered_at) {
      const answered = new Date((call as any).answered_at)
      duration = Math.floor((Date.now() - answered.getTime()) / 1000)
    }

    const { data, error } = await supabase
      .from('call_logs')
      .update({
        status: 'ended',
        ended_at: new Date().toISOString(),
        duration_seconds: duration,
        // Clear WebRTC data to prevent reconnection attempts
        offer: null,
        answer: null,
        ice_candidates: []
      } as any)
      .eq('id', callId)
      .select()

    if (error) {
      console.error('Error ending call:', error)
      // Try a simpler update without clearing WebRTC data
      const { error: retryError } = await supabase
        .from('call_logs')
        .update({
          status: 'ended',
          ended_at: new Date().toISOString(),
          duration_seconds: duration
        } as any)
        .eq('id', callId)
      
      if (retryError) {
        console.error('Retry also failed:', retryError)
        return false
      }
    }

    console.log('Call ended successfully:', data)
    return true
  } catch (err) {
    console.error('Exception ending call:', err)
    return false
  }
}

// Cancel a call (when caller hangs up before answer)
export async function cancelCall(callId: string) {
  console.log('Cancelling call:', callId)
  
  try {
    const { data, error } = await supabase
      .from('call_logs')
      .update({
        status: 'cancelled',
        ended_at: new Date().toISOString(),
        offer: null,
        answer: null,
        ice_candidates: []
      } as any)
      .eq('id', callId)
      .select()

    if (error) {
      console.error('Error cancelling call:', error)
      return false
    }

    console.log('Call cancelled successfully:', data)
    return true
  } catch (err) {
    console.error('Exception cancelling call:', err)
    return false
  }
}

export async function getCallHistory(limit = 20) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('call_logs')
    .select(`
      *,
      caller:profiles!call_logs_caller_id_fkey(id, username, avatar_url),
      receiver:profiles!call_logs_receiver_id_fkey(id, username, avatar_url)
    `)
    .or(`caller_id.eq.${user.id},receiver_id.eq.${user.id}`)
    .order('started_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching call history:', error)
    return []
  }

  return data || []
}

export async function getActiveCall() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('call_logs')
    .select(`
      *,
      caller:profiles!call_logs_caller_id_fkey(id, username, avatar_url),
      receiver:profiles!call_logs_receiver_id_fkey(id, username, avatar_url)
    `)
    .or(`caller_id.eq.${user.id},receiver_id.eq.${user.id}`)
    .in('status', ['calling', 'ringing', 'accepted'])
    .order('started_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !data) return null

  return data
}

// Delete a single call from history
export async function deleteCall(callId: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { error } = await supabase
    .from('call_logs')
    .delete()
    .eq('id', callId)
    .or(`caller_id.eq.${user.id},receiver_id.eq.${user.id}`)

  if (error) {
    console.error('Error deleting call:', error)
    return false
  }

  return true
}

// Delete all call history for the current user
export async function deleteAllCallHistory(): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { error } = await supabase
    .from('call_logs')
    .delete()
    .or(`caller_id.eq.${user.id},receiver_id.eq.${user.id}`)

  if (error) {
    console.error('Error deleting call history:', error)
    return false
  }

  return true
}

// Get call history with pagination
export async function getCallHistoryPaginated(page: number = 0, pageSize: number = 10) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { calls: [], hasMore: false }

  const from = page * pageSize
  const to = from + pageSize

  const { data, error, count } = await supabase
    .from('call_logs')
    .select(`
      *,
      caller:profiles!call_logs_caller_id_fkey(id, username, avatar_url),
      receiver:profiles!call_logs_receiver_id_fkey(id, username, avatar_url)
    `, { count: 'exact' })
    .or(`caller_id.eq.${user.id},receiver_id.eq.${user.id}`)
    .order('started_at', { ascending: false })
    .range(from, to - 1)

  if (error) {
    console.error('Error fetching call history:', error)
    return { calls: [], hasMore: false }
  }

  return {
    calls: data || [],
    hasMore: count ? from + pageSize < count : false,
    total: count || 0
  }
}
