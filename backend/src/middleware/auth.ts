import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { JWT_CONFIG } from '../config/jwt'
import { supabase } from '../config/supabase'

// Extend Express Request type om user property toe te voegen
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string
        email: string
        naam: string
        rol: string
        is_planner: boolean
      }
    }
  }
}

// ============================================
// JWT AUTHENTICATION MIDDLEWARE
// ============================================

export async function authenticateJWT(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Haal token uit Authorization header
    const authHeader = req.headers.authorization
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null

    if (!token) {
      res.status(401).json({ error: 'Geen authenticatie token gevonden' })
      return
    }

    // Verifieer JWT token
    const decoded = jwt.verify(token, JWT_CONFIG.secret) as {
      userId: string
      email: string
    }

    // Haal user data op uit database
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, naam, rol, is_planner')
      .eq('id', decoded.userId)
      .single()

    if (error || !user) {
      res.status(401).json({ error: 'Ongeldige token of user niet gevonden' })
      return
    }

    // Voeg user toe aan request object
    req.user = {
      id: user.id,
      email: user.email,
      naam: user.naam,
      rol: user.rol,
      is_planner: user.is_planner,
    }

    next() // Ga door naar volgende middleware/route
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      res.status(401).json({ error: 'Token verlopen, log opnieuw in' })
      return
    }

    if (error.name === 'JsonWebTokenError') {
      res.status(401).json({ error: 'Ongeldige token' })
      return
    }

    res.status(500).json({ error: 'Authenticatie fout' })
  }
}

// ============================================
// PLANNER ONLY MIDDLEWARE
// ============================================

export function requirePlanner(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({ error: 'Niet geauthenticeerd' })
    return
  }

  if (!req.user.is_planner) {
    res.status(403).json({ error: 'Alleen planners hebben toegang tot deze functie' })
    return
  }

  next()
}
