import { useCallback } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { StoreProvider, UiProvider, useStore, useUi } from './data/store'
import { WorkspaceShell } from './layouts/WorkspaceShell'
import { SettingsShell } from './layouts/SettingsShell'
import { AuthGate } from './components/AuthGate'
import { clearToken } from './data/api'
import { IssueContextMenu } from './components/IssueContextMenu'
import { CommandPalette, ConfirmDelete, GlobalHotkeys, NewIssueModal, Toasts } from './components/Overlays'
import TeamIssues, { MyIssues } from './pages/IssueList'
import IssueDetail from './pages/IssueDetail'
import Login from './pages/Login'
import Backlog from './pages/Backlog'
import Board from './pages/Board'
import Sprints, { SprintIssues } from './pages/Sprints'
import TeamProjects, { ProjectPage } from './pages/Projects'
import TeamViews, { ViewPage } from './pages/Views'
import TeamSummary, { AllSummaries } from './pages/Summary'
import { Inbox } from './pages/Misc'
import { CreateWorkspace, WorkspaceLink } from './pages/Workspaces'
import { ConnectedAccounts, Profile, SecurityAccess } from './pages/settings/Personal'
import { ApiSettings, MembersSettings, SecuritySettings, TeamsSettings, WorkspaceSettings } from './pages/settings/Admin'
import { CreateTeam, TeamSettings } from './pages/settings/Teams'
import { IntegrationDetail, Integrations } from './pages/settings/Integrations'

function Home() {
  const { db } = useStore()
  const team = db.teams.find((t) => !t.isArchived) ?? db.teams[0]
  if (!team) return <Navigate to="/my-issues" replace /> // the workspace has no team yet
  return <Navigate to={`/team/${team.key}/board`} replace />
}

function AppRoutes() {
  const ui = useUi()
  const navigate = useNavigate()
  const logout = useCallback(() => {
    ui.setContextMenu(null)
    ui.setPaletteOpen(false)
    ui.setNewIssue(null)
    clearToken()
    navigate('/login', { replace: true })
  }, [ui, navigate])

  return (
    <Routes>
      <Route path="login" element={<Login />} />
      <Route
        element={
          <AuthGate>
            <IssueContextMenu />
            <NewIssueModal />
            <CommandPalette />
            <ConfirmDelete />
            <Toasts />
            <GlobalHotkeys onLogout={logout} />
          </AuthGate>
        }
      >
        <Route path="w/:slug/*" element={<WorkspaceLink />} />
        <Route element={<WorkspaceShell onLogout={logout} />}>
          <Route index element={<Home />} />
          <Route path="inbox" element={<Inbox />} />
          <Route path="my-issues" element={<MyIssues />} />
          <Route path="summaries" element={<AllSummaries />} />
          <Route path="new-workspace" element={<CreateWorkspace />} />
          <Route path="team/:teamKey" element={<Navigate to="board" replace />} />
          <Route path="team/:teamKey/backlog" element={<Backlog />} />
          <Route path="team/:teamKey/board" element={<Board />} />
          <Route path="team/:teamKey/issues" element={<TeamIssues />} />
          <Route path="team/:teamKey/projects" element={<TeamProjects />} />
          <Route path="team/:teamKey/projects/:projectId" element={<ProjectPage />} />
          <Route path="team/:teamKey/sprints" element={<Sprints />} />
          <Route path="team/:teamKey/sprints/:sprintId" element={<SprintIssues />} />
          <Route path="team/:teamKey/views" element={<TeamViews />} />
          <Route path="team/:teamKey/views/:viewId" element={<ViewPage />} />
          <Route path="team/:teamKey/summary" element={<TeamSummary />} />
          <Route path="issue/:issueKey" element={<IssueDetail />} />
        </Route>
        <Route path="settings" element={<SettingsShell />}>
          <Route index element={<Navigate to="profile" replace />} />
          <Route path="profile" element={<Profile />} />
          <Route path="security-access" element={<SecurityAccess />} />
          <Route path="connected-accounts" element={<ConnectedAccounts />} />
          <Route path="integrations" element={<Integrations />} />
          <Route path="integrations/:integrationId" element={<IntegrationDetail />} />
          <Route path="workspace" element={<WorkspaceSettings />} />
          <Route path="teams" element={<TeamsSettings />} />
          <Route path="teams/:teamKey" element={<TeamSettings />} />
          <Route path="members" element={<MembersSettings />} />
          <Route path="security" element={<SecuritySettings />} />
          <Route path="api" element={<ApiSettings />} />
          <Route path="new-team" element={<CreateTeam />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <StoreProvider>
        <UiProvider>
          <AppRoutes />
        </UiProvider>
      </StoreProvider>
    </BrowserRouter>
  )
}
