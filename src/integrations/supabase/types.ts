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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          annual_revenue: number | null
          cargo_types: string[] | null
          client_user_id: string | null
          company_name: string
          created_at: string
          created_by: string | null
          current_coverage_expiry: string | null
          dot_number: string | null
          fleet_size: number | null
          id: string
          loss_history_summary: string | null
          mc_number: string | null
          notes: string | null
          number_of_claims: number | null
          operating_states: string[] | null
          status: string
          updated_at: string
          years_in_business: number | null
        }
        Insert: {
          annual_revenue?: number | null
          cargo_types?: string[] | null
          client_user_id?: string | null
          company_name: string
          created_at?: string
          created_by?: string | null
          current_coverage_expiry?: string | null
          dot_number?: string | null
          fleet_size?: number | null
          id?: string
          loss_history_summary?: string | null
          mc_number?: string | null
          notes?: string | null
          number_of_claims?: number | null
          operating_states?: string[] | null
          status?: string
          updated_at?: string
          years_in_business?: number | null
        }
        Update: {
          annual_revenue?: number | null
          cargo_types?: string[] | null
          client_user_id?: string | null
          company_name?: string
          created_at?: string
          created_by?: string | null
          current_coverage_expiry?: string | null
          dot_number?: string | null
          fleet_size?: number | null
          id?: string
          loss_history_summary?: string | null
          mc_number?: string | null
          notes?: string | null
          number_of_claims?: number | null
          operating_states?: string[] | null
          status?: string
          updated_at?: string
          years_in_business?: number | null
        }
        Relationships: []
      }
      carriers: {
        Row: {
          am_best_rating: string | null
          appetite_guide: Json | null
          created_at: string
          id: string
          is_active: boolean
          max_claims_tolerance: number | null
          max_fleet_size: number | null
          min_fleet_size: number | null
          name: string
          notes: string | null
          preferred_cargo_types: string[] | null
          preferred_states: string[] | null
          updated_at: string
        }
        Insert: {
          am_best_rating?: string | null
          appetite_guide?: Json | null
          created_at?: string
          id?: string
          is_active?: boolean
          max_claims_tolerance?: number | null
          max_fleet_size?: number | null
          min_fleet_size?: number | null
          name: string
          notes?: string | null
          preferred_cargo_types?: string[] | null
          preferred_states?: string[] | null
          updated_at?: string
        }
        Update: {
          am_best_rating?: string | null
          appetite_guide?: Json | null
          created_at?: string
          id?: string
          is_active?: boolean
          max_claims_tolerance?: number | null
          max_fleet_size?: number | null
          min_fleet_size?: number | null
          name?: string
          notes?: string | null
          preferred_cargo_types?: string[] | null
          preferred_states?: string[] | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          company_name: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          company_name?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          company_name?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      quotes: {
        Row: {
          account_id: string
          carrier_id: string
          coverage_details: Json | null
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          match_score: number | null
          premium_estimate: number | null
          published_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          account_id: string
          carrier_id: string
          coverage_details?: Json | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          match_score?: number | null
          premium_estimate?: number | null
          published_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          carrier_id?: string
          coverage_details?: Json | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          match_score?: number | null
          premium_estimate?: number | null
          published_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotes_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "carriers"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "client"
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
      app_role: ["admin", "client"],
    },
  },
} as const
