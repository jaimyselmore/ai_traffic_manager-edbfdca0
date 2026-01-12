import { syncGoogleSheets, getCache } from '../src/services/sheetsSync'
import dotenv from 'dotenv'

dotenv.config()

async function showEmails() {
  await syncGoogleSheets()
  const cache = getCache()

  console.log('📧 ALLE WERKNEMERS MET EMAIL:\n')
  cache.werknemers.forEach(w => {
    if (w.email) {
      const plannerTag = w.is_planner ? ' [PLANNER]' : ''
      console.log(`${w.naam.padEnd(20)} → ${w.email}${plannerTag}`)
    }
  })

  console.log('\n⚠️  PLANNERS ZONDER EMAIL:\n')
  cache.werknemers
    .filter(w => w.is_planner && !w.email)
    .forEach(w => {
      console.log(`${w.naam} → GEEN EMAIL`)
    })

  process.exit(0)
}

showEmails()
