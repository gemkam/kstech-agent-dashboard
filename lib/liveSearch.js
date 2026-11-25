// Free, real business search using OpenStreetMap.
// - geocode(): turns a place name like "Al Khuwair" into a map point (Nominatim)
// - parseQuery(): reads "find clinics near Al Khuwair +10 km"
// - searchNearby(): lists real businesses around a point (Overpass)
// In the browser every map request goes through /api/search (the map services reject direct browser calls).
// Nothing here writes to the database.

// Free map servers, tried in this order. If one is busy the search moves to the next.
const SERVERS = [
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
]
export const SERVER_COUNT = SERVERS.length

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
  employment_agency: { label: 'Manpower / recruitment', fit: 7, why: 'Office cleaning and AC maintenance' },
  construction_company: { label: 'Construction company', fit: 7, why: 'Site office cleaning and AC maintenance' },
  builder: { label: 'Contractor', fit: 7, why: 'Site office cleaning and AC maintenance' },
  contractor: { label: 'Contractor', fit: 7, why: 'Site office cleaning and AC maintenance' },
  university: { label: 'University', fit: 8, why: 'Campus cleaning and AC maintenance' },
  bank: { label: 'Bank', fit: 7, why: 'Branch cleaning and AC maintenance' },
  diplomatic: { label: 'Embassy / consulate', fit: 6, why: 'Facility maintenance' },
  embassy: { label: 'Embassy / consulate', fit: 6, why: 'Facility maintenance' },
  car_rental: { label: 'Rent a car', fit: 6, why: 'Office cleaning and AC maintenance' },
  logistics: { label: 'Logistics company', fit: 6, why: 'Warehouse cleaning and pest control' },
  courier: { label: 'Courier company', fit: 6, why: 'Warehouse cleaning and pest control' },
  energy_supplier: { label: 'Oil, gas and energy', fit: 7, why: 'Facility maintenance contract' },
  petroleum_company: { label: 'Oil and gas company', fit: 7, why: 'Facility maintenance contract' },
  company: { label: 'Company office', fit: 6, why: 'Office cleaning and AC maintenance' },
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
  { words: ['manpower', 'recruitment', 'recruiter', 'recruiters', 'staffing'], label: 'manpower and recruitment',
    sel: ['nwr["office"="employment_agency"]', 'nwr["office"]["name"~"manpower|recruit|staffing|staff|employment|hr consult",i]', 'nwr["shop"]["name"~"manpower|recruit",i]'] },
  { words: ['construction', 'contracting', 'contractor', 'contractors', 'builders'], label: 'construction and contracting',
    sel: ['nwr["office"~"^(construction_company|contractor)$"]', 'nwr["craft"="builder"]', 'nwr["office"]["name"~"contracting|construction",i]'] },
  { words: ['oil', 'gas', 'petroleum', 'energy', 'drilling'], label: 'oil and gas',
    sel: ['nwr["office"~"^(energy_supplier|petroleum_company)$"]', 'nwr["office"]["name"~"oil|petroleum|drilling|gas ",i]'] },
  { words: ['university', 'universities'], label: 'universities', sel: ['nwr["amenity"="university"]'] },
  { words: ['bank', 'banks'], label: 'banks', sel: ['nwr["amenity"="bank"]'] },
  { words: ['embassy', 'embassies', 'consulate'], label: 'embassies', sel: ['nwr["office"="diplomatic"]', 'nwr["amenity"="embassy"]'] },
  { words: ['rent', 'rental', 'hire'], label: 'rent a car', sel: ['nwr["amenity"="car_rental"]', 'nwr["shop"="car_rental"]'] },
  { words: ['logistics', 'courier', 'cargo', 'shipping'], label: 'logistics', sel: ['nwr["office"~"^(logistics|courier)$"]', 'nwr["office"]["name"~"logistic|cargo|shipping",i]'] },
  { words: ['event', 'events', 'exhibition'], label: 'event companies', sel: ['nwr["name"~"events|exhibition",i]["office"]', 'nwr["name"~"events|exhibition",i]["shop"]'] },
  { words: ['office', 'offices', 'company', 'companies'], label: 'offices', sel: ['nwr["office"]'] },
]

