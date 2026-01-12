import { sheets, SPREADSHEET_ID } from '../config/googleSheets'
import type { Werknemer, RolProfiel, Discipline, Regel, SheetsCache } from '../types'

// In-memory cache van Google Sheets data
let cache: SheetsCache = {
  werknemers: [],
  rollen: [],
  disciplines: [],
  regels: [],
  lastSync: new Date(0), // Epoch = nog nooit gesynct
}

// ============================================
// PARSE FUNCTIES (Sheet rijen → TypeScript objecten)
// ============================================

function parseWerknemers(rows: any[][]): Werknemer[] {
  if (!rows || rows.length === 0) return []

  // Correcte kolom mapping volgens Google Sheet:
  // A=werknemer_id, B=naam, C=primaire_rol, D=tweede_rol, E=derde_rol
  // F=discipline, G=duo_team, H=is_planner, I=werkuren, J=parttime_dag
  // K=vaardigheden, L=e-mail, M=beschikbaar

  return rows
    .filter(row => row[0]) // Skip lege rijen
    .map(row => ({
      werknemer_id: parseInt(row[0]) || 0,
      naam: row[1] || '',
      primaire_rol: row[2] || '',
      tweede_rol: row[3] || undefined,
      derde_rol: row[4] || undefined,
      discipline: row[5] || '',
      duo_team: row[6] || undefined,
      is_planner: (row[7] || '').toLowerCase() === 'yes',
      werkuren: parseInt(row[8]) || 40,
      parttime_dag: row[9] || undefined,
      vaardigheden: row[10] || '',
      email: row[11] || null,
      beschikbaar: (row[12] || 'yes').toLowerCase() === 'yes',
      notities: row[13] || undefined,
    }))
}

function parseRollen(rows: any[][]): RolProfiel[] {
  if (!rows || rows.length === 0) return []

  // Kolom mapping: A=rol_nummer, B=rol_naam, C=beschrijving_rol, D=taken_rol
  return rows
    .filter(row => row[0])
    .map(row => ({
      rol_nummer: parseInt(row[0]) || 0,
      rol_naam: row[1] || '',
      beschrijving: row[2] || '',
      taken: row[3] || '',
    }))
}

function parseDisciplines(rows: any[][]): Discipline[] {
  if (!rows || rows.length === 0) return []

  // Kolom mapping: A=discipline_naam, B=beschrijving
  return rows
    .filter(row => row[0]) // Filter lege rijen EN rows waar kolom A leeg is
    .map(row => ({
      naam: row[0] || '',
      beschrijving: row[1] || '',
      kleur_hex: row[2] || undefined, // Optioneel: kleur uit kolom C
    }))
}

function parseRegels(rows: any[][]): Regel[] {
  if (!rows || rows.length === 0) return []

  return rows
    .filter(row => row[0])
    .map(row => ({
      regel_id: row[0] || '',
      titel_kort: row[1] || '',
      categorie: row[2] || '',
      ernst: (row[3] || 'Waarschuwing') as 'Hard blok' | 'Waarschuwing' | 'Suggestie',
      voorwaarde_kort: row[4] || '',
      actie_kort: row[5] || '',
      max_per_dag: row[6] || undefined,
      parameters: row[7] || undefined,
    }))
}

// ============================================
// SYNC FUNCTIE (Haalt data op uit Google Sheets)
// ============================================

export async function syncGoogleSheets(): Promise<void> {
  try {
    console.log('🔄 Syncing Google Sheets...')

    // Haal alle 4 tabs op in parallel (sneller!)
    const [werknemersRes, rollenRes, disciplinesRes, regelsRes] = await Promise.all([
      sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Werknemers!A2:N', // Vanaf rij 2 (skip header), kolom A t/m N
      }),
      sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Rolprofielen!A2:D',
      }),
      sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Discipline!A2:C', // Inclusief kleur_hex kolom (als je die toevoegt)
      }),
      sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Regels!A2:H',
      }),
    ])

    // Parse de data
    cache.werknemers = parseWerknemers(werknemersRes.data.values || [])
    cache.rollen = parseRollen(rollenRes.data.values || [])
    cache.disciplines = parseDisciplines(disciplinesRes.data.values || [])
    cache.regels = parseRegels(regelsRes.data.values || [])
    cache.lastSync = new Date()

    console.log('✅ Google Sheets sync compleet:')
    console.log(`   - ${cache.werknemers.length} werknemers`)
    console.log(`   - ${cache.rollen.length} rolprofielen`)
    console.log(`   - ${cache.disciplines.length} disciplines`)
    console.log(`   - ${cache.regels.length} regels`)
  } catch (error: any) {
    console.error('❌ Google Sheets sync failed:', error.message)
    throw error
  }
}

// ============================================
// GETTER FUNCTIES (Voor gebruik in routes)
// ============================================

export function getCache(): SheetsCache {
  return cache
}

export function getWerknemers(): Werknemer[] {
  return cache.werknemers
}

export function getRollen(): RolProfiel[] {
  return cache.rollen
}

export function getDisciplines(): Discipline[] {
  return cache.disciplines
}

export function getRegels(): Regel[] {
  return cache.regels
}

// Helper: Vind werknemer op naam
export function findWerknemerByNaam(naam: string): Werknemer | undefined {
  return cache.werknemers.find(w => w.naam.toLowerCase() === naam.toLowerCase())
}

// Helper: Check of werknemer beschikbaar is (niet langdurig afwezig)
export function isWerknemerBeschikbaar(naam: string): boolean {
  const werknemer = findWerknemerByNaam(naam)
  return werknemer?.beschikbaar ?? false
}

// Helper: Haal werknemer capaciteit op
export function getWerknemerCapaciteit(naam: string): number {
  const werknemer = findWerknemerByNaam(naam)
  return werknemer?.werkuren ?? 40
}

// ============================================
// AUTO SYNC (Elke 60 minuten)
// ============================================

// Sync bij server start (initiele load)
export async function initializeSheets(): Promise<void> {
  try {
    await syncGoogleSheets()
  } catch (error) {
    console.error('❌ Initiele Google Sheets sync failed. Server kan niet starten.')
    throw error
  }
}

// Sync elke 60 minuten automatisch
export function startAutoSync(intervalMinutes: number = 60): NodeJS.Timeout {
  const intervalMs = intervalMinutes * 60 * 1000
  console.log(`⏰ Auto-sync ingesteld: elke ${intervalMinutes} minuten`)

  return setInterval(async () => {
    try {
      await syncGoogleSheets()
    } catch (error) {
      console.error('❌ Auto-sync failed, probeer opnieuw bij volgende interval')
    }
  }, intervalMs)
}
