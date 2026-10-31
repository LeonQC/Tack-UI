import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { clearToken } from '../data/api'
import { useStore } from '../data/store'

// Same rule as the backend: 3-32 lowercase letters, digits or dashes, not starting with a dash.
const SLUG_RE = /^[a-z0-9][a-z0-9-]{2,31}$/

/** "Acme Inc." → "acme-inc": a suggestion the user can overwrite. */
const autoSlug = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32)

/**
 * Create a workspace; the creator becomes its Admin. firstOne = the account belongs to no workspace
 * yet, so this is the whole screen (with a way to log out instead).
 */
export function CreateWorkspace({ firstOne = false }: { firstOne?: boolean }) {
  const { createWorkspace } = useStore()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)
  const [saving, setSaving] = useState(false)
  const effectiveSlug = slugEdited ? slug : autoSlug(name)
  const slugError = effectiveSlug && !SLUG_RE.test(effectiveSlug) ? '3–32 lowercase letters, digits or dashes' : null

  const form = (
    <form
      className={firstOne ? 'card' : undefined}
      style={{ width: firstOne ? 380 : undefined, padding: firstOne ? 24 : 0, display: 'flex', flexDirection: 'column', gap: 16, textAlign: 'left' }}
      onSubmit={async (e) => {
        e.preventDefault()
        if (!name.trim() || !effectiveSlug || slugError || saving) return
        setSaving(true)
        const ok = await createWorkspace({ name: name.trim(), slug: effectiveSlug })
        setSaving(false)
        if (ok) navigate('/', { replace: true })
      }}
    >
      <div>
        <h1 className="title-lg" style={{ color: 'var(--text-primary)' }}>{firstOne ? 'Create your workspace' : 'Create a workspace'}</h1>
        <p className="muted" style={{ margin: '4px 0 0' }}>
          A workspace holds your teams, their issues and the people you work with. You’ll be its Admin.
        </p>
      </div>
      <label className="field">
        <span>Workspace name</span>
        <input className="input" autoFocus placeholder="e.g. Acme Inc" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="field">
        <span>Workspace URL</span>
        <div className="row" style={{ gap: 0 }}>
          <span className="input" style={{ width: 'auto', borderRight: 0, borderRadius: '6px 0 0 6px', display: 'flex', alignItems: 'center', color: 'var(--text-tertiary)' }}>/w/</span>
          <input
            className="input mono"
            style={{ borderRadius: '0 6px 6px 0' }}
            value={effectiveSlug}
            onChange={(e) => {
              setSlugEdited(true)
              setSlug(e.target.value.toLowerCase())
            }}
          />
        </div>
        {slugError && <span className="danger-text label">{slugError}</span>}
      </label>
      <button className="btn primary" type="submit" disabled={!name.trim() || !effectiveSlug || !!slugError || saving}>
        {saving ? 'Creating…' : 'Create workspace'}
      </button>
      {firstOne ? (
        <>
          <p className="faint" style={{ margin: 0, fontSize: 12 }}>Joining an existing workspace instead? Ask one of its Admins to add you by your username or email.</p>
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              clearToken()
              navigate('/login', { replace: true })
            }}
          >
            Log out
          </button>
        </>
      ) : (
        <div>
          <button type="button" className="btn ghost" onClick={() => navigate(-1)}>Cancel</button>
        </div>
      )}
    </form>
  )

  return firstOne ? <div className="empty-state" style={{ height: '100%' }}>{form}</div> : <div className="settings-page">{form}</div>
}

/** /w/acme/issue/ENG-12 (the links in notifications): switch to that workspace, then open the rest of the path. */
export function WorkspaceLink() {
  const { slug = '', '*': rest = '' } = useParams()
  const { db, switchWorkspace, toast } = useStore()
  const current = db.workspaces.find((w) => w.id === db.currentWorkspaceId)
  const member = db.workspaces.some((w) => w.slug === slug)
  const [done, setDone] = useState(current?.slug === slug)

  useEffect(() => {
    if (done) return
    if (!member) {
      toast('You’re not a member of that workspace')
      setDone(true)
    } else switchWorkspace(slug).then(() => setDone(true))
  }, [])

  if (!done) return null
  return <Navigate to={member ? `/${rest}` : '/'} replace />
}
