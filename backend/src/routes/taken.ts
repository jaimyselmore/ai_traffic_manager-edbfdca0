import { Router, Request, Response } from 'express'
import { supabase } from '../config/supabase'
import { authenticateJWT, requirePlanner } from '../middleware/auth'
import { checkConflicts, canModifyHardLock } from '../services/planningService'
import type { CreateTaakDTO, UpdateTaakDTO } from '../types'

const router = Router()

// Alle routes vereisen authenticatie + planner role
router.use(authenticateJWT, requirePlanner)

// ============================================
// GET /api/taken?week_start=2026-01-06
// Haal taken op voor een specifieke week
// ============================================

router.get('/', async (req: Request, res: Response) => {
  try {
    const { week_start } = req.query

    if (!week_start) {
      res.status(400).json({ error: 'week_start parameter is verplicht (YYYY-MM-DD)' })
      return
    }

    const { data, error } = await supabase
      .from('taken')
      .select('*')
      .eq('week_start', week_start as string)
      .order('dag_van_week', { ascending: true })
      .order('start_uur', { ascending: true })

    if (error) {
      throw error
    }

    res.json(data || [])
  } catch (error: any) {
    console.error('Error fetching taken:', error)
    res.status(500).json({ error: 'Ophalen taken mislukt' })
  }
})

// ============================================
// POST /api/taken
// Maak nieuwe taak aan (met conflict checking)
// ============================================

router.post('/', async (req: Request, res: Response) => {
  try {
    const taakData: CreateTaakDTO = req.body

    // Validatie
    if (!taakData.werknemer_naam || !taakData.week_start || taakData.dag_van_week === undefined) {
      res.status(400).json({ error: 'Verplichte velden ontbreken' })
      return
    }

    // Check conflicten
    const conflicts = await checkConflicts(taakData)
    const errors = conflicts.filter(c => c.severity === 'error')

    if (errors.length > 0) {
      res.status(409).json({
        error: 'Conflicten gedetecteerd',
        conflicts: errors,
      })
      return
    }

    // Maak taak aan
    const { data, error } = await supabase
      .from('taken')
      .insert({
        ...taakData,
        created_by: req.user!.id,
        locked_by: taakData.is_hard_lock ? req.user!.id : null,
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    // Return taak + eventuele warnings
    const warnings = conflicts.filter(c => c.severity === 'warning')
    res.json({ taak: data, warnings })
  } catch (error: any) {
    console.error('Error creating taak:', error)
    res.status(500).json({ error: 'Aanmaken taak mislukt' })
  }
})

// ============================================
// PUT /api/taken/:id
// Update bestaande taak
// ============================================

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const updateData: UpdateTaakDTO = req.body

    // Check of taak bestaat
    const { data: existingTaak, error: fetchError } = await supabase
      .from('taken')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !existingTaak) {
      res.status(404).json({ error: 'Taak niet gevonden' })
      return
    }

    // Check hard lock permission
    if (existingTaak.is_hard_lock) {
      const canModify = await canModifyHardLock(id, req.user!.id)
      if (!canModify) {
        res.status(403).json({ error: 'Je mag deze hard lock niet wijzigen (alleen de maker kan dit)' })
        return
      }
    }

    // Update taak
    const { data, error } = await supabase
      .from('taken')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      throw error
    }

    res.json(data)
  } catch (error: any) {
    console.error('Error updating taak:', error)
    res.status(500).json({ error: 'Updaten taak mislukt' })
  }
})

// ============================================
// PATCH /api/taken/:id/status
// Wijzig alleen de status (concept <-> vast)
// ============================================

router.patch('/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { plan_status } = req.body

    if (!plan_status || !['concept', 'vast'].includes(plan_status)) {
      res.status(400).json({ error: 'Ongeldige plan_status (moet concept of vast zijn)' })
      return
    }

    const { data, error } = await supabase
      .from('taken')
      .update({ plan_status })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      throw error
    }

    res.json(data)
  } catch (error: any) {
    console.error('Error updating taak status:', error)
    res.status(500).json({ error: 'Status wijzigen mislukt' })
  }
})

// ============================================
// DELETE /api/taken/:id
// Verwijder taak
// ============================================

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    // Check of taak bestaat en of user het mag verwijderen
    const { data: taak, error: fetchError } = await supabase
      .from('taken')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !taak) {
      res.status(404).json({ error: 'Taak niet gevonden' })
      return
    }

    // Hard lock check
    if (taak.is_hard_lock) {
      const canModify = await canModifyHardLock(id, req.user!.id)
      if (!canModify) {
        res.status(403).json({ error: 'Je mag deze hard lock niet verwijderen (alleen de maker kan dit)' })
        return
      }
    }

    // Delete taak
    const { error } = await supabase
      .from('taken')
      .delete()
      .eq('id', id)

    if (error) {
      throw error
    }

    res.json({ message: 'Taak verwijderd' })
  } catch (error: any) {
    console.error('Error deleting taak:', error)
    res.status(500).json({ error: 'Verwijderen taak mislukt' })
  }
})

export default router
