import { Link } from 'react-router-dom'
import { Inbox as InboxIcon } from 'lucide-react'
import { StatusIcon, timeAgo } from '../components/ui'
import { useStore } from '../data/store'

/**
 * Notifications aren't built yet (API section 10), so for now the inbox lists my open issues,
 * most recently changed first.
 */
export function Inbox() {
  const { db, me } = useStore()
  const items = db.issues
    .filter((i) => i.assigneeId === me.id && i.status !== 'done')
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 40)
  return (
    <>
      <div className="content-header">
        <div className="breadcrumb">Inbox</div>
        <span className="faint">Notifications are coming; until then, your open issues by last change.</span>
      </div>
      <div className="content-main">
        {items.length === 0 ? (
          <div className="empty-state">
            <InboxIcon size={32} className="faint" /> You’re all caught up.
          </div>
        ) : (
          items.map((issue) => (
            <Link key={issue.id} to={`/issue/${issue.key}`} className="issue-row" style={{ height: 44, gap: 12, padding: '0 16px' }}>
              <StatusIcon status={issue.status} />
              <span className="mono faint">{issue.key}</span>
              <span style={{ flex: 1, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{issue.title}</span>
              <span className="faint" style={{ fontSize: 12, width: 64, textAlign: 'right' }}>{timeAgo(issue.updatedAt)}</span>
            </Link>
          ))
        )}
      </div>
    </>
  )
}
