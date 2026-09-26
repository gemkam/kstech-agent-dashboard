'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const [mode, setMode] = useState('signin') // 'signin' | 'forgot'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(params.get('link') === 'expired' ? 'That reset link has expired or was already used. Ask for a new one.' : '')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSignIn(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setLoading(false)
    if (error) {
      setError('Email or password is incorrect. Check both and try again.')
      return
    }
    router.push('/dashboard')
    router.refresh()
  }

  async function handleForgot(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/account?reset=1`,
    })
    setLoading(false)
    if (error && /rate|many/i.test(error.message || '')) {
      setError('Too many requests. Wait a few minutes and try again.')
      return
    }
    // Same message whether or not the email exists, so accounts cannot be guessed
    setSent(true)
  }

  return (
    <main className="login">
      <div className="login-card">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">KS</span>
          <span className="brand-name">KS Tech Leads</span>
        </div>

        {mode === 'signin' ? (
          <>
            <h1>Sign in to your lead dashboard</h1>
            <p className="muted">See the businesses we found for you, what was sent, and who replied.</p>
            <form onSubmit={handleSignIn} className="login-form">
              <label>
                Email
                <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>
              <label>
                Password
                <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              </label>
              {error && <p className="error" role="alert">{error}</p>}
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </form>
            <button type="button" className="link-btn small center-link" onClick={() => { setMode('forgot'); setError(''); setSent(false) }}>
              Forgot password?
            </button>
          </>
        ) : (
          <>
            <h1>Reset your password</h1>
            {sent ? (
              <p className="muted" role="status">
                If {email.trim()} has an account, a reset link is on its way. Open it on this device. Check spam if it does not arrive in a few minutes.
              </p>
            ) : (
              <>
                <p className="muted">Enter your email and we will send you a link to set a new password.</p>
                <form onSubmit={handleForgot} className="login-form">
                  <label>
                    Email
                    <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                  </label>
                  {error && <p className="error" role="alert">{error}</p>}
                  <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? 'Sending...' : 'Send reset link'}
                  </button>
                </form>
              </>
            )}
            <button type="button" className="link-btn small center-link" onClick={() => { setMode('signin'); setError('') }}>
              Back to sign in
            </button>
          </>
        )}
        <p className="fine">No account yet? Contact KS Tech LLC on +968 9731 2049.</p>
      </div>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}
