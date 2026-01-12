import { Router } from 'express'
import authRoutes from './auth'
import referenceDataRoutes from './referenceData'
import takenRoutes from './taken'
import { klanten, projecten, meetings, verlof, wijzigingen, notificaties } from './data'

const router = Router()

// Mount all routes
router.use('/auth', authRoutes)
router.use(referenceDataRoutes) // /werknemers, /disciplines, /regels, etc.
router.use('/taken', takenRoutes)
router.use('/klanten', klanten)
router.use('/projecten', projecten)
router.use('/meetings', meetings)
router.use('/verlof', verlof)
router.use('/wijzigingen', wijzigingen)
router.use('/notificaties', notificaties)

export default router
