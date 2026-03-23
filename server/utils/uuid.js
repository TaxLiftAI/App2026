/**
 * Tiny UUID v4 generator using Node's built-in crypto.
 * No npm dependency needed — crypto.randomUUID() is available since Node 14.17.
 */
const { randomUUID } = require('crypto')
module.exports = { v4: () => randomUUID() }