// "Find customers for": the niche your client is in -> the businesses that buy from it.
// Each target is a search niche above plus the reason it buys.
export const AUDIENCES = {
  'travel agencies': [
    ['manpower and recruitment', 'Books flights and visas for workers and staff joining and going on leave', 10],
    ['oil and gas', 'Crew rotation tickets and business travel', 9],
    ['schools', "Teachers' annual ticket allowance and school trips", 9],
    ['hospitals', 'Tickets and visas for doctors and nurses from abroad', 9],
  ],
  'rent a car': [
    ['construction and contracting', 'Monthly pickups and cars for site engineers', 10],
    ['manpower and recruitment', 'Transport for new staff', 9],
    ['oil and gas', '4x4s for site visits', 9],
    ['hotels', 'Car rental for guests', 8],
  ],
  'facility management and cleaning': [
    ['offices', 'Office cleaning and AC maintenance', 8],
    ['hotels', 'Housekeeping support and maintenance contracts', 8],
    ['schools', 'Daily cleaning and AC contracts', 8],
    ['clinics', 'Clinical-grade cleaning', 9],
  ],
  'printing and signage': [
    ['restaurants', 'Menus, shop signs and flyers', 8],
    ['schools', 'Banners, certificates and event prints', 8],
    ['event companies', 'Event banners and stands', 9],
    ['real estate offices', 'Property boards and brochures', 7],
  ],
  'IT and CCTV': [
    ['schools', 'CCTV, Wi-Fi and computer labs', 9],
    ['clinics', 'CCTV, networks and patient systems', 8],
    ['hotels', 'Guest Wi-Fi and CCTV', 8],
    ['supermarkets', 'CCTV and POS systems', 8],
  ],
  'corporate catering': [
    ['construction and contracting', 'Daily meals for site staff', 10],
    ['manpower and recruitment', 'Meals for workers', 9],
    ['oil and gas', 'Camp and site catering', 9],
    ['schools', 'School canteen', 8],
  ],
  'training institutes': [
    ['manpower and recruitment', 'Training and certificates for new staff', 9],
    ['construction and contracting', 'Safety and skills training', 9],
    ['oil and gas', 'HSE and technical training', 9],
    ['banks', 'Staff development courses', 8],
  ],
  'manpower and recruitment': [
    ['construction and contracting', 'Needs workers and technicians', 10],
    ['hotels', 'Needs hospitality staff', 8],
    ['hospitals', 'Needs nurses and support staff', 8],
    ['oil and gas', 'Needs skilled technicians', 9],
  ],
  'pest control': [
    ['restaurants', 'Regular kitchen pest control', 9],
    ['bakeries', 'Food-safe pest control', 9],
    ['hotels', 'Room and kitchen pest control', 8],
    ['supermarkets', 'Store and stock room pest control', 8],
  ],
  'office furniture': [
    ['offices', 'Office desks, chairs and fit-out', 8],
    ['schools', 'Classroom furniture', 8],
    ['universities', 'Classroom and office furniture', 8],
    ['banks', 'Branch furniture', 7],
  ],
}
export const MAX_TYPES = 4
// Buyer types anyone can add in place of a predefined one
export const BUYER_TYPES = CATEGORIES.map((c) => c.label)
export const AUDIENCE_LIST = Object.keys(AUDIENCES)
// Niche buttons shown under the admin search box (label = what gets typed)
export const NICHES = CATEGORIES.map((c) => c.label)

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
  const forMatch = lower.match(/customers for (.+?)(?:\s+(?:near|in|around|at)\s|\s*\+|\s+\d{1,3}\s*km|$)/)
  const forKey = forMatch && AUDIENCE_LIST.find((k) => k.toLowerCase() === forMatch[1].trim())
  if (forKey) {
    // own buyer types, e.g. "... types: hotels; banks" (up to 4); otherwise the predefined 4
    const typesMatch = t.match(/types:\s*(.+)$/i)
    const own = typesMatch ? typesMatch[1].split(';').map((x) => x.trim().toLowerCase()).filter(Boolean).slice(0, MAX_TYPES) : null
    const preset = AUDIENCES[forKey]
    const list = own
      ? own.map((cat) => preset.find(([c]) => c === cat) || [cat, `Regular buyer from ${forKey}`, 8])
      : preset
    const targets = list.map(([cat, why, score]) => ({ cat: CATEGORIES.find((c) => c.label === cat), why, score })).filter((t) => t.cat)
    return {
      km, place, cuisine: null, everything: false,
      audience: forKey,
      label: `customers for ${forKey}`,
      sel: targets.flatMap((t) => t.cat.sel),
      targets: targets.map((t) => ({ label: t.cat.label, sel: t.cat.sel, why: t.why, score: t.score })),
    }
  }
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

