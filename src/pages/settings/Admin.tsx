import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, Plus, Trash2, X } from 'lucide-react'
import { Avatar, Modal, SettingsRow, TeamAvatar, Toggle, initials } from '../../components/ui'
import { ApiKeysSection, PageHeader } from './Personal'
import { newId, useStore } from '../../data/store'
import type { Role } from '../../data/types'

/* ---------- Workspace ---------- */

export function WorkspaceSettings() {
  const { db, setDb, workspace, isAdmin, updateWorkspace, deleteWorkspace, toast } = useStore()
  const navigate = useNavigate()
  const ws = workspace!
  const [name, setName] = useState(ws.name)
  const [slug, setSlug] = useState(ws.slug)
  const [confirm, setConfirm] = useState(false)
  const [typed, setTyped] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const dirty = name !== ws.name || slug !== ws.slug
  // The logo isn't on the backend yet: it stays in this browser.
  const setLogo = (logo: string) => setDb((d) => ({ ...d, workspaces: d.workspaces.map((w) => (w.id === ws.id ? { ...w, logo } : w)) }))

  return (
    <div className="settings-page">
      <PageHeader title="Workspace" desc={isAdmin ? 'Manage your workspace settings.' : 'Only workspace Admins can change these settings.'} />
      <div className="row" style={{ gap: 16, marginBottom: 24 }}>
        {ws.logo ? (
          <img src={ws.logo} alt="" style={{ width: 64, height: 64, borderRadius: 12, objectFit: 'cover' }} />
        ) : (
          <span className="avatar square" style={{ width: 64, height: 64, background: ws.color, fontSize: 24, borderRadius: 12 }}>{initials(ws.name)}</span>
        )}
        {isAdmin && <button className="btn sm" onClick={() => fileRef.current?.click()}>Upload logo</button>}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (!f) return
            const r = new FileReader()
            r.onload = () => setLogo(String(r.result))
            r.readAsDataURL(f)
          }}
        />
      </div>
      <form
        style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
        onSubmit={async (e) => {
          e.preventDefault()
          if (!name.trim() || !slug.trim()) return
          if (await updateWorkspace({ name: name.trim(), slug: slug.trim() })) toast('Workspace updated')
        }}
      >
        <label className="field">
          <span>Workspace name</span>
          <input className="input" readOnly={!isAdmin} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">
          <span>Workspace URL (changing it changes every link into the workspace)</span>
          <div className="row" style={{ gap: 0 }}>
            <span className="input" style={{ width: 'auto', borderRight: 0, borderRadius: '6px 0 0 6px', display: 'flex', alignItems: 'center', color: 'var(--text-tertiary)' }}>/w/</span>
            <input className="input mono" readOnly={!isAdmin} style={{ borderRadius: '0 6px 6px 0' }} value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} />
          </div>
        </label>
        {isAdmin && (
          <div>
            <button className="btn primary" type="submit" disabled={!dirty}>Save</button>
          </div>
        )}
      </form>

      {isAdmin && (
        <section className="settings-section">
          <h3 className="danger-text">Danger zone</h3>
          <div className="card danger-zone" style={{ padding: '0 16px' }}>
            <SettingsRow title="Delete workspace" desc="Permanently delete this workspace, its teams and all their issues. Members keep their accounts.">
              <button className="btn sm danger-outline" onClick={() => setConfirm(true)}>
                <Trash2 size={14} /> Delete workspace
              </button>
            </SettingsRow>
          </div>
        </section>
      )}

      {confirm && (
        <Modal onClose={() => setConfirm(false)} width={440}>
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h2 className="title-md">Delete {ws.name}?</h2>
            <p className="muted" style={{ margin: 0 }}>
              Its {db.teams.length} team{db.teams.length === 1 ? '' : 's'} and {db.issues.length} issue{db.issues.length === 1 ? '' : 's'} are deleted too. This can’t be undone. Type <b>{ws.slug}</b> to confirm.
            </p>
            <input className="input mono" autoFocus value={typed} onChange={(e) => setTyped(e.target.value)} />
          </div>
          <div className="modal-footer">
            <button className="btn" onClick={() => setConfirm(false)}>Cancel</button>
            <button
              className="btn danger"
              disabled={typed !== ws.slug}
              onClick={async () => {
                setConfirm(false)
                setTyped('')
                if (await deleteWorkspace()) navigate('/', { replace: true })
              }}
            >
              Delete workspace
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

/* ---------- Teams ---------- */

export function TeamsSettings() {
  const { db, isAdmin } = useStore()
  const navigate = useNavigate()
  return (
    <div className="settings-page">
      <div className="row" style={{ marginBottom: 32, alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <h1 className="title-lg">Teams</h1>
          <p className="muted" style={{ margin: '4px 0 0' }}>Every team in this workspace. Everyone in the workspace can work in all of them.</p>
        </div>
        {isAdmin && (
          <button className="btn primary sm" onClick={() => navigate('/settings/new-team')}>
            <Plus size={14} /> Create team
          </button>
        )}
      </div>
      <div className="card">
        <table className="table">
          <thead>
            <tr><th>Name</th><th>Key</th><th>Issues</th><th>Projects</th><th>Sprints</th></tr>
          </thead>
          <tbody>
            {db.teams.map((t) => (
              <tr key={t.id} className="clickable" onClick={() => navigate(`/settings/teams/${t.key}`)}>
                <td>
                  <span className="row">
                    <TeamAvatar team={t} size={20} /> <span style={{ fontWeight: 500 }}>{t.name}</span>
                    {t.isArchived && <span className="badge-pill">Archived</span>}
                  </span>
                </td>
                <td className="mono muted">{t.key}</td>
                <td className="muted">{t.issueCount}</td>
                <td className="muted">{db.projects.filter((p) => p.teamId === t.id).length}</td>
                <td className="muted">{db.sprints.filter((s) => s.teamId === t.id).length}</td>
              </tr>
            ))}
            {db.teams.length === 0 && (
              <tr><td colSpan={5} className="muted">No teams yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ---------- Members ---------- */

export function MembersSettings() {
  const { db, me, isAdmin, workspace, addMember, setMemberRole, removeMember } = useStore()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [who, setWho] = useState('')
  const [role, setRole] = useState<Role>('Member')
  const [adding, setAdding] = useState(false)
  const q = query.toLowerCase()
  const users = db.users.filter((u) => !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.username.toLowerCase().includes(q))
  const adminCount = db.users.filter((u) => u.role === 'Admin').length

  return (
    <div className="settings-page" style={{ maxWidth: 760 }}>
      <PageHeader title="Members" desc={`Everyone in ${workspace!.name}. Admins add people, set roles and manage teams; Members do everything else.`} />
      {isAdmin && (
        <form
          className="card card-pad row"
          style={{ marginBottom: 16, gap: 8 }}
          onSubmit={async (e) => {
            e.preventDefault()
            if (!who.trim() || adding) return
            setAdding(true)
            if (await addMember(who.trim(), role)) setWho('')
            setAdding(false)
          }}
        >
          <input className="input" placeholder="Add someone by username or email" value={who} onChange={(e) => setWho(e.target.value)} aria-label="Username or email" />
          <select className="select" style={{ width: 110 }} value={role} onChange={(e) => setRole(e.target.value as Role)} aria-label="Role for new member">
            <option>Member</option>
            <option>Admin</option>
          </select>
          <button className="btn primary" type="submit" disabled={!who.trim() || adding}>Add</button>
        </form>
      )}
      <div className="row" style={{ margin: '0 0 8px' }}>
        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, flex: 1 }}>{db.users.length} members</h3>
        <input className="input" style={{ width: 220, height: 28 }} placeholder="Search members" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <div className="card">
        <table className="table">
          <thead>
            <tr><th>Name</th><th>Username</th><th>Email</th><th>Role</th><th /></tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const lastAdmin = u.role === 'Admin' && adminCount === 1
              const self = u.id === me.id
              return (
                <tr key={u.id}>
                  <td>
                    <span className="row">
                      <Avatar user={u} size={24} /> <span style={{ fontWeight: 500 }}>{u.name}</span>
                      {self && <span className="faint">(you)</span>}
                    </span>
                  </td>
                  <td className="muted mono">{u.username}</td>
                  <td className="muted">{u.email}</td>
                  <td>
                    <select
                      className="select"
                      style={{ height: 28, width: 110 }}
                      value={u.role}
                      disabled={!isAdmin || lastAdmin}
                      title={lastAdmin ? 'The workspace needs at least one Admin' : !isAdmin ? 'Only workspace Admins can change roles' : undefined}
                      onChange={(e) => setMemberRole(u.id, e.target.value as Role)}
                      aria-label={`Role for ${u.name}`}
                    >
                      <option>Admin</option>
                      <option>Member</option>
                    </select>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {(isAdmin || self) && (
                      <button
                        className="icon-btn"
                        aria-label={self ? 'Leave workspace' : `Remove ${u.name}`}
                        title={lastAdmin ? 'The workspace needs at least one Admin' : self ? 'Leave workspace' : 'Remove from workspace'}
                        disabled={lastAdmin}
                        onClick={async () => {
                          if ((await removeMember(u.id)) && self) navigate('/', { replace: true })
                        }}
                      >
                        {self ? <LogOut size={14} /> : <X size={14} />}
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ---------- Security ---------- */

export function SecuritySettings() {
  const { db, setDb, toast } = useStore()
  const sec = db.security
  const [domain, setDomain] = useState('')
  const set = (patch: Partial<typeof sec>) => setDb((d) => ({ ...d, security: { ...d.security, ...patch } }))
  const validDomain = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(domain.trim())

  return (
    <div className="settings-page">
      <PageHeader title="Security" desc="Control who can join the workspace and how they sign in." />
      <section className="settings-section" style={{ marginTop: 0 }}>
        <h3>Allowed email domains</h3>
        <p className="muted" style={{ margin: '0 0 8px' }}>Anyone with a verified email on these domains can join without an invite.</p>
        <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
            {sec.allowedDomains.length === 0 && <span className="faint">No domains yet.</span>}
            {sec.allowedDomains.map((d) => (
              <span key={d} className="chip" style={{ paddingRight: 2 }}>
                {d}
                <button className="icon-btn" style={{ width: 18, height: 18 }} aria-label={`Remove ${d}`} onClick={() => set({ allowedDomains: sec.allowedDomains.filter((x) => x !== d) })}>
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault()
              const d = domain.trim().toLowerCase()
              if (!validDomain || sec.allowedDomains.includes(d)) return
              set({ allowedDomains: [...sec.allowedDomains, d] })
              setDomain('')
            }}
          >
            <input className="input" placeholder="company.com" value={domain} onChange={(e) => setDomain(e.target.value)} />
            <button className="btn" type="submit" disabled={!validDomain}>Add domain</button>
          </form>
          {domain && !validDomain && <span className="danger-text label">Enter a domain like company.com</span>}
        </div>
      </section>
      <section className="settings-section">
        <h3>Authentication</h3>
        <div className="card" style={{ padding: '0 16px' }}>
          <SettingsRow title="SAML single sign-on" desc="Require members to sign in through your identity provider.">
            <Toggle
              on={sec.ssoEnabled}
              label="SAML SSO"
              onChange={(v) => {
                set({ ssoEnabled: v })
                toast(v ? 'SSO enabled' : 'SSO disabled')
              }}
            />
          </SettingsRow>
          <SettingsRow title="Invite permissions" desc="Who can invite new members to the workspace.">
            <select className="select" style={{ width: 180 }} value={sec.invitePermission} onChange={(e) => set({ invitePermission: e.target.value as typeof sec.invitePermission })}>
              <option value="admins">Admins only</option>
              <option value="members">All members</option>
            </select>
          </SettingsRow>
        </div>
      </section>
    </div>
  )
}

/* ---------- API ---------- */

export function ApiSettings() {
  const { db, setDb, toast } = useStore()
  const [adding, setAdding] = useState(false)
  const [url, setUrl] = useState('')
  const validUrl = /^https:\/\/\S+\.\S+/.test(url)

  return (
    <div className="settings-page">
      <PageHeader title="API" desc="Build on top of the workspace with API keys and webhooks." />
      <ApiKeysSection />
      <section className="settings-section">
        <div className="row" style={{ marginBottom: 8 }}>
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, flex: 1 }}>Webhooks</h3>
          <button className="btn sm" onClick={() => setAdding(true)}>New webhook</button>
        </div>
        <div className="card">
          {adding && (
            <form
              className="row card-pad"
              style={{ borderBottom: '1px solid var(--border-subtle)' }}
              onSubmit={(e) => {
                e.preventDefault()
                if (!validUrl) return
                setDb((d) => ({ ...d, webhooks: [...d.webhooks, { id: newId('w'), url, events: ['Issue'], enabled: true }] }))
                setUrl('')
                setAdding(false)
                toast('Webhook created')
              }}
            >
              <input className="input" autoFocus placeholder="https://example.com/webhook" value={url} onChange={(e) => setUrl(e.target.value)} />
              <button className="btn primary" type="submit" disabled={!validUrl}>Create</button>
              <button className="btn ghost" type="button" onClick={() => setAdding(false)}>Cancel</button>
            </form>
          )}
          {db.webhooks.length === 0 && !adding && <div className="card-pad muted">No webhooks yet.</div>}
          {db.webhooks.length > 0 && (
            <table className="table">
              <thead>
                <tr><th>URL</th><th>Events</th><th>Enabled</th><th /></tr>
              </thead>
              <tbody>
                {db.webhooks.map((w) => (
                  <tr key={w.id}>
                    <td className="mono" style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.url}</td>
                    <td className="muted">{w.events.join(', ')}</td>
                    <td>
                      <Toggle on={w.enabled} label="Enabled" onChange={(v) => setDb((d) => ({ ...d, webhooks: d.webhooks.map((x) => (x.id === w.id ? { ...x, enabled: v } : x)) }))} />
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="icon-btn" aria-label="Delete webhook" onClick={() => setDb((d) => ({ ...d, webhooks: d.webhooks.filter((x) => x.id !== w.id) }))}>
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  )
}
