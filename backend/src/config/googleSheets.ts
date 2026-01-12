import { google } from 'googleapis'
import dotenv from 'dotenv'

dotenv.config()

// Haal Google Sheets credentials uit environment variables
const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
const privateKey = process.env.GOOGLE_PRIVATE_KEY
const spreadsheetId = process.env.GOOGLE_SHEET_ID

// Check of alle credentials aanwezig zijn
if (!serviceAccountEmail || !privateKey || !spreadsheetId) {
  throw new Error(
    'GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY en GOOGLE_SHEET_ID moeten ingesteld zijn in .env'
  )
}

// Maak Google Auth client met service account credentials
export const googleAuth = new google.auth.GoogleAuth({
  credentials: {
    client_email: serviceAccountEmail,
    // Replace \n in private key met echte newlines
    private_key: privateKey.replace(/\\n/g, '\n'),
  },
  scopes: [
    'https://www.googleapis.com/auth/spreadsheets.readonly', // Alleen lezen (voor nu)
    // Later kun je dit veranderen naar:
    // 'https://www.googleapis.com/auth/spreadsheets' voor lezen EN schrijven
  ],
})

// Maak Sheets API client
export const sheets = google.sheets({ version: 'v4', auth: googleAuth })

// Export spreadsheet ID voor gebruik in andere bestanden
export const SPREADSHEET_ID = spreadsheetId

console.log('✅ Google Sheets client geïnitialiseerd')
