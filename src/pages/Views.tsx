import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Filter, Globe, Lock, Save, Trash2 } from 'lucide-react'
import { IssueListView, TeamCrumb, useRouteTeam } from './IssueList'
import { Avatar, Modal, Toggle } from '../components/ui'
import { useStore } from '../data/store'
import type { Filters, View } from '../data/types'

/** "Status: 2 · Priority: 1": what a view filters on, in a few words. */
function filterSummary(f: Filters) {
  const parts = [
    f.status.length && `Status ${f.status.length}`,
    f.priority.length && `Priority ${f.priority.length}`,
    f.type.length && `Type ${f.type.length}`,
    f.assignee.length && `Assignee ${f.assignee.length}`,
    f.project.length && `Project ${f.project.length}`,
    f.label.length && `Labels ${f.label.length}`,
  ].filter(Boolean)
  return parts.length ? parts.join(' · ') : 'No filters: every issue'
}

const sameFilters = (a: Filters, b: Filters) => {
  const norm = (f: Filters) => JSON.stringify(Object.entries(f).map(([k, v]) => [k, [...v].map(String).sort()]))
  return norm(a) === norm(b)
}

/** A team's saved views: mine, plus everyone's shared ones. */
export default function TeamViews() {
  const { db, me, user } = useStore()
  const team = useRouteTeam()
  if (!team) return <div className="empty-state">Team not found.</div>
  const views = db.views.filter((v) => v.teamId === team.id).sort((a, b) => a.name.localeCompare(b.name))
  const row = (v: View) => (
    <Link key={v.id} to={`/team/${team.key}/views/${v.id}`} className="issue-row" style={{ height: 48, gap: 12, padding: '0 24px' }}>
      <Filter size={16} className="faint" />
      <span style={{ fontWeight: 500, width: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.name}</span>
      <span className="faint" style={{ flex: 1, fontSize: 12 }}>{filterSummary(v.filters)}</span>
      {v.isShared ? <Globe size={14} className="faint" aria-label="Shared" /> : <Lock size={14} className="faint" aria-label="Private" />}
      <Avatar user={user(v.ownerId)} size={18} />
    </Link>
  )
  const mine = views.filter((v) => v.ownerId === me.id)
  const shared = views.filter((v) => v.ownerId !== me.id)

  return (
    <>
      <div className="content-header">
        <div className="breadcrumb">
          <TeamCrumb teamId={team.id}>Views</TeamCrumb>
        </div>
        <span className="spacer" />
        <Link className="btn sm" to={`/team/${team.key}/issues`}>New view from Issues</Link>
      </div>
      <div className="content-main">
        {views.length === 0 && (
          <div className="empty-state">
            <Filter size={32} className="faint" /> No views yet. Filter the team’s issues, then press “Save as view”.
          </div>
        )}
        {mine.length > 0 && <div className="group-header">My views <span className="count">{mine.length}</span></div>}
        {mine.map(row)}
        {shared.length > 0 && <div className="group-header">Shared with the workspace <span className="count">{shared.length}</span></div>}
        {shared.map(row)}
      </div>
    </>
  )
}

/** One view: the team's issues through its saved filters. The owner can change and share it. */
export function ViewPage() {
  const { viewId } = useParams()
  const { db, me, isAdmin, user, updateView, deleteView } = useStore()
  const navigate = useNavigate()
  const team = useRouteTeam()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const view = db.views.find((v) => v.id === viewId)
  if (!team || !view || view.teamId !== team.id) return <div className="empty-state">View not found.</div>
  const owner = view.ownerId === me.id
  const canDelete = owner || isAdmin

  return (
    <>
      <IssueListView
        // Saving the view replaces its filters, so the list restarts from the saved ones.
        key={`${view.id}-${JSON.stringify(view.filters)}`}
        teamId={team.id}
        initialFilters={view.filters}
        title={
          <TeamCrumb teamId={team.id}>
            <Link to={`/team/${team.key}/views`} className="muted">Views</Link> <span className="sep">›</span> {view.name}
            <span className="faint" style={{ fontWeight: 400 }}>
              {view.isShared ? 'Shared' : 'Private'}{owner ? '' : ` · by ${user(view.ownerId)?.name ?? 'a former member'}`}
            </span>
          </TeamCrumb>
        }
        issues={db.issues.filter((i) => i.teamId === team.id)}
        emptyText={`${team.name} has no issues yet.`}
        headerExtra={(filters) => (
          <>
            {owner && !sameFilters(filters, view.filters) && (
              <button className="btn sm" onClick={() => updateView(view.id, { filters })}>
                <Save size={14} /> Save changes
              </button>
            )}
            {owner && (
              <label className="row muted" style={{ cursor: 'pointer', fontSize: 12 }}>
                <Toggle on={view.isShared} label="Shared" onChange={(v) => updateView(view.id, { isShared: v })} /> Shared
              </label>
            )}
            {canDelete && (
              <button className="btn sm ghost" aria-label="Delete view" onClick={() => setConfirmDelete(true)}>
                <Trash2 size={14} />
              </button>
            )}
          </>
        )}
      />
      {confirmDelete && (
        <Modal onClose={() => setConfirmDelete(false)} width={420}>
          <div style={{ padding: '20px 20px 8px' }}>
            <h2 className="title-md">Delete the view {view.name}?</h2>
            <p className="muted" style={{ margin: '8px 0 12px' }}>Only the saved filter goes; no issue is changed.</p>
          </div>
          <div className="modal-footer">
            <button className="btn" onClick={() => setConfirmDelete(false)}>Cancel</button>
            <button
              className="btn danger"
              onClick={async () => {
                setConfirmDelete(false)
                if (await deleteView(view.id)) navigate(`/team/${team.key}/views`, { replace: true })
              }}
            >
              Delete view
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
