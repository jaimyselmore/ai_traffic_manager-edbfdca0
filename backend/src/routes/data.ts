import { Router, Request, Response } from 'express'
import { supabase } from '../config/supabase'
import { authenticateJWT, requirePlanner } from '../middleware/auth'

// ============================================
// KLANTEN ROUTES
// ============================================

export const klanten = Router()
klanten.use(authenticateJWT, requirePlanner)

// GET alle klanten
klanten.get('/', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('klanten')
      .select('*')
      .order('naam', { ascending: true })

    if (error) throw error
    res.json(data || [])
  } catch (error: any) {
    res.status(500).json({ error: 'Ophalen klanten mislukt' })
  }
})

// POST nieuwe klant
klanten.post('/', async (req: Request, res: Response) => {
  try {
    // Auto-genereer klantnummer (KL001, KL002, etc.)
    const { data: existingKlanten } = await supabase
      .from('klanten')
      .select('klantnummer')
      .order('klantnummer', { ascending: false })
      .limit(1)

    let nextNumber = 1
    if (existingKlanten && existingKlanten.length > 0) {
      const lastNumber = parseInt(existingKlanten[0].klantnummer.replace('KL', ''))
      nextNumber = lastNumber + 1
    }

    const klantnummer = `KL${nextNumber.toString().padStart(3, '0')}`

    const { data, error } = await supabase
      .from('klanten')
      .insert({
        ...req.body,
        klantnummer,
        created_by: req.user!.id,
      })
      .select()
      .single()

    if (error) throw error
    res.json(data)
  } catch (error: any) {
    res.status(500).json({ error: 'Aanmaken klant mislukt' })
  }
})

// PUT update klant
klanten.put('/:id', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('klanten')
      .update(req.body)
      .eq('id', req.params.id)
      .select()
      .single()

    if (error) throw error
    res.json(data)
  } catch (error: any) {
    res.status(500).json({ error: 'Updaten klant mislukt' })
  }
})

// ============================================
// PROJECTEN ROUTES
// ============================================

export const projecten = Router()
projecten.use(authenticateJWT, requirePlanner)

// GET alle projecten (optioneel filter op status)
projecten.get('/', async (req: Request, res: Response) => {
  try {
    let query = supabase
      .from('projecten')
      .select(`
        *,
        klanten:klant_id (klantnummer, naam),
        project_fases (*)
      `)

    if (req.query.status) {
      query = query.eq('status', req.query.status as string)
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) throw error
    res.json(data || [])
  } catch (error: any) {
    res.status(500).json({ error: 'Ophalen projecten mislukt' })
  }
})

// POST nieuw project (met fases)
projecten.post('/', async (req: Request, res: Response) => {
  try {
    const { fases, ...projectData } = req.body

    // Maak project aan
    const { data: project, error: projectError } = await supabase
      .from('projecten')
      .insert({
        ...projectData,
        created_by: req.user!.id,
      })
      .select()
      .single()

    if (projectError) throw projectError

    // Maak fases aan (als opgegeven)
    if (fases && fases.length > 0) {
      const fasesData = fases.map((fase: any) => ({
        ...fase,
        project_id: project.id,
      }))

      const { error: fasesError } = await supabase
        .from('project_fases')
        .insert(fasesData)

      if (fasesError) throw fasesError
    }

    res.json(project)
  } catch (error: any) {
    res.status(500).json({ error: 'Aanmaken project mislukt' })
  }
})

// PUT update project
projecten.put('/:id', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('projecten')
      .update(req.body)
      .eq('id', req.params.id)
      .select()
      .single()

    if (error) throw error
    res.json(data)
  } catch (error: any) {
    res.status(500).json({ error: 'Updaten project mislukt' })
  }
})

// ============================================
// MEETINGS ROUTES
// ============================================

export const meetings = Router()
meetings.use(authenticateJWT, requirePlanner)

