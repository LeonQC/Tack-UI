import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Box, Filter, LayoutList, Plus, Save, SlidersHorizontal, Sparkles, Trash2, X } from 'lucide-react'
import { Menu, type MenuEntry } from '../components/Menu'
import { IssueRow } from '../components/IssueRow'
import { LabelDot, allLabels } from '../components/labels'
import { projectEntries, sprintEntries } from '../components/IssueContextMenu'
import { Avatar, IssueTypeIcon, Modal, PriorityIcon, ProjectIcon, StatusIcon, TeamAvatar, Toggle } from '../components/ui'
import { SummaryPanel } from './Summary'
import { ISSUE_TYPES, PRIORITIES, STATUSES, priorityName, statusMeta, typeMeta } from '../data/meta'
import { NO_FILTERS, useStore, useUi } from '../data/store'
import { getIssues } from '../data/api'
import type { Filters, Issue, Status } from '../data/types'

type GroupBy = 'status' | 'priority' | 'type' | 'assignee' | 'project' | 'none'
type OrderBy = 'priority' | 'created' | 'updated'

const TABS = [
  { id: 'all', label: 'All issues', match: () => true },
  { id: 'open', label: 'Open', match: (i: Issue) => i.status !== 'done' },
  { id: 'backlog', label: 'Backlog', match: (i: Issue) => i.sprintId === null && i.status !== 'done' },
  { id: 'done', label: 'Done', match: (i: Issue) => i.status === 'done' },
]

const toggle = <T,>(xs: T[], x: T) => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x])

export const filterCount = (f: Filters) => f.status.length + f.priority.length + f.type.length + f.assignee.length + f.project.length + f.label.length

/** Does the issue pass the filters? The same rules a saved view uses. */
export const matchesFilters = (i: Issue, f: Filters) =>
  (!f.status.length || f.status.includes(i.status)) &&
  (!f.priority.length || f.priority.includes(i.priority)) &&
  (!f.type.length || f.type.includes(i.type)) &&
  (!f.assignee.length || f.assignee.includes(i.assigneeId)) &&
  (!f.project.length || f.project.includes(i.projectId)) &&
  // Labels match ignoring case, so a "Bug" filter also finds issues labeled "bug".
  (!f.label.length || i.labels.some((l) => f.label.some((x) => x.toLowerCase() === l.toLowerCase())))

/**
 * Shared list view used by a team's Issues tab, a sprint, a project, a saved view, and My issues.
 * headerExtra replaces the "Save as view" button (a view's page puts its own buttons there).
 */