async function viaServer(body, signal) {
  const res = await fetch('/api/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
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

// One map server, one try (about 25 s), so a single server request always fits in the 60 s server limit
async function askServer(url, query) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 25000)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json', 'User-Agent': UA },
      body: 'data=' + encodeURIComponent(query),
      signal: ctrl.signal,
    })
    if (!res.ok) throw new Error(`${new URL(url).host} answered HTTP ${res.status}`)
    return await res.json()
  } catch (e) {
    throw e.name === 'AbortError' ? new Error(`${new URL(url).host} took too long`) : e
  } finally { clearTimeout(timer) }
}

// Server side: server = index of the map server to ask
export async function fetchOverpassOn(query, server = 0) {
  const url = SERVERS[Math.max(0, Math.min(SERVERS.length - 1, Number(server) || 0))]
  return askServer(url, query)
}

// Tries every map server in turn, twice round if needed. onStatus tells the screen what is happening.
export async function fetchOverpass(query, signal, onStatus) {
  let lastErr
  for (let round = 0; round < 2; round++) {
    for (let i = 0; i < SERVERS.length; i++) {
      if (signal?.aborted) throw new Error('Stopped')
      try {
        const data = IN_BROWSER
          ? (await viaServer({ action: 'overpass', query, server: i }, signal)).data
          : await askServer(SERVERS[i], query)
        return data
      } catch (e) {
        if (signal?.aborted) throw e
        lastErr = e
        const nextNo = i + 2 <= SERVERS.length ? i + 2 : 1
        onStatus?.(`Map server ${i + 1} is busy, switching to server ${nextNo}`)
        await wait(400)
      }
    }
  }
  throw lastErr || new Error('All map servers are busy')
}

// km = 0 means "nearby" (2 km). Up to 100 km, matching the distance dropdown.
// Big searches ("all niches") are split into small groups, one after another, so the free
// map service does not time out. onProgress(done, total) reports how far it got.
export async function searchNearby({ lat, lon, km = 0, sel = ALL.sel, cuisine = null, max = 300, custom = [], onProgress, asType = null, signal, onPartial, oneQuery = false, onStatus }) {
  const customRe = custom.length ? new RegExp(custom.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'i') : null
  const meters = Math.min(Math.max(km || 2, 2), 100) * 1000
  const at = `(around:${meters},${lat},${lon})`
  const groupSize = oneQuery ? sel.length : Math.min(3, sel.length)
  const groups = []
  for (let i = 0; i < sel.length; i += groupSize) groups.push(sel.slice(i, i + groupSize))

  const elements = []
  let failed = 0
  let lastError = null
  let next = 0, doneGroups = 0
  // two small requests at a time; each finished one shows its businesses straight away
  const worker = async () => {
    while (next < groups.length && !signal?.aborted) {
      const g = groups[next++]
      onProgress?.(doneGroups, groups.length)
      const query = `[out:json][timeout:25];\n(\n${g.map((s) => `  ${s}["name"]${at};`).join('\n')}\n);\nout center tags 500;`
      try {
        const data = await fetchOverpass(query, signal, onStatus)
        elements.push(...(data.elements || []))
      } catch (e) {
        if (signal?.aborted) return
        failed++
        lastError = e
      }
      doneGroups++
      if (onPartial && !signal?.aborted) onPartial(build(), doneGroups, groups.length)
    }
  }
  await Promise.all(groups.length > 1 ? [worker(), worker()] : [worker()])
  const stopped = Boolean(signal?.aborted)
  onProgress?.(groups.length, groups.length)
  if (!stopped && failed === groups.length) throw lastError || new Error('Search failed')
  const result = build()
  result.partial = failed > 0
  result.stopped = stopped
  return result

  function build() {
  const seen = new Set()
  const out = []
  for (const el of elements) {
    const tags = el.tags || {}
    let kind = typeOf(tags)
    const name = tags['name:en'] || tags.name
    if (!name) continue
    // own niche words: keep any business whose name matches, even if its type is not in the list
    const customHit = customRe && (customRe.test(name) || customRe.test(tags.name || ''))
    if (!kind && !customHit && !asType) continue
    if (!kind) kind = null
    if (EXCLUDE.test(name) || tags.female === 'yes' || tags.unisex === 'yes') continue
    if (cuisine && !`${name} ${tags.name || ''} ${tags.cuisine || ''}`.toLowerCase().includes(cuisine.slice(0, 5))) continue
    const key = name.toLowerCase().replace(/[^a-z0-9؀-ۿ]/g, '')
    if (seen.has(key)) continue
    seen.add(key)
    const pos = el.center || { lat: el.lat, lon: el.lon }
    if (pos.lat == null) continue
    const hitWord = customHit ? custom.find((w) => new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(`${name} ${tags.name || ''}`)) : null
    let t = TYPES[kind] || { label: hitWord ? hitWord[0].toUpperCase() + hitWord.slice(1) : 'Business', fit: 7, why: 'Facility maintenance' }
    // audience search: name the business by the niche searched when the map type is vague
    if (asType && (!TYPES[kind] || kind === 'office' || kind === 'company')) t = { ...t, label: asType[0].toUpperCase() + asType.slice(1) }
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
      tags,
    })
  }
  out.sort((a, b) => b.score - a.score || a.km - b.km)
  return out.slice(0, max)
  }
}