// GET meetings (optioneel datum filter)
meetings.get('/', async (req: Request, res: Response) => {
  try {
    let query = supabase.from('meetings').select('*')

    if (req.query.vanaf) {
      query = query.gte('datum', req.query.vanaf as string)
    }
    if (req.query.tot) {
      query = query.lte('datum', req.query.tot as string)
    }

    const { data, error } = await query.order('datum', { ascending: true })

    if (error) throw error
    res.json(data || [])
  } catch (error: any) {
    res.status(500).json({ error: 'Ophalen meetings mislukt' })
  }
})

// POST nieuwe meeting
meetings.post('/', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('meetings')
      .insert({
        ...req.body,
        is_hard_lock: true, // Meetings zijn altijd hard locks
        created_by: req.user!.id,
      })
      .select()
      .single()

    if (error) throw error
    res.json(data)
  } catch (error: any) {
    res.status(500).json({ error: 'Aanmaken meeting mislukt' })
  }
})

// ============================================
// VERLOF ROUTES
// ============================================

export const verlof = Router()
verlof.use(authenticateJWT, requirePlanner)

// GET verlof aanvragen (optioneel filter op werknemer)
verlof.get('/', async (req: Request, res: Response) => {
  try {
    let query = supabase.from('verlof_aanvragen').select('*')

    if (req.query.werknemer) {
      query = query.eq('werknemer_naam', req.query.werknemer as string)
    }
    if (req.query.vanaf) {
      query = query.gte('start_datum', req.query.vanaf as string)
    }

    const { data, error } = await query.order('start_datum', { ascending: true })

    if (error) throw error
    res.json(data || [])
  } catch (error: any) {
    res.status(500).json({ error: 'Ophalen verlof mislukt' })
  }
})

// POST nieuwe verlof aanvraag
verlof.post('/', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('verlof_aanvragen')
      .insert({
        ...req.body,
        status: 'goedgekeurd', // Standaard goedgekeurd (planners maken dit aan)
        created_by: req.user!.id,
      })
      .select()
      .single()

    if (error) throw error
    res.json(data)
  } catch (error: any) {
    res.status(500).json({ error: 'Aanmaken verlof mislukt' })
  }
})

// ============================================
// WIJZIGINGSVERZOEKEN ROUTES
// ============================================

export const wijzigingen = Router()
wijzigingen.use(authenticateJWT, requirePlanner)

// GET wijzigingsverzoeken (optioneel filter op project)
wijzigingen.get('/', async (req: Request, res: Response) => {
  try {
    let query = supabase.from('wijzigingsverzoeken').select('*')

    if (req.query.project_id) {
      query = query.eq('project_id', req.query.project_id as string)
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) throw error
    res.json(data || [])
  } catch (error: any) {
    res.status(500).json({ error: 'Ophalen wijzigingen mislukt' })
  }
})

// POST nieuw wijzigingsverzoek
wijzigingen.post('/', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('wijzigingsverzoeken')
      .insert({
        ...req.body,
        created_by: req.user!.id,
      })
      .select()
      .single()

    if (error) throw error
    res.json(data)
  } catch (error: any) {
    res.status(500).json({ error: 'Aanmaken wijziging mislukt' })
  }
})

// ============================================
// NOTIFICATIES ROUTES
// ============================================

export const notificaties = Router()
notificaties.use(authenticateJWT, requirePlanner)

// GET notificaties (optioneel filter op type of done status)
notificaties.get('/', async (req: Request, res: Response) => {
  try {
    let query = supabase.from('notificaties').select('*')

    if (req.query.type) {
      query = query.eq('type', req.query.type as string)
    }
    if (req.query.is_done !== undefined) {
      query = query.eq('is_done', req.query.is_done === 'true')
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) throw error
    res.json(data || [])
  } catch (error: any) {
    res.status(500).json({ error: 'Ophalen notificaties mislukt' })
  }
})

// PATCH notificatie als done markeren
notificaties.patch('/:id/done', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('notificaties')
      .update({ is_done: true })
      .eq('id', req.params.id)
      .select()
      .single()

    if (error) throw error
    res.json(data)
  } catch (error: any) {
    res.status(500).json({ error: 'Updaten notificatie mislukt' })
  }
})
