// Server only: find a business's real email address.
// 1. Its own website (home, contact and about pages) - most reliable.
// 2. Web search (Tavily, then Serper Google results) for the business name, reading the result pages.
// Every email comes back with the page it was found on, so it can be checked.

const UA = 'Mozilla/5.0 (compatible; KSTechLeads/1.0; +https://kstech-agent-dashboard.vercel.app)'
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
const BAD = /\.(png|jpe?g|gif|webp|svg|css|js)$|example\.|sentry|wixpress|domain\.com|email\.com|yourname|@2x|godaddy|cloudflare|schema\.org|w3\.org/i
const GOOD_START = /^(info|sales|contact|enquir|inquir|hello|office|admin|hr|careers|booking|reservations?|marketing|support|customerservice)/i

function hostOf(url) {
  try { return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '').toLowerCase() } catch { return '' }
}

function emailsIn(text) {
  const found = new Set()
  const plain = String(text || '')
    .replace(/\s*(?:&#64;|&#x40;|\[at\]|\(at\))\s*/gi, '@')
    .replace(/\s*(?:\[dot\]|\(dot\))\s*/gi, '.')
  for (const m of plain.matchAll(EMAIL_RE)) {
    const e = m[0].toLowerCase().replace(/^mailto:/, '').replace(/\.+$/, '')
    if (!BAD.test(e) && e.length < 80) found.add(e)
  }
  return [...found]
}

// Prefer an address on the business's own domain, then a general mailbox (info@, sales@)
function best(emails, domain) {
  if (!emails.length) return null
  const score = (e) => (domain && e.endsWith('@' + domain) ? 4 : 0) + (domain && e.split('@')[1]?.endsWith(domain) ? 1 : 0) + (GOOD_START.test(e) ? 2 : 0) - (/gmail|hotmail|yahoo|outlook/.test(e) ? 1 : 0)
  return [...emails].sort((a, b) => score(b) - score(a))[0]
}

async function getPage(url, ms = 8000) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html' }, redirect: 'follow', signal: ctrl.signal })
    if (!res.ok) return ''
    const type = res.headers.get('content-type') || ''
    if (!type.includes('html') && !type.includes('text')) return ''
    return (await res.text()).slice(0, 600000)
  } catch { return '' } finally { clearTimeout(t) }
}

async function fromWebsite(website) {
  const base = website.startsWith('http') ? website : `https://${website}`
  let origin
  try { origin = new URL(base).origin } catch { return null }
  const domain = hostOf(base)
  const home = await getPage(base)
  let emails = emailsIn(home)
  const where = Object.fromEntries(emails.map((e) => [e, base]))
  if (!best(emails, domain)?.endsWith(domain)) {
    // follow the site's own contact / about links, or try the usual addresses
    const links = [...home.matchAll(/href=["']([^"'#]+)["']/gi)].map((m) => m[1])
      .filter((h) => /contact|about|reach|enquir|get-in-touch/i.test(h)).slice(0, 3)
    const tries = [...new Set([...links, '/contact', '/contact-us'])].slice(0, 4)
    const urls = tries.map((h) => { try { return new URL(h, origin).href } catch { return null } }).filter(Boolean)
    const pages = await Promise.all(urls.map((u) => getPage(u, 7000)))
    pages.forEach((p, i) => { for (const e of emailsIn(p)) { emails.push(e); where[e] ||= urls[i] } })
  }
  const e = best([...new Set(emails)], domain)
  return e ? { email: e, from: where[e] || base } : null
}

async function tavily(query) {
  const key = process.env.TAVILY_API_KEY
  if (!key) return []
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 15000)
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ query, search_depth: 'basic', max_results: 6 }),
      signal: ctrl.signal,
    })
    if (!res.ok) return []
    const d = await res.json()
    return (d.results || []).map((r) => ({ url: r.url, text: `${r.title || ''} ${r.content || ''}` }))
  } catch { return [] } finally { clearTimeout(t) }
}

async function serperWeb(query) {
  const key = process.env.SERPER_API_KEY
  if (!key) return []
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 15000)
  try {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: query, gl: 'om', hl: 'en', num: 8 }),
      signal: ctrl.signal,
    })
    if (!res.ok) return []
    const d = await res.json()
    return (d.organic || []).map((r) => ({ url: r.link, text: `${r.title || ''} ${r.snippet || ''}` }))
  } catch { return [] } finally { clearTimeout(t) }
}

// name: business name; website: from the map if known; area: e.g. "Bawshar, Muscat"
export async function findEmail({ name, website, area }) {
  const n = String(name || '').trim()
  if (!n) return { email: null }
  // 1. own website
  if (website) {
    const r = await fromWebsite(website)
    if (r) return { ...r, how: 'company website' }
  }
  // 2. web search: snippets first, then the business's own site if search finds it
  const query = `"${n}" ${area ? area.split(',')[0] + ' ' : ''}Oman email contact`
  let results = await tavily(query)
  let how = 'web search (Tavily)'
  if (!results.length) { results = await serperWeb(query); how = 'web search (Google)' }
  const nameWords = n.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3)
  const relevant = (r) => nameWords.length === 0 || nameWords.some((w) => r.text.toLowerCase().includes(w) || (r.url || '').toLowerCase().includes(w))
  for (const r of results.filter(relevant)) {
    const e = best(emailsIn(r.text), hostOf(r.url))
    if (e && nameWords.some((w) => e.includes(w) || hostOf(r.url).includes(w) || r.text.toLowerCase().includes(w))) return { email: e, from: r.url, how }
  }
  // 3. a search result that is probably the business's own site: read it
  const own = results.find((r) => nameWords.some((w) => hostOf(r.url).includes(w)) && !/facebook|instagram|linkedin|yellowpages|google|tripadvisor|wikipedia/.test(hostOf(r.url)))
  if (own && !website) {
    const r = await fromWebsite(own.url)
    if (r) return { ...r, how: 'company website (found by search)', website: own.url }
  }
  return { email: null, website: own?.url || null }
}
