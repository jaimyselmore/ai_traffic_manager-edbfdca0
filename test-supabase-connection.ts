/**
 * Test script om Supabase connectie te verifiëren
 */

import { supabase } from './src/lib/supabase/client'

async function testSupabaseConnection() {
  console.log('🔍 Testing Supabase connection...\n')

  // Test 1: Medewerkers ophalen
  console.log('📋 Test 1: Medewerkers ophalen')
  try {
    const { data: medewerkers, error: medewerkersError } = await supabase
      .from('medewerkers')
      .select('werknemer_id, naam_werknemer, primaire_rol')
      .limit(5)

    if (medewerkersError) throw medewerkersError

    console.log(`✅ Gevonden: ${medewerkers.length} medewerkers`)
    medewerkers.forEach((m) => {
      console.log(`   - ${m.naam_werknemer} (${m.primaire_rol})`)
    })
  } catch (error: any) {
    console.error('❌ Error:', error.message)
  }

  // Test 2: Disciplines ophalen
  console.log('\n📋 Test 2: Disciplines ophalen')
  try {
    const { data: disciplines, error: disciplinesError } = await supabase
      .from('disciplines')
      .select('id, discipline_naam, kleur_hex')

    if (disciplinesError) throw disciplinesError

    console.log(`✅ Gevonden: ${disciplines.length} disciplines`)
    disciplines.forEach((d) => {
      console.log(`   - ${d.discipline_naam} (${d.kleur_hex})`)
    })
  } catch (error: any) {
    console.error('❌ Error:', error.message)
  }

  // Test 3: Klanten ophalen
  console.log('\n📋 Test 3: Klanten ophalen')
  try {
    const { data: klanten, error: klantenError } = await supabase
      .from('klanten')
      .select('id, naam, klantnummer')

    if (klantenError) throw klantenError

    console.log(`✅ Gevonden: ${klanten.length} klanten`)
    if (klanten.length === 0) {
      console.log('   ℹ️  Nog geen klanten in database')
    } else {
      klanten.forEach((k) => {
        console.log(`   - ${k.naam} (${k.klantnummer})`)
      })
    }
  } catch (error: any) {
    console.error('❌ Error:', error.message)
  }

  // Test 4: Taken ophalen
  console.log('\n📋 Test 4: Taken ophalen')
  try {
    const { data: taken, error: takenError } = await supabase
      .from('taken')
      .select('id, werknemer_naam, klant_naam, werktype')
      .limit(5)

    if (takenError) throw takenError

    console.log(`✅ Gevonden: ${taken.length} taken`)
    if (taken.length === 0) {
      console.log('   ℹ️  Nog geen taken in database')
    } else {
      taken.forEach((t) => {
        console.log(`   - ${t.werknemer_naam} @ ${t.klant_naam} (${t.werktype})`)
      })
    }
  } catch (error: any) {
    console.error('❌ Error:', error.message)
  }

  console.log('\n✅ Test complete!')
}

testSupabaseConnection()
