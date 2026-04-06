/**
 * usePageMeta — lightweight head-tag manager (no external dependencies).
 *
 * Sets <title>, <meta name="description">, Open Graph, Twitter Card tags,
 * canonical URL, and optional BreadcrumbList JSON-LD for each page.
 *
 * BreadcrumbList structured data helps Google understand page hierarchy and
 * can display breadcrumb trails in search results (rich snippets).
 *
 * Usage:
 *   usePageMeta({
 *     title:       'TaxLift — Free SR&ED Estimator',
 *     description: 'Estimate your SR&ED credits instantly.',
 *     path:        '/estimate',
 *     image:       '/og-estimate.png',  // optional
 *     breadcrumb:  [                    // optional — omit for homepage
 *       { name: 'Home',      path: '/'         },
 *       { name: 'Estimator', path: '/estimate' },
 *     ],
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

function injectJsonLd(id, data) {
  let el = document.getElementById(id)
  if (!el) {
    el = document.createElement('script')
    el.id   = id
    el.type = 'application/ld+json'
    document.head.appendChild(el)
  }
  el.textContent = JSON.stringify(data)
}

export function usePageMeta({ title, description, path = '', image, breadcrumb } = {}) {
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
    setMeta('twitter:card',        'summary_large_image', 'name')
    setMeta('twitter:title',       title,                 'name')
    setMeta('twitter:description', description,           'name')
    setMeta('twitter:image',       ogImage,               'name')

    // Canonical
    setLink('canonical', canonical)

    // BreadcrumbList JSON-LD (rich result — breadcrumb trail in Google)
    if (breadcrumb?.length > 0) {
      injectJsonLd('ld-breadcrumb', {
        '@context':        'https://schema.org',
        '@type':           'BreadcrumbList',
        itemListElement:   breadcrumb.map((crumb, i) => ({
          '@type':  'ListItem',
          position: i + 1,
          name:     crumb.name,
          item:     `${BASE_URL}${crumb.path}`,
        })),
      })
    }

    return () => {
      document.title = prevTitle
      document.getElementById('ld-breadcrumb')?.remove()
    }
  }, [title, description, path, image, breadcrumb])
}