export function IssueListView({ title, issues, teamId, projectId, emptyText, initialFilters = NO_FILTERS, headerExtra }: {
  title: ReactNode
  issues: Issue[]
  teamId?: string
  /** On a project's page: new issues go into it. */
  projectId?: string
  emptyText: string
  initialFilters?: Filters
  headerExtra?: (filters: Filters) => ReactNode
}) {
  const { db, user, project, bulkUpdate, bulkDelete } = useStore()
  const ui = useUi()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') ?? 'all'
  const [groupBy, setGroupBy] = useState<GroupBy>('status')
  const [orderBy, setOrderBy] = useState<OrderBy>('priority')
  const [filters, setFilters] = useState<Filters>(initialFilters)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)
  const [savingView, setSavingView] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [menu, setMenu] = useState<{ x: number; y: number; entries: MenuEntry[] } | null>(null)

  useEffect(() => setSelected(new Set()), [teamId])

  const setParam = (k: string, v: string | null) => {
    const next = new URLSearchParams(params)
    if (v === null) next.delete(k)
    else next.set(k, v)
    setParams(next, { replace: true })
  }

  const visible = useMemo(() => {
    const tabMatch = TABS.find((t) => t.id === tab)?.match ?? (() => true)
    const sorted = issues.filter(tabMatch).filter((i) => matchesFilters(i, filters))
    return sorted.sort((a, b) =>
      orderBy === 'priority' ? a.priority - b.priority || b.updatedAt - a.updatedAt : orderBy === 'created' ? b.createdAt - a.createdAt : b.updatedAt - a.updatedAt,
    )
  }, [issues, tab, filters, orderBy])

  const groups = useMemo(() => {
    if (groupBy === 'none') return [{ key: 'all', label: 'All issues', icon: null as ReactNode, issues: visible }]
    if (groupBy === 'status')
      return STATUSES.map((s) => ({ key: s.id, label: s.name, icon: <StatusIcon status={s.id} />, issues: visible.filter((i) => i.status === s.id) }))
    if (groupBy === 'priority')
      return PRIORITIES.map((p) => ({ key: String(p.id), label: p.name, icon: <PriorityIcon priority={p.id} />, issues: visible.filter((i) => i.priority === p.id) }))
    if (groupBy === 'type')
      return ISSUE_TYPES.map((t) => ({ key: t.id, label: t.name, icon: <IssueTypeIcon type={t.id} />, issues: visible.filter((i) => i.type === t.id) }))
    if (groupBy === 'project') {
      const ids = [...new Set(visible.map((i) => i.projectId))]
      return ids.map((id) => {
        const p = project(id)
        return { key: id ?? 'none', label: p ? p.name : 'No project', icon: p ? <ProjectIcon status={p.status} /> : <Box size={14} />, issues: visible.filter((i) => i.projectId === id) }
      })
    }
    const ids = [...new Set(visible.map((i) => i.assigneeId))]
    return ids.map((id) => ({ key: id ?? 'none', label: user(id)?.name ?? 'Unassigned', icon: <Avatar user={user(id)} size={16} />, issues: visible.filter((i) => i.assigneeId === id) }))
  }, [visible, groupBy, user, project])

  const scopedProjects = db.projects.filter((p) => !teamId || p.teamId === teamId)
  const openAt = (e: React.MouseEvent, entries: MenuEntry[]) => {
    const r = e.currentTarget.getBoundingClientRect()
    setMenu({ x: r.right - 240, y: r.bottom + 4, entries })
  }

  const filterEntries = (): MenuEntry[] => [
    {
      label: 'Status',
      icon: <StatusIcon status="todo" />,
      submenu: { entries: STATUSES.map((s) => ({ label: s.name, icon: <StatusIcon status={s.id} />, checked: filters.status.includes(s.id), onSelect: () => setFilters((f) => ({ ...f, status: toggle(f.status, s.id) })) })) },
    },
    {
      label: 'Priority',
      icon: <PriorityIcon priority={2} />,
      submenu: { entries: PRIORITIES.map((p) => ({ label: p.name, icon: <PriorityIcon priority={p.id} />, checked: filters.priority.includes(p.id), onSelect: () => setFilters((f) => ({ ...f, priority: toggle(f.priority, p.id) })) })) },
    },
    {
      label: 'Type',
      icon: <IssueTypeIcon type="task" />,
      submenu: { entries: ISSUE_TYPES.map((t) => ({ label: t.name, icon: <IssueTypeIcon type={t.id} />, checked: filters.type.includes(t.id), onSelect: () => setFilters((f) => ({ ...f, type: toggle(f.type, t.id) })) })) },
    },
    {
      label: 'Assignee',
      icon: <Avatar user={null} size={16} />,
      submenu: {
        searchable: true,
        entries: [null, ...db.users.map((u) => u.id)].map((id) => ({
          label: user(id)?.name ?? 'Unassigned',
          icon: <Avatar user={user(id)} size={16} />,
          checked: filters.assignee.includes(id),
          onSelect: () => setFilters((f) => ({ ...f, assignee: toggle(f.assignee, id) })),
        })),
      },
    },
    {
      label: 'Project',
      icon: <Box size={16} />,
      submenu: {
        searchable: true,
        entries: [null, ...scopedProjects.map((p) => p.id)].map((id) => {
          const p = project(id)
          return {
            label: p?.name ?? 'No project',
            icon: p ? <ProjectIcon status={p.status} /> : <Box size={14} />,
            checked: filters.project.includes(id),
            onSelect: () => setFilters((f) => ({ ...f, project: toggle(f.project, id) })),
          }
        }),
      },
    },
    {
      label: 'Labels',
      icon: <span style={{ width: 8, height: 8, borderRadius: 4, background: 'var(--text-tertiary)', display: 'inline-block', margin: 4 }} />,
      submenu: {
        searchable: true,
        entries: allLabels(issues).map((name) => ({
          label: name,
          icon: <LabelDot name={name} />,
          checked: filters.label.includes(name),
          onSelect: () => setFilters((f) => ({ ...f, label: toggle(f.label, name) })),
        })),
      },
    },
  ]

  const GROUP_NAMES: Record<GroupBy, string> = { status: 'Status', priority: 'Priority', type: 'Type', assignee: 'Assignee', project: 'Project', none: 'No grouping' }
  const displayEntries = (): MenuEntry[] => [
    { kind: 'label', label: 'Grouping' },
    ...(Object.keys(GROUP_NAMES) as GroupBy[]).map((g) => ({ label: GROUP_NAMES[g], checked: groupBy === g, onSelect: () => setGroupBy(g) })),
    { kind: 'divider' },
    { kind: 'label', label: 'Ordering' },
    ...(['priority', 'created', 'updated'] as OrderBy[]).map((o) => ({ label: o === 'priority' ? 'Priority' : o === 'created' ? 'Created' : 'Last updated', checked: orderBy === o, onSelect: () => setOrderBy(o) })),
  ]

  const activeFilterCount = filterCount(filters)
  const selectedIds = [...selected]
  const clearSelection = () => setSelected(new Set())
  // A bulk sprint or project move only makes sense inside one team (both belong to one).
  const selectionTeams = new Set(db.issues.filter((i) => selected.has(i.id)).map((i) => i.teamId))
  const oneTeam = selectionTeams.size === 1 ? [...selectionTeams][0] : null
  const bulk = (patch: Parameters<typeof bulkUpdate>[1]) => {
    bulkUpdate(selectedIds, patch)
    clearSelection()
  }
  const unchecked = (entries: MenuEntry[]) => entries.map((x) => ('checked' in x ? { ...x, checked: false } : x))
  const newIssue = (extra: { status?: Status } = {}) => teamId && ui.setNewIssue({ teamId, projectId: projectId ?? null, ...extra })

  return (
    <>
      <div className="content-header">
        <div className="breadcrumb">{title}</div>
        <div className="tabs">
          {TABS.map((t) => (
            <button key={t.id} className={`tab${tab === t.id ? ' active' : ''}`} onClick={() => setParam('tab', t.id === 'all' ? null : t.id)}>
              {t.label}
            </button>
          ))}
        </div>
        <span className="spacer" />
        {headerExtra
          ? headerExtra(filters)
          : teamId && activeFilterCount > 0 && (
              <button className="btn sm ghost" onClick={() => setSavingView(true)}>
                <Save size={14} /> Save as view
              </button>
            )}
        <button className="btn sm ghost" onClick={(e) => openAt(e, filterEntries())}>
          <Filter size={14} /> Filter{activeFilterCount ? ` · ${activeFilterCount}` : ''}
        </button>
        <button className="btn sm ghost" onClick={(e) => openAt(e, displayEntries())}>
          <SlidersHorizontal size={14} /> Display
        </button>
        <button className={`icon-btn ai${aiOpen ? ' active' : ''}`} aria-label="AI summary" title="Summarize this view" onClick={() => setAiOpen(!aiOpen)}>
          <Sparkles size={16} />
        </button>
      </div>

      {(activeFilterCount > 0 || selected.size > 0) && (
        <div className="row" style={{ padding: '6px 16px', borderBottom: '1px solid var(--border-subtle)', flexWrap: 'wrap', gap: 6 }}>
          {selected.size > 0 ? (
            <>
              <span className="label">{selected.size} selected</span>
              <button className="btn sm" onClick={(e) => openAt(e, STATUSES.map((s) => ({ label: s.name, icon: <StatusIcon status={s.id} />, onSelect: () => bulk({ status: s.id }) })))}>
                Set status
              </button>
              <button className="btn sm" onClick={(e) => openAt(e, PRIORITIES.map((p) => ({ label: p.name, icon: <PriorityIcon priority={p.id} />, onSelect: () => bulk({ priority: p.id }) })))}>
                Set priority
              </button>
              <button className="btn sm" disabled={!oneTeam} title={oneTeam ? undefined : 'Select issues of one team'} onClick={(e) => oneTeam && openAt(e, unchecked(projectEntries(db.projects, oneTeam, null, (projectId) => bulk({ projectId }))))}>
                Set project
              </button>
              <button className="btn sm" disabled={!oneTeam} title={oneTeam ? undefined : 'Select issues of one team'} onClick={(e) => oneTeam && openAt(e, unchecked(sprintEntries(db.sprints, oneTeam, null, (sprintId) => bulk({ sprintId }))))}>
                Move to sprint
              </button>
              <button className="btn sm danger-outline" onClick={() => setConfirmBulkDelete(true)}>
                <Trash2 size={14} /> Delete
              </button>
              <button className="btn sm ghost" onClick={clearSelection}>
                Clear selection
              </button>
            </>
          ) : (
            <>
              {filters.status.map((s) => <FilterChip key={s} label={`Status: ${statusMeta(s).name}`} onRemove={() => setFilters((f) => ({ ...f, status: toggle(f.status, s) }))} />)}
              {filters.priority.map((p) => <FilterChip key={p} label={`Priority: ${priorityName(p)}`} onRemove={() => setFilters((f) => ({ ...f, priority: toggle(f.priority, p) }))} />)}
              {filters.type.map((t) => <FilterChip key={t} label={`Type: ${typeMeta(t).name}`} onRemove={() => setFilters((f) => ({ ...f, type: toggle(f.type, t) }))} />)}
              {filters.assignee.map((a) => <FilterChip key={a ?? 'none'} label={`Assignee: ${user(a)?.name ?? 'Unassigned'}`} onRemove={() => setFilters((f) => ({ ...f, assignee: toggle(f.assignee, a) }))} />)}
              {filters.project.map((p) => <FilterChip key={p ?? 'none'} label={`Project: ${project(p)?.name ?? 'None'}`} onRemove={() => setFilters((f) => ({ ...f, project: toggle(f.project, p) }))} />)}
              {filters.label.map((l) => <FilterChip key={l} label={`Label: ${l}`} onRemove={() => setFilters((f) => ({ ...f, label: toggle(f.label, l) }))} />)}
              <button className="btn sm ghost" onClick={() => setFilters(NO_FILTERS)}>Clear filters</button>
            </>
          )}
        </div>
      )}

      <div className="content-body">
        <div className="content-main">
          {visible.length === 0 ? (
            <div className="empty-state">
              <LayoutList size={32} className="faint" />
              <div>{issues.length === 0 ? emptyText : 'No issues match this view.'}</div>
              {teamId && issues.length === 0 && (
                <button className="btn primary" onClick={() => newIssue()}>
                  <Plus size={14} /> Create issue
                </button>
              )}
            </div>
          ) : (
            groups
              .filter((g) => g.issues.length)
              .map((g) => (
                <section key={g.key}>
                  <div className="group-header">
                    {g.icon}
                    <span>{g.label}</span>
                    <span className="count">{g.issues.length}</span>
                    <span className="spacer" />
                    {teamId && (
                      <button className="icon-btn" aria-label={`New issue in ${g.label}`} onClick={() => newIssue(groupBy === 'status' ? { status: g.key as Status } : {})}>
                        <Plus size={14} />
                      </button>
                    )}
                  </div>
                  {g.issues.map((i) => (
                    <IssueRow
                      key={i.id}
                      issue={i}
                      showProject={!projectId}
                      selected={selected.has(i.id)}
                      onToggleSelect={() =>
                        setSelected((s) => {
                          const n = new Set(s)
                          if (n.has(i.id)) n.delete(i.id)
                          else n.add(i.id)
                          return n
                        })
                      }
                    />
                  ))}
                </section>
              ))
          )}
        </div>
        {aiOpen && (
          <aside className="right-panel">
            <SummaryPanel issues={visible} scopeKey={`${teamId}-${projectId}-${tab}-${JSON.stringify(filters)}`} onClose={() => setAiOpen(false)} />
          </aside>
        )}
      </div>
      {menu && <Menu x={menu.x} y={menu.y} entries={menu.entries} onClose={() => setMenu(null)} />}
      {savingView && teamId && <SaveViewModal teamId={teamId} filters={filters} onClose={() => setSavingView(false)} />}
      {confirmBulkDelete && (
        <Modal onClose={() => setConfirmBulkDelete(false)} width={420}>
          <div style={{ padding: '20px 20px 8px' }}>
            <h2 className="title-md">Delete {selected.size} issues?</h2>
            <p className="muted" style={{ margin: '8px 0 12px' }}>All of them are deleted, or none if you can’t delete one of them. This can’t be undone.</p>
          </div>
          <div className="modal-footer">
            <button className="btn" onClick={() => setConfirmBulkDelete(false)}>Cancel</button>
            <button
              className="btn danger"
              onClick={async () => {
                setConfirmBulkDelete(false)
                if (await bulkDelete(selectedIds)) clearSelection()
              }}
            >
              Delete
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}

/** Save the list's current filters as a view of the team, then open it. */
function SaveViewModal({ teamId, filters, onClose }: { teamId: string; filters: Filters; onClose: () => void }) {
  const { team, createView } = useStore()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [shared, setShared] = useState(false)
  const [saving, setSaving] = useState(false)
  const unsaveable = filters.assignee.includes(null) || filters.project.includes(null)
  return (
    <Modal onClose={onClose} width={420}>
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          if (!name.trim() || saving) return
          setSaving(true)
          const v = await createView(teamId, name.trim(), filters, shared)
          setSaving(false)
          if (v) navigate(`/team/${team(teamId).key}/views/${v.id}`)
        }}
      >
        <div style={{ padding: '20px 20px 8px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h2 className="title-md">Save as view</h2>
          <label className="field">
            <span>View name</span>
            <input className="input" autoFocus maxLength={255} placeholder="e.g. My urgent bugs" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="row" style={{ cursor: 'pointer' }}>
            <Toggle on={shared} onChange={setShared} label="Share with the workspace" /> Share with everyone in the workspace
          </label>
          {unsaveable && <span className="muted label">“Unassigned” and “No project” filters aren’t saved in views.</span>}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary" disabled={!name.trim() || saving}>Save view</button>
        </div>
      </form>
    </Modal>
  )
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="chip" style={{ paddingRight: 2 }}>
      {label}
      <button className="icon-btn" style={{ width: 18, height: 18 }} aria-label={`Remove ${label}`} onClick={onRemove}>
        <X size={12} />
      </button>
    </span>
  )
}

/** Header crumb shared by every page of a team: avatar, name, then the page name. */
export function TeamCrumb({ teamId, children }: { teamId: string; children: ReactNode }) {
  const { team } = useStore()
  const t = team(teamId)
  return (
    <>
      <TeamAvatar team={t} size={16} /> {t.name} <span className="sep">›</span> {children}
    </>
  )
}

/** Resolves :teamKey from the URL; undefined when there's no such team. */
export function useRouteTeam() {
  const { teamKey } = useParams()
  const { teamByKey } = useStore()
  return teamByKey(teamKey ?? '')
}

export default function TeamIssues() {
  const { db } = useStore()
  const team = useRouteTeam()
  if (!team) return <div className="empty-state">Team not found.</div>
  return (
    <IssueListView
      key={team.id}
      teamId={team.id}
      title={<TeamCrumb teamId={team.id}>Issues</TeamCrumb>}
      issues={db.issues.filter((i) => i.teamId === team.id)}
      emptyText={`${team.name} has no issues yet.`}
    />
  )
}

export function MyIssues() {
  const { db, loadIssues, toast } = useStore()
  //This is the box. issues is what's in the box right now; setIssues is how we put something new in.
// - <ApiIssue[]> tells TypeScript: "this box holds a list of backend issues."
// - ([]) means it starts empty, because at time 0ms we don't have an answer yet.

  useEffect(() => {
    getIssues()
      .then((data) => loadIssues(data))
      .catch((err) => toast(err.message))
  }, [])
  //This is "ask the backend once, after the first render."
// - getIssues() sends GET /api/issues.
// - .then((data) => ...) says what to do when the answer arrives: put it in the box with setIssues(data). That makes React call MyIssues() again.
// - [] at the end means "only once." Without it, we'd get the infinite loop from before.

  return <IssueListView title="My issues" issues={db.issues.filter((i) => i.assigneeId === db.meId)} emptyText="Nothing is assigned to you." />
}
