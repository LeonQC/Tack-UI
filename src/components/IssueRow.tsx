import { useNavigate } from 'react-router-dom'
import { Repeat } from 'lucide-react'
import { Avatar, IssueTypeIcon, PriorityIcon, ProjectIcon, StatusIcon, shortDate } from './ui'
import { labelColor } from './labels'
import { useStore, useUi } from '../data/store'
import type { Issue } from '../data/types'

export function IssueLabels({ issue }: { issue: Issue }) {
  return (
    <>
      {issue.labels.map((name) => (
        <span key={name} className="chip">
          <span className="dot" style={{ background: labelColor(name) }} />
          {name}
        </span>
      ))}
    </>
  )
}

/** The project and sprint an issue belongs to, as small chips. */
export function IssueChips({ issue, showSprint = true, showProject = true }: { issue: Issue; showSprint?: boolean; showProject?: boolean }) {
  const { db, project } = useStore()
  const p = project(issue.projectId)
  const sprint = db.sprints.find((s) => s.id === issue.sprintId)
  return (
    <>
      {showProject && p && (
        <span className="chip project-chip" title={`Project ${p.name}`}>
          <ProjectIcon status={p.status} size={12} /> {p.name}
        </span>
      )}
      {showSprint && sprint && (
        <span className="chip">
          <Repeat size={12} /> {sprint.name}
        </span>
      )}
    </>
  )
}

export function IssueRow({
  issue,
  selected = false,
  onToggleSelect,
  draggable,
  showSprint = true,
  showProject = true,
}: {
  issue: Issue
  selected?: boolean
  onToggleSelect?: () => void
  /** Lets the row be dragged onto a sprint or the backlog (the Backlog page). */
  draggable?: boolean
  showSprint?: boolean
  showProject?: boolean
}) {
  const { user } = useStore()
  const { setContextMenu } = useUi()
  const navigate = useNavigate()
  return (
    <div
      className={`issue-row${selected ? ' selected' : ''}`}
      draggable={draggable}
      onDragStart={(e) => e.dataTransfer.setData('text/issue', issue.id)}
      onClick={(e) => ((e.ctrlKey || e.metaKey || e.shiftKey) && onToggleSelect ? onToggleSelect() : navigate(`/issue/${issue.key}`))}
      onContextMenu={(e) => {
        e.preventDefault()
        setContextMenu({ issueId: issue.id, x: e.clientX, y: e.clientY })
      }}
    >
      <span className="check-slot" onClick={(e) => e.stopPropagation()}>
        {onToggleSelect && <input type="checkbox" className="checkbox" checked={selected} onChange={onToggleSelect} aria-label="Select issue" />}
      </span>
      <IssueTypeIcon type={issue.type} />
      <span className="id mono">{issue.key}</span>
      <StatusIcon status={issue.status} />
      <span className="title">{issue.title}</span>
      <span className="meta">
        <IssueChips issue={issue} showSprint={showSprint} showProject={showProject} />
        <IssueLabels issue={issue} />
        <PriorityIcon priority={issue.priority} />
        {issue.storyPoints > 0 && <span className="points" title="Story points">{issue.storyPoints}</span>}
        <Avatar user={user(issue.assigneeId)} size={18} />
        <span className="date">{shortDate(issue.createdAt)}</span>
      </span>
    </div>
  )
}
