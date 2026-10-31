export type Status = 'todo' | 'in_progress' | 'in_review' | 'done'
/** 1 = Highest, 2 = High, 3 = Medium, 4 = Low, 5 = Lowest (Jira's ordering) */
export type Priority = 1 | 2 | 3 | 4 | 5
export type IssueType = 'task' | 'bug' | 'story'
/** Role in the current workspace: Admins manage members, teams and settings; Members do everything else. */
export type Role = 'Admin' | 'Member'
export type ProjectStatus = 'planned' | 'in_progress' | 'paused' | 'completed' | 'canceled'

/** A member of the current workspace (users outside it aren't loaded). */
export interface User {
  id: string
  name: string
  username: string
  email: string
  color: string
  role: Role
  avatarUrl?: string
}

export interface Workspace {
  id: string
  name: string
  /** The URL key: /w/{slug}/... on the backend. */
  slug: string
  color: string
  /** My role in this workspace. */
  role: Role
  logo?: string
}

/** A group inside the workspace that owns issues, sprints, projects and views. */
export interface Team {
  id: string
  /** Prefix of its issue keys (ENG-12). Fixed once the team exists. */
  key: string
  name: string
  description: string
  color: string
  isArchived: boolean
  /** How many issues exist now (from the backend). */
  issueCount: number
}

/** A feature or epic inside a team: the parent that groups related issues. */
export interface Project {
  id: string
  teamId: string
  name: string
  description: string
  status: ProjectStatus
  leadId: string | null
  /** Local midnight of the day, or null. */
  startDate: number | null
  targetDate: number | null
}

export type SprintStatus = 'planned' | 'active' | 'completed'

export interface Sprint {
  id: string
  teamId: string
  name: string
  goal: string
  status: SprintStatus
  start: number | null
  end: number | null
  completedAt: number | null
}

export interface Issue {
  id: string
  /** "ENG-12": the team key plus the number. */
  key: string
  teamId: string
  number: number
  type: IssueType
  /** The project (feature) this issue belongs to. */
  projectId: string | null
  title: string
  description: string
  status: Status
  priority: Priority
  assigneeId: string | null
  reporterId: string | null
  storyPoints: number
  /** null = in the backlog */
  sprintId: string | null
  /** Free-text labels, at most 5 (see components/labels.tsx). */
  labels: string[]
  dueDate: number | null
  createdAt: number
  updatedAt: number
  completedAt: number | null
  favorite: boolean
  subscribed: boolean
}

export interface Comment {
  id: string
  issueId: string
  authorId: string | null
  /** The comment this one replies to. */
  parentId: string | null
  body: string
  createdAt: number
  edited: boolean
}

/** One row of an issue's history (issue_activities on the backend). */
export interface Activity {
  id: string
  issueId: string
  actorId: string | null
  action: 'created' | 'updated'
  /** The changed field, in backend names ("status", "assignee_id"); null for "created". */
  field: string | null
  oldValue: unknown
  newValue: unknown
  createdAt: number
}

/** The issue list's filters. An empty list doesn't filter; null in assignee/project means "none". */
export interface Filters {
  status: Status[]
  priority: Priority[]
  type: IssueType[]
  assignee: (string | null)[]
  project: (string | null)[]
  label: string[]
}

/** A saved filter over one team's issues. */
export interface View {
  id: string
  teamId: string
  ownerId: string
  name: string
  filters: Filters
  isShared: boolean
}

export interface Integration {
  id: string
  name: string
  description: string
  color: string
  enabled: boolean
}

export interface ApiKey {
  id: string
  label: string
  prefix: string
  createdAt: number
  lastUsed: number | null
}

export interface Webhook {
  id: string
  url: string
  events: string[]
  enabled: boolean
}

export interface Session {
  id: string
  device: string
  location: string
  lastActive: number
  current: boolean
}

export interface ConnectedAccount {
  provider: 'GitHub' | 'GitLab' | 'Google' | 'Slack'
  handle: string | null
}

export interface SecuritySettings {
  allowedDomains: string[]
  ssoEnabled: boolean
  invitePermission: 'admins' | 'members'
}

export interface Toast {
  id: string
  message: string
  undo?: () => void
}

export interface Db {
  meId: string
  /** The workspaces I belong to (the switcher). Everything below is from the current one. */
  workspaces: Workspace[]
  currentWorkspaceId: string
  users: User[]
  teams: Team[]
  projects: Project[]
  sprints: Sprint[]
  issues: Issue[]
  comments: Comment[]
  activity: Activity[]
  views: View[]
  integrations: Integration[]
  apiKeys: ApiKey[]
  webhooks: Webhook[]
  sessions: Session[]
  connected: ConnectedAccount[]
  security: SecuritySettings
}
