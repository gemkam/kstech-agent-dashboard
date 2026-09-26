import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { signOut } from '../actions'
import Dashboard from './Dashboard'

export const dynamic = 'force-dynamic'

export default async function DashboardPage({ searchParams }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('user_id, email, role, client_id')
    .eq('user_id', user.id)
    .single()

  if (!profile) {
    return <Notice title="Your account is not set up yet" text="KS Tech will link your account to your company shortly. Contact +968 9731 2049 if this takes long." />
  }

  const isAdmin = profile.role === 'admin'
  let clients = []
  let client = null

  if (isAdmin) {
    const { data } = await supabase.from('clients').select('id, name, slug, is_demo, demo_kind, description, search_radius_km').order('name')
    clients = data || []
    client =
      clients.find((c) => c.slug === searchParams?.client) ||
      clients.find((c) => c.slug === 'kstech') ||
      clients[0]
  } else if (profile.client_id) {
    const { data } = await supabase
      .from('clients')
      .select('id, name, slug, is_demo, demo_kind, description, search_radius_km')
      .eq('id', profile.client_id)
      .single()
    client = data
  }

  if (!client) {
    return <Notice title="No company linked to your account" text="KS Tech will link your account to your company shortly. Contact +968 9731 2049 if this takes long." />
  }

  const [leadsRes, outreachRes, followupsRes, visitsRes, runRes, eventsRes, sentRes, firstSentRes, mailboxRes] = await Promise.all([
    supabase
      .from('leads')
      .select('id, ref_code, business_name, category, area, phone, email, website, google_maps_url, source, problem_found, problem_evidence, suggested_service, why_chosen, score, status, notes, do_not_contact, dnc_reason, dnc_at, duplicate_of, created_at, updated_at')
      .eq('client_id', client.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('outreach')
      .select('id, lead_id, channel, subject, message_sent, message_draft, status, sent_at, replied_at, reviewed_at, created_at')
      .eq('client_id', client.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('followups')
      .select('id, lead_id, due_date, draft_message, done')
      .eq('client_id', client.id)
      .order('due_date', { ascending: true }),
    isAdmin && client.slug === 'kstech'
      ? supabase.from('link_visits').select('ref')
      : Promise.resolve({ data: [] }),
    supabase
      .from('agent_runs')
      .select('id, status, current_step, summary, started_at, finished_at')
      .eq('client_id', client.id)
      .order('started_at', { ascending: false })
      .limit(1),
    supabase
      .from('agent_events')
      .select('id, kind, message, created_at')
      .eq('client_id', client.id)
      .order('created_at', { ascending: false })
      .limit(25),
    supabase
      .from('outreach')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', client.id)
      .not('sent_at', 'is', null),
    supabase
      .from('outreach')
      .select('sent_at')
      .eq('client_id', client.id)
      .not('sent_at', 'is', null)
      .order('sent_at', { ascending: true })
      .limit(1),
    supabase
      .from('mailbox_setup')
      .select('outreach_email, provider, mailbox_created, spf, dkim, dmarc, test_passed, notes, updated_at')
      .eq('client_id', client.id)
      .maybeSingle(),
  ])

  // Demo login: list the demo companies so the presenter can switch between them
  let demoClients = []
  if (!isAdmin && client.is_demo) {
    const { data } = await supabase.from('clients').select('id, name, slug, demo_kind').eq('is_demo', true).order('name')
    demoClients = data || []
  }

  const visitCounts = {}
  for (const v of visitsRes.data || []) {
    visitCounts[v.ref] = (visitCounts[v.ref] || 0) + 1
  }

  return (
    <Dashboard
      key={client.id}
      isAdmin={isAdmin}
      demoClients={demoClients}
      userEmail={profile.email || user.email}
      clients={clients}
      client={client}
      leads={leadsRes.data || []}
      outreach={outreachRes.data || []}
      followups={followupsRes.data || []}
      visitCounts={visitCounts}
      latestRun={(runRes.data || [])[0] || null}
      events={eventsRes.data || []}
      sentTotal={sentRes.count || 0}
      firstSentAt={(firstSentRes.data || [])[0]?.sent_at || null}
      mailbox={mailboxRes.data || null}
      today={new Date().toISOString().slice(0, 10)}
    />
  )
}

function Notice({ title, text }) {
  return (
    <main className="login">
      <div className="login-card">
        <h1>{title}</h1>
        <p className="muted">{text}</p>
        <form action={signOut}>
          <button type="submit" className="btn btn-primary">Sign out</button>
        </form>
      </div>
    </main>
  )
}
