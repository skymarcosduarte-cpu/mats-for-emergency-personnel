export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      app_releases: {
        Row: {
          id: string
          min_supported: string
          release_notes: string | null
          released_at: string | null
          version: string
        }
        Insert: {
          id?: string
          min_supported: string
          release_notes?: string | null
          released_at?: string | null
          version: string
        }
        Update: {
          id?: string
          min_supported?: string
          release_notes?: string | null
          released_at?: string | null
          version?: string
        }
        Relationships: []
      }
      app_state: {
        Row: {
          disaster_mode: boolean | null
          disaster_started_at: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          disaster_mode?: boolean | null
          disaster_started_at?: string | null
          id?: string
          updated_at?: string | null
        }
        Update: {
          disaster_mode?: boolean | null
          disaster_started_at?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      beta_feedback: {
        Row: {
          category: string
          created_at: string
          email: string
          id: string
          invite_code: string | null
          message: string
          name: string
        }
        Insert: {
          category?: string
          created_at?: string
          email: string
          id?: string
          invite_code?: string | null
          message: string
          name: string
        }
        Update: {
          category?: string
          created_at?: string
          email?: string
          id?: string
          invite_code?: string | null
          message?: string
          name?: string
        }
        Relationships: []
      }
      clave100_checkins: {
        Row: {
          created_at: string
          drill_id: string | null
          id: string
          lat: number
          lng: number
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          drill_id?: string | null
          id?: string
          lat: number
          lng: number
          status: string
          user_id: string
        }
        Update: {
          created_at?: string
          drill_id?: string | null
          id?: string
          lat?: number
          lng?: number
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clave100_checkins_drill_id_fkey"
            columns: ["drill_id"]
            isOneToOne: false
            referencedRelation: "clave100_drills"
            referencedColumns: ["id"]
          },
        ]
      }
      clave100_drills: {
        Row: {
          chat_closed_at: string | null
          chat_closed_by: string | null
          created_at: string
          creator_id: string
          id: string
          notification_sent_at: string | null
          notified_users: number | null
          scheduled_at: string
          status: string
        }
        Insert: {
          chat_closed_at?: string | null
          chat_closed_by?: string | null
          created_at?: string
          creator_id: string
          id?: string
          notification_sent_at?: string | null
          notified_users?: number | null
          scheduled_at: string
          status?: string
        }
        Update: {
          chat_closed_at?: string | null
          chat_closed_by?: string | null
          created_at?: string
          creator_id?: string
          id?: string
          notification_sent_at?: string | null
          notified_users?: number | null
          scheduled_at?: string
          status?: string
        }
        Relationships: []
      }
      community_events: {
        Row: {
          created_at: string
          event_type: string
          expires_at: string | null
          id: string
          image_url: string | null
          image_urls: string[] | null
          is_active: boolean
          message: string | null
          target_user_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          expires_at?: string | null
          id?: string
          image_url?: string | null
          image_urls?: string[] | null
          is_active?: boolean
          message?: string | null
          target_user_id?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          expires_at?: string | null
          id?: string
          image_url?: string | null
          image_urls?: string[] | null
          is_active?: boolean
          message?: string | null
          target_user_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      community_messages: {
        Row: {
          audio_duration_ms: number | null
          audio_url: string | null
          context_id: string | null
          context_type: string
          created_at: string
          id: string
          image_url: string | null
          message: string
          sender_id: string
        }
        Insert: {
          audio_duration_ms?: number | null
          audio_url?: string | null
          context_id?: string | null
          context_type?: string
          created_at?: string
          id?: string
          image_url?: string | null
          message: string
          sender_id: string
        }
        Update: {
          audio_duration_ms?: number | null
          audio_url?: string | null
          context_id?: string | null
          context_type?: string
          created_at?: string
          id?: string
          image_url?: string | null
          message?: string
          sender_id?: string
        }
        Relationships: []
      }
      emergency_contacts: {
        Row: {
          created_at: string
          email: string | null
          id: string
          is_primary: boolean
          name: string
          phone: string
          relationship: string | null
          sort_order: number
          updated_at: string
          user_id: string
          whatsapp: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean
          name: string
          phone: string
          relationship?: string | null
          sort_order?: number
          updated_at?: string
          user_id: string
          whatsapp?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean
          name?: string
          phone?: string
          relationship?: string | null
          sort_order?: number
          updated_at?: string
          user_id?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      help_request_responders: {
        Row: {
          arrived_at: string | null
          estimated_eta_minutes: number | null
          id: string
          lat: number | null
          lng: number | null
          request_id: string
          started_at: string
          transport_mode: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          arrived_at?: string | null
          estimated_eta_minutes?: number | null
          id?: string
          lat?: number | null
          lng?: number | null
          request_id: string
          started_at?: string
          transport_mode?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          arrived_at?: string | null
          estimated_eta_minutes?: number | null
          id?: string
          lat?: number | null
          lng?: number | null
          request_id?: string
          started_at?: string
          transport_mode?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "help_request_responders_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "help_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      help_requests: {
        Row: {
          arrived_at: string | null
          audio_duration_ms: number | null
          audio_url: string | null
          created_at: string | null
          id: string
          kind: string
          lat: number
          lng: number
          message: string | null
          quake_event_id: string | null
          resolved: boolean | null
          resolved_at: string | null
          resolved_by: string | null
          responding_by: string | null
          responding_started_at: string | null
          user_id: string
        }
        Insert: {
          arrived_at?: string | null
          audio_duration_ms?: number | null
          audio_url?: string | null
          created_at?: string | null
          id?: string
          kind: string
          lat: number
          lng: number
          message?: string | null
          quake_event_id?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          responding_by?: string | null
          responding_started_at?: string | null
          user_id: string
        }
        Update: {
          arrived_at?: string | null
          audio_duration_ms?: number | null
          audio_url?: string | null
          created_at?: string | null
          id?: string
          kind?: string
          lat?: number
          lng?: number
          message?: string | null
          quake_event_id?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          responding_by?: string | null
          responding_started_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      internal_messages: {
        Row: {
          audio_duration_ms: number | null
          audio_url: string | null
          created_at: string
          id: string
          image_url: string | null
          message: string
          read: boolean
          receiver_id: string
          sender_id: string
        }
        Insert: {
          audio_duration_ms?: number | null
          audio_url?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          message: string
          read?: boolean
          receiver_id: string
          sender_id: string
        }
        Update: {
          audio_duration_ms?: number | null
          audio_url?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          message?: string
          read?: boolean
          receiver_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      invites: {
        Row: {
          code: string
          created_at: string | null
          created_by: string
          expires_at: string | null
          id: string
          max_uses: number | null
          used_count: number | null
        }
        Insert: {
          code: string
          created_at?: string | null
          created_by: string
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          used_count?: number | null
        }
        Update: {
          code?: string
          created_at?: string | null
          created_by?: string
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          used_count?: number | null
        }
        Relationships: []
      }
      marketplace_listings: {
        Row: {
          category: string
          created_at: string
          description: string
          id: string
          images: string[] | null
          is_active: boolean | null
          price: number | null
          title: string
          updated_at: string
          user_id: string
          valid_until: string
        }
        Insert: {
          category?: string
          created_at?: string
          description: string
          id?: string
          images?: string[] | null
          is_active?: boolean | null
          price?: number | null
          title: string
          updated_at?: string
          user_id: string
          valid_until: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          id?: string
          images?: string[] | null
          is_active?: boolean | null
          price?: number | null
          title?: string
          updated_at?: string
          user_id?: string
          valid_until?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          listing_id: string | null
          message: string | null
          read: boolean | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          listing_id?: string | null
          message?: string | null
          read?: boolean | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          listing_id?: string | null
          message?: string | null
          read?: boolean | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "marketplace_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      panic_event_responders: {
        Row: {
          arrived_at: string | null
          estimated_eta_minutes: number | null
          id: string
          lat: number | null
          lng: number | null
          panic_id: string
          started_at: string
          transport_mode: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          arrived_at?: string | null
          estimated_eta_minutes?: number | null
          id?: string
          lat?: number | null
          lng?: number | null
          panic_id: string
          started_at?: string
          transport_mode?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          arrived_at?: string | null
          estimated_eta_minutes?: number | null
          id?: string
          lat?: number | null
          lng?: number | null
          panic_id?: string
          started_at?: string
          transport_mode?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "panic_event_responders_panic_id_fkey"
            columns: ["panic_id"]
            isOneToOne: false
            referencedRelation: "panic_events"
            referencedColumns: ["id"]
          },
        ]
      }
      panic_events: {
        Row: {
          arrived_at: string | null
          audio_duration_ms: number | null
          audio_url: string | null
          created_at: string | null
          id: string
          lat: number
          lng: number
          message: string | null
          panic_type: string
          resolved: boolean | null
          resolved_at: string | null
          resolved_by: string | null
          responding_by: string | null
          responding_started_at: string | null
          user_id: string
        }
        Insert: {
          arrived_at?: string | null
          audio_duration_ms?: number | null
          audio_url?: string | null
          created_at?: string | null
          id?: string
          lat: number
          lng: number
          message?: string | null
          panic_type: string
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          responding_by?: string | null
          responding_started_at?: string | null
          user_id: string
        }
        Update: {
          arrived_at?: string | null
          audio_duration_ms?: number | null
          audio_url?: string | null
          created_at?: string | null
          id?: string
          lat?: number
          lng?: number
          message?: string | null
          panic_type?: string
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          responding_by?: string | null
          responding_started_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          allergies: string | null
          birthday: string | null
          blood_type: string | null
          can_provide_medical_assistance: boolean | null
          created_at: string | null
          current_medications: string | null
          emergency_medical_notes: string | null
          full_name: string
          has_ambulance: boolean | null
          has_first_aid_kit: boolean | null
          has_k9_unit: boolean | null
          has_rescue_unit: boolean | null
          id: string
          invite_code_used: string | null
          medical_conditions: string | null
          nickname: string
          opt_out_drills: boolean
          phone: string
          privacy_consent_at: string | null
          share_location: boolean
          share_medical_info: boolean
          show_name_on_map: boolean
          specialty: string[] | null
          terms_accepted_at: string | null
          tutorial_disclaimer_accepted_at: string | null
          updated_at: string | null
        }
        Insert: {
          allergies?: string | null
          birthday?: string | null
          blood_type?: string | null
          can_provide_medical_assistance?: boolean | null
          created_at?: string | null
          current_medications?: string | null
          emergency_medical_notes?: string | null
          full_name: string
          has_ambulance?: boolean | null
          has_first_aid_kit?: boolean | null
          has_k9_unit?: boolean | null
          has_rescue_unit?: boolean | null
          id: string
          invite_code_used?: string | null
          medical_conditions?: string | null
          nickname: string
          opt_out_drills?: boolean
          phone: string
          privacy_consent_at?: string | null
          share_location?: boolean
          share_medical_info?: boolean
          show_name_on_map?: boolean
          specialty?: string[] | null
          terms_accepted_at?: string | null
          tutorial_disclaimer_accepted_at?: string | null
          updated_at?: string | null
        }
        Update: {
          allergies?: string | null
          birthday?: string | null
          blood_type?: string | null
          can_provide_medical_assistance?: boolean | null
          created_at?: string | null
          current_medications?: string | null
          emergency_medical_notes?: string | null
          full_name?: string
          has_ambulance?: boolean | null
          has_first_aid_kit?: boolean | null
          has_k9_unit?: boolean | null
          has_rescue_unit?: boolean | null
          id?: string
          invite_code_used?: string | null
          medical_conditions?: string | null
          nickname?: string
          opt_out_drills?: boolean
          phone?: string
          privacy_consent_at?: string | null
          share_location?: boolean
          share_medical_info?: boolean
          show_name_on_map?: boolean
          specialty?: string[] | null
          terms_accepted_at?: string | null
          tutorial_disclaimer_accepted_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles_public: {
        Row: {
          can_provide_medical_assistance: boolean | null
          has_ambulance: boolean | null
          has_first_aid_kit: boolean | null
          has_k9_unit: boolean | null
          has_rescue_unit: boolean | null
          nickname: string | null
          share_location: boolean
          show_name_on_map: boolean
          specialties: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          can_provide_medical_assistance?: boolean | null
          has_ambulance?: boolean | null
          has_first_aid_kit?: boolean | null
          has_k9_unit?: boolean | null
          has_rescue_unit?: boolean | null
          nickname?: string | null
          share_location?: boolean
          show_name_on_map?: boolean
          specialties?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          can_provide_medical_assistance?: boolean | null
          has_ambulance?: boolean | null
          has_first_aid_kit?: boolean | null
          has_k9_unit?: boolean | null
          has_rescue_unit?: boolean | null
          nickname?: string | null
          share_location?: boolean
          show_name_on_map?: boolean
          specialties?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      quake_checkins: {
        Row: {
          created_at: string | null
          damage_report: string
          id: string
          intensity: number
          lat: number
          lng: number
          user_id: string
          usgs_event_id: string
        }
        Insert: {
          created_at?: string | null
          damage_report: string
          id?: string
          intensity: number
          lat: number
          lng: number
          user_id: string
          usgs_event_id: string
        }
        Update: {
          created_at?: string | null
          damage_report?: string
          id?: string
          intensity?: number
          lat?: number
          lng?: number
          user_id?: string
          usgs_event_id?: string
        }
        Relationships: []
      }
      registration_logs: {
        Row: {
          client_info: Json | null
          created_at: string | null
          email_hash: string
          error_code: string | null
          error_message: string | null
          id: string
          invite_code: string | null
          status: string
        }
        Insert: {
          client_info?: Json | null
          created_at?: string | null
          email_hash: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          invite_code?: string | null
          status: string
        }
        Update: {
          client_info?: Json | null
          created_at?: string | null
          email_hash?: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          invite_code?: string | null
          status?: string
        }
        Relationships: []
      }
      report_media: {
        Row: {
          created_at: string | null
          duration_ms: number | null
          id: string
          media_type: string
          mime_type: string
          report_id: string
          report_type: string
          storage_path: string
        }
        Insert: {
          created_at?: string | null
          duration_ms?: number | null
          id?: string
          media_type: string
          mime_type: string
          report_id: string
          report_type: string
          storage_path: string
        }
        Update: {
          created_at?: string | null
          duration_ms?: number | null
          id?: string
          media_type?: string
          mime_type?: string
          report_id?: string
          report_type?: string
          storage_path?: string
        }
        Relationships: []
      }
      road_reports: {
        Row: {
          category: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          lat: number
          lng: number
          resolved_at: string | null
          severity: number
          title: string
          trip_id: string | null
          user_id: string
          verification_count: number
          verified_by: string[] | null
        }
        Insert: {
          category: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          lat: number
          lng: number
          resolved_at?: string | null
          severity: number
          title: string
          trip_id?: string | null
          user_id: string
          verification_count?: number
          verified_by?: string[] | null
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          lat?: number
          lng?: number
          resolved_at?: string | null
          severity?: number
          title?: string
          trip_id?: string | null
          user_id?: string
          verification_count?: number
          verified_by?: string[] | null
        }
        Relationships: []
      }
      skyalert_cache: {
        Row: {
          alert_data: Json
          alert_id: string
          created_at: string
          id: string
          processed_at: string
        }
        Insert: {
          alert_data: Json
          alert_id: string
          created_at?: string
          id?: string
          processed_at?: string
        }
        Update: {
          alert_data?: Json
          alert_id?: string
          created_at?: string
          id?: string
          processed_at?: string
        }
        Relationships: []
      }
      status_messages: {
        Row: {
          created_at: string | null
          id: string
          lat: number | null
          lng: number | null
          message: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          message?: string | null
          status: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          message?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      transit_trips: {
        Row: {
          airline: string | null
          arrival_airport: string | null
          arrival_time: string | null
          arrived_at: string | null
          boarding_pass_url: string | null
          companions: string | null
          created_at: string | null
          departure_airport: string | null
          departure_time: string | null
          destination: string
          destination_lat: number | null
          destination_lng: number | null
          eta: string
          flight_number: string | null
          id: string
          origin: string
          origin_lat: number | null
          origin_lng: number | null
          plates: string | null
          share_token: string | null
          status: string
          transit_type: string
          user_id: string
          vehicle_photo_url: string | null
          vehicle_type: string | null
        }
        Insert: {
          airline?: string | null
          arrival_airport?: string | null
          arrival_time?: string | null
          arrived_at?: string | null
          boarding_pass_url?: string | null
          companions?: string | null
          created_at?: string | null
          departure_airport?: string | null
          departure_time?: string | null
          destination: string
          destination_lat?: number | null
          destination_lng?: number | null
          eta: string
          flight_number?: string | null
          id?: string
          origin: string
          origin_lat?: number | null
          origin_lng?: number | null
          plates?: string | null
          share_token?: string | null
          status?: string
          transit_type: string
          user_id: string
          vehicle_photo_url?: string | null
          vehicle_type?: string | null
        }
        Update: {
          airline?: string | null
          arrival_airport?: string | null
          arrival_time?: string | null
          arrived_at?: string | null
          boarding_pass_url?: string | null
          companions?: string | null
          created_at?: string | null
          departure_airport?: string | null
          departure_time?: string | null
          destination?: string
          destination_lat?: number | null
          destination_lng?: number | null
          eta?: string
          flight_number?: string | null
          id?: string
          origin?: string
          origin_lat?: number | null
          origin_lng?: number | null
          plates?: string | null
          share_token?: string | null
          status?: string
          transit_type?: string
          user_id?: string
          vehicle_photo_url?: string | null
          vehicle_type?: string | null
        }
        Relationships: []
      }
      trip_position_history: {
        Row: {
          accuracy: number | null
          heading: number | null
          id: string
          lat: number
          lng: number
          recorded_at: string
          speed: number | null
          trip_id: string
          user_id: string
        }
        Insert: {
          accuracy?: number | null
          heading?: number | null
          id?: string
          lat: number
          lng: number
          recorded_at?: string
          speed?: number | null
          trip_id: string
          user_id: string
        }
        Update: {
          accuracy?: number | null
          heading?: number | null
          id?: string
          lat?: number
          lng?: number
          recorded_at?: string
          speed?: number | null
          trip_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_position_history_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "transit_trips"
            referencedColumns: ["id"]
          },
        ]
      }
      user_feedback: {
        Row: {
          category: string
          created_at: string
          email: string
          id: string
          message: string
          name: string
          user_id: string | null
        }
        Insert: {
          category: string
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          user_id?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      user_locations: {
        Row: {
          accuracy: number | null
          heading: number | null
          is_online: boolean | null
          lat: number
          lng: number
          speed: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          accuracy?: number | null
          heading?: number | null
          is_online?: boolean | null
          lat: number
          lng: number
          speed?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          accuracy?: number | null
          heading?: number | null
          is_online?: boolean | null
          lat?: number
          lng?: number
          speed?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      admin_users_view: {
        Row: {
          full_name: string | null
          invite_code_used: string | null
          nickname: string | null
          phone: string | null
          registered_at: string | null
          role: Database["public"]["Enums"]["app_role"] | null
          user_id: string | null
        }
        Relationships: []
      }
      medical_providers: {
        Row: {
          can_provide_medical_assistance: boolean | null
          has_ambulance: boolean | null
          has_first_aid_kit: boolean | null
          is_online: boolean | null
          lat: number | null
          lng: number | null
          updated_at: string | null
          user_id: string | null
        }
        Relationships: []
      }
      user_locations_with_roles: {
        Row: {
          accuracy: number | null
          can_provide_medical_assistance: boolean | null
          display_name: string | null
          has_ambulance: boolean | null
          has_first_aid_kit: boolean | null
          has_k9_unit: boolean | null
          has_rescue_unit: boolean | null
          heading: number | null
          is_in_transit: boolean | null
          is_online: boolean | null
          lat: number | null
          lng: number | null
          role: Database["public"]["Enums"]["app_role"] | null
          show_name_on_map: boolean | null
          specialties: string[] | null
          speed: number | null
          transit_destination: string | null
          transit_destination_lat: number | null
          transit_destination_lng: number | null
          transit_eta: string | null
          transit_origin: string | null
          transit_origin_lat: number | null
          transit_origin_lng: number | null
          updated_at: string | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_beta_user_count: { Args: never; Returns: number }
      get_community_stats: {
        Args: never
        Returns: {
          community_events_total: number
          help_requests_resolved: number
          road_reports_total: number
        }[]
      }
      get_nearby_birthdays: {
        Args: never
        Returns: {
          birthday: string
          day_label: string
          full_name: string
          nickname: string
          user_id: string
        }[]
      }
      get_recent_activity: {
        Args: { limit_count?: number }
        Returns: {
          activity_message: string
          activity_type: string
          created_at: string
        }[]
      }
      get_todays_birthdays: {
        Args: never
        Returns: {
          birthday: string
          full_name: string
          nickname: string
          user_id: string
        }[]
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_users_within_radius: {
        Args: { center_lat: number; center_lng: number; radius_meters?: number }
        Returns: {
          distance_meters: number
          user_id: string
        }[]
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_ex_sos: { Args: { _user_id: string }; Returns: boolean }
      is_rescatista: { Args: { _user_id: string }; Returns: boolean }
      is_sos_activo: { Args: { _user_id: string }; Returns: boolean }
      is_within_radius_of_panic: {
        Args: {
          panic_id: string
          radius_meters?: number
          user_lat: number
          user_lng: number
        }
        Returns: boolean
      }
      is_within_radius_of_request: {
        Args: {
          radius_meters?: number
          request_id: string
          user_lat: number
          user_lng: number
        }
        Returns: boolean
      }
      unverify_report: { Args: { report_id: string }; Returns: boolean }
      use_invite_code: { Args: { invite_code: string }; Returns: boolean }
      user_has_emergency_contacts: {
        Args: { min_contacts?: number }
        Returns: boolean
      }
      validate_invite_code: { Args: { invite_code: string }; Returns: boolean }
      verify_report: { Args: { report_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "RESCATISTA" | "FAMILIAR" | "SOS_ACTIVO" | "EX_SOS"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["RESCATISTA", "FAMILIAR", "SOS_ACTIVO", "EX_SOS"],
    },
  },
} as const
