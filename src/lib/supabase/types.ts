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
      medewerkers: {
        Row: {
          werknemer_id: number
          naam_werknemer: string
          email: string | null
          primaire_rol: string | null
          tweede_rol: string | null
          derde_rol: string | null
          discipline: string | null
          duo_team: string | null
          is_planner: boolean
          werkuren: number
          parttime_dag: string | null
          beschikbaar: boolean
          vaardigheden: string | null
          notities: string | null
          created_at: string
          updated_at: string | null
        }
        Insert: {
          werknemer_id?: number
          naam_werknemer: string
          email?: string | null
          primaire_rol?: string | null
          tweede_rol?: string | null
          derde_rol?: string | null
          discipline?: string | null
          duo_team?: string | null
          is_planner?: boolean
          werkuren?: number
          parttime_dag?: string | null
          beschikbaar?: boolean
          vaardigheden?: string | null
          notities?: string | null
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          werknemer_id?: number
          naam_werknemer?: string
          email?: string | null
          primaire_rol?: string | null
          tweede_rol?: string | null
          derde_rol?: string | null
          discipline?: string | null
          duo_team?: string | null
          is_planner?: boolean
          werkuren?: number
          parttime_dag?: string | null
          beschikbaar?: boolean
          vaardigheden?: string | null
          notities?: string | null
          created_at?: string
          updated_at?: string | null
        }
      }
      klanten: {
        Row: {
          id: string
          klantnummer: string
          naam: string
          contactpersoon: string | null
          email: string | null
          telefoon: string | null
          adres: string | null
          beschikbaarheid: string | null
          interne_notities: string | null
          planning_instructies: string | null
          created_by: string | null
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          klantnummer?: string
          naam: string
          contactpersoon?: string | null
          email?: string | null
          telefoon?: string | null
          adres?: string | null
          beschikbaarheid?: string | null
          interne_notities?: string | null
          planning_instructies?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          klantnummer?: string
          naam?: string
          contactpersoon?: string | null
          email?: string | null
          telefoon?: string | null
          adres?: string | null
          beschikbaarheid?: string | null
          interne_notities?: string | null
          planning_instructies?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string | null
        }
      }
      taken: {
        Row: {
          id: string
          project_id: string | null
          fase_id: string | null
          werknemer_naam: string
          klant_naam: string
          project_nummer: string
          fase_naam: string
          werktype: string
          discipline: string
          week_start: string
          dag_van_week: number
          start_uur: number
          duur_uren: number
          plan_status: 'concept' | 'vast'
          is_hard_lock: boolean
          hard_lock_created_by: string | null
          hard_lock_created_at: string | null
          hard_lock_locked_by: string | null
          hard_lock_locked_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          project_id?: string | null
          fase_id?: string | null
          werknemer_naam: string
          klant_naam: string
          project_nummer: string
          fase_naam: string
          werktype: string
          discipline: string
          week_start: string
          dag_van_week: number
          start_uur: number
          duur_uren: number
          plan_status?: 'concept' | 'vast'
          is_hard_lock?: boolean
          hard_lock_created_by?: string | null
          hard_lock_created_at?: string | null
          hard_lock_locked_by?: string | null
          hard_lock_locked_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string | null
          fase_id?: string | null
          werknemer_naam?: string
          klant_naam?: string
          project_nummer?: string
          fase_naam?: string
          werktype?: string
          discipline?: string
          week_start?: string
          dag_van_week?: number
          start_uur?: number
          duur_uren?: number
          plan_status?: 'concept' | 'vast'
          is_hard_lock?: boolean
          hard_lock_created_by?: string | null
          hard_lock_created_at?: string | null
          hard_lock_locked_by?: string | null
          hard_lock_locked_at?: string | null
          created_at?: string
        }
      }
      notificaties: {
        Row: {
          id: string
          type: 'te_laat' | 'aankomende_deadline' | 'review_nodig' | 'wijziging' | 'actief_project'
          severity: 'low' | 'medium' | 'high'
          titel: string
          beschrijving: string
          project_nummer: string | null
          klant_naam: string | null
          is_done: boolean
          voor_werknemer: string | null
          created_at: string
        }
        Insert: {
          id?: string
          type: 'te_laat' | 'aankomende_deadline' | 'review_nodig' | 'wijziging' | 'actief_project'
          severity?: 'low' | 'medium' | 'high'
          titel: string
          beschrijving: string
          project_nummer?: string | null
          klant_naam?: string | null
          is_done?: boolean
          voor_werknemer?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          type?: 'te_laat' | 'aankomende_deadline' | 'review_nodig' | 'wijziging' | 'actief_project'
          severity?: 'low' | 'medium' | 'high'
          titel?: string
          beschrijving?: string
          project_nummer?: string | null
          klant_naam?: string | null
          is_done?: boolean
          voor_werknemer?: string | null
          created_at?: string
        }
      }
      disciplines: {
        Row: {
          id: string
          discipline_naam: string
          beschrijving: string | null
          kleur_hex: string
          created_at: string
        }
        Insert: {
          id?: string
          discipline_naam: string
          beschrijving?: string | null
          kleur_hex?: string
          created_at?: string
        }
        Update: {
          id?: string
          discipline_naam?: string
          beschrijving?: string | null
          kleur_hex?: string
          created_at?: string
        }
      }
    }
    Views: {}
    Functions: {}
    Enums: {}
  }
}
