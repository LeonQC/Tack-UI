import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  Archive, Box, ChevronDown, ChevronRight, CircleDot, Columns3, Download, Filter, HelpCircle, Inbox, Layers, ListTodo, LogOut, Plus,
  Repeat, Search, Settings, Sparkles, SquarePen, Users,
} from 'lucide-react'
import { Menu, type MenuEntry } from '../components/Menu'
import { TeamAvatar, initials } from '../components/ui'
import { useOpenNewIssue } from '../components/Overlays'
import { useStore, useUi } from '../data/store'

const navClass = ({ isActive }: { isActive: boolean }) => `nav-item${isActive ? ' selected' : ''}`

export function WorkspaceAvatar({ name, color, size = 20 }: { name: string; color: string; size?: number }) {
  return (
    <span className="avatar square" style={{ width: size, height: size, background: color, fontSize: size * 0.42 }}>
      {initials(name)}
    </span>
  )
}

export function AccountMenu({ x, y, onClose, onLogout }: { x: number; y: number; onClose: () => void; onLogout: () => void }) {
  const { db, switchWorkspace, toast } = useStore()
  const navigate = useNavigate()
  const entries: MenuEntry[] = [
    { label: 'Settings', icon: <Settings size={16} />, shortcut: ['G', 'then', 'S'], onSelect: () => navigate('/settings/profile') },
    { label: 'Manage members', icon: <Users size={16} />, onSelect: () => navigate('/settings/members') },
    { kind: 'divider' },
    { label: 'Download desktop app', icon: <Download size={16} />, onSelect: () => toast('Desktop app is not part of this demo') },
    { kind: 'divider' },
    {
      label: 'Switch workspace',
      icon: <Repeat size={16} />,
      shortcut: ['O', 'then', 'W'],
      hotkey: 'o',
      submenu: {
        entries: [
          ...db.workspaces.map((w) => ({
            label: w.name,
            icon: <WorkspaceAvatar name={w.name} color={w.color} size={16} />,
            checked: w.id === db.currentWorkspaceId,
            onSelect: async () => {
              if (w.id === db.currentWorkspaceId) return
              // Everything on screen belongs to the old workspace, so start again from its home page.
              if (await switchWorkspace(w.slug)) {
                navigate('/', { replace: true })
                toast(`Switched to ${w.name}`)
              }
            },
          })),
          { kind: 'divider' as const },
          { label: 'Create workspace', icon: <Plus size={14} />, onSelect: () => navigate('/new-workspace') },
        ],
      },
    },
    { label: 'Log out', icon: <LogOut size={16} />, shortcut: ['Alt', '⇧', 'Q'], onSelect: onLogout },
  ]
  return <Menu x={x} y={y} entries={entries} onClose={onClose} width={260} />
}

const TEAM_PAGES = [
  { path: 'backlog', label: 'Backlog', icon: ListTodo },
  { path: 'board', label: 'Board', icon: Columns3 },
  { path: 'issues', label: 'Issues', icon: Layers },
  { path: 'projects', label: 'Projects', icon: Box },
  { path: 'sprints', label: 'Sprints', icon: Repeat },
  { path: 'views', label: 'Views', icon: Filter },
]

function TeamGroup({ teamId }: { teamId: string }) {
  const { team } = useStore()
  const t = team(teamId)
  const [open, setOpen] = useState(true)
  const base = `/team/${t.key}`
  return (
    <div>
      <button className="nav-item" onClick={() => setOpen(!open)} title={`${t.name} (${t.key})`}>
        <TeamAvatar team={t} size={16} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
        {t.isArchived && <Archive size={12} className="faint" />}
        {open ? <ChevronDown size={12} className="faint" /> : <ChevronRight size={12} className="faint" />}
      </button>
      {open && (
        <>
          {TEAM_PAGES.map(({ path, label, icon: Icon }) => (
            // Projects, sprints and views have pages below them (…/projects/12), which keep the item highlighted.
            <NavLink key={path} to={`${base}/${path}`} end={!['projects', 'sprints', 'views'].includes(path)} className={({ isActive }) => navClass({ isActive }) + ' child'}>
              <Icon size={16} /> {label}
            </NavLink>
          ))}
          <NavLink to={`${base}/summary`} className={({ isActive }) => navClass({ isActive }) + ' child'}>
            <Sparkles size={16} className="sparkle" /> Summary
          </NavLink>
        </>
      )}
    </div>
  )
}

export function WorkspaceShell({ onLogout }: { onLogout: () => void }) {
  const { db, workspace, isAdmin } = useStore()
  const ui = useUi()
  const [accountMenu, setAccountMenu] = useState<{ x: number; y: number } | null>(null)
  const [teamsOpen, setTeamsOpen] = useState(true)
  const openNewIssue = useOpenNewIssue()
  const ws = workspace!
  const teams = [...db.teams].sort((a, b) => Number(a.isArchived) - Number(b.isArchived) || a.name.localeCompare(b.name))

  return (
    <div className="shell">
      <aside className={`sidebar${ui.sidebarCollapsed ? ' collapsed' : ''}`}>
        <div className="sidebar-top">
          <button
            className="ws-switcher"
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect()
              setAccountMenu({ x: r.left, y: r.bottom + 4 })
            }}
          >
            <WorkspaceAvatar name={ws.name} color={ws.color} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ws.name}</span>
            <ChevronDown size={12} className="faint" />
          </button>
          <span className="spacer" />
          <button className="icon-btn" aria-label="Search" title="Search (Ctrl K)" onClick={() => ui.setPaletteOpen(true)}>
            <Search size={16} />
          </button>
          <button className="icon-btn" aria-label="New issue" title="New issue (C)" onClick={() => openNewIssue()}>
            <SquarePen size={16} />
          </button>
        </div>

        <NavLink to="/inbox" className={navClass}>
          <Inbox size={16} /> Inbox
        </NavLink>
        <NavLink to="/my-issues" className={navClass}>
          <CircleDot size={16} /> My issues
        </NavLink>

        <div className="nav-section">
          <div className="section-header">Workspace</div>
          <NavLink to="/summaries" className={navClass}>
            <Sparkles size={16} className="sparkle" /> AI Summaries
          </NavLink>
        </div>

        <div className="nav-section">
          <button className="section-header" onClick={() => setTeamsOpen(!teamsOpen)}>
            Your teams {teamsOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
          {teamsOpen && teams.map((t) => <TeamGroup key={t.id} teamId={t.id} />)}
          {teamsOpen && teams.length === 0 && (
            <div className="faint" style={{ padding: '4px 12px', fontSize: 12 }}>{isAdmin ? 'No teams yet.' : 'No teams yet. An Admin creates them.'}</div>
          )}
          {isAdmin && (
            <NavLink to="/settings/new-team" className={navClass}>
              <Plus size={16} /> Create team
            </NavLink>
          )}
        </div>

        <span className="spacer" />
        <a className="nav-item" href="https://support.atlassian.com/jira-software-cloud/" target="_blank" rel="noreferrer">
          <HelpCircle size={16} /> Help
        </a>
      </aside>
      <main className="content">
        <Outlet />
      </main>
      {accountMenu && <AccountMenu x={accountMenu.x} y={accountMenu.y} onClose={() => setAccountMenu(null)} onLogout={onLogout} />}
    </div>
  )
}
