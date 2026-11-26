// Yellow Pages Oman (yellowpages.om) search. Server side only (the site blocks direct browser calls).
// Reads the public search results page and picks out each listing:
// name, listing link, address, phone, WhatsApp and website.
// It does not depend on the site's CSS class names: each listing is found by its /yp/listing/<slug> link.

const BASE = 'https://www.yellowpages.om'
const UA = 'KSTechLeads/1.0 (+https://kstech-agent-dashboard.vercel.app; kzstech000@gmail.com)'

// Links that are social pages, not the company's own website
const NOT_WEBSITE = /(yellowpages\.om|facebook\.com|fb\.com|instagram\.com|linkedin\.com|twitter\.com|\/\/x\.com|youtube\.com|youtu\.be|whatsapp\.com|wa\.me|google\.|goo\.gl|tiktok\.com|snapchat\.com|pinterest\.|apple\.com|play\.google)/i

function decode(s) {
  return String(s || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
}

// HTML to plain text lines
function textLines(html) {
  const text = decode(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<(br|\/p|\/div|\/li|\/h\d|\/span|\/a)[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  )
  return text.split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean)
}

function cleanPhone(p) {
  const d = String(p || '').replace(/[^\d+]/g, '')
  if (!d) return null
  const digits = d.replace(/^\+/, '')
  if (digits.length === 8) return `+968${digits}`
  return d.startsWith('+') ? d : `+${digits}`
}

export function parseYellowPages(html) {
  const re = /href=["'](?:https?:\/\/(?:www\.)?yellowpages\.om)?\/+yp\/listing\/([^"'?#\s]+)["']/gi
  const hits = []
  let m
  while ((m = re.exec(html))) hits.push({ slug: m[1].toLowerCase(), at: m.index })
  if (!hits.length) return []

  // A new listing starts where the slug changes
  const starts = []
  for (let i = 0; i < hits.length; i++) {
    if (i === 0 || hits[i].slug !== hits[i - 1].slug) starts.push(hits[i])
  }
  // Each block runs from the card's first link (usually its logo) to the next card's first link
  const blocks = starts.map((s, i) => {
    const tagStart = html.lastIndexOf('<', s.at)
    const from = tagStart >= 0 && s.at - tagStart < 300 ? tagStart : s.at
    const to = i + 1 < starts.length ? starts[i + 1].at : Math.min(html.length, s.at + 8000)
    return { slug: s.slug, html: html.slice(from, to) }
  })

  const out = []
  const seen = new Set()
  for (const b of blocks) {
    if (seen.has(b.slug)) continue
    const esc = b.slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    // Name: text of a link to this listing, or the logo's alt text
    let name = ''
    const linkRe = new RegExp(`<a[^>]*\\/yp\\/listing\\/${esc}["'][^>]*>([\\s\\S]*?)<\\/a>`, 'gi')
    let lm
    while ((lm = linkRe.exec(b.html))) {
      const inner = lm[1]
      const t = decode(inner.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
      if (t && t.length > 1 && t.length < 150 && !/^(view|more|details|read more)$/i.test(t)) { name = t; break }
      const alt = inner.match(/alt=["']([^"']+)["']/i)
      if (!name && alt) name = decode(alt[1]).trim()
    }
    if (!name) {
      name = b.slug.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    }

    const tel = b.html.match(/href=["']tel:([^"']+)["']/i)
    const wa = b.html.match(/(?:whatsapp\.com\/send\?phone=|wa\.me\/)(\d{8,15})/i)
    let website = null
    const hrefRe = /href=["'](https?:\/\/[^"'\s]+)["']/gi
    let hm
    while ((hm = hrefRe.exec(b.html))) {
      const u = decode(hm[1])
      if (!NOT_WEBSITE.test(u) && !/\.(png|jpe?g|gif|svg|webp)(\?|$)/i.test(u)) { website = u; break }
    }

    // Address: the line that ends with Oman, or the line after "Office :"
    const lines = textLines(b.html)
    let address = ''
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i]
      if (/^office\s*:?$/i.test(l) && lines[i + 1]) { address = lines[i + 1]; break }
      if (/^office\s*:/i.test(l)) { address = l.replace(/^office\s*:\s*/i, ''); break }
    }
    if (!address) {
      address = lines.find((l) => /(sultanate of oman|,\s*oman\b|muscat|ruwi|ghala|sohar|salalah|nizwa|seeb|barka|khuwair|azaiba|qurum|rusayl|mabela|bousher)/i.test(l) && l.length < 220 && l !== name) || ''
    }
    address = address.replace(/\s*,?\s*Sultanate of Oman\.?$/i, '').trim()

    const phone = cleanPhone(tel?.[1])
    // Footer "related listings" have only a name: skip anything with no phone and no address
    if (!phone && !address) continue
    seen.add(b.slug)
    out.push({
      name,
      url: `${BASE}/yp/listing/${b.slug}`,
      address,
      phone,
      whatsapp: wa ? `+${wa[1]}` : null,
      website,
    })
  }
  return out
}

// One search page, e.g. q = "oil and gas Ghala", page = 1
export async function searchYellowPagesOn(q, page = 1) {
  const url = `${BASE}/yp/search?q=${encodeURIComponent(String(q).trim()).replace(/%20/g, '+')}${page > 1 ? `&page=${page}` : ''}`
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 20000)
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'en' },
      signal: ctrl.signal,
      cache: 'no-store',
    })
    if (!res.ok) throw new Error(`Yellow Pages answered HTTP ${res.status}`)
    const html = await res.text()
    const listings = parseYellowPages(html)
    const lastPage = Math.max(1, ...[...html.matchAll(/[?&]page=(\d+)/g)].map((x) => Number(x[1])).filter((n) => n < 500))
    return { listings, page, lastPage, url, htmlSize: html.length }
  } catch (e) {
    throw e.name === 'AbortError' ? new Error('Yellow Pages took too long') : e
  } finally { clearTimeout(timer) }
}
