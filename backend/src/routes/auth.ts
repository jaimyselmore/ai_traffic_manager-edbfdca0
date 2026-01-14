import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { supabase } from '../config/supabase'
import { JWT_CONFIG } from '../config/jwt'
import { authenticateJWT } from '../middleware/auth'
import type { LoginRequest, LoginResponse } from '../types'

const router = Router()

// ============================================
// POST /api/auth/login
// Login endpoint - geeft JWT token terug
// ============================================

router.post('/login', async (req: Request, res: Response): Promise<any> => {
  try {
    const { email, password } = req.body as LoginRequest

    // Validatie
    if (!email || !password) {
      return res.status(400).json({ error: 'Email en wachtwoord zijn verplicht' })
    }

    // Haal user op uit database
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase())
      .single()

    if (error || !user) {
      return res.status(401).json({ error: 'Onjuiste inloggegevens' })
    }

    // Check wachtwoord
    const isValidPassword = await bcrypt.compare(password, user.password_hash)

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Onjuiste inloggegevens' })
    }

    // Genereer JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
      },
      JWT_CONFIG.secret,
      {
        expiresIn: '7d',
        algorithm: 'HS256' as jwt.Algorithm,
      }
    )

    // Response met token en user info (zonder password!)
    const response: LoginResponse = {
      token,
      user: {
        id: user.id,
        email: user.email,
        naam: user.naam,
        rol: user.rol,
        is_planner: user.is_planner,
      },
    }

    console.log(`✅ User logged in: ${user.email}`)
    return res.json(response)
  } catch (error: any) {
    console.error('Login error:', error)
    return res.status(500).json({ error: 'Login mislukt' })
  }
})

// ============================================
// GET /api/auth/me
// Haal huidige user info op (vereist authenticatie)
// ============================================

router.get('/me', authenticateJWT, async (req: Request, res: Response): Promise<any> => {
  // req.user is gezet door authenticateJWT middleware
  return res.json({ user: req.user })
})

// ============================================
// POST /api/auth/logout
// Logout (client verwijdert token, server hoeft niks te doen bij JWT)
// ============================================

router.post('/logout', authenticateJWT, async (req: Request, res: Response): Promise<any> => {
  // Bij JWT is logout client-side (verwijder token uit localStorage)
  // We loggen alleen dat user uitlogde
  console.log(`User logged out: ${req.user?.email}`)
  return res.json({ message: 'Uitgelogd' })
})

export default router
