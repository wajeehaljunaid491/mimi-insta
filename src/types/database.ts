export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          username: string
          email: string
          full_name: string | null
          avatar_url: string | null
          bio: string | null
          phone_number: string | null
          date_of_birth: string | null
          status: 'available' | 'busy' | 'offline' | 'do_not_disturb'
          last_seen: string
          is_online: boolean
          is_private: boolean
          allow_calls_from: 'everyone' | 'following' | 'mutual' | 'nobody'
          is_verified: boolean
          account_type: 'personal' | 'business' | 'creator'
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          username: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          bio?: string | null
          phone_number?: string | null
          date_of_birth?: string | null
          status?: 'available' | 'busy' | 'offline' | 'do_not_disturb'
          last_seen?: string
          is_online?: boolean
          is_private?: boolean
          allow_calls_from?: 'everyone' | 'following' | 'mutual' | 'nobody'
          is_verified?: boolean
          account_type?: 'personal' | 'business' | 'creator'
        }
        Update: {
          username?: string
          full_name?: string | null
          avatar_url?: string | null
          bio?: string | null
          phone_number?: string | null
          date_of_birth?: string | null
          status?: 'available' | 'busy' | 'offline' | 'do_not_disturb'
          last_seen?: string
          is_online?: boolean
          is_private?: boolean
          allow_calls_from?: 'everyone' | 'following' | 'mutual' | 'nobody'
        }
      }
      follows: {
        Row: {
          id: string
          follower_id: string
          following_id: string
          status: 'pending' | 'accepted' | 'rejected' | 'blocked'
          is_close_friend: boolean
          notification_enabled: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          follower_id: string
          following_id: string
          status?: 'pending' | 'accepted' | 'rejected' | 'blocked'
          is_close_friend?: boolean
          notification_enabled?: boolean
        }
        Update: {
          status?: 'pending' | 'accepted' | 'rejected' | 'blocked'
          is_close_friend?: boolean
          notification_enabled?: boolean
        }
      }
      call_logs: {
        Row: {
          id: string
          caller_id: string
          receiver_id: string
          call_type: 'voice' | 'video'
          status: 'calling' | 'ringing' | 'accepted' | 'rejected' | 'missed' | 'ended' | 'failed' | 'cancelled' | 'busy'
          started_at: string
          answered_at: string | null
          ended_at: string | null
          duration_seconds: number
          ring_duration_seconds: number
          offer: Json | null
          answer: Json | null
          ice_candidates: Json
          connection_quality: 'excellent' | 'good' | 'fair' | 'poor' | null
          packet_loss_percentage: number | null
          average_latency_ms: number | null
          is_online_when_called: boolean
          rejection_reason: string | null
          failure_reason: string | null
          device_info: Json | null
          is_deleted_by_caller: boolean
          is_deleted_by_receiver: boolean
          rating: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          caller_id: string
          receiver_id: string
          call_type?: 'voice' | 'video'
          status?: 'calling' | 'ringing' | 'accepted' | 'rejected' | 'missed' | 'ended' | 'failed' | 'cancelled' | 'busy'
          is_online_when_called?: boolean
        }
        Update: {
          status?: 'calling' | 'ringing' | 'accepted' | 'rejected' | 'missed' | 'ended' | 'failed' | 'cancelled' | 'busy'
          answered_at?: string | null
          ended_at?: string | null
          duration_seconds?: number
          ring_duration_seconds?: number
          offer?: Json | null
          answer?: Json | null
          connection_quality?: 'excellent' | 'good' | 'fair' | 'poor' | null
          rejection_reason?: string | null
          failure_reason?: string | null
          rating?: number | null
        }
      }
      blocked_users: {
        Row: {
          id: string
          blocker_id: string
          blocked_id: string
          reason: string | null
          created_at: string
        }
        Insert: {
          blocker_id: string
          blocked_id: string
          reason?: string | null
        }
        Update: {
          reason?: string | null
        }
      }
      user_settings: {
        Row: {
          user_id: string
          auto_answer_from_favorites: boolean
          call_notification_sound: string
          vibration_enabled: boolean
          show_online_status: boolean
          show_last_seen: boolean
          allow_friend_suggestions: boolean
          push_notifications_enabled: boolean
          email_notifications_enabled: boolean
          call_notifications_enabled: boolean
          message_notifications_enabled: boolean
          auto_download_media: boolean
          media_quality: 'auto' | 'high' | 'medium' | 'low'
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          auto_answer_from_favorites?: boolean
          call_notification_sound?: string
          vibration_enabled?: boolean
          show_online_status?: boolean
          show_last_seen?: boolean
          allow_friend_suggestions?: boolean
          push_notifications_enabled?: boolean
          email_notifications_enabled?: boolean
          call_notifications_enabled?: boolean
          message_notifications_enabled?: boolean
          auto_download_media?: boolean
          media_quality?: 'auto' | 'high' | 'medium' | 'low'
        }
        Update: {
          auto_answer_from_favorites?: boolean
          call_notification_sound?: string
          vibration_enabled?: boolean
          show_online_status?: boolean
          show_last_seen?: boolean
          allow_friend_suggestions?: boolean
          push_notifications_enabled?: boolean
          email_notifications_enabled?: boolean
          call_notifications_enabled?: boolean
          message_notifications_enabled?: boolean
          auto_download_media?: boolean
          media_quality?: 'auto' | 'high' | 'medium' | 'low'
        }
      }
    }
    Views: {
      online_users: {
        Row: {
          id: string
          username: string
          full_name: string | null
          avatar_url: string | null
          status: string
          is_online: boolean
          last_seen: string
          is_verified: boolean
        }
      }
      user_call_history: {
        Row: {
          id: string
          caller_id: string
          caller_username: string
          caller_avatar: string | null
          receiver_id: string
          receiver_username: string
          receiver_avatar: string | null
          call_type: string
          status: string
          started_at: string
          answered_at: string | null
          ended_at: string | null
          duration_seconds: number
          connection_quality: string | null
          rating: number | null
        }
      }
    }
    Functions: {
      are_users_mutual_followers: {
        Args: { user1_id: string; user2_id: string }
        Returns: boolean
      }
      is_user_blocked: {
        Args: { checker_id: string; target_id: string }
        Returns: boolean
      }
      is_username_available: {
        Args: { desired_username: string }
        Returns: boolean
      }
      get_user_by_username: {
        Args: { search_username: string }
        Returns: Database['public']['Tables']['profiles']['Row'][]
      }
      check_call_rate_limit: {
        Args: { user_id: string }
        Returns: boolean
      }
      get_active_call: {
        Args: { for_user_id: string }
        Returns: {
          id: string
          caller_id: string
          caller_username: string
          caller_avatar: string | null
          receiver_id: string
          receiver_username: string
          receiver_avatar: string | null
          call_type: string
          status: string
          started_at: string
          is_caller: boolean
        }[]
      }
      search_users: {
        Args: { search_query: string; searcher_id: string; limit_count?: number }
        Returns: {
          id: string
          username: string
          full_name: string | null
          avatar_url: string | null
          bio: string | null
          status: string
          is_online: boolean
          is_verified: boolean
          is_following: boolean
          is_follower: boolean
          is_blocked: boolean
        }[]
      }
    }
  }
}
