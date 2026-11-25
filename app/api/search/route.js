import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { geocode, fetchOverpassOn } from '@/lib/liveSearch'

// Server side of the live map search. Signed-in users only.
export const maxDuration = 60
export const dynamic = 'force-dynamic'

export async function POST(request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })

  let body
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Bad request.' }, { status: 400 }) }

  try {
    if (body.action === 'geocode') {
      const place = String(body.place || '').slice(0, 80)
      if (!place) return NextResponse.json({ error: 'No place given.' }, { status: 400 })
      return NextResponse.json({ point: await geocode(place) })
    }
    if (body.action === 'overpass') {
      const query = String(body.query || '')
      // only our own search queries: read-only map queries, limited size
      if (!query.startsWith('[out:json]') || query.length > 4000) {
        return NextResponse.json({ error: 'Bad query.' }, { status: 400 })
      }
      return NextResponse.json({ data: await fetchOverpassOn(query, body.server) })
    }
    // Which extra sources have keys set in Vercel (no key values are sent)
    if (body.action === 'sources') {
      return NextResponse.json({ google: Boolean(process.env.SERPER_API_KEY) })
    }
    // Google Maps listings through Serper (needs SERPER_API_KEY; each call uses 3 of its credits)
    if (body.action === 'gmaps') {
      const key = process.env.SERPER_API_KEY
      if (!key) return NextResponse.json({ error: 'Google search is not switched on yet.' }, { status: 400 })
      const q = String(body.q || '').slice(0, 120)
      const lat = Number(body.lat), lon = Number(body.lon), km = Math.min(100, Math.max(1, Number(body.km) || 5))
      if (!q || !Number.isFinite(lat) || !Number.isFinite(lon)) return NextResponse.json({ error: 'Bad query.' }, { status: 400 })
      const zoom = km <= 3 ? 14 : km <= 7 ? 13 : km <= 15 ? 12 : km <= 30 ? 11 : 10
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 20000)
      try {
        const res = await fetch('https://google.serper.dev/maps', {
          method: 'POST',
          headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
          body: JSON.stringify({ q, ll: `@${lat},${lon},${zoom}z`, gl: 'om', hl: 'en', page: Number(body.page) || 1 }),
          signal: ctrl.signal,
        })
        const d = await res.json().catch(() => ({}))
        if (!res.ok) return NextResponse.json({ error: d.message || `Google search answered HTTP ${res.status}` }, { status: 502 })
        const places = (d.places || []).map((p) => ({
          title: p.title, address: p.address, lat: p.latitude, lon: p.longitude, phone: p.phoneNumber || null,
          website: p.website || null, type: p.type || null, rating: p.rating ?? null, reviews: p.ratingCount ?? null, cid: p.cid || p.placeId || null,
        }))
        return NextResponse.json({ places })
      } finally { clearTimeout(timer) }
    }
    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: String(e?.message || e).slice(0, 200) }, { status: 502 })
  }
}
