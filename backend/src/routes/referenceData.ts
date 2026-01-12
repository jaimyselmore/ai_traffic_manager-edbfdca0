import { Router, Request, Response } from 'express'
import { authenticateJWT } from '../middleware/auth'
import {
  getWerknemers,
  getRollen,
  getDisciplines,
  getRegels,
  syncGoogleSheets,
} from '../services/sheetsSync'

const router = Router()

// Alle routes vereisen authenticatie
router.use(authenticateJWT)

// ============================================
// GET /api/werknemers
// Haal alle werknemers op uit Google Sheets cache
// ============================================

router.get('/werknemers', (req: Request, res: Response) => {
  const werknemers = getWerknemers()
  res.json(werknemers)
})

// ============================================
// GET /api/rollen
// Haal alle rolprofielen op
// ============================================

router.get('/rollen', (req: Request, res: Response) => {
  const rollen = getRollen()
  res.json(rollen)
})

// ============================================
// GET /api/disciplines
// Haal alle disciplines op (met kleuren voor UI)
// ============================================

router.get('/disciplines', (req: Request, res: Response) => {
  const disciplines = getDisciplines()
  res.json(disciplines)
})

// ============================================
// GET /api/regels
// Haal alle validatieregels op
// ============================================

router.get('/regels', (req: Request, res: Response) => {
  const regels = getRegels()
  res.json(regels)
})

// ============================================
// POST /api/sync-sheets (admin only)
// Forceer een sync van Google Sheets (manual refresh)
// ============================================

router.post('/sync-sheets', async (req: Request, res: Response) => {
  try {
    // Check of user een planner is
    if (!req.user?.is_planner) {
      res.status(403).json({ error: 'Alleen planners kunnen sheets syncen' })
      return
    }

    await syncGoogleSheets()
    res.json({ message: 'Google Sheets succesvol gesynchroniseerd' })
  } catch (error: any) {
    console.error('Manual sync error:', error)
    res.status(500).json({ error: 'Sync mislukt' })
  }
})

export default router
