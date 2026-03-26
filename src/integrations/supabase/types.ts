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
          application_step: number | null
          business_categories: string[] | null
          business_owner_dob: string | null
          business_owner_name: string | null
          business_type: string | null
          cargo_types: string[] | null
          carrier_authority_number: string | null
          carrier_authority_prefix: string | null
          client_user_id: string | null
          commodity_info: Json | null
          company_name: string
          contractor_types: string[] | null
          county: string | null
          coverage_selections: Json | null
          created_at: string
          created_by: string | null
          current_coverage_expiry: string | null
          date_of_authority: string | null
          dba_name: string | null
          dot_number: string | null
          ein_tax_id: string | null
          fleet_size: number | null
          general_questions: Json | null
          id: string
          loss_history_summary: string | null
          mailing_address: string | null
          mailing_city: string | null
          mailing_state: string | null
          mailing_zip: string | null
          mc_number: string | null
          notes: string | null
          number_of_claims: number | null
          operating_states: string[] | null
          operation_info: Json | null
          projected_gross_receipts: number | null
          radius_operations: Json | null
          requested_effective_date: string | null
          status: string
          total_annual_revenue: number | null
          total_drivers: number | null
          total_garage_locations: number | null
          total_nonowned_trailers: number | null
          total_owned_trailers: number | null
          total_subhaul_revenue: number | null
          total_trucks: number | null
          updated_at: string
          years_in_business: number | null
        }
        Insert: {
          annual_revenue?: number | null
          application_step?: number | null
          business_categories?: string[] | null
          business_owner_dob?: string | null
          business_owner_name?: string | null
          business_type?: string | null
          cargo_types?: string[] | null
          carrier_authority_number?: string | null
          carrier_authority_prefix?: string | null
          client_user_id?: string | null
          commodity_info?: Json | null
          company_name: string
          contractor_types?: string[] | null
          county?: string | null
          coverage_selections?: Json | null
          created_at?: string
          created_by?: string | null
          current_coverage_expiry?: string | null
          date_of_authority?: string | null
          dba_name?: string | null
          dot_number?: string | null
          ein_tax_id?: string | null
          fleet_size?: number | null
          general_questions?: Json | null
          id?: string
          loss_history_summary?: string | null
          mailing_address?: string | null
          mailing_city?: string | null
          mailing_state?: string | null
          mailing_zip?: string | null
          mc_number?: string | null
          notes?: string | null
          number_of_claims?: number | null
          operating_states?: string[] | null
          operation_info?: Json | null
          projected_gross_receipts?: number | null
          radius_operations?: Json | null
          requested_effective_date?: string | null
          status?: string
          total_annual_revenue?: number | null
          total_drivers?: number | null
          total_garage_locations?: number | null
          total_nonowned_trailers?: number | null
          total_owned_trailers?: number | null
          total_subhaul_revenue?: number | null
          total_trucks?: number | null
          updated_at?: string
          years_in_business?: number | null
        }
        Update: {
          annual_revenue?: number | null
          application_step?: number | null
          business_categories?: string[] | null
          business_owner_dob?: string | null
          business_owner_name?: string | null
          business_type?: string | null
          cargo_types?: string[] | null
          carrier_authority_number?: string | null
          carrier_authority_prefix?: string | null
          client_user_id?: string | null
          commodity_info?: Json | null
          company_name?: string
          contractor_types?: string[] | null
          county?: string | null
          coverage_selections?: Json | null
          created_at?: string
          created_by?: string | null
          current_coverage_expiry?: string | null
          date_of_authority?: string | null
          dba_name?: string | null
          dot_number?: string | null
          ein_tax_id?: string | null
          fleet_size?: number | null
          general_questions?: Json | null
          id?: string
          loss_history_summary?: string | null
          mailing_address?: string | null
          mailing_city?: string | null
          mailing_state?: string | null
          mailing_zip?: string | null
          mc_number?: string | null
          notes?: string | null
          number_of_claims?: number | null
          operating_states?: string[] | null
          operation_info?: Json | null
          projected_gross_receipts?: number | null
          radius_operations?: Json | null
          requested_effective_date?: string | null
          status?: string
          total_annual_revenue?: number | null
          total_drivers?: number | null
          total_garage_locations?: number | null
          total_nonowned_trailers?: number | null
          total_owned_trailers?: number | null
          total_subhaul_revenue?: number | null
          total_trucks?: number | null
          updated_at?: string
          years_in_business?: number | null
        }
        Relationships: []
      }
      carriers: {
        Row: {
          accepted_business_types: string[] | null
          am_best_rating: string | null
          appetite_guide: Json | null
          appetite_pdf_path: string | null
          created_at: string
          excluded_cargo_types: string[] | null
          excluded_states: string[] | null
          id: string
          is_active: boolean
          logo_path: string | null
          max_annual_revenue: number | null
          max_claims_tolerance: number | null
          max_fleet_size: number | null
          max_radius_pct_over500: number | null
          min_annual_revenue: number | null
          min_authority_age_months: number | null
          min_fleet_size: number | null
          min_years_in_business: number | null
          name: string
          notes: string | null
          preferred_cargo_types: string[] | null
          preferred_states: string[] | null
          requires_authority: boolean | null
          updated_at: string
          website: string | null
        }
        Insert: {
          accepted_business_types?: string[] | null
          am_best_rating?: string | null
          appetite_guide?: Json | null
          appetite_pdf_path?: string | null
          created_at?: string
          excluded_cargo_types?: string[] | null
          excluded_states?: string[] | null
          id?: string
          is_active?: boolean
          logo_path?: string | null
          max_annual_revenue?: number | null
          max_claims_tolerance?: number | null
          max_fleet_size?: number | null
          max_radius_pct_over500?: number | null
          min_annual_revenue?: number | null
          min_authority_age_months?: number | null
          min_fleet_size?: number | null
          min_years_in_business?: number | null
          name: string
          notes?: string | null
          preferred_cargo_types?: string[] | null
          preferred_states?: string[] | null
          requires_authority?: boolean | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          accepted_business_types?: string[] | null
          am_best_rating?: string | null
          appetite_guide?: Json | null
          appetite_pdf_path?: string | null
          created_at?: string
          excluded_cargo_types?: string[] | null
          excluded_states?: string[] | null
          id?: string
          is_active?: boolean
          logo_path?: string | null
          max_annual_revenue?: number | null
          max_claims_tolerance?: number | null
          max_fleet_size?: number | null
          max_radius_pct_over500?: number | null
          min_annual_revenue?: number | null
          min_authority_age_months?: number | null
          min_fleet_size?: number | null
          min_years_in_business?: number | null
          name?: string
          notes?: string | null
          preferred_cargo_types?: string[] | null
          preferred_states?: string[] | null
          requires_authority?: boolean | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      drivers: {
        Row: {
          accidents: Json | null
          account_id: string
          created_at: string
          date_hired_month: number | null
          date_hired_year: number | null
          date_of_birth: string | null
          driver_type: string | null
          experience_months: number | null
          experience_years: number | null
          first_name: string | null
          id: string
          lapse_explanation: string | null
          lapse_suspension: string | null
          last_name: string | null
          license_number: string | null
          license_state: string | null
          license_type: string | null
          num_accidents: number | null
          num_violations: number | null
          original_issue_month: number | null
          original_issue_year: number | null
          sort_order: number | null
          updated_at: string
          violations: Json | null
        }
        Insert: {
          accidents?: Json | null
          account_id: string
          created_at?: string
          date_hired_month?: number | null
          date_hired_year?: number | null
          date_of_birth?: string | null
          driver_type?: string | null
          experience_months?: number | null
          experience_years?: number | null
          first_name?: string | null
          id?: string
          lapse_explanation?: string | null
          lapse_suspension?: string | null
          last_name?: string | null
          license_number?: string | null
          license_state?: string | null
          license_type?: string | null
          num_accidents?: number | null
          num_violations?: number | null
          original_issue_month?: number | null
          original_issue_year?: number | null
          sort_order?: number | null
          updated_at?: string
          violations?: Json | null
        }
        Update: {
          accidents?: Json | null
          account_id?: string
          created_at?: string
          date_hired_month?: number | null
          date_hired_year?: number | null
          date_of_birth?: string | null
          driver_type?: string | null
          experience_months?: number | null
          experience_years?: number | null
          first_name?: string | null
          id?: string
          lapse_explanation?: string | null
          lapse_suspension?: string | null
          last_name?: string | null
          license_number?: string | null
          license_state?: string | null
          license_type?: string | null
          num_accidents?: number | null
          num_violations?: number | null
          original_issue_month?: number | null
          original_issue_year?: number | null
          sort_order?: number | null
          updated_at?: string
          violations?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "drivers_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      garage_locations: {
        Row: {
          account_id: string
          address: string | null
          city: string | null
          county: string | null
          created_at: string
          id: string
          is_principal: boolean | null
          sort_order: number | null
          state: string | null
          updated_at: string
          zip: string | null
        }
        Insert: {
          account_id: string
          address?: string | null
          city?: string | null
          county?: string | null
          created_at?: string
          id?: string
          is_principal?: boolean | null
          sort_order?: number | null
          state?: string | null
          updated_at?: string
          zip?: string | null
        }
        Update: {
          account_id?: string
          address?: string | null
          city?: string | null
          county?: string | null
          created_at?: string
          id?: string
          is_principal?: boolean | null
          sort_order?: number | null
          state?: string | null
          updated_at?: string
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "garage_locations_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      loss_history: {
        Row: {
          account_id: string
          cancellation_reason: string | null
          cancellation_reason_other: string | null
          cancelled_nonrenewed: boolean | null
          coverage_type: string
          created_at: string
          id: string
          no_prior_coverage: boolean | null
          policy_terms: Json | null
          updated_at: string
        }
        Insert: {
          account_id: string
          cancellation_reason?: string | null
          cancellation_reason_other?: string | null
          cancelled_nonrenewed?: boolean | null
          coverage_type: string
          created_at?: string
          id?: string
          no_prior_coverage?: boolean | null
          policy_terms?: Json | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          cancellation_reason?: string | null
          cancellation_reason_other?: string | null
          cancelled_nonrenewed?: boolean | null
          coverage_type?: string
          created_at?: string
          id?: string
          no_prior_coverage?: boolean | null
          policy_terms?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loss_history_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      market_guidance_results: {
        Row: {
          account_id: string
          checked_at: string
          created_at: string
          id: string
          results: Json
        }
        Insert: {
          account_id: string
          checked_at?: string
          created_at?: string
          id?: string
          results?: Json
        }
        Update: {
          account_id?: string
          checked_at?: string
          created_at?: string
          id?: string
          results?: Json
        }
        Relationships: [
          {
            foreignKeyName: "market_guidance_results_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          account_id: string
          attachment_name: string | null
          attachment_path: string | null
          content: string
          created_at: string
          id: string
          is_staff: boolean
          sender_id: string
        }
        Insert: {
          account_id: string
          attachment_name?: string | null
          attachment_path?: string | null
          content?: string
          created_at?: string
          id?: string
          is_staff?: boolean
          sender_id: string
        }
        Update: {
          account_id?: string
          attachment_name?: string | null
          attachment_path?: string | null
          content?: string
          created_at?: string
          id?: string
          is_staff?: boolean
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      power_units: {
        Row: {
          account_id: string
          cab_card_path: string | null
          created_at: string
          garage_zip: string | null
          gvw_class: string | null
          has_cargo: boolean | null
          has_physdam: boolean | null
          id: string
          is_service_vehicle: boolean | null
          lender_address: string | null
          lender_city: string | null
          lender_name: string | null
          lender_state: string | null
          lender_zip: string | null
          make: string | null
          model: string | null
          ownership_type: string | null
          physdam_amount: number | null
          roadside_assistance: boolean | null
          sort_order: number | null
          titled_state: string | null
          truck_type: string | null
          updated_at: string
          vin: string | null
          year: string | null
        }
        Insert: {
          account_id: string
          cab_card_path?: string | null
          created_at?: string
          garage_zip?: string | null
          gvw_class?: string | null
          has_cargo?: boolean | null
          has_physdam?: boolean | null
          id?: string
          is_service_vehicle?: boolean | null
          lender_address?: string | null
          lender_city?: string | null
          lender_name?: string | null
          lender_state?: string | null
          lender_zip?: string | null
          make?: string | null
          model?: string | null
          ownership_type?: string | null
          physdam_amount?: number | null
          roadside_assistance?: boolean | null
          sort_order?: number | null
          titled_state?: string | null
          truck_type?: string | null
          updated_at?: string
          vin?: string | null
          year?: string | null
        }
        Update: {
          account_id?: string
          cab_card_path?: string | null
          created_at?: string
          garage_zip?: string | null
          gvw_class?: string | null
          has_cargo?: boolean | null
          has_physdam?: boolean | null
          id?: string
          is_service_vehicle?: boolean | null
          lender_address?: string | null
          lender_city?: string | null
          lender_name?: string | null
          lender_state?: string | null
          lender_zip?: string | null
          make?: string | null
          model?: string | null
          ownership_type?: string | null
          physdam_amount?: number | null
          roadside_assistance?: boolean | null
          sort_order?: number | null
          titled_state?: string | null
          truck_type?: string | null
          updated_at?: string
          vin?: string | null
          year?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "power_units_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
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
      trailers: {
        Row: {
          account_id: string
          created_at: string
          garage_zip: string | null
          has_physdam: boolean | null
          id: string
          is_nonowned: boolean | null
          lender_address: string | null
          lender_city: string | null
          lender_name: string | null
          lender_state: string | null
          lender_zip: string | null
          make: string | null
          model: string | null
          ownership_type: string | null
          physdam_amount: number | null
          sort_order: number | null
          trailer_type: string | null
          updated_at: string
          vin: string | null
          year: string | null
        }
        Insert: {
          account_id: string
          created_at?: string
          garage_zip?: string | null
          has_physdam?: boolean | null
          id?: string
          is_nonowned?: boolean | null
          lender_address?: string | null
          lender_city?: string | null
          lender_name?: string | null
          lender_state?: string | null
          lender_zip?: string | null
          make?: string | null
          model?: string | null
          ownership_type?: string | null
          physdam_amount?: number | null
          sort_order?: number | null
          trailer_type?: string | null
          updated_at?: string
          vin?: string | null
          year?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string
          garage_zip?: string | null
          has_physdam?: boolean | null
          id?: string
          is_nonowned?: boolean | null
          lender_address?: string | null
          lender_city?: string | null
          lender_name?: string | null
          lender_state?: string | null
          lender_zip?: string | null
          make?: string | null
          model?: string | null
          ownership_type?: string | null
          physdam_amount?: number | null
          sort_order?: number | null
          trailer_type?: string | null
          updated_at?: string
          vin?: string | null
          year?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trailers_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
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
