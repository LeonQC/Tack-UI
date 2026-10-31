import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import { Modal, SettingsRow, TeamAvatar, Toggle } from '../../components/ui'
import { PageHeader } from './Personal'
import { COLORS } from '../../data/meta'
import { useStore } from '../../data/store'
import type { Team } from '../../data/types'

// Same rule as the backend: 2-10 capital letters or digits, starting with a letter.
const KEY_RE = /^[A-Z][A-Z0-9]{1,9}$/

export function TeamSettings() {
  const { teamKey } = useParams()
  const { teamByKey } = useStore()
  const team = teamByKey(teamKey ?? '')
  if (!team) return <div className="empty-state">Team not found.</div>
  return <TeamSettingsForm key={team.id} team={team} />
}

function TeamSettingsForm({ team }: { team: Team }) {
  const { db, isAdmin, updateTeam, deleteTeam, toast } = useStore()
  const navigate = useNavigate()
  const [name, setName] = useState(team.name)
  const [description, setDescription] = useState(team.description)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [typed, setTyped] = useState('')
  const dirty = name !== team.name || description !== team.description
  const projects = db.projects.filter((p) => p.teamId === team.id).length
  const sprints = db.sprints.filter((s) => s.teamId === team.id).length

  return (
    <div className="settings-page">
      <div className="row" style={{ gap: 12, marginBottom: 32 }}>
        <TeamAvatar team={team} size={32} />
        <div>
          <h1 className="title-lg">{team.name}</h1>
          <p className="muted" style={{ margin: 0 }}>Team settings{!isAdmin && ' · only workspace Admins can change them'}</p>
        </div>
      </div>

      <form
        style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
        onSubmit={async (e) => {
          e.preventDefault()
          if (!name.trim()) return
          if (await updateTeam(team.id, { name: name.trim(), description })) toast('Team updated')
        }}
      >
        <label className="field">
          <span>Name</span>
          <input className="input" value={name} readOnly={!isAdmin} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">
          <span>Key — the prefix of every issue key ({team.key}-123). Fixed once the team exists.</span>
          <input className="input mono" value={team.key} readOnly />
        </label>
        <label className="field">
          <span>Description</span>
          <textarea className="textarea" rows={3} readOnly={!isAdmin} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        {isAdmin && (
          <div>
            <button className="btn primary" type="submit" disabled={!dirty || !name.trim()}>Save</button>
          </div>
        )}
      </form>

      <p className="faint" style={{ marginTop: 24, fontSize: 12 }}>
        Every member of the workspace works in every team; roles are set on the Members page.
      </p>

      {isAdmin && (
        <>
          <section className="settings-section">
            <h3>Archive</h3>
            <div className="card" style={{ padding: '0 16px' }}>
              <SettingsRow title="Archived" desc="Archived teams stay readable but don’t take new issues from the New issue dialog.">
                <Toggle on={team.isArchived} label="Archived" onChange={(v) => updateTeam(team.id, { isArchived: v })} />
              </SettingsRow>
            </div>
          </section>

          <section className="settings-section">
            <h3 className="danger-text">Danger zone</h3>
            <div className="card danger-zone" style={{ padding: '0 16px' }}>
              <SettingsRow title="Delete team" desc="Deletes the team with all its issues, comments, sprints, projects and views. This can’t be undone.">
                <button className="btn sm danger-outline" onClick={() => setConfirmDelete(true)}>
                  <Trash2 size={14} /> Delete team
                </button>
              </SettingsRow>
            </div>
          </section>
        </>
      )}

      {confirmDelete && (
        <Modal onClose={() => setConfirmDelete(false)} width={440}>
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h2 className="title-md">Delete {team.name}?</h2>
            <p className="muted" style={{ margin: 0 }}>
              Its {team.issueCount} issue{team.issueCount === 1 ? '' : 's'}, {projects} project{projects === 1 ? '' : 's'} and {sprints} sprint{sprints === 1 ? '' : 's'} are deleted too. Type <b>{team.key}</b> to confirm.
            </p>
            <input className="input mono" autoFocus value={typed} onChange={(e) => setTyped(e.target.value.toUpperCase())} />
          </div>
          <div className="modal-footer">
            <button className="btn" onClick={() => setConfirmDelete(false)}>Cancel</button>
            <button
              className="btn danger"
              disabled={typed !== team.key}
              onClick={async () => {
                setConfirmDelete(false)
                if (await deleteTeam(team.id)) navigate('/settings/teams', { replace: true })
              }}
            >
              Delete team
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

/** "Platform Engineering" → "PE", "Design" → "DES": a suggestion the user can overwrite. */
const autoKey = (name: string) => {
  const words = name.toUpperCase().replace(/[^A-Z0-9 ]/g, '').split(/\s+/).filter(Boolean)
  const key = words.length > 1 ? words.map((w) => w[0]).join('') : (words[0] ?? '').slice(0, 3)
  return key.replace(/^[0-9]+/, '').slice(0, 10)
}

export function CreateTeam() {
  const { db, isAdmin, createTeam } = useStore()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [key, setKey] = useState('')
  const [keyEdited, setKeyEdited] = useState(false)
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const effectiveKey = keyEdited ? key : autoKey(name)
  const keyError = !effectiveKey ? null : !KEY_RE.test(effectiveKey) ? '2–10 capital letters or digits, starting with a letter' : db.teams.some((t) => t.key === effectiveKey) ? 'Key already in use' : null

  if (!isAdmin)
    return (
      <div className="settings-page">
        <PageHeader title="Create a team" desc="Only workspace Admins can create teams. Ask an Admin to create one." />
      </div>
    )

  return (
    <div className="settings-page">
      <PageHeader title="Create a team" desc="A team owns its issues, sprints, projects and views. Everyone in the workspace can work in it." />
      <form
        style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
        onSubmit={async (e) => {
          e.preventDefault()
          if (!name.trim() || !effectiveKey || keyError || saving) return
          setSaving(true)
          const t = await createTeam({ name: name.trim(), key: effectiveKey, description })
          setSaving(false)
          if (t) navigate(`/team/${t.key}/backlog`)
        }}
      >
        <div className="row" style={{ gap: 12 }}>
          <TeamAvatar team={{ name: name || '?', color: COLORS[(db.teams.length + 1) % COLORS.length] }} size={32} />
          <label className="field" style={{ flex: 1 }}>
            <span>Team name</span>
            <input className="input" autoFocus placeholder="e.g. Engineering" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
        </div>
        <label className="field">
          <span>Key — the prefix of every issue key ({effectiveKey || 'ENG'}-123); it can’t change later</span>
          <input
            className="input mono"
            value={effectiveKey}
            onChange={(e) => {
              setKeyEdited(true)
              setKey(e.target.value.toUpperCase())
            }}
          />
          {keyError && <span className="danger-text label">{keyError}</span>}
        </label>
        <label className="field">
          <span>Description</span>
          <textarea className="textarea" rows={3} placeholder="What does this team work on?" value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <div className="row">
          <button className="btn primary" type="submit" disabled={!name.trim() || !effectiveKey || !!keyError || saving}>Create team</button>
          <button className="btn ghost" type="button" onClick={() => navigate(-1)}>Cancel</button>
        </div>
      </form>
    </div>
  )
}
