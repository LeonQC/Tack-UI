import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Box, Pencil, Plus, Trash2 } from 'lucide-react'
import { IssueListView, TeamCrumb, useRouteTeam } from './IssueList'
import { Avatar, Modal, ProjectIcon, shortDate } from '../components/ui'
import { PROJECT_STATUSES, projectStatusMeta } from '../data/meta'
import { toDay, useStore, type ProjectInput } from '../data/store'
import type { Project, ProjectStatus } from '../data/types'

/** <input type="date"> works in local "YYYY-MM-DD"; a project's dates are local midnights. */
const fromInput = (v: string) => {
  if (!v) return null
  const [y, m, d] = v.split('-').map(Number)
  return new Date(y, m - 1, d).getTime()
}

/** Done / total of a project's issues, for its progress bar. */
function useProgress(projectId: string) {
  const { db } = useStore()
  const issues = db.issues.filter((i) => i.projectId === projectId)
  return { total: issues.length, done: issues.filter((i) => i.status === 'done').length }
}

export const projectDates = (p: Project) =>
  p.startDate || p.targetDate ? `${p.startDate ? shortDate(p.startDate) : '…'} → ${p.targetDate ? shortDate(p.targetDate) : '…'}` : 'No dates'

/** Create a project in a team, or edit one. */
export function ProjectModal({ teamId, project, onClose }: { teamId: string; project?: Project; onClose: () => void }) {
  const { db, user, createProject, updateProject } = useStore()
  const navigate = useNavigate()
  const [name, setName] = useState(project?.name ?? '')
  const [description, setDescription] = useState(project?.description ?? '')
  const [status, setStatus] = useState<ProjectStatus>(project?.status ?? 'planned')
  const [leadId, setLeadId] = useState(project?.leadId ?? '')
  const [start, setStart] = useState(toDay(project?.startDate ?? null) ?? '')
  const [target, setTarget] = useState(toDay(project?.targetDate ?? null) ?? '')
  const [saving, setSaving] = useState(false)
  const badDates = !!start && !!target && target < start

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || badDates || saving) return
    setSaving(true)
    const input: ProjectInput = { name: name.trim(), description, status, leadId: leadId || null, startDate: fromInput(start), targetDate: fromInput(target) }
    if (project) {
      const ok = await updateProject(project.id, input)
      setSaving(false)
      if (ok) onClose()
    } else {
      const p = await createProject(teamId, input)
      setSaving(false)
      if (p) navigate(`/team/${db.teams.find((t) => t.id === teamId)!.key}/projects/${p.id}`)
    }
  }

  return (
    <Modal onClose={onClose} width={520}>
      <form onSubmit={submit}>
        <div style={{ padding: '20px 20px 8px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h2 className="title-md">{project ? 'Edit project' : 'New project'}</h2>
          <label className="field">
            <span>Name</span>
            <input className="input" autoFocus maxLength={255} placeholder="e.g. Dark mode" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="field">
            <span>Description</span>
            <textarea className="textarea" rows={3} placeholder="What does this feature deliver?" value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <div className="row" style={{ gap: 12 }}>
            <label className="field" style={{ flex: 1 }}>
              <span>Status</span>
              <select className="select" value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)}>
                {PROJECT_STATUSES.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </label>
            <label className="field" style={{ flex: 1 }}>
              <span>Lead</span>
              <select className="select" value={leadId} onChange={(e) => setLeadId(e.target.value)}>
                <option value="">No lead</option>
                {db.users.map((u) => (
                  <option key={u.id} value={u.id}>{user(u.id)?.name}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="row" style={{ gap: 12 }}>
            <label className="field" style={{ flex: 1 }}>
              <span>Start date</span>
              <input className="input" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </label>
            <label className="field" style={{ flex: 1 }}>
              <span>Target date</span>
              <input className="input" type="date" value={target} onChange={(e) => setTarget(e.target.value)} />
            </label>
          </div>
          {badDates && <span className="danger-text label">The target date can’t be before the start date.</span>}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary" disabled={!name.trim() || badDates || saving}>{project ? 'Save' : 'Create project'}</button>
        </div>
      </form>
    </Modal>
  )
}

function ProjectRow({ project, teamKey }: { project: Project; teamKey: string }) {
  const { user } = useStore()
  const { total, done } = useProgress(project.id)
  const meta = projectStatusMeta(project.status)
  return (
    <Link to={`/team/${teamKey}/projects/${project.id}`} className="issue-row" style={{ height: 52, gap: 14, padding: '0 24px' }}>
      <ProjectIcon status={project.status} size={16} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{project.name}</div>
        {project.description && <div className="faint" style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{project.description}</div>}
      </div>
      <span className="chip">
        <span className="dot" style={{ background: meta.color }} /> {meta.name}
      </span>
      <Avatar user={user(project.leadId)} size={18} />
      <span className="faint" style={{ width: 130, fontSize: 12, textAlign: 'right' }}>{projectDates(project)}</span>
      <div style={{ width: 140 }}>
        <div className="progress" title={`${done} of ${total} issues done`}>
          {done > 0 && <div style={{ width: `${(done / Math.max(1, total)) * 100}%`, background: 'var(--accent)' }} />}
        </div>
      </div>
      <span className="muted" style={{ width: 56, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{done} / {total}</span>
    </Link>
  )
}

/** A team's projects (its features / epics), each with the progress of its issues. */
export default function TeamProjects() {
  const { db } = useStore()
  const team = useRouteTeam()
  const [creating, setCreating] = useState(false)
  if (!team) return <div className="empty-state">Team not found.</div>
  // In progress first, then planned, paused, completed, canceled; soonest target date first within each.
  const order: Record<ProjectStatus, number> = { in_progress: 0, planned: 1, paused: 2, completed: 3, canceled: 4 }
  const projects = db.projects
    .filter((p) => p.teamId === team.id)
    .sort((a, b) => order[a.status] - order[b.status] || (a.targetDate ?? Infinity) - (b.targetDate ?? Infinity))

  return (
    <>
      <div className="content-header">
        <div className="breadcrumb">
          <TeamCrumb teamId={team.id}>Projects</TeamCrumb>
        </div>
        <span className="spacer" />
        <button className="btn sm" onClick={() => setCreating(true)}>
          <Plus size={14} /> New project
        </button>
      </div>
      <div className="content-main">
        {projects.length === 0 && (
          <div className="empty-state">
            <Box size={32} className="faint" /> No projects yet. A project groups the issues of one feature, with a lead and a target date.
          </div>
        )}
        {projects.map((p) => (
          <ProjectRow key={p.id} project={p} teamKey={team.key} />
        ))}
      </div>
      {creating && <ProjectModal teamId={team.id} onClose={() => setCreating(false)} />}
    </>
  )
}

/** One project: its issues, with buttons to edit or delete it. */
export function ProjectPage() {
  const { projectId } = useParams()
  const { db, me, isAdmin, user, project: getProject, deleteProject } = useStore()
  const navigate = useNavigate()
  const team = useRouteTeam()
  const [dialog, setDialog] = useState<'edit' | 'delete' | null>(null)
  const project = getProject(projectId ?? null)
  if (!team || !project || project.teamId !== team.id) return <div className="empty-state">Project not found.</div>
  const meta = projectStatusMeta(project.status)
  const lead = user(project.leadId)
  // Same rule as the backend: the lead or an Admin may delete a project.
  const canDelete = isAdmin || project.leadId === me.id

  return (
    <>
      <IssueListView
        key={project.id}
        teamId={team.id}
        projectId={project.id}
        title={
          <TeamCrumb teamId={team.id}>
            <Link to={`/team/${team.key}/projects`} className="muted">Projects</Link> <span className="sep">›</span>
            <ProjectIcon status={project.status} /> {project.name}
            <span className="faint" style={{ fontWeight: 400 }}>
              {meta.name} · {projectDates(project)}{lead ? ` · Lead: ${lead.name}` : ''}
            </span>
          </TeamCrumb>
        }
        issues={db.issues.filter((i) => i.projectId === project.id)}
        emptyText="No issues in this project yet. Add one, or set the Project field of an existing issue."
        headerExtra={() => (
          <>
            <button className="btn sm ghost" onClick={() => setDialog('edit')}>
              <Pencil size={14} /> Edit
            </button>
            {canDelete && (
              <button className="btn sm ghost" aria-label="Delete project" onClick={() => setDialog('delete')}>
                <Trash2 size={14} />
              </button>
            )}
          </>
        )}
      />
      {dialog === 'edit' && <ProjectModal teamId={team.id} project={project} onClose={() => setDialog(null)} />}
      {dialog === 'delete' && (
        <Modal onClose={() => setDialog(null)} width={420}>
          <div style={{ padding: '20px 20px 8px' }}>
            <h2 className="title-md">Delete {project.name}?</h2>
            <p className="muted" style={{ margin: '8px 0 12px' }}>Its issues aren’t deleted; they just won’t belong to a project anymore.</p>
          </div>
          <div className="modal-footer">
            <button className="btn" onClick={() => setDialog(null)}>Cancel</button>
            <button
              className="btn danger"
              onClick={async () => {
                setDialog(null)
                if (await deleteProject(project.id)) navigate(`/team/${team.key}/projects`, { replace: true })
              }}
            >
              Delete project
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
