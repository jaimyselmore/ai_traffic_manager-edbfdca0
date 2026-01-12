/**
 * API Initialization
 *
 * Deze file zorgt ervoor dat er automatisch een token in localStorage staat
 * zodat je kunt testen zonder in te hoeven loggen.
 *
 * TIJDELIJK: Later vervangen we dit door een echte LoginPage.
 */

import { setAuthToken } from './client'

/**
 * Initialiseer API met dummy token voor development
 */
export function initializeAPI() {
  // Check of er al een token in localStorage staat
  const existingToken = localStorage.getItem('auth_token')

  if (!existingToken) {
    console.log('⚠️  Geen auth token gevonden. Je moet eerst inloggen.')
    console.log('   Voor nu werken API calls NIET zonder inloggen.')
    console.log('   Later bouwen we een LoginPage.')
  }
}

/**
 * Manual login helper (voor development)
 * Roep deze functie aan in de browser console:
 * window.devLogin('jaimy@selmore.com', 'selmore2026')
 */
;(window as any).devLogin = async (email: string, password: string) => {
  try {
    const response = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })

    if (!response.ok) {
      throw new Error('Login failed')
    }

    const data = await response.json()
    setAuthToken(data.token)
    console.log('✅ Logged in as:', data.user.naam)
    console.log('🔄 Refresh de pagina om data te zien')
    return data
  } catch (error) {
    console.error('❌ Login failed:', error)
  }
}

// Log instructies in console
console.log('🔐 Auth helper geladen!')
console.log('💡 Log in via console: window.devLogin("jaimy@selmore.com", "selmore2026")')
