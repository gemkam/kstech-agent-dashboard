// Free, real business search using OpenStreetMap.
// - geocode(): turns a place name like "Al Khuwair" into a map point (Nominatim)
// - parseQuery(): reads "find clinics near Al Khuwair +10 km"
// - searchNearby(): lists real businesses around a point (Overpass)
// Nothing here writes to the database.

const SERVERS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
]

// Business types: label, facility-services fit (used by the demo company), and demo offer
const TYPES = {
  restaurant: { label: 'Restaurant', fit: 9, why: 'Kitchen exhaust cleaning and AC maintenance' },
  fast_food: { label: 'Fast food', fit: 8, why: 'Kitchen exhaust cleaning and pest control' },
  food_court: { label: 'Food court', fit: 8, why: 'Kitchen exhaust cleaning and pest control' },
  cafe: { label: 'Cafe', fit: 8, why: 'AC maintenance and regular deep cleaning' },
  clinic: { label: 'Clinic', fit: 9, why: 'Clinical-grade cleaning and AC servicing' },
  dentist: { label: 'Dental clinic', fit: 9, why: 'Clinical-grade cleaning and AC servicing' },
  doctors: { label: 'Medical centre', fit: 9, why: 'Clinical-grade cleaning and AC servicing' },
  doctor: { label: 'Medical centre', fit: 9, why: 'Clinical-grade cleaning and AC servicing' },
  physiotherapist: { label: 'Physiotherapy', fit: 8, why: 'Clinical-grade cleaning and AC servicing' },
  hospital: { label: 'Hospital', fit: 7, why: 'Facility maintenance contract' },
  pharmacy: { label: 'Pharmacy', fit: 6, why: 'AC maintenance for stock rooms' },
  fitness_centre: { label: 'Gym', fit: 8, why: 'Daily cleaning and AC for workout areas' },
  sports_centre: { label: 'Sports centre', fit: 7, why: 'Cleaning and AC maintenance' },
  school: { label: 'School', fit: 7, why: 'Cleaning and AC maintenance contract' },
  kindergarten: { label: 'Nursery', fit: 7, why: 'Safe cleaning and pest control' },
  college: { label: 'Training institute', fit: 8, why: 'Classroom cleaning and AC maintenance' },
  training: { label: 'Training centre', fit: 8, why: 'Classroom cleaning and AC maintenance' },
  language_school: { label: 'Language centre', fit: 8, why: 'Classroom cleaning and AC maintenance' },
  hotel: { label: 'Hotel', fit: 8, why: 'Facility maintenance contract' },
  guest_house: { label: 'Guest house', fit: 7, why: 'Facility maintenance contract' },
  supermarket: { label: 'Supermarket', fit: 7, why: 'Cold room AC and pest control' },
  convenience: { label: 'Grocery', fit: 6, why: 'Pest control and AC maintenance' },
  bakery: { label: 'Bakery', fit: 7, why: 'Pest control and exhaust cleaning' },
  pastry: { label: 'Sweets shop', fit: 7, why: 'Pest control and exhaust cleaning' },
  car_repair: { label: 'Car garage', fit: 5, why: 'Workshop cleaning and pest control' },
  car: { label: 'Car showroom', fit: 6, why: 'Showroom cleaning and AC maintenance' },
  tyres: { label: 'Tyre shop', fit: 5, why: 'Workshop cleaning' },
  car_wash: { label: 'Car wash', fit: 5, why: 'Facility maintenance' },
  hairdresser: { label: "Men's barber", fit: 6, why: 'Cleaning and AC maintenance' },
  travel_agency: { label: 'Travel agency', fit: 6, why: 'Office cleaning and AC maintenance' },
  furniture: { label: 'Furniture shop', fit: 6, why: 'Showroom cleaning and AC maintenance' },
  interior_decoration: { label: 'Interiors shop', fit: 6, why: 'Showroom cleaning and AC maintenance' },
  copyshop: { label: 'Printing shop', fit: 6, why: 'Office cleaning and AC maintenance' },
  signmaker: { label: 'Signage maker', fit: 6, why: 'Workshop cleaning and AC maintenance' },
  estate_agent: { label: 'Real estate office', fit: 6, why: 'Office cleaning and AC maintenance' },
  office: { label: 'Office', fit: 7, why: 'Office cleaning and AC maintenance' },
}

