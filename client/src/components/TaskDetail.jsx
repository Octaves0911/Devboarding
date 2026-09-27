import { useState, useEffect, useCallback } from 'react';
import { Paperclip, Download, Clock, ChevronLeft, ChevronRight, AlertTriangle, ExternalLink } from 'lucide-react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import StatusBadge from './StatusBadge';
import Button from './Button';
import ConfirmModal from './ConfirmModal';
import TaskForm from './TaskForm';

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Render a task description that may contain a "## Resources" section with
 * markdown-style links: [title](url). Renders the resources section as a list
 * of clickable links; the rest is plain pre-wrapped text.
 */
function DescriptionWithResources({ text }) {
  const resourcesIdx = text.indexOf('\n\n## Resources\n');
  if (resourcesIdx === -1) {
    return <p className="text-sm text-gray-700 whitespace-pre-wrap">{text}</p>;
  }

  const mainText = text.slice(0, resourcesIdx);
  const resourcesBlock = text.slice(resourcesIdx + '\n\n## Resources\n'.length);

  // Parse markdown links: [title](url)
  const linkRegex = /^- \[(.+?)\]\((.+?)\)$/gm;
  const links = [];
  let match;
  while ((match = linkRegex.exec(resourcesBlock)) !== null) {
    links.push({ title: match[1], url: match[2] });
  }

  return (
    <>
      {mainText && <p className="text-sm text-gray-700 whitespace-pre-wrap mb-3">{mainText}</p>}
      {links.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Resources</p>
          <ul className="space-y-1.5">
            {links.map((r, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <ExternalLink size={13} className="text-blue-400 shrink-0" />
                <a
                  href={r.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 hover:underline break-all"
                >
                  {r.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

function formatDateTime(iso) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function activityLabel(act) {
  const who = act.user?.name ?? 'Someone';
  switch (act.action) {
    case 'CREATED': return `${who} created this task`;
    case 'STATUS_CHANGED': return `${who} changed status from ${act.fromStatus} to ${act.toStatus}`;
    case 'SUBTASK_COMPLETED': return `${who} completed a subtask`;
    case 'SUBTASK_UNCHECKED': return `${who} unchecked a subtask`;
    default: return `${who}: ${act.action}`;
  }
}

/**
 * TaskDetail — shared task detail view.
 *
 * Props:
 *   taskId     number           — ID to load (reloads on change)
 *   assignees  array | null     — if provided, shows edit form for creator
 *   backLabel  string           — label for back button (optional)
 *   onBack     () => void       — optional back navigation
 *   onDelete   () => void       — called after successful delete
 *   prevId     number | null    — for prev/next navigation (Mentee)
 *   nextId     number | null
 *   onNavigate (id) => void     — called when prev/next clicked
 */
export default function TaskDetail({
  taskId,
  assignees = null,
  backLabel,
  onBack,
  onDelete,
  prevId,
  nextId,
  onNavigate,
}) {
  const { user } = useAuth();
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Editing
  const [editing, setEditing] = useState(false);

  // Delete modal
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Status change
  const [statusLoading, setStatusLoading] = useState(false);

  // DONE flow
  const [doneModalOpen, setDoneModalOpen] = useState(false);
  const [completionNote, setCompletionNote] = useState('');
  const [submissionFiles, setSubmissionFiles] = useState([]);
  const [doneSubmitting, setDoneSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!taskId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/tasks/${taskId}`);
      setTask(res.data.task);
    } catch (err) {
      setError(err.response?.data?.error ?? 'Failed to load task.');
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <svg className="animate-spin w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      </div>
    );
  }

  if (error) {
    return <div className="text-center py-16 text-red-600 text-sm">{error}</div>;
  }

  if (!task) return null;

  const isCreator = task.createdById === user?.id;
  const isAssignee = task.assigneeId === user?.id;
  const allSubtasksDone = task.subtasks.every((s) => s.isDone);
  const overdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'DONE';

  const refAttachments = task.attachments.filter((a) => a.kind === 'REFERENCE');
  const subAttachments = task.attachments.filter((a) => a.kind === 'SUBMISSION');

  // ── Status controls ──────────────────────────────────────────────

  async function changeStatus(newStatus) {
    if (newStatus === 'DONE') {
      setDoneModalOpen(true);
      return;
    }
    setStatusLoading(true);
    try {
      await api.patch(`/tasks/${task.id}/status`, { status: newStatus });
      toast.success(`Status changed to ${newStatus.replace('_', ' ')}.`);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Failed to update status.');
    } finally {
      setStatusLoading(false);
    }
  }

  async function handleDoneSubmit() {
    if (!allSubtasksDone) {
      toast.error('Complete all subtasks before marking as done.');
      return;
    }
    setDoneSubmitting(true);
    try {
      await api.patch(`/tasks/${task.id}/status`, {
        status: 'DONE',
        completionNote: completionNote.trim() || undefined,
      });

      if (submissionFiles.length > 0) {
        const fd = new FormData();
        submissionFiles.forEach((f) => fd.append('files', f));
        fd.append('kind', 'SUBMISSION');
        await api.post(`/tasks/${task.id}/attachments`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      toast.success('Task marked as done.');
      setDoneModalOpen(false);
      setCompletionNote('');
      setSubmissionFiles([]);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Failed to mark done.');
    } finally {
      setDoneSubmitting(false);
    }
  }

  // ── Subtask toggle ───────────────────────────────────────────────

  async function toggleSubtask(subtaskId) {
    try {
      await api.patch(`/subtasks/${subtaskId}/toggle`);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Failed to update subtask.');
    }
  }

  // ── Delete ───────────────────────────────────────────────────────

  async function handleDelete() {
    setDeleting(true);
    try {
      await api.delete(`/tasks/${task.id}`);
      toast.success('Task deleted.');
      setDeleteOpen(false);
      onDelete?.();
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Failed to delete task.');
    } finally {
      setDeleting(false);
    }
  }

  // ── Edit mode ────────────────────────────────────────────────────

  if (editing) {
    return (
      <div className="space-y-4 max-w-2xl">
        <button
          onClick={() => setEditing(false)}
          className="text-sm text-gray-500 hover:underline"
        >
          ← Back to task
        </button>
        <h1 className="text-xl font-bold text-gray-900">Edit Task</h1>
        <TaskForm
          task={task}
          assignees={assignees ?? []}
          onSuccess={async () => {
            setEditing(false);
            await load();
            toast.success('Task updated.');
          }}
          onCancel={() => setEditing(false)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="space-y-1 flex-1 min-w-0">
          {(onBack || backLabel) && (
            <button
              onClick={onBack}
              className="text-sm text-gray-500 hover:underline mb-1 block"
            >
              ← {backLabel ?? 'Back'}
            </button>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-gray-900 break-words">{task.title}</h1>
            {overdue && (
              <span className="inline-flex items-center gap-1 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                <AlertTriangle size={11} /> Overdue
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge type="status" value={task.status} />
            <StatusBadge type="priority" value={task.priority} />
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isCreator && assignees !== null && (
            <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
              Edit
            </Button>
          )}
          {isCreator && (
            <Button size="sm" variant="danger" onClick={() => setDeleteOpen(true)}>
              Delete
            </Button>
          )}
        </div>
      </div>

      {/* Meta */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-xs text-gray-500 mb-0.5">Created by</p>
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-gray-800">{task.createdBy?.name}</span>
            <StatusBadge type="role" value={task.createdBy?.role} />
          </div>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-0.5">Assignee</p>
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-gray-800">{task.assignee?.name}</span>
            <StatusBadge type="role" value={task.assignee?.role} />
          </div>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-0.5">Due Date</p>
          <p className={`font-medium ${overdue ? 'text-red-600' : 'text-gray-800'}`}>
            {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '—'}
          </p>
        </div>
        {task.completedAt && (
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Completed At</p>
            <p className="font-medium text-gray-800">{new Date(task.completedAt).toLocaleDateString()}</p>
          </div>
        )}
      </div>

      {/* Description */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-2">Description</h2>
        <DescriptionWithResources text={task.description} />
      </div>

      {/* Status control (assignee only) */}
      {isAssignee && task.status !== 'DONE' && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">Update Status</h2>
          <div className="flex items-center gap-3 flex-wrap">
            {task.status === 'TODO' && (
              <Button
                size="sm"
                variant="secondary"
                loading={statusLoading}
                onClick={() => changeStatus('IN_PROGRESS')}
              >
                Start → In Progress
              </Button>
            )}
            {task.status === 'IN_PROGRESS' && (
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  loading={statusLoading}
                  onClick={() => changeStatus('TODO')}
                >
                  ← Back to To Do
                </Button>
                <Button
                  size="sm"
                  variant="success"
                  disabled={!allSubtasksDone}
                  loading={statusLoading}
                  onClick={() => changeStatus('DONE')}
                >
                  Mark as Done ✓
                </Button>
              </>
            )}
          </div>
          {!allSubtasksDone && task.subtasks.length > 0 && task.status === 'IN_PROGRESS' && (
            <p className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
              Complete all subtasks before marking as done.
            </p>
          )}
        </div>
      )}

      {/* Reopen (assignee, DONE state) */}
      {isAssignee && task.status === 'DONE' && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center justify-between gap-3">
          <p className="text-sm text-gray-600">This task is marked done.</p>
          <Button
            size="sm"
            variant="secondary"
            loading={statusLoading}
            onClick={() => changeStatus('IN_PROGRESS')}
          >
            Reopen
          </Button>
        </div>
      )}

      {/* Completion note */}
      {task.completionNote && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-green-800 mb-1">Completion Note</h2>
          <p className="text-sm text-green-700 whitespace-pre-wrap">{task.completionNote}</p>
        </div>
      )}

      {/* Subtasks */}
      {task.subtasks.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">
            Subtasks ({task.subtasks.filter((s) => s.isDone).length}/{task.subtasks.length} done)
          </h2>
          <ul className="space-y-2">
            {task.subtasks.map((s) => (
              <li key={s.id} className="flex items-center gap-3">
                {isAssignee ? (
                  <input
                    type="checkbox"
                    checked={s.isDone}
                    onChange={() => toggleSubtask(s.id)}
                    className="w-4 h-4 rounded accent-purple-600 cursor-pointer"
                  />
                ) : (
                  <span
                    className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                      s.isDone ? 'bg-purple-600 border-purple-600' : 'border-gray-300'
                    }`}
                  >
                    {s.isDone && (
                      <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 12">
                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                )}
                <span className={`text-sm ${s.isDone ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                  {s.title}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Reference attachments */}
      {refAttachments.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Reference Attachments</h2>
          <ul className="space-y-2">
            {refAttachments.map((att) => (
              <li key={att.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 truncate">
                  <Paperclip size={14} className="text-gray-400 shrink-0" />
                  <span className="truncate text-gray-700">{att.fileName}</span>
                  <span className="text-xs text-gray-400 shrink-0">{formatBytes(att.size)}</span>
                </div>
                <a
                  href={`/api/attachments/${att.id}/download`}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-3 shrink-0 text-purple-600 hover:text-purple-800"
                >
                  <Download size={15} />
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Submission attachments */}
      {subAttachments.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Submission Files</h2>
          <ul className="space-y-2">
            {subAttachments.map((att) => (
              <li key={att.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 truncate">
                  <Paperclip size={14} className="text-gray-400 shrink-0" />
                  <span className="truncate text-gray-700">{att.fileName}</span>
                  <span className="text-xs text-gray-400 shrink-0">{formatBytes(att.size)}</span>
                </div>
                <a
                  href={`/api/attachments/${att.id}/download`}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-3 shrink-0 text-purple-600 hover:text-purple-800"
                >
                  <Download size={15} />
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Activity timeline */}
      {task.activities?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Activity</h2>
          <ul className="space-y-3">
            {task.activities.map((act) => (
              <li key={act.id} className="flex items-start gap-3 text-sm">
                <Clock size={14} className="text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-gray-700">{activityLabel(act)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(act.createdAt)}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Prev / Next navigation */}
      {(prevId || nextId) && (
        <div className="flex justify-between pt-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={!prevId}
            onClick={() => onNavigate?.(prevId)}
          >
            <ChevronLeft size={14} /> Previous
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={!nextId}
            onClick={() => onNavigate?.(nextId)}
          >
            Next <ChevronRight size={14} />
          </Button>
        </div>
      )}

      {/* Delete modal */}
      <ConfirmModal
        open={deleteOpen}
        title="Delete Task"
        message={`Permanently delete "${task.title}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
      />

      {/* Done modal */}
      {doneModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => !doneSubmitting && setDoneModalOpen(false)} />
          <div className="relative z-10 bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-base font-semibold text-gray-900">Mark as Done</h2>

            {!allSubtasksDone && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                All subtasks must be completed first.
              </p>
            )}

            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Completion Note <span className="text-gray-400">(optional)</span>
              </label>
              <textarea
                rows={3}
                value={completionNote}
                onChange={(e) => setCompletionNote(e.target.value)}
                placeholder="Describe what was done…"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 resize-y"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Submission Files <span className="text-gray-400">(optional)</span>
              </label>
              <input
                type="file"
                multiple
                accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg,.zip"
                onChange={(e) => setSubmissionFiles(Array.from(e.target.files))}
                className="w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
              />
              {submissionFiles.length > 0 && (
                <p className="text-xs text-gray-400 mt-1">{submissionFiles.length} file(s) selected</p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button
                variant="secondary"
                onClick={() => setDoneModalOpen(false)}
                disabled={doneSubmitting}
              >
                Cancel
              </Button>
              <Button
                variant="success"
                loading={doneSubmitting}
                disabled={!allSubtasksDone}
                onClick={handleDoneSubmit}
              >
                Confirm Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
