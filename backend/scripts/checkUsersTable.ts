import { supabase } from '../src/config/supabase'
import dotenv from 'dotenv'

dotenv.config()

async function checkUsers() {
  console.log('👥 Checking users in Supabase users table...\n')

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('naam')

  if (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }

  if (!data || data.length === 0) {
    console.log('⚠️  No users found in users table!')
    process.exit(0)
  }

  console.log(`Found ${data.length} users:\n`)

  data.forEach(user => {
    console.log(`✅ ${user.naam.padEnd(15)} → ${user.email || 'NO EMAIL'}`)
    console.log(`   Rol: ${user.rol}`)
    console.log(`   Is planner: ${user.is_planner}`)
    console.log(`   Has password: ${user.password_hash ? 'YES' : 'NO'}`)
    console.log('')
  })

  console.log('💡 Deze users kunnen inloggen via de users tabel (niet Supabase Auth)')
  console.log('   Wachtwoord voor alle planners: selmore2026')

  process.exit(0)
}

checkUsers()
