import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { geocode, fetchOverpass } from '@/lib/liveSearch'

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
      return NextResponse.json({ data: await fetchOverpass(query) })
    }
    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: String(e?.message || e).slice(0, 200) }, { status: 502 })
  }
}

// TEMP self-test for the preview branch only (fixed query, no user input)
export async function GET() {
  const out = {}
  try { out.geocode = await geocode('Al Khuwair') } catch (e) { out.geocodeError = String(e.message) }
  try {
    const p = out.geocode || { lat: 23.588, lon: 58.406 }
    const q = `[out:json][timeout:25];\n(\n  nwr["amenity"~"^(clinic|dentist|doctors)$"]["name"](around:10000,${p.lat},${p.lon});\n);\nout center tags 150;`
    const d = await fetchOverpass(q)
    out.count = (d.elements || []).length
    out.sample = (d.elements || []).slice(0, 5).map((e) => e.tags?.name)
  } catch (e) { out.overpassError = String(e.message) }
  return NextResponse.json(out)
}
