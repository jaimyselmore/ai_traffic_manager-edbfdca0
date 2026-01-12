import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { errorHandler, notFoundHandler } from './middleware/errorHandler'
import routes from './routes'
import { initializeSheets, startAutoSync } from './services/sheetsSync'

// Laad environment variabelen
dotenv.config()

// ============================================
// EXPRESS APP SETUP
// ============================================

const app = express()
const PORT = process.env.PORT || 3001
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'

// ============================================
// MIDDLEWARE
// ============================================

// CORS - sta frontend toe om backend aan te roepen
app.use(cors({
  origin: FRONTEND_URL,
  credentials: true,
}))

// JSON body parser
app.use(express.json())

// Request logging (development only)
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`)
    next()
  })
}

// ============================================
// ROUTES
// ============================================

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
  })
})

// API routes (alle routes onder /api)
app.use('/api', routes)

// 404 handler
app.use(notFoundHandler)

// Error handler (moet laatste zijn!)
app.use(errorHandler)

// ============================================
// SERVER START
// ============================================

async function startServer() {
  try {
    console.log('🚀 Starting AI Traffic Manager Backend...')
    console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`)

    // 1. Initialiseer Google Sheets (eerste sync)
    console.log('🔄 Initializing Google Sheets...')
    await initializeSheets()

    // 2. Start auto-sync (elke 60 minuten)
    startAutoSync(60)

    // 3. Start Express server
    app.listen(PORT, () => {
      console.log('✅ Server is running!')
      console.log(`🌐 API: http://localhost:${PORT}`)
      console.log(`🔗 Frontend: ${FRONTEND_URL}`)
      console.log(`📊 Health check: http://localhost:${PORT}/health`)
      console.log('\n📚 API Endpoints:')
      console.log('   POST   /api/auth/login')
      console.log('   GET    /api/auth/me')
      console.log('   GET    /api/werknemers')
      console.log('   GET    /api/disciplines')
      console.log('   GET    /api/regels')
      console.log('   GET    /api/taken?week_start=YYYY-MM-DD')
      console.log('   POST   /api/taken')
      console.log('   GET    /api/klanten')
      console.log('   GET    /api/projecten')
      console.log('   GET    /api/meetings')
      console.log('   GET    /api/verlof')
      console.log('   GET    /api/notificaties')
      console.log('\n💡 Tip: Test met GET /health')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    })
  } catch (error) {
    console.error('❌ Server kon niet starten:', error)
    process.exit(1)
  }
}

// Start de server!
startServer()

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Server wordt afgesloten...')
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log('\n👋 Server wordt afgesloten...')
  process.exit(0)
})
