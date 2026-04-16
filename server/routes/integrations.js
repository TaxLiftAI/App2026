const router = require('express').Router()
const db     = require('../db')
const { requireAuth }    = require('../middleware/auth')
const { decrypt }        = require('../lib/tokenEncryption')

router.use(requireAuth)

router.get('/', (req, res) => {
  const row  = db.prepare('SELECT github_token, atlassian_token FROM users WHERE id = ?').get(req.user.id)
  const user = row ? {
    github_token:    row.github_token    ? decrypt(row.github_token)    : null,
    atlassian_token: row.atlassian_token ? decrypt(row.atlassian_token) : null,
  } : null
  const integrations = [
    {
      integration:    'github',
      status:         user?.github_token    ? 'healthy' : 'disconnected',
      last_sync_at:   user?.github_token    ? new Date().toISOString() : null,
      token_expires_at: null,
      error_detail:   null,
    },
    {
      integration:    'jira',
      status:         user?.atlassian_token ? 'healthy' : 'disconnected',
      last_sync_at:   user?.atlassian_token ? new Date().toISOString() : null,
      token_expires_at: null,
      error_detail:   null,
    },
    {
      integration:    'slack',
      status:         'disconnected',
      last_sync_at:   null,
      token_expires_at: null,
      error_detail:   null,
    },
  ]
  res.json(integrations)
})

module.exports = router
