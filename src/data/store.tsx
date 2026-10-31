import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { createSeed } from './mock'
import { COLORS } from './meta'
import * as api from './api'
import type {
  Activity, Comment, Db, Filters, Issue, IssueType, Priority, Project, ProjectStatus, Role, Sprint, Status, Team, Toast, User, View,
  Workspace,
} from './types'

let idCounter = 1000
export const newId = (prefix: string) => `${prefix}-${++idCounter}`

export type IssuePatch = Partial<Omit<Issue, 'id' | 'key' | 'teamId' | 'number' | 'reporterId'>>

/** Remembers the last workspace opened in this browser, so the app reopens it. */
const WORKSPACE_KEY = 'workspace'

/* ---------- Backend → app shapes. Backend ids are numbers; app ids are strings. ---------- */

const str = (n: number | null) => (n === null ? null : String(n))
const num = (s: string | null | undefined) => (s ? Number(s) : null)
const time = (iso: string | null) => (iso === null ? null : Date.parse(iso))
const iso = (t: number | null) => (t === null ? null : new Date(t).toISOString())
/** A project's dates are plain days ("2026-11-30"): read and written as local midnight. */
const fromDay = (day: string | null) => {
  if (!day) return null
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d).getTime()
}
export const toDay = (t: number | null) => {
  if (t === null) return null
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const toWorkspace = (a: { id: number; name: string; slug: string; role: Role }): Workspace => ({
  id: String(a.id),
  name: a.name,
  slug: a.slug,
  role: a.role,
  color: COLORS[a.id % COLORS.length],
})

const toUser = (m: api.ApiMember): User => ({
  id: String(m.user_id),
  name: m.name,
  username: m.username,
  email: m.email,
  role: m.role,
  color: COLORS[m.user_id % COLORS.length],
})

const toTeam = (a: api.ApiTeam): Team => ({
  id: String(a.id),
  key: a.key,
  name: a.name,
  description: a.description,
  color: COLORS[a.id % COLORS.length],
  isArchived: a.is_archived,
  issueCount: a.issue_count,
})

const toProject = (a: api.ApiProject): Project => ({
  id: String(a.id),
  teamId: String(a.team_id),
  name: a.name,
  description: a.description,
  status: a.status,
  leadId: str(a.lead_id),
  startDate: fromDay(a.start_date),
  targetDate: fromDay(a.target_date),
})

const toSprint = (a: api.ApiSprint): Sprint => ({
  id: String(a.id),
  teamId: String(a.team_id),
  name: a.name,
  goal: a.goal ?? '',
  status: a.status,
  start: time(a.start_date),
  end: time(a.end_date),
  completedAt: time(a.completed_date),
})

/** Favorite, subscribed and when it was completed aren't on the backend: they come from the local copy. */
const toIssue = (d: Db, a: api.ApiIssue): Issue => {
  const local = d.issues.find((i) => i.id === String(a.id))
  const updatedAt = Date.parse(a.updated_at)
  return {
    favorite: local?.favorite ?? false,
    subscribed: local?.subscribed ?? true,
    id: String(a.id),
    key: a.issue_key,
    teamId: String(a.team_id),
    number: a.number,
    type: a.issue_type,
    projectId: str(a.project_id),
    title: a.title,
    description: a.description,
    status: a.status as Status,
    priority: a.priority as Priority,
    assigneeId: str(a.assignee_id),
    reporterId: str(a.reporter_id),
    storyPoints: a.story_points,
    sprintId: str(a.sprint_id),
    labels: a.labels,
    dueDate: time(a.due_date),
    createdAt: Date.parse(a.created_at),
    updatedAt,
    completedAt: a.status === 'done' ? local?.completedAt ?? updatedAt : null,
  }
}

const toComment = (a: api.ApiComment): Comment => ({
  id: String(a.id),
  issueId: String(a.issue_id),
  authorId: str(a.author_id),
  parentId: str(a.parent_id),
  body: a.content,
  createdAt: Date.parse(a.created_at),
  edited: a.is_edited,
})

const toActivity = (a: api.ApiActivity): Activity => ({
  id: String(a.id),
  issueId: String(a.issue_id),
  actorId: str(a.actor_id),
  action: a.action,
  field: a.field,
  oldValue: a.old_value,
  newValue: a.new_value,
  createdAt: Date.parse(a.created_at),
})

export const NO_FILTERS: Filters = { status: [], priority: [], type: [], assignee: [], project: [], label: [] }

/** A saved view's filter → the list's. */
const toFilters = (a: api.ApiFilters): Filters => ({
  status: (a.status ?? []) as Status[],
  priority: (a.priority ?? []) as Priority[],
  type: (a.issue_type ?? []) as IssueType[],
  assignee: (a.assignee_id ?? []).map(String),
  project: (a.project_id ?? []).map(String),
  label: a.labels ?? [],
})

/** The list's filter → what a view saves. "Unassigned" / "No project" can't be saved, so they're dropped. */
const fromFilters = (f: Filters): api.ApiFilters => {
  const out: api.ApiFilters = {}
  if (f.status.length) out.status = f.status
  if (f.priority.length) out.priority = f.priority
  if (f.type.length) out.issue_type = f.type
  const assignees = f.assignee.filter((x): x is string => x !== null).map(Number)
  if (assignees.length) out.assignee_id = assignees
  const projects = f.project.filter((x): x is string => x !== null).map(Number)
  if (projects.length) out.project_id = projects
  if (f.label.length) out.labels = f.label
  return out
}

const toView = (a: api.ApiView): View => ({
  id: String(a.id),
  teamId: String(a.team_id),
  ownerId: String(a.owner_id),
  name: a.name,
  filters: toFilters(a.filters),
  isShared: a.is_shared,
})

/** The app's issue fields → the backend's (IssueUpdate). Favorite and subscribed stay in this browser. */
function issueFields(patch: IssuePatch): api.ApiIssueFields {
  const f: api.ApiIssueFields = {}
  if (patch.title !== undefined) f.title = patch.title
  if (patch.description !== undefined) f.description = patch.description
  if (patch.type !== undefined) f.issue_type = patch.type
  if (patch.status !== undefined) f.status = patch.status
  if (patch.priority !== undefined) f.priority = patch.priority
  if ('assigneeId' in patch) f.assignee_id = num(patch.assigneeId)
  if ('projectId' in patch) f.project_id = num(patch.projectId)
  if ('sprintId' in patch) f.sprint_id = num(patch.sprintId)
  if (patch.storyPoints !== undefined) f.story_points = patch.storyPoints
  if (patch.labels !== undefined) f.labels = patch.labels
  if ('dueDate' in patch) f.due_date = iso(patch.dueDate ?? null)
  return f
}

export interface NewIssueInput {
  teamId: string
  title: string
  description: string
  type: IssueType
  status: Status
  priority: Priority
  assigneeId: string | null
  projectId: string | null
  sprintId: string | null
  labels: string[]
  storyPoints: number
  dueDate: number | null
}

export interface SprintInput {
  name: string
  goal: string
  start: number | null
  end: number | null
}

const sprintFields = (s: Partial<SprintInput>): api.ApiSprintFields => {
  const f: api.ApiSprintFields = {}
  if (s.name !== undefined) f.name = s.name
  if (s.goal !== undefined) f.goal = s.goal || null
  if ('start' in s) f.start_date = iso(s.start ?? null)
  if ('end' in s) f.end_date = iso(s.end ?? null)
  return f
}

export type ProjectInput = { name: string; description: string; status: ProjectStatus; leadId: string | null; startDate: number | null; targetDate: number | null }

const projectFields = (p: Partial<ProjectInput>): api.ApiProjectFields => {
  const f: api.ApiProjectFields = {}
  if (p.name !== undefined) f.name = p.name
  if (p.description !== undefined) f.description = p.description
  if (p.status !== undefined) f.status = p.status
  if ('leadId' in p) f.lead_id = num(p.leadId)
  if ('startDate' in p) f.start_date = toDay(p.startDate ?? null)
  if ('targetDate' in p) f.target_date = toDay(p.targetDate ?? null)
  return f
}

/** Replace one item of a list by id, or append it. */
const upsert = <T extends { id: string }>(xs: T[], x: T) => (xs.some((y) => y.id === x.id) ? xs.map((y) => (y.id === x.id ? x : y)) : [...xs, x])

function useStoreValue() {
  const [db, setDb] = useState<Db>(createSeed)
  const [toasts, setToasts] = useState<Toast[]>([])
  const dbRef = useRef(db)
  dbRef.current = db

  const me = db.users.find((u) => u.id === db.meId)!
  const workspace = db.workspaces.find((w) => w.id === db.currentWorkspaceId)
  const isAdmin = me?.role === 'Admin'
  const user = (id: string | null) => (id ? db.users.find((u) => u.id === id) ?? null : null)
  const team = (id: string) => db.teams.find((t) => t.id === id)!
  const teamByKey = (key: string) => db.teams.find((t) => t.key.toLowerCase() === key.toLowerCase())
  const project = (id: string | null) => (id ? db.projects.find((p) => p.id === id) ?? null : null)
  const issueKey = (issue: Issue) => issue.key
  const issueByKey = (key: string) => db.issues.find((i) => i.key.toLowerCase() === key.toLowerCase())

  const dismissToast = useCallback((id: string) => setToasts((ts) => ts.filter((t) => t.id !== id)), [])
  const toast = useCallback(
    (message: string, undo?: () => void) => {
      const id = newId('toast')
      setToasts((ts) => [...ts, { id, message, undo }])
      setTimeout(() => dismissToast(id), 5000)
    },
    [dismissToast],
  )
  const fail = (err: unknown) => {
    toast((err as Error).message)
    return false as const
  }

  /* ---------- Loading ---------- */

  /**
   * Open a workspace: point the API at it, then load its members, teams and issues, and each team's
   * projects, sprints and views. `me` (from GET /users/me) also refreshes the workspace list.
   */
  const openWorkspace = async (slug: string, me?: api.ApiMe) => {
    api.setWorkspace(slug)
    localStorage.setItem(WORKSPACE_KEY, slug)
    const [members, teams, issues] = await Promise.all([api.getMembers(), api.getTeams(), api.getIssues()])
    const perTeam = await Promise.all(
      teams.map((t) => Promise.all([api.getProjects(t.key), api.getSprints(t.key), api.getViews(t.key)])),
    )
    setDb((d) => {
      const workspaces = me ? me.workspaces.map(toWorkspace) : d.workspaces
      // Comments and activity are fetched per issue when its page opens, so start with none.
      const next: Db = {
        ...d,
        meId: me ? String(me.id) : d.meId,
        workspaces,
        currentWorkspaceId: workspaces.find((w) => w.slug === slug)?.id ?? '',
        users: members.map(toUser),
        teams: teams.map(toTeam),
        projects: perTeam.flatMap(([ps]) => ps.map(toProject)),
        sprints: perTeam.flatMap(([, ss]) => ss.map(toSprint)),
        views: perTeam.flatMap(([, , vs]) => vs.map(toView)),
        comments: [],
        activity: [],
      }
      return { ...next, issues: issues.map((a) => toIssue(d, a)) }
    })
  }

  /**
   * After login: load my workspaces and open the one I used last (or the first). With no workspace
   * at all, nothing is opened and the app asks me to create one.
   */
  const loadSession = async () => {
    const me = await api.getMe()
    const last = localStorage.getItem(WORKSPACE_KEY)
    const slug = me.workspaces.find((w) => w.slug === last)?.slug ?? me.workspaces[0]?.slug
    if (slug) return openWorkspace(slug, me)
    setDb((d) => ({ ...d, meId: String(me.id), workspaces: [], currentWorkspaceId: '', users: [], teams: [], projects: [], sprints: [], issues: [], views: [] }))
  }

  /** Switch to another of my workspaces; resolves to true once it's loaded. */
  const switchWorkspace = (slug: string): Promise<boolean> =>
    api
      .getMe()
      .then((me) => openWorkspace(slug, me))
      .then(() => true)
      .catch(fail)

  const loadIssues = (issues: api.ApiIssue[]) => setDb((d) => ({ ...d, issues: issues.map((a) => toIssue(d, a)) }))

  /** Re-fetch issues (and this team's sprints), e.g. after a change that moved many issues at once. */
  const reload = async (teamId?: string) => {
    const t = teamId ? dbRef.current.teams.find((x) => x.id === teamId) : undefined
    const [issues, sprints] = await Promise.all([api.getIssues(), t ? api.getSprints(t.key) : Promise.resolve(null)])
    setDb((d) => ({
      ...d,
      issues: issues.map((a) => toIssue(d, a)),
      sprints: sprints ? [...d.sprints.filter((s) => s.teamId !== teamId), ...sprints.map(toSprint)] : d.sprints,
    }))
  }

  /* ---------- Workspaces and members ---------- */

  const createWorkspace = (fields: { name: string; slug: string }): Promise<boolean> =>
    api
      .createWorkspace(fields)
      .then(async (a) => {
        await switchWorkspace(a.slug)
        toast(`Workspace ${a.name} created`)
        return true
      })
      .catch(fail)

  const updateWorkspace = (fields: { name?: string; slug?: string }): Promise<boolean> =>
    api
      .updateWorkspace(fields)
      .then((a) => {
        // A new slug changes every path, so point the API (and the remembered workspace) at it.
        api.setWorkspace(a.slug)
        localStorage.setItem(WORKSPACE_KEY, a.slug)
        setDb((d) => ({ ...d, workspaces: d.workspaces.map((w) => (w.id === String(a.id) ? { ...w, name: a.name, slug: a.slug } : w)) }))
        return true
      })
      .catch(fail)

  /** After deleting or leaving the current workspace: open another one, or none (the app then offers to create one). */
  const afterLeaving = async () => {
    localStorage.removeItem(WORKSPACE_KEY)
    await loadSession()
  }

  const deleteWorkspace = (): Promise<boolean> =>
    api
      .deleteWorkspace()
      .then(async () => {
        await afterLeaving()
        toast('Workspace deleted')
        return true
      })
      .catch(fail)

  const addMember = (usernameOrEmail: string, role: Role): Promise<boolean> =>
    api
      .addMember(usernameOrEmail, role)
      .then((m) => {
        setDb((d) => ({ ...d, users: upsert(d.users, toUser(m)) }))
        toast(`${m.name} added to the workspace`)
        return true
      })
      .catch(fail)

  const setMemberRole = (userId: string, role: Role) =>
    api
      .updateMember(Number(userId), role)
      .then((m) => setDb((d) => ({ ...d, users: d.users.map((u) => (u.id === userId ? { ...u, role: m.role } : u)) })))
      .catch(fail)

  /** Removing yourself is leaving: the workspace then disappears from your list. */
  const removeMember = (userId: string): Promise<boolean> =>
    api
      .removeMember(Number(userId))
      .then(async () => {
        if (userId === dbRef.current.meId) {
          await afterLeaving()
          toast('You left the workspace')
        } else setDb((d) => ({ ...d, users: d.users.filter((u) => u.id !== userId) }))
        return true
      })
      .catch(fail)

  /* ---------- Teams ---------- */

  const putTeam = (a: api.ApiTeam) => {
    const t = toTeam(a)
    setDb((d) => ({ ...d, teams: upsert(d.teams, t) }))
    return t
  }

  const createTeam = (fields: { name: string; key: string; description: string }): Promise<Team | null> =>
    api
      .createTeam(fields)
      .then((a) => {
        toast(`Team ${a.key} created`)
        return putTeam(a)
      })
      .catch((err) => (fail(err), null))

  const updateTeam = (id: string, fields: Partial<Pick<Team, 'name' | 'description' | 'isArchived'>>): Promise<boolean> => {
    const f: api.ApiTeamFields = {}
    if (fields.name !== undefined) f.name = fields.name
    if (fields.description !== undefined) f.description = fields.description
    if (fields.isArchived !== undefined) f.is_archived = fields.isArchived
    return api
      .updateTeam(team(id).key, f)
      .then((a) => (putTeam(a), true))
      .catch(fail)
  }

  /** The backend deletes the team's issues, sprints, projects and views with it (ON DELETE CASCADE). */
  const deleteTeam = (id: string): Promise<boolean> =>
    api
      .deleteTeam(team(id).key)
      .then(() => {
        setDb((d) => ({
          ...d,
          teams: d.teams.filter((t) => t.id !== id),
          issues: d.issues.filter((i) => i.teamId !== id),
          sprints: d.sprints.filter((s) => s.teamId !== id),
          projects: d.projects.filter((p) => p.teamId !== id),
          views: d.views.filter((v) => v.teamId !== id),
        }))
        toast('Team deleted')
        return true
      })
      .catch(fail)

  /* ---------- Projects (features / epics) ---------- */

  const putProject = (a: api.ApiProject) => {
    const p = toProject(a)
    setDb((d) => ({ ...d, projects: upsert(d.projects, p) }))
    return p
  }

  const createProject = (teamId: string, input: ProjectInput): Promise<Project | null> =>
    api
      .createProject(team(teamId).key, { name: input.name, ...projectFields(input) })
      .then((a) => {
        toast(`Project ${a.name} created`)
        return putProject(a)
      })
      .catch((err) => (fail(err), null))

  const updateProject = (id: string, input: Partial<ProjectInput>): Promise<boolean> =>
    api
      .updateProject(Number(id), projectFields(input))
      .then((a) => (putProject(a), true))
      .catch(fail)

  /** Its issues stay; they only lose the project (issues.project_id ON DELETE SET NULL). */
  const deleteProject = (id: string): Promise<boolean> =>
    api
      .deleteProject(Number(id))
      .then(() => {
        setDb((d) => ({
          ...d,
          projects: d.projects.filter((p) => p.id !== id),
          issues: d.issues.map((i) => (i.projectId === id ? { ...i, projectId: null } : i)),
        }))
        toast('Project deleted; its issues are kept')
        return true
      })
      .catch(fail)

  /* ---------- Issues ---------- */

  const keyOf = (issueId: string) => dbRef.current.issues.find((i) => i.id === issueId)!.key

  /** Replace this issue's history with the backend's. */
  const loadActivity = (issueId: string) =>
    api
      .getActivity(keyOf(issueId))
      .then((list) => setDb((d) => ({ ...d, activity: [...d.activity.filter((a) => a.issueId !== issueId), ...list.map(toActivity)] })))
      .catch(fail)

  /** The backend wrote a history row for the change; if this issue's history is on screen, fetch it again. */
  const refreshActivity = (issueId: string) => {
    if (dbRef.current.activity.some((a) => a.issueId === issueId)) loadActivity(issueId)
  }

  const putIssue = (a: api.ApiIssue) =>
    setDb((d) => ({ ...d, issues: d.issues.map((i) => (i.id === String(a.id) ? toIssue(d, a) : i)) }))

  const setLocalIssue = (id: string, patch: IssuePatch) =>
    setDb((d) => {
      const t = Date.now()
      return {
        ...d,
        issues: d.issues.map((i) =>
          i.id === id
            ? { ...i, ...patch, updatedAt: t, completedAt: patch.status ? (patch.status === 'done' ? t : null) : i.completedAt }
            : i,
        ),
      }
    })

  /** Change the screen right away, then save; if the backend says no, undo and show why. */
  const updateIssue = (id: string, patch: IssuePatch) => {
    const before = dbRef.current.issues.find((i) => i.id === id)
    if (!before) return
    setLocalIssue(id, patch)
    const fields = issueFields(patch)
    const keys = Object.keys(fields)
    if (keys.length === 0) return
    const undo = (err: unknown) => {
      setDb((d) => ({ ...d, issues: d.issues.map((i) => (i.id === id ? before : i)) }))
      fail(err)
    }
    // A status-only change (the board's drag and drop) uses the dedicated endpoint.
    if (keys.length === 1 && fields.status)
      api.moveIssueStatus(before.key, fields.status)
        .then((r) => {
          setDb((d) => ({ ...d, issues: d.issues.map((i) => (i.id === id ? { ...i, updatedAt: Date.parse(r.updated_at) } : i)) }))
          refreshActivity(id)
        })
        .catch(undo)
    else
      api.updateIssue(before.key, fields)
        .then((a) => {
          putIssue(a)
          refreshActivity(id)
        })
        .catch(undo)
  }

  const createIssue = (input: NewIssueInput): Promise<Issue | null> =>
    api
      .createIssue(team(input.teamId).key, {
        title: input.title,
        description: input.description,
        issue_type: input.type,
        status: input.status,
        priority: input.priority,
        assignee_id: num(input.assigneeId),
        project_id: num(input.projectId),
        sprint_id: num(input.sprintId),
        story_points: input.storyPoints,
        labels: input.labels,
        due_date: iso(input.dueDate),
      })
      .then((a) => {
        const issue = toIssue(dbRef.current, a)
        setDb((d) => ({
          ...d,
          issues: [issue, ...d.issues],
          teams: d.teams.map((t) => (t.id === issue.teamId ? { ...t, issueCount: t.issueCount + 1 } : t)),
        }))
        toast(`${a.issue_key} created`)
        return issue
      })
      .catch((err) => (fail(err), null))

  /** Mirror the backend: comments and history go with the issue. */
  const removeIssuesLocally = (ids: string[]) =>
    setDb((d) => ({
      ...d,
      issues: d.issues.filter((i) => !ids.includes(i.id)),
      comments: d.comments.filter((c) => !ids.includes(c.issueId)),
      activity: d.activity.filter((a) => !ids.includes(a.issueId)),
      teams: d.teams.map((t) => ({ ...t, issueCount: t.issueCount - d.issues.filter((i) => i.teamId === t.id && ids.includes(i.id)).length })),
    }))

  const deleteIssue = (id: string) => {
    const issue = dbRef.current.issues.find((i) => i.id === id)
    if (!issue) return
    api
      .deleteIssue(issue.key)
      .then(() => {
        removeIssuesLocally([id])
        toast(`${issue.key} deleted`)
      })
      .catch(fail)
  }

  /** Same change on many issues; each succeeds or fails on its own (the backend reports per issue). */
  const bulkUpdate = async (ids: string[], patch: Pick<IssuePatch, 'status' | 'priority' | 'assigneeId' | 'projectId' | 'sprintId'>) => {
    const keys = dbRef.current.issues.filter((i) => ids.includes(i.id)).map((i) => i.key)
    try {
      const r = await api.bulkUpdateIssues(keys, issueFields(patch))
      await reload()
      const failed = r.results.filter((x) => x.status === 'Failed')
      toast(failed.length ? `${r.summary.success_count} updated; ${failed[0].issue_key}: ${failed[0].error}` : `${r.summary.success_count} issues updated`)
    } catch (err) {
      fail(err)
    }
  }

  /** All or nothing: if any one can't be deleted, none are. */
  const bulkDelete = (ids: string[]) => {
    const keys = dbRef.current.issues.filter((i) => ids.includes(i.id)).map((i) => i.key)
    return api
      .bulkDeleteIssues(keys)
      .then(() => {
        removeIssuesLocally(ids)
        toast(`${keys.length} issues deleted`)
        return true
      })
      .catch(fail)
  }

  /* ---------- Comments ---------- */

  /** Replace this issue's comments with the backend's list. */
  const loadComments = (issueId: string) =>
    api
      .getComments(keyOf(issueId))
      .then((list) => setDb((d) => ({ ...d, comments: [...d.comments.filter((c) => c.issueId !== issueId), ...list.map(toComment)] })))
      .catch(fail)

  /** Resolves to true once saved, so the page only clears the comment box on success. */
  const addComment = (issueId: string, body: string, parentId: string | null = null): Promise<boolean> =>
    api
      .createComment(keyOf(issueId), body, num(parentId))
      .then((a) => {
        setDb((d) => ({ ...d, comments: [...d.comments, toComment(a)] }))
        return true
      })
      .catch(fail)

  /** Resolves to true once saved, so the page only closes the editor on success. */
  const editComment = (id: string, body: string): Promise<boolean> =>
    api
      .updateComment(Number(id), body)
      .then((a) => {
        setDb((d) => ({ ...d, comments: d.comments.map((c) => (c.id === id ? toComment(a) : c)) }))
        return true
      })
      .catch(fail)

  /** The backend deletes the replies too (parent_id ON DELETE CASCADE), all the way down. */
  const deleteComment = (id: string) =>
    api
      .deleteComment(Number(id))
      .then(() => {
        setDb((d) => {
          const gone = new Set([id])
          let grew = true
          while (grew) {
            grew = false
            for (const c of d.comments) if (c.parentId && gone.has(c.parentId) && !gone.has(c.id)) (gone.add(c.id), (grew = true))
          }
          return { ...d, comments: d.comments.filter((c) => !gone.has(c.id)) }
        })
        toast('Comment deleted')
      })
      .catch(fail)

  /* ---------- Sprints ---------- */

  const putSprint = (a: api.ApiSprint) => {
    const s = toSprint(a)
    setDb((d) => ({ ...d, sprints: upsert(d.sprints, s) }))
    return s
  }

  const createSprint = (teamId: string, input: SprintInput): Promise<Sprint | null> =>
    api
      .createSprint(team(teamId).key, { name: input.name, ...sprintFields(input) })
      .then((a) => {
        toast(`${a.name} created`)
        return putSprint(a)
      })
      .catch((err) => (fail(err), null))

  const updateSprint = (id: string, input: Partial<SprintInput>): Promise<boolean> =>
    api
      .updateSprint(Number(id), sprintFields(input))
      .then((a) => (putSprint(a), true))
      .catch(fail)

  /** Its issues go back to the backlog (sprint_id ON DELETE SET NULL). */
  const deleteSprint = (id: string) =>
    api
      .deleteSprint(Number(id))
      .then(() => {
        setDb((d) => ({
          ...d,
          sprints: d.sprints.filter((s) => s.id !== id),
          issues: d.issues.map((i) => (i.sprintId === id ? { ...i, sprintId: null } : i)),
        }))
        toast('Sprint deleted; its issues are back in the backlog')
      })
      .catch(fail)

  const startSprint = (id: string): Promise<boolean> =>
    api
      .startSprint(Number(id))
      .then((a) => {
        putSprint(a)
        toast(`${a.name} started`)
        return true
      })
      .catch(fail)

  /** Unfinished issues move to the destination sprint (or the backlog) on the backend, so re-fetch after. */
  const completeSprint = (id: string, destinationId: string | null): Promise<boolean> => {
    const sprint = dbRef.current.sprints.find((s) => s.id === id)!
    return api
      .completeSprint(Number(id), num(destinationId))
      .then(async (r) => {
        await reload(sprint.teamId)
        toast(`${sprint.name} completed: ${r.completed_issues} done, ${r.moved_issues} moved`)
        return true
      })
      .catch(fail)
  }

  /* ---------- Views (saved filters) ---------- */

  const putView = (a: api.ApiView) => {
    const v = toView(a)
    setDb((d) => ({ ...d, views: upsert(d.views, v) }))
    return v
  }

  const createView = (teamId: string, name: string, filters: Filters, isShared: boolean): Promise<View | null> =>
    api
      .createView(team(teamId).key, { name, filters: fromFilters(filters), is_shared: isShared })
      .then((a) => {
        toast(`View ${a.name} saved`)
        return putView(a)
      })
      .catch((err) => (fail(err), null))

  const updateView = (id: string, fields: { name?: string; filters?: Filters; isShared?: boolean }): Promise<boolean> =>
    api
      .updateView(Number(id), {
        ...(fields.name !== undefined ? { name: fields.name } : {}),
        ...(fields.filters ? { filters: fromFilters(fields.filters) } : {}),
        ...(fields.isShared !== undefined ? { is_shared: fields.isShared } : {}),
      })
      .then((a) => (putView(a), true))
      .catch(fail)

  const deleteView = (id: string): Promise<boolean> =>
    api
      .deleteView(Number(id))
      .then(() => {
        setDb((d) => ({ ...d, views: d.views.filter((v) => v.id !== id) }))
        toast('View deleted')
        return true
      })
      .catch(fail)

  /* ---------- People ---------- */

  const updateMe = (fields: { name?: string; username?: string; email?: string }): Promise<boolean> =>
    api
      .updateMe(fields)
      .then((a) => {
        // The account has no role; keep my role in this workspace (and the local avatar).
        setDb((d) => ({ ...d, users: d.users.map((u) => (u.id === String(a.id) ? { ...u, name: a.name, username: a.username, email: a.email } : u)) }))
        return true
      })
      .catch(fail)

  const changePassword = (current: string, next: string): Promise<boolean> =>
    api
      .changePassword(current, next)
      .then(() => true)
      .catch(fail)

  /** Only for things the backend doesn't store (the avatar picture). */
  const updateUser = (id: string, patch: Partial<User>) =>
    setDb((d) => ({ ...d, users: d.users.map((u) => (u.id === id ? { ...u, ...patch } : u)) }))

  return {
    db,
    setDb,
    me,
    workspace,
    isAdmin,
    user,
    team,
    teamByKey,
    project,
    issueKey,
    issueByKey,
    toasts,
    toast,
    dismissToast,
    loadSession,
    switchWorkspace,
    loadIssues,
    reload,
    createWorkspace,
    updateWorkspace,
    deleteWorkspace,
    addMember,
    setMemberRole,
    removeMember,
    createTeam,
    updateTeam,
    deleteTeam,
    createProject,
    updateProject,
    deleteProject,
    loadActivity,
    updateIssue,
    createIssue,
    deleteIssue,
    bulkUpdate,
    bulkDelete,
    loadComments,
    addComment,
    editComment,
    deleteComment,
    createSprint,
    updateSprint,
    deleteSprint,
    startSprint,
    completeSprint,
    createView,
    updateView,
    deleteView,
    updateMe,
    changePassword,
    updateUser,
  }
}

export type Store = ReturnType<typeof useStoreValue>
const StoreContext = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const value = useStoreValue()
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const s = useContext(StoreContext)
  if (!s) throw new Error('useStore outside StoreProvider')
  return s
}

/* ---------- UI state: overlays shared across screens ---------- */

export interface ContextMenuState {
  issueId: string
  x: number
  y: number
}

/** What the New issue modal opens with: the team, plus anything the place it was opened from implies. */
export interface NewIssueDraft {
  teamId: string
  type?: IssueType
  projectId?: string | null
  sprintId?: string | null
  status?: Status
}

function useUiValue() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [newIssue, setNewIssue] = useState<NewIssueDraft | null>(null)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  return useMemo(
    () => ({
      sidebarCollapsed,
      setSidebarCollapsed,
      newIssue,
      setNewIssue,
      paletteOpen,
      setPaletteOpen,
      contextMenu,
      setContextMenu,
      confirmDeleteId,
      setConfirmDeleteId,
    }),
    [sidebarCollapsed, newIssue, paletteOpen, contextMenu, confirmDeleteId],
  )
}

type Ui = ReturnType<typeof useUiValue>
const UiContext = createContext<Ui | null>(null)

export function UiProvider({ children }: { children: ReactNode }) {
  const value = useUiValue()
  return <UiContext.Provider value={value}>{children}</UiContext.Provider>
}

export function useUi() {
  const s = useContext(UiContext)
  if (!s) throw new Error('useUi outside UiProvider')
  return s
}
