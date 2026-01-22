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
      audit_log: {
        Row: {
          actie: string
          created_at: string | null
          entiteit_id: string
          entiteit_type: string
          id: string
          ip_address: string | null
          nieuwe_waarde: Json | null
          oude_waarde: Json | null
          user_id: string | null
        }
        Insert: {
          actie: string
          created_at?: string | null
          entiteit_id: string
          entiteit_type: string
          id?: string
          ip_address?: string | null
          nieuwe_waarde?: Json | null
          oude_waarde?: Json | null
          user_id?: string | null
        }
        Update: {
          actie?: string
          created_at?: string | null
          entiteit_id?: string
          entiteit_type?: string
          id?: string
          ip_address?: string | null
          nieuwe_waarde?: Json | null
          oude_waarde?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      beschikbaarheid_medewerkers: {
        Row: {
          created_at: string | null
          created_by: string | null
          eind_datum: string
          id: string
          reden: string | null
          start_datum: string
          status: string | null
          type: string
          updated_at: string | null
          werknemer_naam: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          eind_datum: string
          id?: string
          reden?: string | null
          start_datum: string
          status?: string | null
          type: string
          updated_at?: string | null
          werknemer_naam: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          eind_datum?: string
          id?: string
          reden?: string | null
          start_datum?: string
          status?: string | null
          type?: string
          updated_at?: string | null
          werknemer_naam?: string
        }
        Relationships: [
          {
            foreignKeyName: "verlof_aanvragen_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      disciplines: {
        Row: {
          beschrijving: string | null
          created_at: string | null
          discipline_naam: string
          id: number
          kleur_hex: string | null
          updated_at: string | null
        }
        Insert: {
          beschrijving?: string | null
          created_at?: string | null
          discipline_naam: string
          id?: number
          kleur_hex?: string | null
          updated_at?: string | null
        }
        Update: {
          beschrijving?: string | null
          created_at?: string | null
          discipline_naam?: string
          id?: number
          kleur_hex?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      klanten: {
        Row: {
          adres: string | null
          contactpersoon: string | null
          created_at: string | null
          created_by: string | null
          email: string | null
          id: string
          klantnummer: string
          naam: string
          notities: string | null
          telefoon: string | null
          updated_at: string | null
        }
        Insert: {
          adres?: string | null
          contactpersoon?: string | null
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          id?: string
          klantnummer: string
          naam: string
          notities?: string | null
          telefoon?: string | null
          updated_at?: string | null
        }
        Update: {
          adres?: string | null
          contactpersoon?: string | null
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          id?: string
          klantnummer?: string
          naam?: string
          notities?: string | null
          telefoon?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "klanten_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      login_attempts: {
        Row: {
          created_at: string | null
          gebruikersnaam: string
          id: string
          ip_address: string | null
          success: boolean
        }
        Insert: {
          created_at?: string | null
          gebruikersnaam: string
          id?: string
          ip_address?: string | null
          success?: boolean
        }
        Update: {
          created_at?: string | null
          gebruikersnaam?: string
          id?: string
          ip_address?: string | null
          success?: boolean
        }
        Relationships: []
      }
      medewerkers: {
        Row: {
          beschikbaar: boolean | null
          created_at: string | null
          derde_rol: string | null
          discipline: string | null
          duo_team: string | null
          gebruikersnaam: string | null
          in_planning: boolean | null
          is_planner: boolean | null
          microsoft_connected: boolean | null
          microsoft_connected_at: string | null
          microsoft_email: string | null
          naam_werknemer: string
          notities: string | null
          parttime_dag: string | null
          planner_volgorde: number | null
          primaire_rol: string | null
          tweede_rol: string | null
          updated_at: string | null
          vaardigheden: string | null
          werknemer_id: number
          werkuren: number | null
        }
        Insert: {
          beschikbaar?: boolean | null
          created_at?: string | null
          derde_rol?: string | null
          discipline?: string | null
          duo_team?: string | null
          gebruikersnaam?: string | null
          in_planning?: boolean | null
          is_planner?: boolean | null
          microsoft_connected?: boolean | null
          microsoft_connected_at?: string | null
          microsoft_email?: string | null
          naam_werknemer: string
          notities?: string | null
          parttime_dag?: string | null
          planner_volgorde?: number | null
          primaire_rol?: string | null
          tweede_rol?: string | null
          updated_at?: string | null
          vaardigheden?: string | null
          werknemer_id: number
          werkuren?: number | null
        }
        Update: {
          beschikbaar?: boolean | null
          created_at?: string | null
          derde_rol?: string | null
          discipline?: string | null
          duo_team?: string | null
          gebruikersnaam?: string | null
          in_planning?: boolean | null
          is_planner?: boolean | null
          microsoft_connected?: boolean | null
          microsoft_connected_at?: string | null
          microsoft_email?: string | null
          naam_werknemer?: string
          notities?: string | null
          parttime_dag?: string | null
          planner_volgorde?: number | null
          primaire_rol?: string | null
          tweede_rol?: string | null
          updated_at?: string | null
          vaardigheden?: string | null
          werknemer_id?: number
          werkuren?: number | null
        }
        Relationships: []
      }
      "meetings & presentaties": {
        Row: {
          created_at: string | null
          created_by: string | null
          datum: string
          deelnemers: string[] | null
          eind_tijd: string
          id: string
          is_hard_lock: boolean | null
          locatie: string | null
          onderwerp: string
          project_id: string | null
          start_tijd: string
          status: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          datum: string
          deelnemers?: string[] | null
          eind_tijd: string
          id?: string
          is_hard_lock?: boolean | null
          locatie?: string | null
          onderwerp: string
          project_id?: string | null
          start_tijd: string
          status?: string | null
          type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          datum?: string
          deelnemers?: string[] | null
          eind_tijd?: string
          id?: string
          is_hard_lock?: boolean | null
          locatie?: string | null
          onderwerp?: string
          project_id?: string | null
          start_tijd?: string
          status?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meetings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projecten"
            referencedColumns: ["id"]
          },
        ]
      }
      microsoft_tokens: {
        Row: {
          access_token_encrypted: string
          created_at: string | null
          id: string
          refresh_token_encrypted: string
          token_expires_at: string
          updated_at: string | null
          werknemer_id: number
        }
        Insert: {
          access_token_encrypted: string
          created_at?: string | null
          id?: string
          refresh_token_encrypted: string
          token_expires_at: string
          updated_at?: string | null
          werknemer_id: number
        }
        Update: {
          access_token_encrypted?: string
          created_at?: string | null
          id?: string
          refresh_token_encrypted?: string
          token_expires_at?: string
          updated_at?: string | null
          werknemer_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "microsoft_tokens_werknemer_id_fkey"
            columns: ["werknemer_id"]
            isOneToOne: true
            referencedRelation: "medewerkers"
            referencedColumns: ["werknemer_id"]
          },
        ]
      }
      notificaties: {
        Row: {
          aantal: number | null
          beschrijving: string | null
          created_at: string | null
          deadline: string | null
          id: string
          is_done: boolean | null
          klant_naam: string | null
          project_nummer: string | null
          severity: string
          titel: string
          type: string
          updated_at: string | null
          voor_werknemer: string | null
        }
        Insert: {
          aantal?: number | null
          beschrijving?: string | null
          created_at?: string | null
          deadline?: string | null
          id?: string
          is_done?: boolean | null
          klant_naam?: string | null
          project_nummer?: string | null
          severity: string
          titel: string
          type: string
          updated_at?: string | null
          voor_werknemer?: string | null
        }
        Update: {
          aantal?: number | null
          beschrijving?: string | null
          created_at?: string | null
          deadline?: string | null
          id?: string
          is_done?: boolean | null
          klant_naam?: string | null
          project_nummer?: string | null
          severity?: string
          titel?: string
          type?: string
          updated_at?: string | null
          voor_werknemer?: string | null
        }
        Relationships: []
      }
      planning_regels: {
        Row: {
          actie_kort: string | null
          categorie: string | null
          created_at: string | null
          ernst: string | null
          max_per_dag: number | null
          parameters: Json | null
          regel_id: number
          titel_kort: string
          updated_at: string | null
          voorwaarde_kort: string | null
        }
        Insert: {
          actie_kort?: string | null
          categorie?: string | null
          created_at?: string | null
          ernst?: string | null
          max_per_dag?: number | null
          parameters?: Json | null
          regel_id: number
          titel_kort: string
          updated_at?: string | null
          voorwaarde_kort?: string | null
        }
        Update: {
          actie_kort?: string | null
          categorie?: string | null
          created_at?: string | null
          ernst?: string | null
          max_per_dag?: number | null
          parameters?: Json | null
          regel_id?: number
          titel_kort?: string
          updated_at?: string | null
          voorwaarde_kort?: string | null
        }
        Relationships: []
      }
      project_fases: {
        Row: {
          created_at: string | null
          datum_tijd: string | null
          eind_datum: string | null
          fase_naam: string
          fase_type: string
          id: string
          inspanning_dagen: number | null
          is_hard_lock: boolean | null
          locatie: string | null
          medewerkers: string[] | null
          opmerkingen: string | null
          project_id: string | null
          start_datum: string | null
          updated_at: string | null
          volgorde: number
        }
        Insert: {
          created_at?: string | null
          datum_tijd?: string | null
          eind_datum?: string | null
          fase_naam: string
          fase_type: string
          id?: string
          inspanning_dagen?: number | null
          is_hard_lock?: boolean | null
          locatie?: string | null
          medewerkers?: string[] | null
          opmerkingen?: string | null
          project_id?: string | null
          start_datum?: string | null
          updated_at?: string | null
          volgorde: number
        }
        Update: {
          created_at?: string | null
          datum_tijd?: string | null
          eind_datum?: string | null
          fase_naam?: string
          fase_type?: string
          id?: string
          inspanning_dagen?: number | null
          is_hard_lock?: boolean | null
          locatie?: string | null
          medewerkers?: string[] | null
          opmerkingen?: string | null
          project_id?: string | null
          start_datum?: string | null
          updated_at?: string | null
          volgorde?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_fases_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projecten"
            referencedColumns: ["id"]
          },
        ]
      }
      projecten: {
        Row: {
          account_team: Json | null
          adres_klant: string | null
          created_at: string | null
          created_by: string | null
          creatie_team: Json | null
          datum_aanvraag: string
          deadline: string
          id: string
          info_klant: string | null
          klant_id: string | null
          omschrijving: string
          opmerkingen: string | null
          productie_team: Json | null
          projectnummer: string
          projecttype: string
          status: string | null
          updated_at: string | null
          volgnummer: number
        }
        Insert: {
          account_team?: Json | null
          adres_klant?: string | null
          created_at?: string | null
          created_by?: string | null
          creatie_team?: Json | null
          datum_aanvraag: string
          deadline: string
          id?: string
          info_klant?: string | null
          klant_id?: string | null
          omschrijving: string
          opmerkingen?: string | null
          productie_team?: Json | null
          projectnummer: string
          projecttype: string
          status?: string | null
          updated_at?: string | null
          volgnummer: number
        }
        Update: {
          account_team?: Json | null
          adres_klant?: string | null
          created_at?: string | null
          created_by?: string | null
          creatie_team?: Json | null
          datum_aanvraag?: string
          deadline?: string
          id?: string
          info_klant?: string | null
          klant_id?: string | null
          omschrijving?: string
          opmerkingen?: string | null
          productie_team?: Json | null
          projectnummer?: string
          projecttype?: string
          status?: string | null
          updated_at?: string | null
          volgnummer?: number
        }
        Relationships: [
          {
            foreignKeyName: "projecten_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projecten_klant_id_fkey"
            columns: ["klant_id"]
            isOneToOne: false
            referencedRelation: "klanten"
            referencedColumns: ["id"]
          },
        ]
      }
      rolprofielen: {
        Row: {
          beschrijving_rol: string | null
          created_at: string | null
          rol_naam: string
          rol_nummer: number
          taken_rol: string | null
          updated_at: string | null
        }
        Insert: {
          beschrijving_rol?: string | null
          created_at?: string | null
          rol_naam: string
          rol_nummer: number
          taken_rol?: string | null
          updated_at?: string | null
        }
        Update: {
          beschrijving_rol?: string | null
          created_at?: string | null
          rol_naam?: string
          rol_nummer?: number
          taken_rol?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      taken: {
        Row: {
          created_at: string | null
          created_by: string | null
          dag_van_week: number
          discipline: string
          duur_uren: number
          fase_id: string | null
          fase_naam: string
          id: string
          is_hard_lock: boolean | null
          klant_naam: string
          locked_by: string | null
          microsoft_event_id: string | null
          microsoft_synced_at: string | null
          plan_status: string | null
          project_id: string | null
          project_nummer: string
          start_uur: number
          synced_to_microsoft: boolean | null
          updated_at: string | null
          week_start: string
          werknemer_naam: string
          werktype: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          dag_van_week: number
          discipline: string
          duur_uren: number
          fase_id?: string | null
          fase_naam: string
          id?: string
          is_hard_lock?: boolean | null
          klant_naam: string
          locked_by?: string | null
          microsoft_event_id?: string | null
          microsoft_synced_at?: string | null
          plan_status?: string | null
          project_id?: string | null
          project_nummer: string
          start_uur: number
          synced_to_microsoft?: boolean | null
          updated_at?: string | null
          week_start: string
          werknemer_naam: string
          werktype: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          dag_van_week?: number
          discipline?: string
          duur_uren?: number
          fase_id?: string | null
          fase_naam?: string
          id?: string
          is_hard_lock?: boolean | null
          klant_naam?: string
          locked_by?: string | null
          microsoft_event_id?: string | null
          microsoft_synced_at?: string | null
          plan_status?: string | null
          project_id?: string | null
          project_nummer?: string
          start_uur?: number
          synced_to_microsoft?: boolean | null
          updated_at?: string | null
          week_start?: string
          werknemer_naam?: string
          werktype?: string
        }
        Relationships: [
          {
            foreignKeyName: "taken_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "taken_fase_id_fkey"
            columns: ["fase_id"]
            isOneToOne: false
            referencedRelation: "project_fases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "taken_locked_by_fkey"
            columns: ["locked_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "taken_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projecten"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string | null
          gebruikersnaam: string
          id: string
          is_planner: boolean | null
          naam: string
          password_hash: string
          rol: string
          updated_at: string | null
          werknemer_id: number | null
        }
        Insert: {
          created_at?: string | null
          gebruikersnaam: string
          id?: string
          is_planner?: boolean | null
          naam: string
          password_hash: string
          rol: string
          updated_at?: string | null
          werknemer_id?: number | null
        }
        Update: {
          created_at?: string | null
          gebruikersnaam?: string
          id?: string
          is_planner?: boolean | null
          naam?: string
          password_hash?: string
          rol?: string
          updated_at?: string | null
          werknemer_id?: number | null
        }
        Relationships: []
      }
      wijzigingsverzoeken: {
        Row: {
          beschrijving: string
          betrokken_mensen: string[] | null
          created_at: string | null
          created_by: string | null
          extra_uren: number | null
          id: string
          impact: string | null
          nieuwe_deadline: string | null
          project_id: string | null
          status: string | null
          type_wijziging: string
          updated_at: string | null
        }
        Insert: {
          beschrijving: string
          betrokken_mensen?: string[] | null
          created_at?: string | null
          created_by?: string | null
          extra_uren?: number | null
          id?: string
          impact?: string | null
          nieuwe_deadline?: string | null
          project_id?: string | null
          status?: string | null
          type_wijziging: string
          updated_at?: string | null
        }
        Update: {
          beschrijving?: string
          betrokken_mensen?: string[] | null
          created_at?: string | null
          created_by?: string | null
          extra_uren?: number | null
          id?: string
          impact?: string | null
          nieuwe_deadline?: string | null
          project_id?: string | null
          status?: string | null
          type_wijziging?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wijzigingsverzoeken_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wijzigingsverzoeken_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projecten"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_old_login_attempts: { Args: never; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
