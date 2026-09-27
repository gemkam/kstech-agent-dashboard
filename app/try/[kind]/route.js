import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Public demo links you can share: /try/quotes, /try/booking, /try/leadgen
// Every visitor gets their own private copy of the demo, so nobody can restart
// someone else's demo, and nobody can see real client data.
const KINDS = ['leadgen', 'quotes', 'booking']

export async function GET(request, { params }) {
  const kind = String(params?.kind || '').toLowerCase()
  const url = new URL(request.url)
  url.search = ''

  if (!KINDS.includes(kind)) {
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  const supabase = createClient()
  await supabase.auth.signOut()

  const { data: visitor, error } = await supabase.rpc('new_share_visitor', { p_kind: kind })
  if (error || !visitor?.email) {
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: visitor.email,
    password: visitor.password,
  })
  url.pathname = signInError ? '/login' : '/dashboard'
  return NextResponse.redirect(url)
}
