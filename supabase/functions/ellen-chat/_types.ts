// ===== GEDEELDE TYPES =====

export interface SessionPayload {
  sub: string;
  email: string;
  naam: string;
  isPlanner: boolean;
  rol: string;
  iat: number;
  exp: number;
}

export interface PlanningConfig {
  werkdag_start: number;
  werkdag_eind: number;
  lunch_start: number;
  lunch_eind: number;
  meeting_start: number;
  meeting_eind: number;
  standaard_uren_per_dag: number;
  min_buffer_tussen_fases: number;
  fase_templates: Array<{ naam: string; min_dagen: number; max_dagen: number; omschrijving?: string }>;
  extra_instructies?: string;
}

export interface EllenRegel {
  categorie: 'hard' | 'soft' | 'voorkeur';
  prioriteit: number;
  regel: string;
  rationale: string | null;
}

export interface TimeSlot {
  startUur: number;
  duurUren: number;
}

export type Intent = 'CHAT' | 'PLAN' | 'QUERY';

// deno-lint-ignore no-explicit-any
export type SupabaseClient = any;

export const DEFAULT_CONFIG: PlanningConfig = {
  werkdag_start: 9,
  werkdag_eind: 18,
  lunch_start: 12.5,
  lunch_eind: 13.5,
  meeting_start: 10,
  meeting_eind: 17,
  standaard_uren_per_dag: 8,
  min_buffer_tussen_fases: 0,
  fase_templates: [
    { naam: 'Concept/Strategie', min_dagen: 1, max_dagen: 2 },
    { naam: 'Pre-productie', min_dagen: 1, max_dagen: 3 },
    { naam: 'Shoot/Productie', min_dagen: 1, max_dagen: 5 },
    { naam: 'Edit/Post-productie', min_dagen: 2, max_dagen: 10 },
    { naam: 'Review/Afronding', min_dagen: 1, max_dagen: 2 },
  ],
};
