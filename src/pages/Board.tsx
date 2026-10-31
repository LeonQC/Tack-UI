import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Columns3 } from 'lucide-react'
import { Avatar, IssueTypeIcon, PriorityIcon, ProjectIcon, StatusIcon } from '../components/ui'
import { CompleteSprintModal, daysLeft, sprintDates } from './Sprints'
import { TeamCrumb, useRouteTeam } from './IssueList'
import { STATUSES } from '../data/meta'
import { useStore, useUi } from '../data/store'
import type { Issue, Status } from '../data/types'

function Card({ issue }: { issue: Issue }) {
  const { user, project } = useStore()
  const { setContextMenu } = useUi()
  const navigate = useNavigate()
  const p = project(issue.projectId)
  return (
    <div
      className="board-card"
      draggable
      onDragStart={(e) => e.dataTransfer.setData('text/issue', issue.id)}
      onClick={() => navigate(`/issue/${issue.key}`)}
      onContextMenu={(e) => {
        e.preventDefault()
        setContextMenu({ issueId: issue.id, x: e.clientX, y: e.clientY })
      }}
    >
      <div style={{ fontWeight: 500 }}>{issue.title}</div>
      {p && (
        <span className="chip project-chip" style={{ alignSelf: 'flex-start' }}>
          <ProjectIcon status={p.status} size={12} /> {p.name}
        </span>
      )}
      <div className="row" style={{ gap: 6 }}>
        <IssueTypeIcon type={issue.type} />
        <span className="mono faint">{issue.key}</span>
        <span className="spacer" />
        <PriorityIcon priority={issue.priority} />
        {issue.storyPoints > 0 && <span className="points">{issue.storyPoints}</span>}
        <Avatar user={user(issue.assigneeId)} size={18} />
      </div>
    </div>
  )
}

/** The Scrum board: the active sprint's issues, one column per status. Drag a card to change its status. */
export default function Board() {
  const { db, me, updateIssue } = useStore()
  const team = useRouteTeam()
  const [dragOver, setDragOver] = useState<Status | null>(null)
  const [onlyMine, setOnlyMine] = useState(false)
  const [completing, setCompleting] = useState(false)
  if (!team) return <div className="empty-state">Team not found.</div>
  const sprint = db.sprints.find((s) => s.teamId === team.id && s.status === 'active')
  const issues = sprint
    ? db.issues.filter((i) => i.sprintId === sprint.id && (!onlyMine || i.assigneeId === me.id)).sort((a, b) => a.priority - b.priority || a.number - b.number)
    : []
  const left = sprint ? daysLeft(sprint) : null

  return (
    <>
      <div className="content-header">
        <div className="breadcrumb">
          <TeamCrumb teamId={team.id}>{sprint ? sprint.name : 'Board'}</TeamCrumb>
          {sprint && <span className="faint" style={{ fontWeight: 400 }}>{sprintDates(sprint)}</span>}
        </div>
        <span className="spacer" />
        {sprint && (
          <>
            {left !== null && <span className="muted">{left} day{left === 1 ? '' : 's'} left</span>}
            <button className={`btn sm${onlyMine ? '' : ' ghost'}`} onClick={() => setOnlyMine(!onlyMine)} aria-pressed={onlyMine}>
              Only my issues
            </button>
            <button className="btn sm" onClick={() => setCompleting(true)}>
              Complete sprint
            </button>
          </>
        )}
      </div>
      <div className="content-main">
        {!sprint ? (
          <div className="empty-state">
            <Columns3 size={32} className="faint" />
            No active sprint. Plan one and start it from the backlog.
            <Link className="btn" to={`/team/${team.key}/backlog`}>Go to backlog</Link>
          </div>
        ) : (
          <>
            {sprint.goal && <div className="muted" style={{ padding: '10px 16px 0' }}>Goal: {sprint.goal}</div>}
            <div className="board">
              {STATUSES.map((s) => {
                const col = issues.filter((i) => i.status === s.id)
                return (
                  <div
                    key={s.id}
                    className="board-col"
                    style={{ outline: dragOver === s.id ? '1px dashed var(--border-strong)' : undefined, borderRadius: 8, minHeight: 200 }}
                    onDragOver={(e) => {
                      e.preventDefault()
                      setDragOver(s.id)
                    }}
                    onDragLeave={() => setDragOver(null)}
                    onDrop={(e) => {
                      const id = e.dataTransfer.getData('text/issue')
                      const issue = db.issues.find((i) => i.id === id)
                      if (issue && issue.status !== s.id) updateIssue(id, { status: s.id })
                      setDragOver(null)
                    }}
                  >
                    <div className="board-col-header">
                      <StatusIcon status={s.id} /> {s.name} <span className="faint">{col.length}</span>
                    </div>
                    {col.map((i) => (
                      <Card key={i.id} issue={i} />
                    ))}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
      {completing && sprint && <CompleteSprintModal sprint={sprint} onClose={() => setCompleting(false)} />}
    </>
  )
}
