/**
 * Documents / Vault routes — stub returning empty list.
 * No documents table exists in the DB yet.
 * Returns consistent empty responses so frontend doesn't surface 404 errors.
 *
 *   GET    /api/v1/documents        → []
 *   GET    /api/v1/documents/:id    → 404
 *   POST   /api/v1/documents        → 501 (not implemented)
 *   PATCH  /api/v1/documents/:id/verify → 501
 *   DELETE /api/v1/documents/:id    → 404
 */
const router = require('express').Router()
const { requireAuth } = require('../middleware/auth')

router.use(requireAuth)

router.get('/',    (_req, res) => res.json([]))
router.get('/:id', (_req, res) => res.status(404).json({ message: 'Document not found' }))

router.post('/', (_req, res) => res.status(501).json({ message: 'Document upload not yet implemented' }))
router.patch('/:id/verify', (_req, res) => res.status(501).json({ message: 'Document verification not yet implemented' }))
router.delete('/:id', (_req, res) => res.status(404).json({ message: 'Document not found' }))

module.exports = router
