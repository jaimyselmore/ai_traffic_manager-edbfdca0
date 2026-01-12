import dotenv from 'dotenv'

dotenv.config()

// Haal JWT secret uit environment variables
const jwtSecret = process.env.JWT_SECRET

// Check of secret aanwezig is
if (!jwtSecret) {
  throw new Error('JWT_SECRET moet ingesteld zijn in .env bestand')
}

// Waarschuwing als default secret wordt gebruikt (niet veilig!)
if (jwtSecret === 'your-super-secret-jwt-key-change-this-to-something-random') {
  console.warn('⚠️  WAARSCHUWING: Je gebruikt nog de default JWT_SECRET! Verander deze naar een random string in productie.')
}

// JWT configuratie
export const JWT_CONFIG = {
  secret: jwtSecret,
  expiresIn: '7d', // Token geldig voor 7 dagen
  algorithm: 'HS256' as const, // Encryptie algoritme
}

console.log('✅ JWT config geladen')
