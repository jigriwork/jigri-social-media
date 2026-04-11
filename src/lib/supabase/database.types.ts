export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          created_at: string
          updated_at: string | null
          email: string
          name: string
          username: string
          bio: string | null
          image_url: string | null
          role: 'user' | 'moderator' | 'admin' | 'super_admin' | null
          is_admin: boolean | null
          is_active: boolean | null
          is_deactivated: boolean | null
          last_active: string | null
          privacy_setting: 'public' | 'private' | 'followers_only' | null
          is_verified: boolean
          verification_badge_type: 'verified' | 'official' | null
          verification_status: 'none' | 'pending' | 'verified' | 'revoked'
          verification_updated_at: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string | null
          email: string
          name: string
          username: string
          bio?: string | null
          image_url?: string | null
          role?: 'user' | 'moderator' | 'admin' | 'super_admin' | null
          is_admin?: boolean | null
          is_active?: boolean | null
          is_deactivated?: boolean | null
          last_active?: string | null
          privacy_setting?: 'public' | 'private' | 'followers_only' | null
          is_verified?: boolean
          verification_badge_type?: 'verified' | 'official' | null
          verification_status?: 'none' | 'pending' | 'verified' | 'revoked'
          verification_updated_at?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string | null
          email?: string
          name?: string
          username?: string
          bio?: string | null
          image_url?: string | null
          role?: 'user' | 'moderator' | 'admin' | 'super_admin' | null
          is_admin?: boolean | null
          is_active?: boolean | null
          is_deactivated?: boolean | null
          last_active?: string | null
          privacy_setting?: 'public' | 'private' | 'followers_only' | null
          is_verified?: boolean
          verification_badge_type?: 'verified' | 'official' | null
          verification_status?: 'none' | 'pending' | 'verified' | 'revoked'
          verification_updated_at?: string | null
        }
      }
      posts: {
        Row: {
          id: string
          created_at: string
          updated_at: string | null
          caption: string
          image_url: string | null
          location: string | null
          tags: string[] | null
          creator_id: string
          category: 'general' | 'announcement' | 'question' | null
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string | null
          caption: string
          image_url?: string | null
          location?: string | null
          tags?: string[] | null
          creator_id: string
          category?: 'general' | 'announcement' | 'question' | null
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string | null
          caption?: string
          image_url?: string | null
          location?: string | null
          tags?: string[] | null
          creator_id?: string
          category?: 'general' | 'announcement' | 'question' | null
        }
      }
      likes: {
        Row: {
          id: string
          created_at: string
          user_id: string
          post_id: string
        }
        Insert: {
          id?: string
          created_at?: string
          user_id: string
          post_id: string
        }
        Update: {
          id?: string
          created_at?: string
          user_id?: string
          post_id?: string
        }
      }
      saves: {
        Row: {
          id: string
          created_at: string
          user_id: string
          post_id: string
        }
        Insert: {
          id?: string
          created_at?: string
          user_id: string
          post_id: string
        }
        Update: {
          id?: string
          created_at?: string
          user_id?: string
          post_id?: string
        }
      }
      follows: {
        Row: {
          id: string
          created_at: string
          follower_id: string
          following_id: string
        }
        Insert: {
          id?: string
          created_at?: string
          follower_id: string
          following_id: string
        }
        Update: {
          id?: string
          created_at?: string
          follower_id?: string
          following_id?: string
        }
      }
      comments: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          content: string
          user_id: string
          post_id: string
          parent_id: string | null
          is_edited: boolean
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          content: string
          user_id: string
          post_id: string
          parent_id?: string | null
          is_edited?: boolean
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
          content?: string
          user_id?: string
          post_id?: string
          parent_id?: string | null
          is_edited?: boolean
        }
      }
      comment_likes: {
        Row: {
          id: string
          created_at: string
          user_id: string
          comment_id: string
        }
        Insert: {
          id?: string
          created_at?: string
          user_id: string
          comment_id: string
        }
        Update: {
          id?: string
          created_at?: string
          user_id?: string
          comment_id?: string
        }
      }
      governance_audit_log: {
        Row: {
          id: string
          created_at: string
          actor_user_id: string | null
          actor_role: 'user' | 'moderator' | 'admin' | 'super_admin' | null
          action_type: string
          target_type: string
          target_id: string | null
          reason: string | null
          metadata: Record<string, any>
          before_snapshot: Record<string, any> | null
          after_snapshot: Record<string, any> | null
        }
        Insert: {
          id?: string
          created_at?: string
          actor_user_id?: string | null
          actor_role?: 'user' | 'moderator' | 'admin' | 'super_admin' | null
          action_type: string
          target_type: string
          target_id?: string | null
          reason?: string | null
          metadata?: Record<string, any>
          before_snapshot?: Record<string, any> | null
          after_snapshot?: Record<string, any> | null
        }
        Update: {
          id?: string
          created_at?: string
          actor_user_id?: string | null
          actor_role?: 'user' | 'moderator' | 'admin' | 'super_admin' | null
          action_type?: string
          target_type?: string
          target_id?: string | null
          reason?: string | null
          metadata?: Record<string, any>
          before_snapshot?: Record<string, any> | null
          after_snapshot?: Record<string, any> | null
        }
      }
      reports: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          reporter_user_id: string | null
          entity_type: string
          entity_id: string | null
          reason_code: string
          description: string | null
          status: 'open' | 'triaged' | 'in_review' | 'resolved' | 'dismissed' | 'escalated'
          priority: 'low' | 'normal' | 'high' | 'critical'
          assigned_to_user_id: string | null
          resolved_at: string | null
          resolution_code: string | null
          resolution_note: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          reporter_user_id?: string | null
          entity_type: string
          entity_id?: string | null
          reason_code: string
          description?: string | null
          status?: 'open' | 'triaged' | 'in_review' | 'resolved' | 'dismissed' | 'escalated'
          priority?: 'low' | 'normal' | 'high' | 'critical'
          assigned_to_user_id?: string | null
          resolved_at?: string | null
          resolution_code?: string | null
          resolution_note?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
          reporter_user_id?: string | null
          entity_type?: string
          entity_id?: string | null
          reason_code?: string
          description?: string | null
          status?: 'open' | 'triaged' | 'in_review' | 'resolved' | 'dismissed' | 'escalated'
          priority?: 'low' | 'normal' | 'high' | 'critical'
          assigned_to_user_id?: string | null
          resolved_at?: string | null
          resolution_code?: string | null
          resolution_note?: string | null
        }
      }
      report_actions: {
        Row: {
          id: string
          created_at: string
          report_id: string
          actor_user_id: string | null
          actor_role: 'user' | 'moderator' | 'admin' | 'super_admin' | null
          action_type: string
          reason: string | null
          metadata: Record<string, any>
        }
        Insert: {
          id?: string
          created_at?: string
          report_id: string
          actor_user_id?: string | null
          actor_role?: 'user' | 'moderator' | 'admin' | 'super_admin' | null
          action_type: string
          reason?: string | null
          metadata?: Record<string, any>
        }
        Update: {
          id?: string
          created_at?: string
          report_id?: string
          actor_user_id?: string | null
          actor_role?: 'user' | 'moderator' | 'admin' | 'super_admin' | null
          action_type?: string
          reason?: string | null
          metadata?: Record<string, any>
        }
      }
      verification_applications: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          applicant_user_id: string
          status: 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'revoked' | 'needs_resubmission' | 'withdrawn'
          application_type: 'person' | 'creator' | 'organization'
          requested_badge_type: 'verified' | 'official'
          evidence_payload: Record<string, any>
          review_notes: string | null
          rejection_reason_code: string | null
          reviewed_by_user_id: string | null
          reviewed_at: string | null
          final_decision_by_user_id: string | null
          final_decision_at: string | null
          resubmission_count: number
          cooldown_until: string | null
          active: boolean
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          applicant_user_id: string
          status?: 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'revoked' | 'needs_resubmission' | 'withdrawn'
          application_type?: 'person' | 'creator' | 'organization'
          requested_badge_type?: 'verified' | 'official'
          evidence_payload?: Record<string, any>
          review_notes?: string | null
          rejection_reason_code?: string | null
          reviewed_by_user_id?: string | null
          reviewed_at?: string | null
          final_decision_by_user_id?: string | null
          final_decision_at?: string | null
          resubmission_count?: number
          cooldown_until?: string | null
          active?: boolean
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
          applicant_user_id?: string
          status?: 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'revoked' | 'needs_resubmission' | 'withdrawn'
          application_type?: 'person' | 'creator' | 'organization'
          requested_badge_type?: 'verified' | 'official'
          evidence_payload?: Record<string, any>
          review_notes?: string | null
          rejection_reason_code?: string | null
          reviewed_by_user_id?: string | null
          reviewed_at?: string | null
          final_decision_by_user_id?: string | null
          final_decision_at?: string | null
          resubmission_count?: number
          cooldown_until?: string | null
          active?: boolean
        }
      }
      verification_application_events: {
        Row: {
          id: string
          created_at: string
          application_id: string
          actor_user_id: string | null
          actor_role: 'user' | 'moderator' | 'admin' | 'super_admin' | null
          event_type: string
          from_status: string | null
          to_status: string | null
          reason: string | null
          metadata: Record<string, any>
        }
        Insert: {
          id?: string
          created_at?: string
          application_id: string
          actor_user_id?: string | null
          actor_role?: 'user' | 'moderator' | 'admin' | 'super_admin' | null
          event_type: string
          from_status?: string | null
          to_status?: string | null
          reason?: string | null
          metadata?: Record<string, any>
        }
        Update: {
          id?: string
          created_at?: string
          application_id?: string
          actor_user_id?: string | null
          actor_role?: 'user' | 'moderator' | 'admin' | 'super_admin' | null
          event_type?: string
          from_status?: string | null
          to_status?: string | null
          reason?: string | null
          metadata?: Record<string, any>
        }
      }
      conversations: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          participant_one: string
          participant_two: string
          last_message_at: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          participant_one: string
          participant_two: string
          last_message_at?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
          participant_one?: string
          participant_two?: string
          last_message_at?: string | null
        }
      }
      messages: {
        Row: {
          id: string
          created_at: string
          conversation_id: string
          sender_id: string
          content: string
          read: boolean
        }
        Insert: {
          id?: string
          created_at?: string
          conversation_id: string
          sender_id: string
          content: string
          read?: boolean
        }
        Update: {
          id?: string
          created_at?: string
          conversation_id?: string
          sender_id?: string
          content?: string
          read?: boolean
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
