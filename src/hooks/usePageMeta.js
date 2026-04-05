/**
 * usePageMeta — lightweight head-tag manager (no external dependencies).
 *
 * Sets <title>, <meta name="description">, Open Graph, and Twitter Card tags
 * for the current page. Cleans up on unmount (restores defaults).
 *
 * Usage:
 *   usePageMeta({
 *     title: 'TaxLift — Free SR&ED Eligibility Quiz',
 *     description: 'Find out if your startup qualifies ...',
 *     path: '/quiz',        // appended to canonical URL
 *     image: '/og-quiz.png' // optional, defaults to /og-image.png
 *   })
 */
import { useEffect } from 'react'

const SITE_NAME  = 'TaxLift'
const BASE_URL   = 'https://taxlift.ai'
const DEFAULT_OG = `${BASE_URL}/og-image.png`

function setMeta(name, content, attr = 'name') {
  if (!content) return
  let el = document.querySelector(`meta[${attr}="${name}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, name)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function setLink(rel, href) {
  if (!href) return
  let el = document.querySelector(`link[rel="${rel}"]`)
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

export function usePageMeta({ title, description, path = '', image } = {}) {
  useEffect(() => {
    const prevTitle = document.title
    const ogImage   = image ? `${BASE_URL}${image}` : DEFAULT_OG
    const canonical = `${BASE_URL}${path}`

    if (title)       document.title = title
    if (description) setMeta('description', description)

    // Open Graph
    setMeta('og:title',       title,       'property')
    setMeta('og:description', description, 'property')
    setMeta('og:url',         canonical,   'property')
    setMeta('og:image',       ogImage,     'property')
    setMeta('og:site_name',   SITE_NAME,   'property')
    setMeta('og:type',        'website',   'property')

    // Twitter
    setMeta('twitter:title',       title,       'name')
    setMeta('twitter:description', description, 'name')
    setMeta('twitter:image',       ogImage,     'name')

    // Canonical
    setLink('canonical', canonical)

    return () => {
      document.title = prevTitle
    }
  }, [title, description, path, image])
}
