import { syncGoogleSheets, getCache } from '../src/services/sheetsSync'
import dotenv from 'dotenv'

dotenv.config()

async function checkData() {
  console.log('📊 Fetching Google Sheets data...\n')

  await syncGoogleSheets()
  const cache = getCache()

  console.log('=== WERKNEMERS (eerste 3) ===')
  cache.werknemers.slice(0, 3).forEach((w) => {
    console.log(`${w.naam}:`)
    console.log(`  ID: ${w.werknemer_id}`)
    console.log(`  Email: ${w.email || 'GEEN'}`)
    console.log(`  Primaire rol: ${w.primaire_rol}`)
    console.log(`  Discipline: ${w.discipline}`)
    console.log(`  Werkuren: ${w.werkuren}`)
    console.log(`  Beschikbaar: ${w.beschikbaar}`)
    console.log('')
  })

  console.log('\n=== DISCIPLINES ===')
  cache.disciplines.forEach((d, i) => {
    console.log(`${i+1}. ${d.naam}`)
    console.log(`   Beschrijving: ${d.beschrijving || 'GEEN'}`)
    console.log(`   Kleur: ${d.kleur_hex || 'GEEN'}`)
    console.log('')
  })

  console.log('\n=== ROLPROFIELEN (eerste 3) ===')
  cache.rollen.slice(0, 3).forEach((r) => {
    console.log(`${r.rol_naam}:`)
    console.log(`  Beschrijving: ${r.beschrijving || 'GEEN'}`)
    console.log(`  Taken: ${r.taken || 'GEEN'}`)
    console.log('')
  })

  console.log('\n=== REGELS ===')
  cache.regels.forEach((r) => {
    console.log(`${r.titel_kort}:`)
    console.log(`  Voorwaarde: ${r.voorwaarde_kort}`)
    console.log(`  Actie: ${r.actie_kort}`)
    console.log(`  Max per dag: ${r.max_per_dag}`)
    console.log(`  Parameters: ${JSON.stringify(r.parameters)}`)
    console.log('')
  })

  process.exit(0)
}

checkData()
