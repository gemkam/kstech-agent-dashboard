import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Password reset links land here. The code is swapped for a login session,
// then the user is sent to set a new password.
export async function GET(request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') || '/account?reset=1'
  const safeNext = next.startsWith('/') ? next : '/account?reset=1'

  if (code) {
    const supabase = createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(`${origin}${safeNext}`)
  }
  return NextResponse.redirect(`${origin}/login?link=expired`)
}
