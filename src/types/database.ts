
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "app_config": {
                  Row: {
                    "key": string,"updated_at": string,"updated_by": string | null,"value": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "key": string,"updated_at"?: string,"updated_by"?: string | null,"value": NonNullable<Json>
                  }
                  Update: {
                    "key"?: string,"updated_at"?: string,"updated_by"?: string | null,"value"?: NonNullable<Json>
                  }
                  Relationships: [
                    
                  ]
                },"areas": {
                  Row: {
                    "active": boolean,"created_at": string,"id": number,"label": string,"slug": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"id"?: never,"label": string,"slug": string,"sort_order"?: number
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"id"?: never,"label"?: string,"slug"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    
                  ]
                },"audit_log": {
                  Row: {
                    "action": string,"actor_id": string | null,"at": string,"id": number,"new_data": Json | null,"old_data": Json | null,"row_pk": string | null,"table_name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"at"?: string,"id"?: never,"new_data"?: Json | null,"old_data"?: Json | null,"row_pk"?: string | null,"table_name": string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"at"?: string,"id"?: never,"new_data"?: Json | null,"old_data"?: Json | null,"row_pk"?: string | null,"table_name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"bookings": {
                  Row: {
                    "cancel_reason": string | null,"cancelled_at": string | null,"created_at": string,"decided_at": string | null,"decided_by": string | null,"event_id": string,"hold_expires_at": string | null,"id": string,"reconfirm_by": string | null,"reconfirm_requested_at": string | null,"reconfirm_token": string,"reconfirmed_at": string | null,"reminded_at": string | null,"requested_at": string,"squad_id": string | null,"status": Database["public"]['Enums']["booking_status"],"updated_at": string,"user_id": string,"waitlisted_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"event_id": string,"hold_expires_at"?: string | null,"id"?: string,"reconfirm_by"?: string | null,"reconfirm_requested_at"?: string | null,"reconfirm_token"?: string,"reconfirmed_at"?: string | null,"reminded_at"?: string | null,"requested_at"?: string,"squad_id"?: string | null,"status"?: Database["public"]['Enums']["booking_status"],"updated_at"?: string,"user_id": string,"waitlisted_at"?: string | null
                  }
                  Update: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"event_id"?: string,"hold_expires_at"?: string | null,"id"?: string,"reconfirm_by"?: string | null,"reconfirm_requested_at"?: string | null,"reconfirm_token"?: string,"reconfirmed_at"?: string | null,"reminded_at"?: string | null,"requested_at"?: string,"squad_id"?: string | null,"status"?: Database["public"]['Enums']["booking_status"],"updated_at"?: string,"user_id"?: string,"waitlisted_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "bookings_decided_by_fkey"
      columns: ["decided_by"]
isOneToOne: false
      referencedRelation: "profile_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_decided_by_fkey"
      columns: ["decided_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "event_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_squad_id_fkey"
      columns: ["squad_id"]
isOneToOne: false
      referencedRelation: "squads"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profile_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"categories": {
                  Row: {
                    "active": boolean,"created_at": string,"id": number,"label": string,"slug": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"id"?: never,"label": string,"slug": string,"sort_order"?: number
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"id"?: never,"label"?: string,"slug"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    
                  ]
                },"consents": {
                  Row: {
                    "anonymous_id": string | null,"created_at": string,"granted": boolean,"id": string,"notice_version": string,"purpose": Database["public"]['Enums']["consent_purpose"],"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "anonymous_id"?: string | null,"created_at"?: string,"granted": boolean,"id"?: string,"notice_version": string,"purpose": Database["public"]['Enums']["consent_purpose"],"user_id"?: string | null
                  }
                  Update: {
                    "anonymous_id"?: string | null,"created_at"?: string,"granted"?: boolean,"id"?: string,"notice_version"?: string,"purpose"?: Database["public"]['Enums']["consent_purpose"],"user_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"email_outbox": {
                  Row: {
                    "attempts": number,"created_at": string,"data": NonNullable<Json>,"id": number,"last_error": string | null,"priority": number,"provider_message_id": string | null,"send_after": string,"sent_at": string | null,"status": string,"template": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"created_at"?: string,"data"?: NonNullable<Json>,"id"?: never,"last_error"?: string | null,"priority"?: number,"provider_message_id"?: string | null,"send_after"?: string,"sent_at"?: string | null,"status"?: string,"template": string,"user_id": string
                  }
                  Update: {
                    "attempts"?: number,"created_at"?: string,"data"?: NonNullable<Json>,"id"?: never,"last_error"?: string | null,"priority"?: number,"provider_message_id"?: string | null,"send_after"?: string,"sent_at"?: string | null,"status"?: string,"template"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "email_outbox_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profile_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "email_outbox_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"event_private": {
                  Row: {
                    "address": string | null,"directions_note": string | null,"event_id": string,"host_notes": string | null,"lat": number | null,"lng": number | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"directions_note"?: string | null,"event_id": string,"host_notes"?: string | null,"lat"?: number | null,"lng"?: number | null,"updated_at"?: string
                  }
                  Update: {
                    "address"?: string | null,"directions_note"?: string | null,"event_id"?: string,"host_notes"?: string | null,"lat"?: number | null,"lng"?: number | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "event_private_event_id_fkey"
      columns: ["event_id"]
isOneToOne: true
      referencedRelation: "event_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "event_private_event_id_fkey"
      columns: ["event_id"]
isOneToOne: true
      referencedRelation: "events"
      referencedColumns: ["id"]
    }
                  ]
                },"events": {
                  Row: {
                    "approval_mode": Database["public"]['Enums']["approval_mode"],"area_id": number,"capacity": number | null,"category_id": number | null,"cover_key": string | null,"created_at": string,"description": string,"ends_at": string,"host_id": string,"house_party": boolean,"house_rules": string | null,"id": string,"max_age": number | null,"min_age": number,"overbook_pct": number,"partner_url": string | null,"price_label": string | null,"price_paise": number,"pricing_mode": Database["public"]['Enums']["pricing_mode"],"published_at": string | null,"referral_code": string | null,"review_note": string | null,"reviewed_at": string | null,"reviewed_by": string | null,"starts_at": string,"status": Database["public"]['Enums']["event_status"],"submitted_at": string | null,"title": string,"type": Database["public"]['Enums']["event_type"],"updated_at": string,"women_only": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "approval_mode"?: Database["public"]['Enums']["approval_mode"],"area_id": number,"capacity"?: number | null,"category_id"?: number | null,"cover_key"?: string | null,"created_at"?: string,"description"?: string,"ends_at": string,"host_id": string,"house_party"?: boolean,"house_rules"?: string | null,"id"?: string,"max_age"?: number | null,"min_age"?: number,"overbook_pct"?: number,"partner_url"?: string | null,"price_label"?: string | null,"price_paise"?: number,"pricing_mode"?: Database["public"]['Enums']["pricing_mode"],"published_at"?: string | null,"referral_code"?: string | null,"review_note"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"starts_at": string,"status"?: Database["public"]['Enums']["event_status"],"submitted_at"?: string | null,"title": string,"type": Database["public"]['Enums']["event_type"],"updated_at"?: string,"women_only"?: boolean
                  }
                  Update: {
                    "approval_mode"?: Database["public"]['Enums']["approval_mode"],"area_id"?: number,"capacity"?: number | null,"category_id"?: number | null,"cover_key"?: string | null,"created_at"?: string,"description"?: string,"ends_at"?: string,"host_id"?: string,"house_party"?: boolean,"house_rules"?: string | null,"id"?: string,"max_age"?: number | null,"min_age"?: number,"overbook_pct"?: number,"partner_url"?: string | null,"price_label"?: string | null,"price_paise"?: number,"pricing_mode"?: Database["public"]['Enums']["pricing_mode"],"published_at"?: string | null,"referral_code"?: string | null,"review_note"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"starts_at"?: string,"status"?: Database["public"]['Enums']["event_status"],"submitted_at"?: string | null,"title"?: string,"type"?: Database["public"]['Enums']["event_type"],"updated_at"?: string,"women_only"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "events_area_id_fkey"
      columns: ["area_id"]
isOneToOne: false
      referencedRelation: "areas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "events_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "events_host_id_fkey"
      columns: ["host_id"]
isOneToOne: false
      referencedRelation: "profile_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "events_host_id_fkey"
      columns: ["host_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "events_reviewed_by_fkey"
      columns: ["reviewed_by"]
isOneToOne: false
      referencedRelation: "profile_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "events_reviewed_by_fkey"
      columns: ["reviewed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"featured_slots": {
                  Row: {
                    "created_at": string,"created_by": string | null,"event_id": string,"featured_until": string | null,"position": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"event_id": string,"featured_until"?: string | null,"position": number
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"event_id"?: string,"featured_until"?: string | null,"position"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "featured_slots_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profile_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "featured_slots_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "featured_slots_event_id_fkey"
      columns: ["event_id"]
isOneToOne: true
      referencedRelation: "event_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "featured_slots_event_id_fkey"
      columns: ["event_id"]
isOneToOne: true
      referencedRelation: "events"
      referencedColumns: ["id"]
    }
                  ]
                },"host_applications": {
                  Row: {
                    "admin_note": string | null,"created_at": string,"id": string,"message": string,"reviewed_at": string | null,"reviewed_by": string | null,"status": Database["public"]['Enums']["review_status"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "admin_note"?: string | null,"created_at"?: string,"id"?: string,"message": string,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"status"?: Database["public"]['Enums']["review_status"],"user_id": string
                  }
                  Update: {
                    "admin_note"?: string | null,"created_at"?: string,"id"?: string,"message"?: string,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"status"?: Database["public"]['Enums']["review_status"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "host_applications_reviewed_by_fkey"
      columns: ["reviewed_by"]
isOneToOne: false
      referencedRelation: "profile_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "host_applications_reviewed_by_fkey"
      columns: ["reviewed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "host_applications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profile_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "host_applications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"host_rating_tags": {
                  Row: {
                    "active": boolean,"created_at": string,"id": number,"label": string,"slug": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"id"?: never,"label": string,"slug": string,"sort_order"?: number
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"id"?: never,"label"?: string,"slug"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    
                  ]
                },"hub_events": {
                  Row: {
                    "event_id": string,"hub_id": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "event_id": string,"hub_id": string,"sort_order"?: number
                  }
                  Update: {
                    "event_id"?: string,"hub_id"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "hub_events_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "event_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "hub_events_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "hub_events_hub_id_fkey"
      columns: ["hub_id"]
isOneToOne: false
      referencedRelation: "hub_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "hub_events_hub_id_fkey"
      columns: ["hub_id"]
isOneToOne: false
      referencedRelation: "hubs"
      referencedColumns: ["id"]
    }
                  ]
                },"hubs": {
                  Row: {
                    "accent_color": string,"art_key": string | null,"created_at": string,"ends_on": string | null,"id": string,"published": boolean,"slug": string,"sort_order": number,"starts_on": string | null,"subtitle": string | null,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accent_color"?: string,"art_key"?: string | null,"created_at"?: string,"ends_on"?: string | null,"id"?: string,"published"?: boolean,"slug": string,"sort_order"?: number,"starts_on"?: string | null,"subtitle"?: string | null,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "accent_color"?: string,"art_key"?: string | null,"created_at"?: string,"ends_on"?: string | null,"id"?: string,"published"?: boolean,"slug"?: string,"sort_order"?: number,"starts_on"?: string | null,"subtitle"?: string | null,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"interests": {
                  Row: {
                    "active": boolean,"created_at": string,"id": number,"label": string,"slug": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"id"?: never,"label": string,"slug": string,"sort_order"?: number
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"id"?: never,"label"?: string,"slug"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    
                  ]
                },"job_runs": {
                  Row: {
                    "error_count": number,"job": string,"last_detail": Json | null,"last_error": string | null,"last_finished_at": string | null,"last_started_at": string | null,"last_status": string | null,"run_count": number
                  }
                  ComputedFields: never
                  Insert: {
                    "error_count"?: number,"job": string,"last_detail"?: Json | null,"last_error"?: string | null,"last_finished_at"?: string | null,"last_started_at"?: string | null,"last_status"?: string | null,"run_count"?: number
                  }
                  Update: {
                    "error_count"?: number,"job"?: string,"last_detail"?: Json | null,"last_error"?: string | null,"last_finished_at"?: string | null,"last_started_at"?: string | null,"last_status"?: string | null,"run_count"?: number
                  }
                  Relationships: [
                    
                  ]
                },"languages": {
                  Row: {
                    "active": boolean,"created_at": string,"id": number,"label": string,"slug": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"id"?: never,"label": string,"slug": string,"sort_order"?: number
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"id"?: never,"label"?: string,"slug"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    
                  ]
                },"notifications": {
                  Row: {
                    "body": string | null,"created_at": string,"data": NonNullable<Json>,"id": number,"kind": string,"read_at": string | null,"title": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body"?: string | null,"created_at"?: string,"data"?: NonNullable<Json>,"id"?: never,"kind": string,"read_at"?: string | null,"title": string,"user_id": string
                  }
                  Update: {
                    "body"?: string | null,"created_at"?: string,"data"?: NonNullable<Json>,"id"?: never,"kind"?: string,"read_at"?: string | null,"title"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profile_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"positive_tags": {
                  Row: {
                    "active": boolean,"created_at": string,"id": number,"label": string,"slug": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"id"?: never,"label": string,"slug": string,"sort_order"?: number
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"id"?: never,"label"?: string,"slug"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    
                  ]
                },"profile_interests": {
                  Row: {
                    "interest_id": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "interest_id": number,"user_id": string
                  }
                  Update: {
                    "interest_id"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "profile_interests_interest_id_fkey"
      columns: ["interest_id"]
isOneToOne: false
      referencedRelation: "interests"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "profile_interests_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profile_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "profile_interests_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profile_languages": {
                  Row: {
                    "language_id": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "language_id": number,"user_id": string
                  }
                  Update: {
                    "language_id"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "profile_languages_language_id_fkey"
      columns: ["language_id"]
isOneToOne: false
      referencedRelation: "languages"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "profile_languages_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profile_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "profile_languages_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profile_photos": {
                  Row: {
                    "created_at": string,"id": string,"position": number,"r2_key": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"position": number,"r2_key": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"position"?: number,"r2_key"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "profile_photos_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profile_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "profile_photos_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profile_private": {
                  Row: {
                    "created_at": string,"date_of_birth": string | null,"email": string | null,"gender": Database["public"]['Enums']["gender"] | null,"id": string,"last_name": string | null,"phone": string | null,"status": Database["public"]['Enums']["user_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"date_of_birth"?: string | null,"email"?: string | null,"gender"?: Database["public"]['Enums']["gender"] | null,"id": string,"last_name"?: string | null,"phone"?: string | null,"status"?: Database["public"]['Enums']["user_status"],"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"date_of_birth"?: string | null,"email"?: string | null,"gender"?: Database["public"]['Enums']["gender"] | null,"id"?: string,"last_name"?: string | null,"phone"?: string | null,"status"?: Database["public"]['Enums']["user_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "profile_private_id_fkey"
      columns: ["id"]
isOneToOne: true
      referencedRelation: "profile_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "profile_private_id_fkey"
      columns: ["id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "area_id": number | null,"bio_prompts": NonNullable<Json>,"created_at": string,"deleted_at": string | null,"first_name": string | null,"id": string,"is_verified": boolean,"onboarding_completed_at": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "area_id"?: number | null,"bio_prompts"?: NonNullable<Json>,"created_at"?: string,"deleted_at"?: string | null,"first_name"?: string | null,"id": string,"is_verified"?: boolean,"onboarding_completed_at"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "area_id"?: number | null,"bio_prompts"?: NonNullable<Json>,"created_at"?: string,"deleted_at"?: string | null,"first_name"?: string | null,"id"?: string,"is_verified"?: boolean,"onboarding_completed_at"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_area_id_fkey"
      columns: ["area_id"]
isOneToOne: false
      referencedRelation: "areas"
      referencedColumns: ["id"]
    }
                  ]
                },"rate_limits": {
                  Row: {
                    "action": string,"count": number,"user_id": string,"window_start": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"count"?: number,"user_id": string,"window_start": string
                  }
                  Update: {
                    "action"?: string,"count"?: number,"user_id"?: string,"window_start"?: string
                  }
                  Relationships: [
                    
                  ]
                },"squad_members": {
                  Row: {
                    "created_at": string,"decided_at": string | null,"event_id": string,"squad_id": string,"status": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"decided_at"?: string | null,"event_id": string,"squad_id": string,"status"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"decided_at"?: string | null,"event_id"?: string,"squad_id"?: string,"status"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "squad_members_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "event_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "squad_members_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "squad_members_squad_id_fkey"
      columns: ["squad_id"]
isOneToOne: false
      referencedRelation: "squads"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "squad_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profile_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "squad_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"squads": {
                  Row: {
                    "created_at": string,"creator_id": string,"event_id": string,"id": string,"meeting_point": string,"name": string | null,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"creator_id": string,"event_id": string,"id"?: string,"meeting_point": string,"name"?: string | null,"status"?: string
                  }
                  Update: {
                    "created_at"?: string,"creator_id"?: string,"event_id"?: string,"id"?: string,"meeting_point"?: string,"name"?: string | null,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "squads_creator_id_fkey"
      columns: ["creator_id"]
isOneToOne: false
      referencedRelation: "profile_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "squads_creator_id_fkey"
      columns: ["creator_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "squads_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "event_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "squads_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    }
                  ]
                },"storage_deletions": {
                  Row: {
                    "bucket": string,"done_at": string | null,"id": number,"key": string,"requested_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bucket": string,"done_at"?: string | null,"id"?: never,"key": string,"requested_at"?: string
                  }
                  Update: {
                    "bucket"?: string,"done_at"?: string | null,"id"?: never,"key"?: string,"requested_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"upload_keys": {
                  Row: {
                    "consumed_at": string | null,"created_at": string,"event_id": string | null,"key": string,"purpose": string,"size_limit": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "consumed_at"?: string | null,"created_at"?: string,"event_id"?: string | null,"key": string,"purpose": string,"size_limit": number,"user_id": string
                  }
                  Update: {
                    "consumed_at"?: string | null,"created_at"?: string,"event_id"?: string | null,"key"?: string,"purpose"?: string,"size_limit"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "upload_keys_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profile_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "upload_keys_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"user_blocks": {
                  Row: {
                    "blocked_id": string,"blocker_id": string,"created_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "blocked_id": string,"blocker_id": string,"created_at"?: string
                  }
                  Update: {
                    "blocked_id"?: string,"blocker_id"?: string,"created_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_blocks_blocked_id_fkey"
      columns: ["blocked_id"]
isOneToOne: false
      referencedRelation: "profile_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_blocks_blocked_id_fkey"
      columns: ["blocked_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_blocks_blocker_id_fkey"
      columns: ["blocker_id"]
isOneToOne: false
      referencedRelation: "profile_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_blocks_blocker_id_fkey"
      columns: ["blocker_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"user_roles": {
                  Row: {
                    "granted_at": string,"granted_by": string | null,"role": Database["public"]['Enums']["app_role"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "granted_at"?: string,"granted_by"?: string | null,"role": Database["public"]['Enums']["app_role"],"user_id": string
                  }
                  Update: {
                    "granted_at"?: string,"granted_by"?: string | null,"role"?: Database["public"]['Enums']["app_role"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_roles_granted_by_fkey"
      columns: ["granted_by"]
isOneToOne: false
      referencedRelation: "profile_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_roles_granted_by_fkey"
      columns: ["granted_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_roles_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profile_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_roles_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"verifications": {
                  Row: {
                    "created_at": string,"id": string,"result": Database["public"]['Enums']["review_status"],"reviewed_at": string | null,"reviewer_id": string | null,"selfie_key": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"result"?: Database["public"]['Enums']["review_status"],"reviewed_at"?: string | null,"reviewer_id"?: string | null,"selfie_key"?: string | null,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"result"?: Database["public"]['Enums']["review_status"],"reviewed_at"?: string | null,"reviewer_id"?: string | null,"selfie_key"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "verifications_reviewer_id_fkey"
      columns: ["reviewer_id"]
isOneToOne: false
      referencedRelation: "profile_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "verifications_reviewer_id_fkey"
      columns: ["reviewer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "verifications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profile_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "verifications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "event_cards": {
                  Row: {
                    "approval_mode": Database["public"]['Enums']["approval_mode"],"area_id": number,"area_name": string,"attendee_avatars": (string)[] | null,"capacity": number | null,"category_id": number | null,"category_name": string | null,"cover_key": string | null,"description": string,"ends_at": string,"has_partner_link": boolean | null,"host_first_name": string | null,"host_id": string,"host_is_verified": boolean,"house_party": boolean,"house_rules": string | null,"id": string,"max_age": number | null,"min_age": number,"overbook_pct": number,"price_label": string | null,"pricing_mode": Database["public"]['Enums']["pricing_mode"],"spots_left": number | null,"starts_at": string,"title": string,"type": Database["public"]['Enums']["event_type"],"women_only": boolean
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "events_area_id_fkey"
      columns: ["area_id"]
isOneToOne: false
      referencedRelation: "areas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "events_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "events_host_id_fkey"
      columns: ["host_id"]
isOneToOne: false
      referencedRelation: "profile_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "events_host_id_fkey"
      columns: ["host_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"hub_cards": {
                  Row: {
                    "accent_color": string,"art_key": string | null,"ends_on": string | null,"event_count": number | null,"id": string,"slug": string,"sort_order": number,"starts_on": string | null,"subtitle": string | null,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                           "accent_color"?: string | null,"art_key"?: string | null,"ends_on"?: string | null,"event_count"?: never,"id"?: string | null,"slug"?: string | null,"sort_order"?: number | null,"starts_on"?: string | null,"subtitle"?: string | null,"title"?: string | null
                         }
                        Update: {
                           "accent_color"?: string | null,"art_key"?: string | null,"ends_on"?: string | null,"event_count"?: never,"id"?: string | null,"slug"?: string | null,"sort_order"?: number | null,"starts_on"?: string | null,"subtitle"?: string | null,"title"?: string | null
                         }
                        Relationships: [
                    
                  ]
                },"profile_cards": {
                  Row: {
                    "age": number | null,"area_id": number | null,"bio_prompts": NonNullable<Json>,"created_at": string,"first_name": string | null,"id": string,"interest_ids": (number)[] | null,"is_verified": boolean,"language_ids": (number)[] | null,"photo_keys": (string)[] | null
                  }
                  ComputedFields: never
                  Insert: {
                           "age"?: never,"area_id"?: number | null,"bio_prompts"?: Json | null,"created_at"?: string | null,"first_name"?: string | null,"id"?: string | null,"interest_ids"?: never,"is_verified"?: boolean | null,"language_ids"?: never,"photo_keys"?: never
                         }
                        Update: {
                           "age"?: never,"area_id"?: number | null,"bio_prompts"?: Json | null,"created_at"?: string | null,"first_name"?: string | null,"id"?: string | null,"interest_ids"?: never,"is_verified"?: boolean | null,"language_ids"?: never,"photo_keys"?: never
                         }
                        Relationships: [
                    {
      foreignKeyName: "profiles_area_id_fkey"
      columns: ["area_id"]
isOneToOne: false
      referencedRelation: "areas"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "admin_delete_hub":
{ Args: { "p_hub": string }; Returns: undefined
                           },
"admin_job_runs":
{ Args: Record<PropertyKey, never>; Returns: {
              "error_count": number,"job": string,"last_detail": Json,"last_error": string,"last_finished_at": string,"last_status": string,"run_count": number
            }[]
                           },
"admin_list_host_applications":
{ Args: Record<PropertyKey, never>; Returns: {
              "created_at": string,"first_name": string,"id": string,"message": string,"user_id": string
            }[]
                           },
"admin_list_pending_verifications":
{ Args: Record<PropertyKey, never>; Returns: {
              "created_at": string,"first_name": string,"id": string,"user_id": string
            }[]
                           },
"admin_send_reconfirmation":
{ Args: { "p_booking": string }; Returns: undefined
                           },
"admin_set_hub_events":
{ Args: { "p_event_ids": (string)[],"p_hub": string }; Returns: undefined
                           },
"admin_upsert_hub":
{ Args: { "p_accent_color": string,"p_art_key"?: string,"p_ends_on": string,"p_id": string,"p_published": boolean,"p_slug": string,"p_sort_order": number,"p_starts_on": string,"p_subtitle": string,"p_title": string }; Returns: string
                           },
"apply_to_host":
{ Args: { "p_message": string }; Returns: undefined
                           },
"approve_event":
{ Args: { "p_event": string,"p_note"?: string }; Returns: undefined
                           },
"authorize_upload":
{ Args: { "p_content_type": string,"p_event": string,"p_purpose": string,"p_size": number,"p_user": string }; Returns: string
                           },
"cancel_event":
{ Args: { "p_event": string,"p_reason"?: string }; Returns: undefined
                           },
"cancel_my_booking":
{ Args: { "p_booking": string }; Returns: undefined
                           },
"claim_deletions":
{ Args: { "p_limit": number }; Returns: {
              "bucket": string,"id": number,"key": string
            }[]
                           },
"claim_emails":
{ Args: { "p_limit": number }; Returns: {
              "attempts": number,"data": Json,"id": number,"priority": number,"template": string,"to_email": string,"user_id": string
            }[]
                           },
"complete_ended_events":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"complete_onboarding":
{ Args: { "p_accept_conduct": boolean,"p_accept_privacy": boolean,"p_area_id": number,"p_date_of_birth": string,"p_first_name": string,"p_gender": Database["public"]['Enums']["gender"],"p_interest_ids": (number)[],"p_language_ids": (number)[],"p_last_name"?: string,"p_notice_version": string,"p_phone"?: string,"p_photo_keys": (string)[],"p_prompts": Json }; Returns: undefined
                           },
"create_event":
{ Args: { "p_input": Json }; Returns: string
                           },
"create_squad":
{ Args: { "p_event": string,"p_meeting_point": string,"p_name"?: string }; Returns: string
                           },
"decide_request":
{ Args: { "p_booking": string,"p_decision": string }; Returns: undefined
                           },
"decide_squad_request":
{ Args: { "p_approve": boolean,"p_squad": string,"p_user": string }; Returns: undefined
                           },
"delete_my_account":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"disband_squad":
{ Args: { "p_squad": string }; Returns: undefined
                           },
"emails_sent_today":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"event_squads":
{ Args: { "p_event": string }; Returns: {
              "complete": boolean,"creator_first_name": string,"creator_id": string,"id": string,"member_count": number,"my_status": string,"name": string,"spots_left": number
            }[]
                           },
"export_my_data":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"feature_event":
{ Args: { "p_event": string,"p_position": number,"p_until"?: string }; Returns: undefined
                           },
"featured_event_cards":
{ Args: Record<PropertyKey, never>; Returns: {
              "approval_mode": Database["public"]['Enums']["approval_mode"],
"area_id": number,
"area_name": string,
"attendee_avatars": (string)[] | null,
"capacity": number | null,
"category_id": number | null,
"category_name": string | null,
"cover_key": string | null,
"description": string,
"ends_at": string,
"has_partner_link": boolean | null,
"host_first_name": string | null,
"host_id": string,
"host_is_verified": boolean,
"house_party": boolean,
"house_rules": string | null,
"id": string,
"max_age": number | null,
"min_age": number,
"overbook_pct": number,
"price_label": string | null,
"pricing_mode": Database["public"]['Enums']["pricing_mode"],
"spots_left": number | null,
"starts_at": string,
"title": string,
"type": Database["public"]['Enums']["event_type"],
"women_only": boolean
            }[]
                          SetofOptions: {
        from: "*"
        to: "event_cards"
        isOneToOne: false
        isSetofReturn: true
      } },
"finish_emails":
{ Args: { "p_results": Json }; Returns: undefined
                           },
"get_event_address":
{ Args: { "p_event": string }; Returns: Json
                           },
"get_event_for_edit":
{ Args: { "p_event": string }; Returns: Json
                           },
"get_my_booking":
{ Args: { "p_event": string }; Returns: Json
                           },
"get_my_profile":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"get_squad":
{ Args: { "p_squad": string }; Returns: Json
                           },
"host_inbox":
{ Args: { "p_event": string }; Returns: {
              "age": number,"area_id": number,"bio_prompts": Json,"booking_id": string,"events_in_common": number,"first_name": string,"interest_ids": (number)[],"is_verified": boolean,"language_ids": (number)[],"photo_keys": (string)[],"requested_at": string,"shows_up_attended": number,"shows_up_total": number,"squad_id": string,"squad_name": string,"status": Database["public"]['Enums']["booking_status"],"top_tags": Json,"user_id": string
            }[]
                           },
"hub_event_cards":
{ Args: { "p_hub": string }; Returns: {
              "approval_mode": Database["public"]['Enums']["approval_mode"],
"area_id": number,
"area_name": string,
"attendee_avatars": (string)[] | null,
"capacity": number | null,
"category_id": number | null,
"category_name": string | null,
"cover_key": string | null,
"description": string,
"ends_at": string,
"has_partner_link": boolean | null,
"host_first_name": string | null,
"host_id": string,
"host_is_verified": boolean,
"house_party": boolean,
"house_rules": string | null,
"id": string,
"max_age": number | null,
"min_age": number,
"overbook_pct": number,
"price_label": string | null,
"pricing_mode": Database["public"]['Enums']["pricing_mode"],
"spots_left": number | null,
"starts_at": string,
"title": string,
"type": Database["public"]['Enums']["event_type"],
"women_only": boolean
            }[]
                          SetofOptions: {
        from: "*"
        to: "event_cards"
        isOneToOne: false
        isSetofReturn: true
      } },
"leave_squad":
{ Args: { "p_squad": string }; Returns: undefined
                           },
"mark_deletions_done":
{ Args: { "p_ids": (number)[] }; Returns: undefined
                           },
"mark_notifications_read":
{ Args: { "p_ids"?: (number)[] }; Returns: undefined
                           },
"my_bookings":
{ Args: Record<PropertyKey, never>; Returns: {
              "area_name": string,"booking_id": string,"cancel_reason": string,"cover_key": string,"ends_at": string,"event_id": string,"event_status": Database["public"]['Enums']["event_status"],"event_title": string,"requested_at": string,"squad_id": string,"starts_at": string,"status": Database["public"]['Enums']["booking_status"],"waitlist_position": number
            }[]
                           },
"my_events":
{ Args: Record<PropertyKey, never>; Returns: {
              "cover_key": string,"id": string,"review_note": string,"starts_at": string,"status": Database["public"]['Enums']["event_status"],"title": string,"type": Database["public"]['Enums']["event_type"]
            }[]
                           },
"my_squads":
{ Args: Record<PropertyKey, never>; Returns: {
              "event_id": string,"event_title": string,"id": string,"is_creator": boolean,"member_count": number,"my_status": string,"name": string,"request_count": number,"status": string
            }[]
                           },
"purge_old_upload_keys":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"reconfirm_booking":
{ Args: { "p_token": string }; Returns: Json
                           },
"record_job_run":
{ Args: { "p_detail"?: Json,"p_error"?: string,"p_job": string,"p_status": string }; Returns: undefined
                           },
"reject_event":
{ Args: { "p_event": string,"p_note": string }; Returns: undefined
                           },
"remove_profile_photo":
{ Args: { "p_position": number }; Returns: undefined
                           },
"request_to_join":
{ Args: { "p_event": string }; Returns: Json
                           },
"request_to_join_squad":
{ Args: { "p_squad": string }; Returns: undefined
                           },
"review_host_application":
{ Args: { "p_approved": boolean,"p_id": string,"p_note"?: string }; Returns: undefined
                           },
"review_verification":
{ Args: { "p_approved": boolean,"p_id": string }; Returns: undefined
                           },
"search_events":
{ Args: { "p_area_ids"?: (number)[],"p_category_ids"?: (number)[],"p_from"?: string,"p_group_size"?: number,"p_limit"?: number,"p_offset"?: number,"p_pricing"?: (Database["public"]['Enums']["pricing_mode"])[],"p_to"?: string,"p_types"?: (Database["public"]['Enums']["event_type"])[],"p_women_only"?: boolean }; Returns: {
              "approval_mode": Database["public"]['Enums']["approval_mode"],
"area_id": number,
"area_name": string,
"attendee_avatars": (string)[] | null,
"capacity": number | null,
"category_id": number | null,
"category_name": string | null,
"cover_key": string | null,
"description": string,
"ends_at": string,
"has_partner_link": boolean | null,
"host_first_name": string | null,
"host_id": string,
"host_is_verified": boolean,
"house_party": boolean,
"house_rules": string | null,
"id": string,
"max_age": number | null,
"min_age": number,
"overbook_pct": number,
"price_label": string | null,
"pricing_mode": Database["public"]['Enums']["pricing_mode"],
"spots_left": number | null,
"starts_at": string,
"title": string,
"type": Database["public"]['Enums']["event_type"],
"women_only": boolean
            }[]
                          SetofOptions: {
        from: "*"
        to: "event_cards"
        isOneToOne: false
        isSetofReturn: true
      } },
"set_event_cover":
{ Args: { "p_event_id": string,"p_key": string }; Returns: undefined
                           },
"set_profile_photo":
{ Args: { "p_key": string,"p_position": number }; Returns: undefined
                           },
"submit_event_for_review":
{ Args: { "p_event": string }; Returns: undefined
                           },
"submit_selfie":
{ Args: { "p_key": string }; Returns: undefined
                           },
"unfeature_event":
{ Args: { "p_event": string }; Returns: undefined
                           },
"unreferenced_keys":
{ Args: { "p_bucket": string,"p_keys": (string)[] }; Returns: (string)[]
                           },
"update_event":
{ Args: { "p_event": string,"p_input": Json }; Returns: undefined
                           },
"update_my_profile":
{ Args: { "p_area_id"?: number,"p_bio_prompts"?: Json,"p_first_name"?: string,"p_interest_ids"?: (number)[],"p_language_ids"?: (number)[],"p_last_name"?: string,"p_phone"?: string }; Returns: undefined
                           }
          }
          Enums: {
            "app_role": "admin"|"host","approval_mode": "instant"|"host_approval","booking_status": "requested"|"approved"|"waitlisted"|"declined"|"confirmed"|"attended"|"no_show"|"cancelled"|"pending_payment"|"paid"|"expired"|"refunded","consent_purpose": "terms"|"code_of_conduct"|"preferences"|"analytics"|"marketing"|"privacy_notice","event_status": "draft"|"pending_review"|"published"|"cancelled"|"completed","event_type": "partner"|"community"|"kollide","gender": "woman"|"man"|"non_binary"|"prefer_not_to_say","pricing_mode": "free"|"pay_at_venue"|"cost_split"|"paid","report_status": "open"|"reviewing"|"resolved"|"dismissed","review_status": "pending"|"approved"|"rejected","user_status": "active"|"on_hold"|"suspended"|"banned"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "app_role": ["admin", "host"],"approval_mode": ["instant", "host_approval"],"booking_status": ["requested", "approved", "waitlisted", "declined", "confirmed", "attended", "no_show", "cancelled", "pending_payment", "paid", "expired", "refunded"],"consent_purpose": ["terms", "code_of_conduct", "preferences", "analytics", "marketing", "privacy_notice"],"event_status": ["draft", "pending_review", "published", "cancelled", "completed"],"event_type": ["partner", "community", "kollide"],"gender": ["woman", "man", "non_binary", "prefer_not_to_say"],"pricing_mode": ["free", "pay_at_venue", "cost_split", "paid"],"report_status": ["open", "reviewing", "resolved", "dismissed"],"review_status": ["pending", "approved", "rejected"],"user_status": ["active", "on_hold", "suspended", "banned"]
          }
        }
} as const
