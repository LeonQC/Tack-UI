import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google'
import { googleAuth, type GoogleSignup } from '../data/api'

export default function Login() {
  const navigate = useNavigate()
  // The Google ID token, kept while a new user picks a username: the same token is sent again to create the account.
  const [token, setToken] = useState('')
  const [signup, setSignup] = useState<GoogleSignup | null>(null)
  const [username, setUsername] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function onGoogle(credential: string | undefined) {
    if (!credential) return setError('Google sign-in failed')
    setError('')
    try {
      const needed = await googleAuth(credential)
      if (!needed) return navigate('/', { replace: true })
      // New here: ask for a username before the account exists.
      setToken(credential)
      setSignup(needed)
      setName(needed.name)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await googleAuth(token, { username, ...(name.trim() ? { name: name.trim() } : {}) })
      navigate('/', { replace: true })
    } catch (err) {
      setSubmitting(false)
      // The Google token lasts about an hour; once it's expired, start over with the button.
      if ((err as Error).message === 'Invalid Google token') {
        setSignup(null)
        setError('Google sign-in expired, please sign in again')
      } else setError((err as Error).message)
    }
  }

  return (
    <div className="empty-state" style={{ height: '100%' }}>
      <div
        className="card"
        style={{ width: 320, padding: 24, display: 'flex', flexDirection: 'column', gap: 16, textAlign: 'left' }}
      >
        {signup ? (
          <form onSubmit={onCreate} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h1 className="title-lg" style={{ color: 'var(--text-primary)' }}>Create account</h1>
            <span className="muted">{signup.email}</span>
            <label className="field">
              <span>Username</span>
              <input
                className="input"
                autoFocus
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </label>
            <label className="field">
              <span>Full name</span>
              <input className="input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            {error && <div className="danger-text">{error}</div>}
            <button className="btn primary" type="submit" disabled={submitting || !username.trim()}>
              {submitting ? 'Creating…' : 'Create account'}
            </button>
            <button type="button" className="btn ghost" onClick={() => setSignup(null)}>
              Use a different Google account
            </button>
          </form>
        ) : (
          <>
            <h1 className="title-lg" style={{ color: 'var(--text-primary)' }}>Log in</h1>
            <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
              <GoogleLogin
                onSuccess={(r) => onGoogle(r.credential)}
                onError={() => setError('Google sign-in failed')}
                width={272}
              />
            </GoogleOAuthProvider>
            {error && <div className="danger-text">{error}</div>}
          </>
        )}
      </div>
    </div>
  )
}
