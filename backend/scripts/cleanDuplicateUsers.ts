import { supabase } from '../src/config/supabase'
import dotenv from 'dotenv'

dotenv.config()

async function cleanDuplicates() {
  console.log('🧹 Cleaning duplicate users...\n')

  // Verwijder users zonder password_hash (de oude/foute entries)
  const { data: usersToDelete, error: fetchError } = await supabase
    .from('users')
    .select('*')
    .is('password_hash', null)

  if (fetchError) {
    console.error('❌ Error fetching users:', fetchError.message)
    process.exit(1)
  }

  console.log(`Found ${usersToDelete.length} users without password (will delete):\n`)

  for (const user of usersToDelete) {
    console.log(`🗑️  Deleting: ${user.naam} (${user.email})`)

    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', user.id)

    if (error) {
      console.error(`❌ Error deleting ${user.naam}:`, error.message)
    }
  }

  console.log('\n✅ Cleanup complete!')
  console.log('\n📋 Remaining valid users:')

  const { data: remainingUsers } = await supabase
    .from('users')
    .select('*')
    .not('password_hash', 'is', null)
    .order('naam')

  remainingUsers?.forEach(user => {
    console.log(`   ✅ ${user.naam.padEnd(15)} → ${user.email}`)
  })

  console.log('\n💡 Login met deze emails en wachtwoord: selmore2026')

  process.exit(0)
}

cleanDuplicates()
