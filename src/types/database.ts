
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
                    "area_id": number | null,"bio_prompts": NonNullable<Json>,"created_at": string,"first_name": string | null,"id": string,"is_verified": boolean,"onboarding_completed_at": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "area_id"?: number | null,"bio_prompts"?: NonNullable<Json>,"created_at"?: string,"first_name"?: string | null,"id": string,"is_verified"?: boolean,"onboarding_completed_at"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "area_id"?: number | null,"bio_prompts"?: NonNullable<Json>,"created_at"?: string,"first_name"?: string | null,"id"?: string,"is_verified"?: boolean,"onboarding_completed_at"?: string | null,"updated_at"?: string
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
                    "created_at": string,"id": string,"result": Database["public"]['Enums']["review_status"],"reviewed_at": string | null,"reviewer_id": string | null,"selfie_key": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"result"?: Database["public"]['Enums']["review_status"],"reviewed_at"?: string | null,"reviewer_id"?: string | null,"selfie_key": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"result"?: Database["public"]['Enums']["review_status"],"reviewed_at"?: string | null,"reviewer_id"?: string | null,"selfie_key"?: string,"user_id"?: string
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
            "profile_cards": {
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
            [_ in never]: never
          }
          Enums: {
            "app_role": "admin"|"host","approval_mode": "instant"|"host_approval","booking_status": "requested"|"approved"|"waitlisted"|"declined"|"confirmed"|"attended"|"no_show"|"cancelled"|"pending_payment"|"paid"|"expired"|"refunded","consent_purpose": "terms"|"code_of_conduct"|"preferences"|"analytics"|"marketing","event_status": "draft"|"pending_review"|"published"|"cancelled"|"completed","event_type": "partner"|"community"|"kollide","gender": "woman"|"man"|"non_binary"|"prefer_not_to_say","pricing_mode": "free"|"pay_at_venue"|"cost_split"|"paid","report_status": "open"|"reviewing"|"resolved"|"dismissed","review_status": "pending"|"approved"|"rejected","user_status": "active"|"on_hold"|"suspended"|"banned"
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
            "app_role": ["admin", "host"],"approval_mode": ["instant", "host_approval"],"booking_status": ["requested", "approved", "waitlisted", "declined", "confirmed", "attended", "no_show", "cancelled", "pending_payment", "paid", "expired", "refunded"],"consent_purpose": ["terms", "code_of_conduct", "preferences", "analytics", "marketing"],"event_status": ["draft", "pending_review", "published", "cancelled", "completed"],"event_type": ["partner", "community", "kollide"],"gender": ["woman", "man", "non_binary", "prefer_not_to_say"],"pricing_mode": ["free", "pay_at_venue", "cost_split", "paid"],"report_status": ["open", "reviewing", "resolved", "dismissed"],"review_status": ["pending", "approved", "rejected"],"user_status": ["active", "on_hold", "suspended", "banned"]
          }
        }
} as const
