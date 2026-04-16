/**
 * tokenEncryption.js — AES-256-GCM encrypt/decrypt for OAuth tokens at rest.
 *
 * Key: process.env.TOKEN_ENCRYPTION_KEY (32-byte hex, 64 hex chars)
 *   Generate: node -e "require('crypto').randomBytes(32).toString('hex')|console.log()"
 *
 * Encrypted format: <iv-hex>:<authTag-hex>:<ciphertext-hex>
 *   iv       = 12 random bytes (96-bit nonce — NIST recommended for GCM)
 *   authTag  = 16 bytes GCM authentication tag (tamper detection)
 *   ciphertext = variable length
 *
 * If TOKEN_ENCRYPTION_KEY is unset, plaintext is passed through with a warning
 * so dev environments work without extra setup. Production should always set the key.
 */
const crypto = require('crypto')

const ALGORITHM = 'aes-256-gcm'

function getKey() {
  const hex = process.env.TOKEN_ENCRYPTION_KEY
  if (!hex) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('TOKEN_ENCRYPTION_KEY is not set — cannot encrypt tokens in production')
    }
    return null  // dev fallback: no encryption
  }
  if (!/^[0-9a-f]{64}$/i.test(hex)) {
    throw new Error('TOKEN_ENCRYPTION_KEY must be 64 hex characters (32 bytes)')
  }
  return Buffer.from(hex, 'hex')
}

/**
 * encrypt(plaintext) → "<iv>:<tag>:<ciphertext>" or plaintext if key is absent (dev).
 */
function encrypt(plaintext) {
  if (!plaintext) return plaintext
  const key = getKey()
  if (!key) return plaintext  // dev: pass through

  const iv     = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  const ct     = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag    = cipher.getAuthTag()

  return `${iv.toString('hex')}:${tag.toString('hex')}:${ct.toString('hex')}`
}

/**
 * decrypt(stored) → plaintext string, or null on decryption failure.
 * Handles plain-text values (for rows encrypted before key was set, or dev env).
 */
function decrypt(stored) {
  if (!stored) return stored
  const key = getKey()

  // Not an encrypted value (dev pass-through or legacy plaintext row)
  if (!stored.includes(':')) return stored
  if (!key) return stored  // dev: pass through

  try {
    const [ivHex, tagHex, ctHex] = stored.split(':')
    const iv      = Buffer.from(ivHex,  'hex')
    const tag     = Buffer.from(tagHex, 'hex')
    const ct      = Buffer.from(ctHex,  'hex')
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(tag)
    return decipher.update(ct, undefined, 'utf8') + decipher.final('utf8')
  } catch {
    console.error('[tokenEncryption] Decryption failed — token may be corrupted or key rotated')
    return null
  }
}

module.exports = { encrypt, decrypt }