// Does a map listing match one of our selectors, e.g. nwr["shop"~"^(a|b)$"]["name"~"x",i] ?
export function matchSel(tags, sel) {
  const parts = [...String(sel).matchAll(/\["([^"]+)"(?:(=|~)"([^"]*)"(,i)?)?\]/g)]
  return parts.every(([, k, op, v, ci]) => {
    const val = tags?.[k]
    if (val == null) return false
    if (!op) return true
    if (op === '=') return val === v
    try { return new RegExp(v, ci ? 'i' : '').test(val) } catch { return false }
  })
}

// ---------- Google Maps (through Serper) ----------
let googleOn = null
export async function googleAvailable() {
  if (googleOn !== null) return googleOn
  try { googleOn = Boolean((await viaServer({ action: 'sources' })).google) } catch { googleOn = false }
  return googleOn
}

// One Google Maps search, e.g. "manpower companies" around a point. Returns items like searchNearby.
export async function searchGoogle({ q, lat, lon, km, label, signal }) {
  const { places = [] } = await viaServer({ action: 'gmaps', q, lat, lon, km }, signal)
  const out = []
  for (const p of places) {
    const name = String(p.title || '').trim()
    if (!name || EXCLUDE.test(name) || EXCLUDE.test(p.type || '')) continue
    if (p.lat == null || p.lon == null) continue
    const dist = distanceKm({ lat, lon }, { lat: p.lat, lon: p.lon })
    if (dist > km * 1.15) continue
    const gaps = []
    if (!p.website) gaps.push('No website listed')
    if (!p.phone) gaps.push('No phone listed')
    out.push({
      id: `g-${p.cid || name}`,
      name,
      type: label ? label[0].toUpperCase() + label.slice(1) : (p.type || 'Business'),
      typeKey: String(p.type || label || 'business').toLowerCase().replace(/\s+/g, '_').slice(0, 60),
      area: p.address || '',
      km: dist,
      website: p.website,
      phone: p.phone,
      email: null,
      gaps,
      offer: '',
      score: 8,
      mapUrl: p.cid ? `https://maps.google.com/?cid=${p.cid}` : `https://www.google.com/maps/search/${encodeURIComponent(name)}`,
      source: 'google_maps',
      rating: p.rating,
      reviews: p.reviews,
      tags: {},
    })
  }
  return out
}

// Keep the best few per buyer type: listings with a phone and a website first, then rating, then the closest
export const PER_TYPE = 2
export function pickPerType(items, per = PER_TYPE) {
  const rank = (b) => (b.phone ? 2 : 0) + (b.website ? 2 : 0) + (b.email ? 3 : 0) + (b.source === 'google_maps' ? 1 : 0) + (b.rating ? Math.min(1, b.rating / 5) : 0)
  const byType = {}
  for (const b of items) (byType[b.target || b.type] ||= []).push(b)
  const out = []
  for (const list of Object.values(byType)) {
    list.sort((a, b) => rank(b) - rank(a) || a.km - b.km)
    out.push(...list.slice(0, per))
  }
  return out
}
