import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Public demo links you can share: /try/quotes, /try/booking, /try/leadgen
// Each link signs the visitor into its own share demo, separate from the presenter demo login.
// These are public demo accounts (the links are meant to be shared), limited to the share demo data.
const SHARE_PASSWORD = process.env.DEMO_SHARE_PASSWORD || 'Ks8T0xm77MjZjt6931XAQLkPPQ'
const SHARE_USERS = {
  leadgen: 'share-leadgen@kstech.om',
  quotes: 'share-quotes@kstech.om',
  booking: 'share-booking@kstech.om',
}

export async function GET(request, { params }) {
  const kind = String(params?.kind || '').toLowerCase()
  const email = SHARE_USERS[kind]
  const url = new URL(request.url)
  if (!email) {
    url.pathname = '/login'
    url.search = ''
    return NextResponse.redirect(url)
  }
  const supabase = createClient()
  await supabase.auth.signOut()
  const { error } = await supabase.auth.signInWithPassword({ email, password: SHARE_PASSWORD })
  url.pathname = error ? '/login' : '/dashboard'
  url.search = ''
  return NextResponse.redirect(url)
}
