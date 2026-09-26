'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'

function AccountForm() {
  const router = useRouter()
  const params = useSearchParams()
  const fromReset = params.get('reset') === '1'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (!data?.user) router.replace('/login')
      else setEmail(data.user.email || '')
    })
  }, [router])

  async function save(e) {
    e.preventDefault()
    setError('')
    if (password.length < 8) { setError('Use at least 8 characters.'); return }
    if (password !== confirm) { setError('The two passwords do not match.'); return }
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) {
      setError(error.message?.includes('different')
        ? 'The new password must be different from the old one.'
        : 'Could not change the password. Sign in again and retry.')
      return
    }
    setDone(true)
    setPassword('')
    setConfirm('')
  }

  return (
    <main className="login">
      <div className="login-card">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">KS</span>
          <span className="brand-name">KS Tech Leads</span>
        </div>
        <h1>{fromReset ? 'Set a new password' : 'Change password'}</h1>
        {email && <p className="muted">Signed in as {email}</p>}

        {done ? (
          <>
            <p className="ok" role="status">Password changed. Use it next time you sign in.</p>
            <Link href="/dashboard" className="btn btn-primary">Go to dashboard</Link>
          </>
        ) : (
          <form onSubmit={save} className="login-form">
            <label>
              New password
              <input type="password" autoComplete="new-password" required minLength={8}
                value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
            <label>
              Type it again
              <input type="password" autoComplete="new-password" required minLength={8}
                value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </label>
            {error && <p className="error" role="alert">{error}</p>}
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : 'Save new password'}
            </button>
          </form>
        )}
        {!done && <p className="fine"><Link href="/dashboard">Back to dashboard</Link></p>}
      </div>
    </main>
  )
}

export default function AccountPage() {
  return (
    <Suspense fallback={null}>
      <AccountForm />
    </Suspense>
  )
}
