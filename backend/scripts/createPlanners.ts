import { supabase } from '../src/config/supabase'
import bcrypt from 'bcryptjs'
import dotenv from 'dotenv'

// Laad environment variabelen
dotenv.config()

/**
 * Script om de eerste 4 planners aan te maken in de database
 *
 * Dit zijn de mensen die kunnen inloggen op de AI Traffic Manager
 * en de planning kunnen beheren.
 */

const planners = [
  {
    email: 'tom@selmore.com',
    naam: 'Tom',
    rol: 'Head of Account',
    werknemer_id: 10, // Link naar Google Sheet
  },
  {
    email: 'tess@selmore.com',
    naam: 'Tess',
    rol: 'Account Director',
    werknemer_id: 11,
  },
  {
    email: 'sarah@selmore.com',
    naam: 'Sarah',
    rol: 'Senior Creative Producer',
    werknemer_id: 12,
  },
  {
    email: 'jaimy@selmore.com',
    naam: 'Jaimy',
    rol: 'Account Manager',
    werknemer_id: 13,
  },
]

async function createPlanners() {
  console.log('🔐 Planners aanmaken...\n')

  for (const planner of planners) {
    try {
      // Tijdelijk wachtwoord (ze moeten dit later zelf wijzigen)
      const tijdelijkWachtwoord = 'selmore2026'
      const password_hash = await bcrypt.hash(tijdelijkWachtwoord, 10)

      // Check of user al bestaat
      const { data: existingUser } = await supabase
        .from('users')
        .select('*')
        .eq('email', planner.email)
        .single()

      if (existingUser) {
        console.log(`⚠️  ${planner.naam} bestaat al (${planner.email})`)
        continue
      }

      // Maak user aan
      const { data, error } = await supabase
        .from('users')
        .insert({
          email: planner.email,
          naam: planner.naam,
          rol: planner.rol,
          werknemer_id: planner.werknemer_id,
          password_hash,
          is_planner: true,
        })
        .select()
        .single()

      if (error) {
        console.error(`❌ Error bij ${planner.naam}:`, error.message)
      } else {
        console.log(`✅ ${planner.naam} aangemaakt (${planner.email})`)
        console.log(`   Wachtwoord: ${tijdelijkWachtwoord}`)
      }
    } catch (error: any) {
      console.error(`❌ Onverwachte error bij ${planner.naam}:`, error.message)
    }
  }

  console.log('\n✅ Klaar! Planners kunnen nu inloggen met:')
  console.log('   Email: hun@selmore.com')
  console.log('   Wachtwoord: selmore2026')
  console.log('\n💡 Tip: Laat ze hun wachtwoord later wijzigen!')

  process.exit(0)
}

// Run het script
createPlanners()
