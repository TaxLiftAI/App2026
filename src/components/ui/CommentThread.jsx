import { useState } from 'react'
import { MessageSquare, Reply, CheckCircle2, ChevronDown, ChevronUp, Send, Lock } from 'lucide-react'
import { USERS } from '../../data/mockData'
import { formatDateTime } from '../../lib/utils'
import { useAuth } from '../../context/AuthContext'

const userMap = Object.fromEntries(USERS.map(u => [u.id, u]))

// ── Avatar ─────────────────────────────────────────────────────────────────────
function Avatar({ userId, size = 'sm' }) {
  const user = userMap[userId]
  const initials = user ? user.display_name.split(' ').map(n => n[0]).join('').slice(0, 2) : '?'
  const dim = size === 'sm' ? 'w-6 h-6 text-[10px]' : 'w-8 h-8 text-xs'
  return (
    <div className={`${dim} rounded-full bg-indigo-100 flex items-center justify-center font-bold text-indigo-700 flex-shrink-0`}>
      {initials}
    </div>
  )
}

// ── Parse @mentions ────────────────────────────────────────────────────────────
function CommentBody({ content }) {
  const parts = content.split(/(@u-\w+)/g)
  return (
    <p className="text-sm text-gray-700 leading-relaxed">
      {parts.map((part, i) => {
        if (part.match(/^@u-\w+$/)) {
          const user = userMap[part.slice(1)]
          return (
            <span key={i} className="inline-flex items-center px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 text-xs font-medium">
              @{user?.display_name ?? part.slice(1)}
            </span>
          )
        }
        return part
      })}
    </p>
  )
}

// ── Single reply ───────────────────────────────────────────────────────────────
function CommentReply({ reply }) {
  const user = userMap[reply.user_id]
  return (
    <div className="flex gap-2.5 py-2">
      <div className="flex-shrink-0 flex flex-col items-center">
        <div className="w-px h-3 bg-gray-200" />
        <Avatar userId={reply.user_id} size="sm" />
      </div>
      <div className="flex-1 min-w-0 pb-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold text-gray-800">{user?.display_name ?? reply.user_id}</span>
          <span className="text-[10px] text-gray-400">{formatDateTime(reply.created_at)}</span>
        </div>
        <CommentBody content={reply.content} />
      </div>
    </div>
  )
}

// ── Reply composer ─────────────────────────────────────────────────────────────
function ReplyComposer({ onSubmit, onCancel }) {
  const [text, setText] = useState('')
  const { currentUser } = useAuth()

  function handleSubmit(e) {
    e.preventDefault()
    if (!text.trim()) return
    onSubmit(text.trim())
    setText('')
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 mt-2 pl-8">
      <Avatar userId={currentUser?.id ?? 'u-001'} size="sm" />
      <div className="flex-1 relative">
        <input
          type="text"
          placeholder="Write a reply… (use @name to mention)"
          value={text}
          onChange={e => setText(e.target.value)}
          autoFocus
          className="w-full pr-10 pl-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-700 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-indigo-500 hover:text-indigo-700 disabled:text-gray-300 transition-colors"
        >
          <Send size={13} />
        </button>
      </div>
      <button
        type="button"
        onClick={onCancel}
        className="text-xs text-gray-400 hover:text-gray-600 transition-colors px-1"
      >
        Cancel
      </button>
    </form>
  )
}