// What someone may type -> which map listings to search
const CATEGORIES = [
  { words: ['clinic', 'clinics', 'dental', 'dentist', 'doctor', 'medical', 'physio', 'health'], label: 'clinics',
    sel: ['nwr["amenity"~"^(clinic|dentist|doctors)$"]', 'nwr["healthcare"~"^(clinic|dentist|doctor|physiotherapist)$"]'] },
  { words: ['hospital', 'hospitals'], label: 'hospitals', sel: ['nwr["amenity"="hospital"]'] },
  { words: ['restaurant', 'restaurants', 'food', 'eatery'], label: 'restaurants', sel: ['nwr["amenity"~"^(restaurant|fast_food|food_court)$"]'] },
  { words: ['cafe', 'cafes', 'coffee'], label: 'cafes', sel: ['nwr["amenity"="cafe"]'] },
  { words: ['gym', 'gyms', 'fitness'], label: 'gyms', sel: ['nwr["leisure"~"^(fitness_centre|sports_centre)$"]'] },
  { words: ['school', 'schools', 'nursery'], label: 'schools', sel: ['nwr["amenity"~"^(school|kindergarten)$"]'] },
  { words: ['institute', 'training', 'college', 'academy', 'course', 'centre', 'center'], label: 'training centres',
    sel: ['nwr["amenity"~"^(college|training|language_school)$"]', 'nwr["office"="educational_institution"]'] },
  { words: ['hotel', 'hotels'], label: 'hotels', sel: ['nwr["tourism"~"^(hotel|guest_house)$"]'] },
  { words: ['pharmacy', 'pharmacies'], label: 'pharmacies', sel: ['nwr["amenity"="pharmacy"]'] },
  { words: ['garage', 'garages', 'car', 'cars', 'workshop'], label: 'car businesses',
    sel: ['nwr["shop"~"^(car_repair|car|tyres)$"]', 'nwr["amenity"="car_wash"]'] },
  { words: ['supermarket', 'supermarkets', 'grocery'], label: 'supermarkets', sel: ['nwr["shop"~"^(supermarket|convenience)$"]'] },
  { words: ['bakery', 'bakeries', 'sweets'], label: 'bakeries', sel: ['nwr["shop"~"^(bakery|pastry)$"]'] },
  { words: ['barber', 'barbers'], label: "men's barbers", sel: ['nwr["shop"="hairdresser"]'] },
  { words: ['travel', 'umrah', 'tour'], label: 'travel agencies', sel: ['nwr["shop"="travel_agency"]', 'nwr["office"="travel_agent"]'] },
  { words: ['furniture', 'interior', 'interiors', 'curtain', 'curtains'], label: 'furniture and interiors', sel: ['nwr["shop"~"^(furniture|interior_decoration|curtain)$"]'] },
  { words: ['printing', 'print', 'signage', 'signs', 'sign'], label: 'printing and signage', sel: ['nwr["shop"="copyshop"]', 'nwr["craft"="signmaker"]'] },
  { words: ['real', 'estate', 'property'], label: 'real estate offices', sel: ['nwr["office"="estate_agent"]'] },
  { words: ['office', 'offices', 'company', 'companies'], label: 'offices', sel: ['nwr["office"]'] },
]
// Niches for the admin dropdown
export const NICHES = CATEGORIES.map((c) => c.label)

