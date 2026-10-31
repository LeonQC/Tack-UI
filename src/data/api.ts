// Talks to the FastAPI backend. Every path starts with /api, which Vite forwards to :8000.
// Everything inside a workspace is under /w/{slug}/..., for the workspace picked with setWorkspace.

const TOKEN_KEY = 'access_token'
const REFRESH_KEY = 'refresh_token'

export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const clearToken = () => {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(REFRESH_KEY)
}

/** The current workspace's slug; every workspace path below starts with /w/{slug}. */
let slug = ''
export const setWorkspace = (s: string) => {
  slug = s
}
const w = (path: string) => `/w/${slug}${path}`

/** The shape of UserOut on the backend. */
export interface ApiUser {
  id: number
  email: string
  username: string
  name: string
  created_at: string  //json has no date type, so we use string and convert to Date in the frontend
}

/** GET /users/me: the user plus each workspace they belong to. */
export interface ApiMe extends ApiUser {
  workspaces: { id: number; name: string; slug: string; role: 'Admin' | 'Member' }[]
}

/** Ask the backend for a fresh 1-hour access token with the 7-day refresh token. */
async function refreshAccessToken(): Promise<boolean> {
  const refresh_token = localStorage.getItem(REFRESH_KEY)
  if (!refresh_token) return false
  const res = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token }),
  })
  if (!res.ok) return false
  const data: { access_token: string } = await res.json()
  localStorage.setItem(TOKEN_KEY, data.access_token)
  return true
}

/** fetch with the token attached. An expired access token is refreshed once and the request retried. */
async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const attempt = () =>
    fetch(`/api${path}`, { ...init, headers: { ...init.headers, Authorization: `Bearer ${getToken()}` } })
  const res = await attempt()
  if (res.status === 401 && (await refreshAccessToken())) return attempt()
  return res
}

/** The backend's error message: FastAPI puts it in "detail"; validation errors (422) make it a list instead. */
async function errorMessage(res: Response) {
  const data = await res.json().catch(() => null)
  if (typeof data?.detail === 'string') return data.detail
  if (Array.isArray(data?.detail) && data.detail[0]?.msg) return String(data.detail[0].msg).replace(/^Value error, /, '')
  return `Request failed (${res.status})`
}

export async function login(username: string, password: string): Promise<void> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (res.status === 401) throw new Error('Incorrect username or password')
  if (!res.ok) throw new Error(await errorMessage(res))
  const data: { access_token: string; refresh_token: string } = await res.json()
  localStorage.setItem(TOKEN_KEY, data.access_token)
  localStorage.setItem(REFRESH_KEY, data.refresh_token)
}

export async function register(fields: { username: string; email: string; password: string; name?: string }): Promise<void> {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  })
  if (!res.ok) throw new Error(await errorMessage(res))
}

export async function getMe(): Promise<ApiMe> {
  const res = await authFetch('/users/me')
  if (!res.ok) throw new Error('Not logged in')
  return res.json()
}

/** The shape of IssueOut on the backend. */
export interface ApiIssue {
  id: number
  issue_key: string
  team_id: number
  number: number
  issue_type: 'task' | 'bug' | 'story'
  project_id: number | null
  sprint_id: number | null
  title: string
  description: string
  status: string
  priority: number
  assignee_id: number | null
  reporter_id: number | null
  story_points: number
  labels: string[]
  due_date: string | null
  created_at: string
  updated_at: string
}

export async function getIssues(): Promise<ApiIssue[]> {
  //async means this function waits on the network. Promise<ApiIssue[]> means it returns "a list of issues, later".
  // That "later" is why the page will need .then(...)
  const res = await authFetch(w('/issues'))
  if (!res.ok) throw new Error(`Could not load issues (${res.status})`)
  //res.ok is true for 200–299.
  return res.json()
}

