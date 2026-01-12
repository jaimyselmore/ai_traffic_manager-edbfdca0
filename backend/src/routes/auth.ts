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

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as LoginRequest

    // Validatie
    if (!email || !password) {
      res.status(400).json({ error: 'Email en wachtwoord zijn verplicht' })
      return
    }

    // Haal user op uit database
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase())
      .single()

    if (error || !user) {
      res.status(401).json({ error: 'Onjuiste inloggegevens' })
      return
    }

    // Check wachtwoord
    const isValidPassword = await bcrypt.compare(password, user.password_hash)

    if (!isValidPassword) {
      res.status(401).json({ error: 'Onjuiste inloggegevens' })
      return
    }

    // Genereer JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
      },
      JWT_CONFIG.secret,
      {
        expiresIn: JWT_CONFIG.expiresIn,
        algorithm: JWT_CONFIG.algorithm,
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
    res.json(response)
  } catch (error: any) {
    console.error('Login error:', error)
    res.status(500).json({ error: 'Login mislukt' })
  }
})

// ============================================
// GET /api/auth/me
// Haal huidige user info op (vereist authenticatie)
// ============================================

router.get('/me', authenticateJWT, async (req: Request, res: Response) => {
  // req.user is gezet door authenticateJWT middleware
  res.json({ user: req.user })
})

// ============================================
// POST /api/auth/logout
// Logout (client verwijdert token, server hoeft niks te doen bij JWT)
// ============================================

router.post('/logout', authenticateJWT, async (req: Request, res: Response) => {
  // Bij JWT is logout client-side (verwijder token uit localStorage)
  // We loggen alleen dat user uitlogde
  console.log(`User logged out: ${req.user?.email}`)
  res.json({ message: 'Uitgelogd' })
})

export default router
