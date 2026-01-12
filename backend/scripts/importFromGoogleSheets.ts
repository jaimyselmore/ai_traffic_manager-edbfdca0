import { supabase } from '../src/config/supabase'
import { syncGoogleSheets, getCache } from '../src/services/sheetsSync'
import dotenv from 'dotenv'

dotenv.config()

/**
 * ONE-TIME IMPORT SCRIPT
 *
 * Dit script haalt alle data uit Google Sheets en zet het in Supabase.
 * Run dit script 1x om de initiële data over te zetten.
 */

async function importAllData() {
  console.log('🚀 Starting Google Sheets → Supabase import...\n')

  try {
    // Stap 1: Sync Google Sheets (haal data op)
    console.log('📊 Fetching data from Google Sheets...')
    await syncGoogleSheets()
    const cache = getCache()
    console.log('✅ Google Sheets data fetched!\n')

    // Stap 2: Import werknemers
    console.log('👥 Importing werknemers...')
    for (const werknemer of cache.werknemers) {
      const { error } = await supabase
        .from('werknemers')
        .upsert({
          werknemer_id: werknemer.werknemer_id,
          naam_werknemer: werknemer.naam,
          email: werknemer.email,
          primaire_rol: werknemer.primaire_rol,
          tweede_rol: werknemer.tweede_rol,
          derde_rol: werknemer.derde_rol,
          discipline: werknemer.discipline,
          duo_team: werknemer.duo_team,
          is_planner: werknemer.is_planner,
          werkuren: werknemer.werkuren,
          parttime_dag: werknemer.parttime_dag,
          beschikbaar: werknemer.beschikbaar,
          vaardigheden: werknemer.vaardigheden,
          notities: werknemer.notities,
        }, { onConflict: 'werknemer_id' })

      if (error) {
        console.error(`  ❌ Error importing ${werknemer.naam}:`, error.message)
      } else {
        console.log(`  ✅ ${werknemer.naam}`)
      }
    }
    console.log(`✅ Imported ${cache.werknemers.length} werknemers\n`)

    // Stap 3: Import rolprofielen
    console.log('📋 Importing rolprofielen...')
    for (const rol of cache.rollen) {
      const { error } = await supabase
        .from('rolprofielen')
        .upsert({
          rol_nummer: rol.rol_nummer,
          rol_naam: rol.rol_naam,
          beschrijving_rol: rol.beschrijving,
          taken_rol: rol.taken,
        }, { onConflict: 'rol_nummer' })

      if (error) {
        console.error(`  ❌ Error importing ${rol.rol_naam}:`, error.message)
      } else {
        console.log(`  ✅ ${rol.rol_naam}`)
      }
    }
    console.log(`✅ Imported ${cache.rollen.length} rolprofielen\n`)

    // Stap 4: Import disciplines
    console.log('🎨 Importing disciplines...')
    for (const discipline of cache.disciplines) {
      const { error } = await supabase
        .from('disciplines')
        .upsert({
          discipline_naam: discipline.naam,
          beschrijving: discipline.beschrijving,
          kleur_hex: discipline.kleur_hex || '#3b82f6',
        }, { onConflict: 'discipline_naam' })

      if (error) {
        console.error(`  ❌ Error importing ${discipline.naam}:`, error.message)
      } else {
        console.log(`  ✅ ${discipline.naam}`)
      }
    }
    console.log(`✅ Imported ${cache.disciplines.length} disciplines\n`)

    // Stap 5: Import planning regels
    console.log('📏 Importing planning regels...')
    for (const regel of cache.regels) {
      const { error } = await supabase
        .from('planning_regels')
        .upsert({
          regel_id: regel.regel_id,
          titel_kort: regel.titel_kort,
          categorie: regel.categorie,
          ernst: regel.ernst,
          voorwaarde_kort: regel.voorwaarde_kort,
          actie_kort: regel.actie_kort,
          max_per_dag: regel.max_per_dag,
          parameters: regel.parameters,
        }, { onConflict: 'regel_id' })

      if (error) {
        console.error(`  ❌ Error importing ${regel.titel_kort}:`, error.message)
      } else {
        console.log(`  ✅ ${regel.titel_kort}`)
      }
    }
    console.log(`✅ Imported ${cache.regels.length} planning regels\n`)

    console.log('🎉 IMPORT COMPLETE!')
    console.log('\n📊 Summary:')
    console.log(`   Werknemers:       ${cache.werknemers.length}`)
    console.log(`   Rolprofielen:     ${cache.rollen.length}`)
    console.log(`   Disciplines:      ${cache.disciplines.length}`)
    console.log(`   Planning regels:  ${cache.regels.length}`)
    console.log('\n✅ All data is now in Supabase!')
    console.log('💡 Je kunt nu Google Sheets los laten en alles via Supabase doen.')

  } catch (error: any) {
    console.error('\n❌ Import failed:', error.message)
    process.exit(1)
  }

  process.exit(0)
}

// Run import
importAllData()