/** authFetch with a JSON body; on failure, throws the backend's error message. */
async function send(path: string, method: string, body?: unknown) {
  const res = await authFetch(path, {
    method,
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await errorMessage(res))
  return res.status === 204 ? null : res.json()
}

/** Fields the backend lets you set on an issue (IssueCreate / IssueUpdate). */
export interface ApiIssueFields {
  title?: string
  description?: string
  issue_type?: string
  status?: string
  priority?: number
  assignee_id?: number | null
  project_id?: number | null
  sprint_id?: number | null
  story_points?: number
  labels?: string[]
  due_date?: string | null
}

/** The shape of WorkspaceOut on the backend. */
export interface ApiWorkspace {
  id: number
  name: string
  slug: string
  role: 'Admin' | 'Member'
  member_count: number
  created_at: string
  updated_at: string
}

/** The shape of MemberOut on the backend: a user plus their role in this workspace. */
export interface ApiMember {
  user_id: number
  username: string
  name: string
  email: string
  role: 'Admin' | 'Member'
  joined_at: string
}

/** The shape of TeamOut on the backend. */
export interface ApiTeam {
  id: number
  workspace_id: number
  name: string
  key: string
  description: string
  is_archived: boolean
  issue_count: number
  created_at: string
  updated_at: string
}

export type ApiTeamFields = { name?: string; description?: string; is_archived?: boolean }

/** The shape of ProjectOut on the backend (a feature / epic inside a team). Dates are "YYYY-MM-DD". */
export interface ApiProject {
  id: number
  team_id: number
  name: string
  description: string
  status: 'planned' | 'in_progress' | 'paused' | 'completed' | 'canceled'
  lead_id: number | null
  start_date: string | null
  target_date: string | null
  progress: { total: number; done: number }
  created_at: string
  updated_at: string
}

export type ApiProjectFields = {
  name?: string
  description?: string
  status?: string
  lead_id?: number | null
  start_date?: string | null
  target_date?: string | null
}

/** The shape of SprintOut on the backend. */
export interface ApiSprint {
  id: number
  team_id: number
  name: string
  goal: string | null
  status: 'planned' | 'active' | 'completed'
  start_date: string | null
  end_date: string | null
  completed_date: string | null
  created_by: number | null
  created_at: string
}

export type ApiSprintFields = { name?: string; goal?: string | null; start_date?: string | null; end_date?: string | null }

/** The shape of CommentOut on the backend. */
export interface ApiComment {
  id: number
  issue_id: number
  author_id: number | null
  parent_id: number | null
  content: string
  is_edited: boolean
  created_at: string
  updated_at: string
}

/** The shape of ActivityOut on the backend: one change to an issue. */
export interface ApiActivity {
  id: number
  issue_id: number
  actor_id: number | null
  action: 'created' | 'updated'
  field: string | null
  old_value: unknown
  new_value: unknown
  created_at: string
}

/** A view's saved filter: each field lists the accepted values (IssueFilters on the backend). */
export interface ApiFilters {
  status?: string[]
  priority?: number[]
  issue_type?: string[]
  assignee_id?: number[]
  project_id?: number[]
  sprint_id?: number[]
  labels?: string[]
}

/** The shape of ViewOut on the backend. */
export interface ApiView {
  id: number
  team_id: number
  owner_id: number
  name: string
  filters: ApiFilters
  is_shared: boolean
  created_at: string
  updated_at: string
}

export interface ApiBulkResult {
  summary: { total: number; success_count: number; failure_count: number }
  results: { issue_key: string; status: 'Updated' | 'Failed'; updated_at: string | null; error: string | null }[]
}

const key = (k: string) => encodeURIComponent(k)

// Account
export const updateMe = (fields: { name?: string; username?: string; email?: string }): Promise<ApiUser> => send('/users/me', 'PATCH', fields)
export const changePassword = (current_password: string, new_password: string): Promise<{ message: string }> =>
  send('/users/me/password', 'PATCH', { current_password, new_password })

// Workspaces and members
export const createWorkspace = (fields: { name: string; slug: string }): Promise<ApiWorkspace> => send('/workspaces', 'POST', fields)
export const updateWorkspace = (fields: { name?: string; slug?: string }): Promise<ApiWorkspace> => send(w(''), 'PATCH', fields)
export const deleteWorkspace = (): Promise<null> => send(w(''), 'DELETE')
export const getMembers = (): Promise<ApiMember[]> => send(w('/members'), 'GET')
export const addMember = (usernameOrEmail: string, role: string): Promise<ApiMember> =>
  send(w('/members'), 'POST', { username_or_email: usernameOrEmail, role })
export const updateMember = (userId: number, role: string): Promise<ApiMember> => send(w(`/members/${userId}`), 'PATCH', { role })
export const removeMember = (userId: number): Promise<null> => send(w(`/members/${userId}`), 'DELETE')

// Teams
export const getTeams = (): Promise<ApiTeam[]> => send(w('/teams'), 'GET')
export const createTeam = (fields: { name: string; key: string; description: string }): Promise<ApiTeam> => send(w('/teams'), 'POST', fields)
export const updateTeam = (teamKey: string, fields: ApiTeamFields): Promise<ApiTeam> => send(w(`/teams/${key(teamKey)}`), 'PATCH', fields)
export const deleteTeam = (teamKey: string): Promise<null> => send(w(`/teams/${key(teamKey)}`), 'DELETE')

// Projects (features / epics)
export const getProjects = (teamKey: string): Promise<ApiProject[]> => send(w(`/teams/${key(teamKey)}/projects`), 'GET')
export const createProject = (teamKey: string, fields: ApiProjectFields & { name: string }): Promise<ApiProject> =>
  send(w(`/teams/${key(teamKey)}/projects`), 'POST', fields)
export const updateProject = (id: number, fields: ApiProjectFields): Promise<ApiProject> => send(w(`/projects/${id}`), 'PATCH', fields)
export const deleteProject = (id: number): Promise<null> => send(w(`/projects/${id}`), 'DELETE')

// Sprints
export const getSprints = (teamKey: string): Promise<ApiSprint[]> => send(w(`/teams/${key(teamKey)}/sprints?limit=200`), 'GET')
export const createSprint = (teamKey: string, fields: ApiSprintFields & { name: string }): Promise<ApiSprint> =>
  send(w(`/teams/${key(teamKey)}/sprints`), 'POST', fields)
export const updateSprint = (id: number, fields: ApiSprintFields): Promise<ApiSprint> => send(w(`/sprints/${id}`), 'PATCH', fields)
export const deleteSprint = (id: number): Promise<null> => send(w(`/sprints/${id}`), 'DELETE')
export const startSprint = (id: number): Promise<ApiSprint> => send(w(`/sprints/${id}/start`), 'POST')
export const completeSprint = (id: number, destinationSprintId: number | null): Promise<{ completed_issues: number; moved_issues: number }> =>
  send(w(`/sprints/${id}/complete`), 'POST', { destination_sprint_id: destinationSprintId })

// Issues
export const createIssue = (teamKey: string, fields: ApiIssueFields & { title: string }): Promise<ApiIssue> =>
  send(w(`/teams/${key(teamKey)}/issues`), 'POST', fields)
export const updateIssue = (issueKey: string, fields: ApiIssueFields): Promise<ApiIssue> => send(w(`/issues/${key(issueKey)}`), 'PATCH', fields)
export const moveIssueStatus = (issueKey: string, status: string): Promise<{ issue_key: string; status: string; updated_at: string }> =>
  send(w(`/issues/${key(issueKey)}/status`), 'PUT', { status })
export const deleteIssue = (issueKey: string): Promise<null> => send(w(`/issues/${key(issueKey)}`), 'DELETE')
export const bulkUpdateIssues = (issueKeys: string[], updates: ApiIssueFields): Promise<ApiBulkResult> =>
  send(w('/issues/bulk'), 'PATCH', { issue_keys: issueKeys, updates })
export const bulkDeleteIssues = (issueKeys: string[]): Promise<null> => send(w('/issues/bulk'), 'DELETE', { issue_keys: issueKeys })
export const getActivity = (issueKey: string): Promise<ApiActivity[]> => send(w(`/issues/${key(issueKey)}/activity`), 'GET')

// Comments
export const getComments = (issueKey: string): Promise<ApiComment[]> => send(w(`/issues/${key(issueKey)}/comments`), 'GET')
export const createComment = (issueKey: string, content: string, parentId: number | null): Promise<ApiComment> =>
  send(w(`/issues/${key(issueKey)}/comments`), 'POST', { content, parent_id: parentId })
export const updateComment = (id: number, content: string): Promise<ApiComment> => send(w(`/comments/${id}`), 'PATCH', { content })
export const deleteComment = (id: number): Promise<null> => send(w(`/comments/${id}`), 'DELETE')

// Views (saved filters)
export const getViews = (teamKey: string): Promise<ApiView[]> => send(w(`/teams/${key(teamKey)}/views`), 'GET')
export const createView = (teamKey: string, fields: { name: string; filters: ApiFilters; is_shared: boolean }): Promise<ApiView> =>
  send(w(`/teams/${key(teamKey)}/views`), 'POST', fields)
export const updateView = (id: number, fields: { name?: string; filters?: ApiFilters; is_shared?: boolean }): Promise<ApiView> =>
  send(w(`/views/${id}`), 'PATCH', fields)
export const deleteView = (id: number): Promise<null> => send(w(`/views/${id}`), 'DELETE')
