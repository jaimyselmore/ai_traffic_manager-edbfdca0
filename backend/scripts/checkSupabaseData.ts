/**
 * Script om te checken of er data in Supabase staat
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') })

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkData() {
  console.log('\n🔍 Checken of er data in Supabase staat...\n')

  // Check werknemers
  const { data: werknemers, error: werknemersError } = await supabase
    .from('werknemers')
    .select('*')
    .limit(5)

  console.log('👥 WERKNEMERS:')
  if (werknemersError) {
    console.error('   ❌ Error:', werknemersError.message)
  } else {
    console.log(`   ✅ ${werknemers?.length || 0} werknemers gevonden`)
    werknemers?.forEach(w => {
      console.log(`      - ${w.naam_werknemer} (${w.primaire_rol})`)
    })
  }

  // Check klanten
  const { data: klanten, error: klantenError } = await supabase
    .from('klanten')
    .select('*')
    .limit(5)

  console.log('\n🏢 KLANTEN:')
  if (klantenError) {
    console.error('   ❌ Error:', klantenError.message)
  } else {
    console.log(`   ✅ ${klanten?.length || 0} klanten gevonden`)
    klanten?.forEach(k => {
      console.log(`      - ${k.naam} (${k.klantnummer})`)
    })
  }

  // Check taken
  const { data: taken, error: takenError } = await supabase
    .from('taken')
    .select('*')
    .limit(5)

  console.log('\n📋 TAKEN:')
  if (takenError) {
    console.error('   ❌ Error:', takenError.message)
  } else {
    console.log(`   ✅ ${taken?.length || 0} taken gevonden`)
    taken?.forEach(t => {
      console.log(`      - ${t.werknemer_naam} @ ${t.klant_naam} (Week: ${t.week_start})`)
    })
  }

  // Check notificaties
  const { data: notificaties, error: notificatiesError } = await supabase
    .from('notificaties')
    .select('*')
    .limit(5)

  console.log('\n🔔 NOTIFICATIES:')
  if (notificatiesError) {
    console.error('   ❌ Error:', notificatiesError.message)
  } else {
    console.log(`   ✅ ${notificaties?.length || 0} notificaties gevonden`)
    notificaties?.forEach(n => {
      console.log(`      - ${n.titel} (${n.type})`)
    })
  }

  // Check disciplines
  const { data: disciplines, error: disciplinesError } = await supabase
    .from('disciplines')
    .select('*')
    .limit(5)

  console.log('\n🎨 DISCIPLINES:')
  if (disciplinesError) {
    console.error('   ❌ Error:', disciplinesError.message)
  } else {
    console.log(`   ✅ ${disciplines?.length || 0} disciplines gevonden`)
    disciplines?.forEach(d => {
      console.log(`      - ${d.discipline_naam}`)
    })
  }

  console.log('\n')
}

checkData()
  .then(() => {
    console.log('✅ Check voltooid!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Error:', error)
    process.exit(1)
  })
