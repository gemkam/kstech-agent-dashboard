import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { updateProfile, addClient, signOut } from '../actions'

export const dynamic = 'force-dynamic'

const DEMO_LABEL = { leadgen: 'Lead generation', quotes: 'Quote follow-up', booking: 'Booking' }

export default async function AdminPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: me } = await supabase.from('profiles').select('role').eq('user_id', user.id).single()
  if (me?.role !== 'admin') redirect('/dashboard')

  const [{ data: profiles }, { data: clients }] = await Promise.all([
    supabase.from('profiles').select('user_id, email, role, client_id, created_at').order('created_at'),
    supabase.from('clients').select('id, name, slug, is_demo, demo_kind').order('is_demo').order('name'),
  ])

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">KS</span>
          <span className="brand-name">KS Tech Leads</span>
        </div>
        <div className="topbar-right">
          <Link href="/dashboard" className="btn btn-ghost">Dashboard</Link>
          <form action={signOut}>
            <button className="btn btn-ghost" type="submit">Sign out</button>
          </form>
        </div>
      </header>

      <main className="content admin">
        <section className="panel">
          <h2>Users</h2>
          <p className="muted">
            Create logins in Supabase (Authentication, Users, Add user). They appear here; then link each one to a company.
          </p>
          {(profiles || []).length === 0 ? (
            <p className="empty">No users yet.</p>
          ) : (
            <ul className="user-list">
              {profiles.map((p) => (
                <li key={p.user_id}>
                  <form action={updateProfile} className="user-row">
                    <input type="hidden" name="user_id" value={p.user_id} />
                    <span className="biz">{p.email}</span>
                    <select name="role" defaultValue={p.role} aria-label={`Role for ${p.email}`}>
                      <option value="client">Client</option>
                      <option value="admin">Admin</option>
                    </select>
                    <select name="client_id" defaultValue={p.client_id || ''} aria-label={`Company for ${p.email}`}>
                      <option value="">No company</option>
                      {(clients || []).map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <button className="btn btn-primary" type="submit">Save</button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel">
          <h2>Companies</h2>
          <ul className="plain-list">
            {(clients || []).map((c) => (
              <li key={c.id}>
                <Link href={`/dashboard?client=${c.slug}`}>
                  {c.is_demo ? `Demo: ${DEMO_LABEL[c.demo_kind] || 'Lead generation'}` : c.name}
                </Link>
                {c.is_demo && <span className="sub"> ({c.name.replace(' (Demo)', '')})</span>}
              </li>
            ))}
          </ul>
          <form action={addClient} className="user-row">
            <input name="name" placeholder="Company name" required aria-label="Company name" />
            <input name="slug" placeholder="short-id e.g. al-noor" required aria-label="Short id" />
            <button className="btn btn-primary" type="submit">Add company</button>
          </form>
        </section>
      </main>
    </div>
  )
}
