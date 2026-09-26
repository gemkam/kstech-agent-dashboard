// Free, real business search using OpenStreetMap.
// - geocode(): turns a place name like "Al Khuwair" into a map point (Nominatim)
// - parseQuery(): reads "find clinics near Al Khuwair +10 km"
// - searchNearby(): lists real businesses around a point (Overpass)
// Nothing here writes to the database.

const SERVERS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
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

export async function geocode(place) {
  const q = /oman|muscat|seeb|sohar|salalah|nizwa|sur\b|barka/i.test(place) ? place : `${place}, Muscat`
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=om&accept-language=en&q=${encodeURIComponent(q)}`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error('geocode failed')
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

async function fetchOverpass(query) {
  let lastErr
  for (const url of SERVERS) {
    try {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 30000)
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(query),
        signal: ctrl.signal,
      })
      clearTimeout(timer)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.json()
    } catch (e) {
      lastErr = e
    }
  }
  throw lastErr || new Error('Search failed')
}

// km = 0 means "nearby" (2 km). Capped at 30 km so the free map service answers quickly.
export async function searchNearby({ lat, lon, km = 0, sel = ALL.sel, cuisine = null, max = 60 }) {
  const meters = Math.min(Math.max(km || 2, 2), 30) * 1000
  const at = `(around:${meters},${lat},${lon})`
  const query = `[out:json][timeout:25];\n(\n${sel.map((s) => `  ${s}["name"]${at};`).join('\n')}\n);\nout center tags ${max > 60 ? 500 : 200};`
  const data = await fetchOverpass(query)
  const seen = new Set()
  const out = []
  for (const el of data.elements || []) {
    const tags = el.tags || {}
    const kind = typeOf(tags)
    const name = tags['name:en'] || tags.name
    if (!kind || !name) continue
    if (EXCLUDE.test(name) || tags.female === 'yes' || tags.unisex === 'yes') continue
    if (cuisine && !`${name} ${tags.name || ''} ${tags.cuisine || ''}`.toLowerCase().includes(cuisine.slice(0, 5))) continue
    const key = name.toLowerCase().replace(/[^a-z0-9؀-ۿ]/g, '')
    if (seen.has(key)) continue
    seen.add(key)
    const pos = el.center || { lat: el.lat, lon: el.lon }
    if (pos.lat == null) continue
    const t = TYPES[kind]
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
      typeKey: kind,
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
  return out.slice(0, max)
}
