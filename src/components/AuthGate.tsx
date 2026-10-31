import { useEffect, useState, type ReactNode } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useStore } from '../data/store'
import { CreateWorkspace } from '../pages/Workspaces'

/** Wraps every page that needs a logged-in user. children = things that only exist while logged in. */
export function AuthGate({ children }: { children: ReactNode }) {
  const { db, loadSession } = useStore()
  const [status, setStatus] = useState<'checking' | 'in' | 'out'>('checking')

  useEffect(() => {
    // Check the token first (fails → /login), then load my workspaces and open one before any page shows.
    loadSession()
      .then(() => setStatus('in'))
      .catch(() => setStatus('out'))
  }, [])

  if (status === 'checking') return null
  if (status === 'out') return <Navigate to="/login" replace />
  // A new account belongs to no workspace yet: it starts by creating one (or waits to be added).
  if (!db.currentWorkspaceId) return <CreateWorkspace firstOne />
  return (
    <>
      <Outlet />
      {children}
    </>
  )
}