// ── Single thread ──────────────────────────────────────────────────────────────
function CommentItem({ comment, onResolve, onAddReply }) {
  const [showReplies, setShowReplies] = useState(true)
  const [replying, setReplying] = useState(false)
  const { currentUser } = useAuth()
  const user = userMap[comment.user_id]
  const canResolve = currentUser && ['Admin', 'Reviewer'].includes(currentUser.role)

  function handleAddReply(text) {
    onAddReply(comment.id, text)
    setReplying(false)
  }

  return (
    <div className={`rounded-xl border transition-colors ${
      comment.resolved
        ? 'border-gray-100 bg-gray-50'
        : 'border-gray-200 bg-white shadow-sm'
    }`}>
      {/* Thread header */}
      <div className="flex gap-3 p-3">
        <Avatar userId={comment.user_id} size="md" />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="text-sm font-semibold text-gray-800">{user?.display_name ?? comment.user_id}</span>
              <span className="text-xs text-gray-400 ml-2">{formatDateTime(comment.created_at)}</span>
              {user?.role && (
                <span className="ml-2 text-[10px] font-medium px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600">{user.role}</span>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {comment.resolved && (
                <span className="flex items-center gap-1 text-[10px] font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                  <CheckCircle2 size={10} /> Resolved
                </span>
              )}
              {!comment.resolved && canResolve && (
                <button
                  onClick={() => onResolve(comment.id)}
                  className="flex items-center gap-1 text-[10px] font-medium text-gray-400 hover:text-green-600 hover:bg-green-50 px-2 py-0.5 rounded-full border border-gray-200 hover:border-green-200 transition-colors"
                >
                  <CheckCircle2 size={10} /> Resolve
                </button>
              )}
            </div>
          </div>
          <div className={`mt-1 ${comment.resolved ? 'opacity-60' : ''}`}>
            <CommentBody content={comment.content} />
          </div>

          {/* Reply / expand controls */}
          <div className="flex items-center gap-3 mt-2">
            {!comment.resolved && (
              <button
                onClick={() => setReplying(r => !r)}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-indigo-600 transition-colors"
              >
                <Reply size={12} /> Reply
              </button>
            )}
            {comment.replies.length > 0 && (
              <button
                onClick={() => setShowReplies(s => !s)}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showReplies ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                {comment.replies.length} {comment.replies.length === 1 ? 'reply' : 'replies'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Replies */}
      {showReplies && comment.replies.length > 0 && (
        <div className="px-3 pb-2 border-t border-gray-100 divide-y divide-gray-50">
          {comment.replies.map(reply => (
            <CommentReply key={reply.id} reply={reply} />
          ))}
        </div>
      )}

      {/* Reply composer */}
      {replying && (
        <div className="px-3 pb-3 border-t border-gray-100">
          <ReplyComposer
            onSubmit={handleAddReply}
            onCancel={() => setReplying(false)}
          />
        </div>
      )}
    </div>
  )
}

// ── New comment composer ───────────────────────────────────────────────────────
function NewCommentComposer({ onSubmit }) {
  const [text, setText] = useState('')
  const [focused, setFocused] = useState(false)
  const { currentUser } = useAuth()

  function handleSubmit(e) {
    e.preventDefault()
    if (!text.trim()) return
    onSubmit(text.trim())
    setText('')
    setFocused(false)
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className={`flex gap-3 p-3 rounded-xl border transition-all ${
        focused ? 'border-indigo-300 bg-white shadow-sm' : 'border-gray-200 bg-gray-50'
      }`}>
        <Avatar userId={currentUser?.id ?? 'u-001'} size="md" />
        <div className="flex-1 min-w-0">
          <textarea
            placeholder="Add a comment… use @name to mention a teammate"
            value={text}
            onChange={e => setText(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => !text && setFocused(false)}
            rows={focused ? 3 : 1}
            className="w-full resize-none bg-transparent text-sm text-gray-700 placeholder-gray-400 focus:outline-none"
          />
          {focused && (
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
              <p className="text-[10px] text-gray-400">Comments are visible to all users with cluster access.</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setText(''); setFocused(false) }}
                  className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!text.trim()}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-lg transition-colors"
                >
                  <Send size={11} /> Comment
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </form>
  )
}

// ── Main CommentThread export ──────────────────────────────────────────────────
export default function CommentThread({ clusterId, initialComments = [] }) {
  const [comments, setComments] = useState(initialComments)
  const [showResolved, setShowResolved] = useState(false)
  const { currentUser } = useAuth()

  const open = comments.filter(c => !c.resolved)
  const resolved = comments.filter(c => c.resolved)

  function addComment(text) {
    const newComment = {
      id: `cmt-${Date.now()}`,
      cluster_id: clusterId,
      user_id: currentUser?.id ?? 'u-001',
      content: text,
      created_at: new Date().toISOString(),
      resolved: false,
      replies: [],
    }
    setComments(prev => [newComment, ...prev])
  }

  function resolveComment(commentId) {
    setComments(prev => prev.map(c =>
      c.id === commentId ? { ...c, resolved: true } : c
    ))
  }

  function addReply(commentId, text) {
    const reply = {
      id: `cmt-${Date.now()}-r`,
      user_id: currentUser?.id ?? 'u-001',
      content: text,
      created_at: new Date().toISOString(),
    }
    setComments(prev => prev.map(c =>
      c.id === commentId ? { ...c, replies: [...c.replies, reply] } : c
    ))
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare size={15} className="text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-900">Comments</h3>
          {open.length > 0 && (
            <span className="text-xs font-medium px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded-full">
              {open.length} open
            </span>
          )}
        </div>
        {resolved.length > 0 && (
          <button
            onClick={() => setShowResolved(s => !s)}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            <Lock size={11} />
            {showResolved ? 'Hide' : 'Show'} {resolved.length} resolved
          </button>
        )}
      </div>

      {/* New comment composer */}
      <NewCommentComposer onSubmit={addComment} />

      {/* Open threads */}
      {open.length === 0 && !showResolved && (
        <p className="text-xs text-gray-400 text-center py-4">No open comments. Add one above to start a discussion.</p>
      )}
      {open.map(comment => (
        <CommentItem
          key={comment.id}
          comment={comment}
          onResolve={resolveComment}
          onAddReply={addReply}
        />
      ))}

      {/* Resolved threads */}
      {showResolved && resolved.length > 0 && (
        <>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Resolved</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>
          {resolved.map(comment => (
            <CommentItem
              key={comment.id}
              comment={comment}
              onResolve={resolveComment}
              onAddReply={addReply}
            />
          ))}
        </>
      )}
    </div>
  )
}