// Build a search from picked niches (built-in labels) plus the admin's own words, e.g. "curtains"
export function presetFor(labels = [], custom = []) {
  const cats = CATEGORIES.filter((c) => labels.includes(c.label))
  const words = custom.map((w) => String(w).trim()).filter(Boolean).slice(0, 4)
  const esc = (w) => w.replace(/[\\"^$.*+?()[\]{}|]/g, '')
  const sel = [
    ...cats.flatMap((c) => c.sel),
    ...words.map((w) => `nwr["name"~"${esc(w)}",i]`),
  ]
  const label = [...cats.map((c) => c.label), ...words].join(', ')
  return { sel, label: label || 'businesses', custom: words }
}

const ALL = { label: 'businesses', sel: CATEGORIES.filter((c) => !['hospitals', 'offices'].includes(c.label)).flatMap((c) => c.sel) }

// Words that narrow results by name or cuisine, e.g. "Pakistani restaurants"
const CUISINES = ['pakistani', 'indian', 'arabic', 'omani', 'lebanese', 'turkish', 'chinese', 'filipino', 'kerala', 'afghan', 'iranian', 'italian', 'egyptian', 'syrian', 'yemeni', 'bangladeshi']

// Never list ladies' salons or beauty parlours
const EXCLUDE = /\b(ladies|lady|women|woman|girls|beauty|nail|bridal|spa)\b/i

export function parseQuery(text) {
  const t = String(text || '').trim()
  const lower = t.toLowerCase()
  const kmMatch = lower.match(/(\d{1,3})\s*(km|kilo)/)
  const km = kmMatch ? Math.min(Number(kmMatch[1]), 100) : null
  const placeMatch = t.match(/\b(?:near|in|around|at)\s+(.+?)(?:\s*[+,(]|\s+\d{1,3}\s*(?:km|kilo)|\s+(?:plus|within|upto|up to|and)\b|$)/i)
  const place = placeMatch ? placeMatch[1].trim() : null
  const tokens = lower.replace(/[^a-z\s]/g, ' ').split(/\s+/)
  const everything = /\b(everything|all niches|all businesses|all types)\b/.test(lower)
  const cats = everything ? [] : CATEGORIES.filter((c) => c.words.some((w) => tokens.includes(w)) || lower.includes(c.label))
  // "centre" alone is too broad if another type matched
  const picked = cats.length > 1 ? cats.filter((c) => c.label !== 'training centres' || tokens.some((w) => ['institute', 'training', 'college', 'academy', 'course'].includes(w))) : cats
  const cuisine = CUISINES.find((c) => tokens.includes(c) || tokens.includes(c + 's')) || null
  return {
    km,
    place,
    cuisine,
    everything,
    label: (cuisine ? cuisine[0].toUpperCase() + cuisine.slice(1) + ' ' : '') + (picked.length ? picked.map((c) => c.label).join(' and ') : everything ? 'businesses (all niches)' : 'businesses'),
    sel: picked.length ? picked.flatMap((c) => c.sel) : everything ? CATEGORIES.filter((c) => c.label !== 'offices').flatMap((c) => c.sel) : ALL.sel,
  }
}

// In the browser, map requests go through our own server (/api/search), which identifies
// itself properly to the free map services. On the server they go straight out.
const IN_BROWSER = typeof window !== 'undefined'
const UA = 'KSTechLeads/1.0 (+https://kstech-agent-dashboard.vercel.app; kzstech000@gmail.com)'

async function viaServer(body) {
  const res = await fetch('/api/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const d = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(d.error || `HTTP ${res.status}`)
  return d
}

export async function geocode(place) {
  if (IN_BROWSER) return (await viaServer({ action: 'geocode', place })).point || null
  const q = /oman|muscat|seeb|sohar|salalah|nizwa|sur\b|barka/i.test(place) ? place : `${place}, Muscat`
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=om&accept-language=en&q=${encodeURIComponent(q)}`
  const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': UA, Referer: 'https://kstech-agent-dashboard.vercel.app/' } })
  if (!res.ok) throw new Error(`Place lookup failed (HTTP ${res.status})`)
  const d = await res.json()
  if (!d?.length) return null
  const name = d[0].display_name.split(',').slice(0, 2).join(',').trim()
  return { lat: Number(d[0].lat), lon: Number(d[0].lon), label: name }
}

function typeOf(tags) {
  for (const k of [tags.office, tags.healthcare, tags.amenity, tags.leisure, tags.shop, tags.tourism, tags.craft]) {
    if (k && TYPES[k]) return k
  }
  return tags.office ? 'office' : null
}

function distanceKm(a, b) {
  const R = 6371
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

export async function fetchOverpass(query) {
  if (IN_BROWSER) return (await viaServer({ action: 'overpass', query })).data
  let lastErr
  for (const [i, url] of SERVERS.entries()) {
    try {
      if (i > 0) await wait(600)
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 35000)
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json', 'User-Agent': UA },
        body: 'data=' + encodeURIComponent(query),
        signal: ctrl.signal,
      })
      clearTimeout(timer)
      if (!res.ok) throw new Error(`${new URL(url).host} answered HTTP ${res.status}`)
      return await res.json()
    } catch (e) {
      lastErr = e.name === 'AbortError' ? new Error(`${new URL(url).host} took too long`) : e
    }
  }
  throw lastErr || new Error('Search failed')
}

// km = 0 means "nearby" (2 km). Capped at 30 km so the free map service answers quickly.
// Big searches ("all niches") are split into small groups, one after another, so the free
// map service does not time out. onProgress(done, total) reports how far it got.
export async function searchNearby({ lat, lon, km = 0, sel = ALL.sel, cuisine = null, max = 60, custom = [], onProgress }) {
  const customRe = custom.length ? new RegExp(custom.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'i') : null
  const meters = Math.min(Math.max(km || 2, 2), 30) * 1000
  const at = `(around:${meters},${lat},${lon})`
  const groupSize = sel.length > 4 ? 3 : sel.length
  const groups = []
  for (let i = 0; i < sel.length; i += groupSize) groups.push(sel.slice(i, i + groupSize))

  const elements = []
  let failed = 0
  let lastError = null
  for (const [i, g] of groups.entries()) {
    onProgress?.(i, groups.length)
    const query = `[out:json][timeout:25];\n(\n${g.map((s) => `  ${s}["name"]${at};`).join('\n')}\n);\nout center tags 150;`
    try {
      const data = await fetchOverpass(query)
      elements.push(...(data.elements || []))
    } catch (e) {
      failed++
      lastError = e
      if (groups.length === 1) throw e
    }
    if (i < groups.length - 1) await wait(400)
  }
  onProgress?.(groups.length, groups.length)
  if (failed === groups.length) throw lastError || new Error('Search failed')

  const seen = new Set()
  const out = []
  for (const el of elements) {
    const tags = el.tags || {}
    let kind = typeOf(tags)
    const name = tags['name:en'] || tags.name
    if (!name) continue
    // own niche words: keep any business whose name matches, even if its type is not in the list
    const customHit = customRe && (customRe.test(name) || customRe.test(tags.name || ''))
    if (!kind && !customHit) continue
    if (!kind) kind = null
    if (EXCLUDE.test(name) || tags.female === 'yes' || tags.unisex === 'yes') continue
    if (cuisine && !`${name} ${tags.name || ''} ${tags.cuisine || ''}`.toLowerCase().includes(cuisine.slice(0, 5))) continue
    const key = name.toLowerCase().replace(/[^a-z0-9؀-ۿ]/g, '')
    if (seen.has(key)) continue
    seen.add(key)
    const pos = el.center || { lat: el.lat, lon: el.lon }
    if (pos.lat == null) continue
    const hitWord = customHit ? custom.find((w) => new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(`${name} ${tags.name || ''}`)) : null
    const t = TYPES[kind] || { label: hitWord ? hitWord[0].toUpperCase() + hitWord.slice(1) : 'Business', fit: 7, why: 'Facility maintenance' }
    const website = tags.website || tags['contact:website'] || null
    const phone = tags.phone || tags['contact:phone'] || tags['contact:mobile'] || null
    const email = tags.email || tags['contact:email'] || null
    const gaps = []
    if (!website) gaps.push('No website listed')
    if (!phone) gaps.push('No phone listed')
    if (!tags.opening_hours) gaps.push('No opening hours listed')
    out.push({
      id: `${el.type}-${el.id}`,
      name,
      type: t.label,
      typeKey: kind || (hitWord || 'business').toLowerCase().replace(/\s+/g, '_'),
      area: tags['addr:suburb'] || tags['addr:city'] || tags['addr:street'] || '',
      km: distanceKm({ lat, lon }, pos),
      website,
      phone,
      email,
      cuisine: tags.cuisine || null,
      gaps,
      offer: t.why,
      score: Math.min(10, t.fit + (gaps.length >= 2 ? 1 : 0)),
      mapUrl: `https://www.openstreetmap.org/${el.type}/${el.id}`,
    })
  }
  out.sort((a, b) => b.score - a.score || a.km - b.km)
  const result = out.slice(0, max)
  result.partial = failed > 0
  return result
}
