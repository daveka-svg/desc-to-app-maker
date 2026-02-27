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
      ahc_template_mappings: {
        Row: {
          created_at: string
          field_catalog_json: Json | null
          id: string
          mapping_json: Json
          template_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          field_catalog_json?: Json | null
          id?: string
          mapping_json?: Json
          template_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          field_catalog_json?: Json | null
          id?: string
          mapping_json?: Json
          template_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ahc_template_mappings_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: true
            referencedRelation: "ahc_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      ahc_templates: {
        Row: {
          created_at: string
          first_country_entry: string
          id: string
          is_acroform: boolean
          is_active: boolean
          language_pair: string
          storage_bucket: string
          storage_path: string
          template_code: string
        }
        Insert: {
          created_at?: string
          first_country_entry: string
          id?: string
          is_acroform?: boolean
          is_active?: boolean
          language_pair?: string
          storage_bucket?: string
          storage_path: string
          template_code: string
        }
        Update: {
          created_at?: string
          first_country_entry?: string
          id?: string
          is_acroform?: boolean
          is_active?: boolean
          language_pair?: string
          storage_bucket?: string
          storage_path?: string
          template_code?: string
        }
        Relationships: []
      }
      attachments: {
        Row: {
          created_at: string
          filename: string
          id: string
          submission_id: string
          type: Database["public"]["Enums"]["attachment_type"]
          url: string
        }
        Insert: {
          created_at?: string
          filename: string
          id?: string
          submission_id: string
          type?: Database["public"]["Enums"]["attachment_type"]
          url: string
        }
        Update: {
          created_at?: string
          filename?: string
          id?: string
          submission_id?: string
          type?: Database["public"]["Enums"]["attachment_type"]
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "attachments_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: Database["public"]["Enums"]["audit_action"]
          created_at: string
          details_json: Json | null
          id: string
          submission_id: string | null
          user_id: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["audit_action"]
          created_at?: string
          details_json?: Json | null
          id?: string
          submission_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["audit_action"]
          created_at?: string
          details_json?: Json | null
          id?: string
          submission_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      clinics: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          city: string | null
          country: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          postal_code: string | null
          updated_at: string
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          postal_code?: string | null
          updated_at?: string
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          postal_code?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      document_templates: {
        Row: {
          active: boolean
          created_at: string
          first_country_of_entry: string
          id: string
          mapping_schema_json: Json | null
          name: string
          second_language_code: string
          storage_bucket: string
          storage_path: string | null
          template_pdf_url: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          first_country_of_entry: string
          id?: string
          mapping_schema_json?: Json | null
          name: string
          second_language_code: string
          storage_bucket?: string
          storage_path?: string | null
          template_pdf_url: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          first_country_of_entry?: string
          id?: string
          mapping_schema_json?: Json | null
          name?: string
          second_language_code?: string
          storage_bucket?: string
          storage_path?: string | null
          template_pdf_url?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          clinic_id: string
          created_at: string
          email: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          email: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          email?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions: {
        Row: {
          certificate_number: string | null
          clinic_id: string
          correction_fields: Json | null
          correction_message: string | null
          created_at: string
          created_by_user_id: string | null
          data_json: Json
          entry_date: string | null
          final_ahc_pdf_path: string | null
          final_ahc_pdf_url: string | null
          final_destination: string | null
          first_country_of_entry: string | null
          id: string
          intake_pdf_url: string | null
          intake_upload_path: string | null
          issue_datetime: string | null
          issue_place: string | null
          issuing_practice_id: string | null
          issuing_vet_id: string | null
          owner_email: string | null
          owner_name: string | null
          pets_count: number | null
          public_token: string
          selected_template_id: string | null
          source: string
          status: Database["public"]["Enums"]["submission_status"]
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          certificate_number?: string | null
          clinic_id: string
          correction_fields?: Json | null
          correction_message?: string | null
          created_at?: string
          created_by_user_id?: string | null
          data_json?: Json
          entry_date?: string | null
          final_ahc_pdf_path?: string | null
          final_ahc_pdf_url?: string | null
          final_destination?: string | null
          first_country_of_entry?: string | null
          id?: string
          intake_pdf_url?: string | null
          intake_upload_path?: string | null
          issue_datetime?: string | null
          issue_place?: string | null
          issuing_practice_id?: string | null
          issuing_vet_id?: string | null
          owner_email?: string | null
          owner_name?: string | null
          pets_count?: number | null
          public_token?: string
          selected_template_id?: string | null
          source?: string
          status?: Database["public"]["Enums"]["submission_status"]
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          certificate_number?: string | null
          clinic_id?: string
          correction_fields?: Json | null
          correction_message?: string | null
          created_at?: string
          created_by_user_id?: string | null
          data_json?: Json
          entry_date?: string | null
          final_ahc_pdf_path?: string | null
          final_ahc_pdf_url?: string | null
          final_destination?: string | null
          first_country_of_entry?: string | null
          id?: string
          intake_pdf_url?: string | null
          intake_upload_path?: string | null
          issue_datetime?: string | null
          issue_place?: string | null
          issuing_practice_id?: string | null
          issuing_vet_id?: string | null
          owner_email?: string | null
          owner_name?: string | null
          pets_count?: number | null
          public_token?: string
          selected_template_id?: string | null
          source?: string
          status?: Database["public"]["Enums"]["submission_status"]
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "submissions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_issuing_practice_id_fkey"
            columns: ["issuing_practice_id"]
            isOneToOne: false
            referencedRelation: "vet_practices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_issuing_vet_id_fkey"
            columns: ["issuing_vet_id"]
            isOneToOne: false
            referencedRelation: "vets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_selected_template_id_fkey"
            columns: ["selected_template_id"]
            isOneToOne: false
            referencedRelation: "ahc_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vet_practices: {
        Row: {
          address_line_1: string
          address_line_2: string | null
          city: string
          clinic_id: string
          country: string
          created_at: string
          email: string | null
          id: string
          ov_practice_id: string | null
          phone: string | null
          postcode: string
          practice_name: string
          rcvs_premises_ref: string | null
          trading_name: string | null
          updated_at: string
        }
        Insert: {
          address_line_1?: string
          address_line_2?: string | null
          city?: string
          clinic_id: string
          country?: string
          created_at?: string
          email?: string | null
          id?: string
          ov_practice_id?: string | null
          phone?: string | null
          postcode?: string
          practice_name: string
          rcvs_premises_ref?: string | null
          trading_name?: string | null
          updated_at?: string
        }
        Update: {
          address_line_1?: string
          address_line_2?: string | null
          city?: string
          clinic_id?: string
          country?: string
          created_at?: string
          email?: string | null
          id?: string
          ov_practice_id?: string | null
          phone?: string | null
          postcode?: string
          practice_name?: string
          rcvs_premises_ref?: string | null
          trading_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vet_practices_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      vets: {
        Row: {
          clinic_id: string
          created_at: string
          email: string | null
          full_name: string
          id: string
          phone: string | null
          rcvs_number: string | null
          role_title: string | null
          signature_image_url: string | null
          signature_text: string | null
          stamp_image_url: string | null
          updated_at: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          phone?: string | null
          rcvs_number?: string | null
          role_title?: string | null
          signature_image_url?: string | null
          signature_text?: string | null
          stamp_image_url?: string | null
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          rcvs_number?: string | null
          role_title?: string | null
          signature_image_url?: string | null
          signature_text?: string | null
          stamp_image_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vets_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_clinic_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_member_of_clinic: {
        Args: { _clinic_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "staff"
      attachment_type: "rabies_evidence" | "authorisation_letter" | "other"
      audit_action:
        | "created"
        | "saved_draft"
        | "submitted"
        | "correction_requested"
        | "corrected"
        | "template_selected"
        | "generated"
        | "approved"
        | "downloaded"
      submission_status:
        | "Draft"
        | "Submitted"
        | "NeedsCorrection"
        | "UnderReview"
        | "ReadyToGenerate"
        | "Generated"
        | "Approved"
        | "Downloaded"
        | "Cancelled"
        | "Archived"
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
      app_role: ["admin", "staff"],
      attachment_type: ["rabies_evidence", "authorisation_letter", "other"],
      audit_action: [
        "created",
        "saved_draft",
        "submitted",
        "correction_requested",
        "corrected",
        "template_selected",
        "generated",
        "approved",
        "downloaded",
      ],
      submission_status: [
        "Draft",
        "Submitted",
        "NeedsCorrection",
        "UnderReview",
        "ReadyToGenerate",
        "Generated",
        "Approved",
        "Downloaded",
        "Cancelled",
        "Archived",
      ],
    },
  },
} as const
