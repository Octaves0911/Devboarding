import { useState, useRef } from 'react';
import { Plus, Trash2, GripVertical, Paperclip, X, Search, Sparkles, RefreshCw, ExternalLink } from 'lucide-react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import Button from './Button';

const ALLOWED_EXTS = ['pdf', 'docx', 'xlsx', 'png', 'jpg', 'jpeg', 'zip'];
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

function Field({ label, required, error, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function inputCls(error) {
  return `w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 ${
    error ? 'border-red-400' : 'border-gray-300'
  }`;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

const ROLE_LABELS = { HR: 'HR', MENTOR: 'Mentor', MENTEE: 'Mentee' };

/**
 * AssigneeCheckboxList — create mode: multi-select checkboxes grouped by role.
 * AssigneeRadioList    — edit mode:   single-select radios grouped by role.
 *
 * Both support:
 *   - search filter
 *   - "Select all in group" (checkboxes only)
 *   - selected count badge
 */
function AssigneeCheckboxList({ assignees, selected, onChange, error }) {
  const [search, setSearch] = useState('');

  const filtered = assignees.filter(
    (u) => u.name.toLowerCase().includes(search.toLowerCase())
  );

  const grouped = Object.entries(
    filtered.reduce((acc, u) => {
      const key = u.role;
      acc[key] = acc[key] ?? [];
      acc[key].push(u);
      return acc;
    }, {})
  );

  function toggle(id) {
    const sid = String(id);
    onChange(selected.includes(sid) ? selected.filter((x) => x !== sid) : [...selected, sid]);
  }

  function toggleGroup(users) {
    const ids = users.map((u) => String(u.id));
    const allOn = ids.every((id) => selected.includes(id));
    if (allOn) {
      onChange(selected.filter((id) => !ids.includes(id)));
    } else {
      const next = [...selected];
      ids.forEach((id) => { if (!next.includes(id)) next.push(id); });
      onChange(next);
    }
  }

  return (
    <div
      className={`border rounded-lg overflow-hidden ${
        error ? 'border-red-400' : 'border-gray-300'
      }`}
    >
      {/* Search */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 bg-gray-50">
        <Search size={13} className="text-gray-400 shrink-0" />
        <input
          type="text"
          placeholder="Search people…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 text-sm bg-transparent outline-none placeholder-gray-400"
        />
        {selected.length > 0 && (
          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
            {selected.length} selected
          </span>
        )}
      </div>

      {/* Groups */}
      <div className="max-h-52 overflow-y-auto divide-y divide-gray-100">
        {grouped.length === 0 ? (
          <p className="text-xs text-gray-400 px-4 py-3 text-center">No people found.</p>
        ) : (
          grouped.map(([role, users]) => {
            const groupIds = users.map((u) => String(u.id));
            const allOn = groupIds.every((id) => selected.includes(id));
            return (
              <div key={role}>
                {/* Group header */}
                <div
                  className="flex items-center justify-between px-3 py-1.5 bg-gray-50 cursor-pointer hover:bg-gray-100"
                  onClick={() => toggleGroup(users)}
                >
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {ROLE_LABELS[role] ?? role}
                  </span>
                  <span className="text-xs text-purple-600">
                    {allOn ? 'Deselect all' : 'Select all'}
                  </span>
                </div>
                {users.map((u) => (
                  <label
                    key={u.id}
                    className="flex items-center gap-3 px-4 py-2 hover:bg-purple-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(String(u.id))}
                      onChange={() => toggle(u.id)}
                      className="w-4 h-4 rounded accent-purple-600"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{u.name}</p>
                      {u.email && (
                        <p className="text-xs text-gray-400 truncate">{u.email}</p>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function AssigneeRadioList({ assignees, selected, onChange, error }) {
  const [search, setSearch] = useState('');

  const filtered = assignees.filter(
    (u) => u.name.toLowerCase().includes(search.toLowerCase())
  );

  const grouped = Object.entries(
    filtered.reduce((acc, u) => {
      const key = u.role;
      acc[key] = acc[key] ?? [];
      acc[key].push(u);
      return acc;
    }, {})
  );

  return (
    <div
      className={`border rounded-lg overflow-hidden ${
        error ? 'border-red-400' : 'border-gray-300'
      }`}
    >
      {/* Search */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 bg-gray-50">
        <Search size={13} className="text-gray-400 shrink-0" />
        <input
          type="text"
          placeholder="Search people…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 text-sm bg-transparent outline-none placeholder-gray-400"
        />
      </div>

      {/* Groups */}
      <div className="max-h-52 overflow-y-auto divide-y divide-gray-100">
        {grouped.length === 0 ? (
          <p className="text-xs text-gray-400 px-4 py-3 text-center">No people found.</p>
        ) : (
          grouped.map(([role, users]) => (
            <div key={role}>
              <div className="px-3 py-1.5 bg-gray-50">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {ROLE_LABELS[role] ?? role}
                </span>
              </div>
              {users.map((u) => (
                <label
                  key={u.id}
                  className="flex items-center gap-3 px-4 py-2 hover:bg-purple-50 cursor-pointer"
                >
                  <input
                    type="radio"
                    name="assignee"
                    value={String(u.id)}
                    checked={selected === String(u.id)}
                    onChange={() => onChange(String(u.id))}
                    className="w-4 h-4 accent-purple-600"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{u.name}</p>
                    {u.email && (
                      <p className="text-xs text-gray-400 truncate">{u.email}</p>
                    )}
                  </div>
                </label>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── AI Preview Card — one editable task ─────────────────────────────────────
function AITaskCard({ task, index, onChange, onRemove }) {
  const [newSubtask, setNewSubtask] = useState('');

  function set(field, value) {
    onChange(index, { ...task, [field]: value });
  }

  function addSubtask() {
    const s = newSubtask.trim();
    if (!s) return;
    if ((task.subtasks || []).length >= 6) {
      toast.error('Maximum 6 subtasks per task.');
      return;
    }
    set('subtasks', [...(task.subtasks || []), s]);
    setNewSubtask('');
  }

  function removeSubtask(i) {
    set('subtasks', task.subtasks.filter((_, idx) => idx !== i));
  }

  function removeResource(i) {
    set('resources', task.resources.filter((_, idx) => idx !== i));
  }

  return (
    <div className="border border-gray-200 rounded-xl p-4 space-y-3 bg-white">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-semibold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full shrink-0">
          Task {index + 1}
        </span>
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="text-gray-400 hover:text-red-500 p-0.5 shrink-0"
          title="Remove task"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Title */}
      <input
        type="text"
        value={task.title}
        maxLength={120}
        onChange={(e) => set('title', e.target.value)}
        placeholder="Task title"
        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 font-medium"
      />

      {/* Description */}
      <textarea
        rows={2}
        value={task.description}
        onChange={(e) => set('description', e.target.value)}
        placeholder="Description"
        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 resize-y"
      />

      {/* Priority + Due date */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Priority</label>
          <select
            value={task.priority}
            onChange={(e) => set('priority', e.target.value)}
            className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
          >
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Due date</label>
          <input
            type="date"
            value={task.dueDate}
            onChange={(e) => set('dueDate', e.target.value)}
            className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
          />
        </div>
      </div>

      {/* Subtasks */}
      {(task.subtasks || []).length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-600 mb-1">Subtasks</p>
          <ul className="space-y-1">
            {task.subtasks.map((s, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <span className="flex-1 text-gray-700 truncate">{s}</span>
                <button
                  type="button"
                  onClick={() => removeSubtask(i)}
                  className="text-gray-400 hover:text-red-500 shrink-0"
                >
                  <X size={12} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {/* Add subtask */}
      {(task.subtasks || []).length < 6 && (
        <div className="flex gap-2">
          <input
            type="text"
            value={newSubtask}
            onChange={(e) => setNewSubtask(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSubtask(); } }}
            placeholder="Add subtask…"
            className="flex-1 px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
          />
          <button
            type="button"
            onClick={addSubtask}
            className="text-purple-600 hover:text-purple-800 text-xs font-medium px-2"
          >
            Add
          </button>
        </div>
      )}

      {/* Resources */}
      {(task.resources || []).length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-600 mb-1">Resources</p>
          <ul className="space-y-1">
            {task.resources.map((r, i) => (
              <li key={i} className="flex items-center gap-2 text-xs">
                <ExternalLink size={11} className="text-blue-400 shrink-0" />
                <a
                  href={r.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 text-blue-600 hover:underline truncate"
                >
                  {r.title}
                </a>
                <button
                  type="button"
                  onClick={() => removeResource(i)}
                  className="text-gray-400 hover:text-red-500 shrink-0"
                >
                  <X size={12} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── AI Assistant Tab ─────────────────────────────────────────────────────────
function AIAssistantTab({ assignees, onSuccess, onCancel }) {
  const [roadmap, setRoadmap] = useState('');
  const [startDate, setStartDate] = useState(todayStr());
  const [durationDays, setDurationDays] = useState('');
  const [generating, setGenerating] = useState(false);

  const [preview, setPreview] = useState(null); // array of tasks
  const [assigneeIds, setAssigneeIds] = useState([]);
  const [assigneeError, setAssigneeError] = useState('');
  const [creating, setCreating] = useState(false);

  const roadmapLen = roadmap.length;
  const roadmapValid = roadmapLen >= 20 && roadmapLen <= 4000;

  async function generate() {
    if (!roadmapValid) {
      toast.error('Roadmap must be 20–4000 characters.');
      return;
    }
    setGenerating(true);
    setPreview(null);
    try {
      const payload = { roadmap, startDate };
      if (durationDays && parseInt(durationDays, 10) > 0) {
        payload.durationDays = parseInt(durationDays, 10);
      }
      const res = await api.post('/ai/generate-tasks', payload);
      setPreview(res.data.tasks);
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'AI generation failed. Please try again.');
    } finally {
      setGenerating(false);
    }
  }

  function updateTask(index, updated) {
    setPreview((prev) => prev.map((t, i) => (i === index ? updated : t)));
  }

  function removeTask(index) {
    setPreview((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleCreateAll() {
    if (!preview || preview.length === 0) return;
    if (assigneeIds.length === 0) {
      setAssigneeError('At least one assignee is required.');
      return;
    }
    setAssigneeError('');
    setCreating(true);
    try {
      const res = await api.post('/ai/create-tasks', {
        tasks: preview,
        assigneeIds: assigneeIds.map((id) => parseInt(id, 10)),
      });
      toast.success(`${res.data.tasks.length} task(s) created successfully.`);
      onSuccess?.(res.data.tasks[0]);
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Failed to create tasks.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Inputs */}
      <Field label="Roadmap / Onboarding Plan" required error={!roadmapValid && roadmapLen > 0 ? 'Must be 20–4000 characters.' : undefined}>
        <textarea
          rows={5}
          value={roadmap}
          onChange={(e) => setRoadmap(e.target.value)}
          placeholder="Paste or describe the onboarding roadmap, learning plan, or list of topics for the new hire…"
          className={`${inputCls(roadmapLen > 0 && !roadmapValid)} resize-y`}
        />
        <p className={`mt-0.5 text-xs text-right ${roadmapLen > 4000 ? 'text-red-500' : 'text-gray-400'}`}>
          {roadmapLen}/4000
        </p>
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Start Date">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className={inputCls(false)}
          />
        </Field>
        <Field label="Total Duration (days)" >
          <input
            type="number"
            min="1"
            max="365"
            value={durationDays}
            onChange={(e) => setDurationDays(e.target.value)}
            placeholder="Optional"
            className={inputCls(false)}
          />
        </Field>
      </div>

      <Button
        type="button"
        onClick={generate}
        loading={generating}
        disabled={!roadmapValid}
        className="w-full"
      >
        <Sparkles size={15} />
        {generating ? 'Generating…' : 'Generate Tasks with AI'}
      </Button>

      {/* Preview */}
      {preview && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800">
              Preview — {preview.length} task{preview.length !== 1 ? 's' : ''}
            </h3>
            <button
              type="button"
              onClick={generate}
              disabled={generating}
              className="flex items-center gap-1.5 text-xs text-purple-600 hover:text-purple-800 font-medium disabled:opacity-50"
            >
              <RefreshCw size={12} className={generating ? 'animate-spin' : ''} />
              Regenerate
            </button>
          </div>

          {preview.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-6 border border-dashed border-gray-200 rounded-xl">
              All tasks removed. Click Regenerate to start over.
            </p>
          ) : (
            <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
              {preview.map((task, i) => (
                <AITaskCard
                  key={i}
                  task={task}
                  index={i}
                  onChange={updateTask}
                  onRemove={removeTask}
                />
              ))}
            </div>
          )}

          {/* Assignee selection */}
          <Field
            label={`Assignees${assigneeIds.length > 0 ? ` (${assigneeIds.length} selected)` : ''}`}
            required
            error={assigneeError}
          >
            <AssigneeCheckboxList
              assignees={assignees}
              selected={assigneeIds}
              onChange={(ids) => { setAssigneeIds(ids); setAssigneeError(''); }}
              error={assigneeError}
            />
          </Field>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            {onCancel && (
              <Button type="button" variant="secondary" onClick={onCancel} disabled={creating}>
                Cancel
              </Button>
            )}
            <Button
              type="button"
              onClick={handleCreateAll}
              loading={creating}
              disabled={preview.length === 0}
            >
              Create all ({preview.length})
            </Button>
          </div>
        </div>
      )}

      {/* Cancel before preview is available */}
      {!preview && onCancel && (
        <div className="flex justify-end">
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Main TaskForm export ─────────────────────────────────────────────────────
export default function TaskForm({ assignees = [], task = null, onSuccess, onCancel }) {
  const isEdit = !!task;

  // Tab state — only relevant in create mode
  const [activeTab, setActiveTab] = useState('manual');

  const [form, setForm] = useState({
    title: task?.title ?? '',
    description: task?.description ?? '',
    priority: task?.priority ?? 'MEDIUM',
    dueDate: task?.dueDate ? task.dueDate.split('T')[0] : '',
  });
  const [errors, setErrors] = useState({});

  // Create mode: array of string IDs; Edit mode: single string ID
  const [assigneeIds, setAssigneeIds] = useState(
    isEdit
      ? (task?.assignee?.id ? [String(task.assignee.id)] : [])
      : []
  );
  // Single selected for edit mode (radio)
  const [assigneeId, setAssigneeId] = useState(
    isEdit ? (task?.assignee?.id ? String(task.assignee.id) : '') : ''
  );

  // Subtasks: each has { id (existing) | null, title, _key (local) }
  const [subtasks, setSubtasks] = useState(
    task?.subtasks?.map((s) => ({ id: s.id, title: s.title, isDone: s.isDone, _key: s.id })) ?? []
  );

  // Existing attachments (edit mode only) — can be removed
  const [existingAttachments, setExistingAttachments] = useState(
    task?.attachments?.filter((a) => a.kind === 'REFERENCE') ?? []
  );
  const [removingAttId, setRemovingAttId] = useState(null);

  // New files to upload
  const [newFiles, setNewFiles] = useState([]);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef(null);

  const [submitting, setSubmitting] = useState(false);

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  /** Prevent Enter from submitting the form in any input except textarea */
  function preventEnterSubmit(e) {
    if (e.key === 'Enter') e.preventDefault();
  }

  // ── Subtask helpers ──────────────────────────────────────────────

  let nextKey = useRef(Date.now());
  function addSubtask() {
    setSubtasks((prev) => [...prev, { id: null, title: '', isDone: false, _key: ++nextKey.current }]);
  }
  function removeSubtask(key) {
    setSubtasks((prev) => prev.filter((s) => s._key !== key));
  }
  function updateSubtaskTitle(key, title) {
    setSubtasks((prev) => prev.map((s) => (s._key === key ? { ...s, title } : s)));
  }
  function moveSubtask(from, to) {
    if (to < 0 || to >= subtasks.length) return;
    const next = [...subtasks];
    [next[from], next[to]] = [next[to], next[from]];
    setSubtasks(next);
  }

  // ── File helpers ─────────────────────────────────────────────────

  function validateFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (!ALLOWED_EXTS.includes(ext)) return `${file.name}: unsupported type.`;
    if (file.size > MAX_SIZE) return `${file.name}: exceeds 10 MB.`;
    return null;
  }

  function addFiles(fileList) {
    const incoming = Array.from(fileList);
    const errs = incoming.map(validateFile).filter(Boolean);
    if (errs.length) { toast.error(errs[0]); return; }
    setNewFiles((prev) => [...prev, ...incoming]);
  }

  function removeNewFile(idx) {
    setNewFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  async function removeExistingAttachment(att) {
    setRemovingAttId(att.id);
    try {
      await api.delete(`/attachments/${att.id}`);
      setExistingAttachments((prev) => prev.filter((a) => a.id !== att.id));
      toast.success('Attachment removed.');
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Failed to remove attachment.');
    } finally {
      setRemovingAttId(null);
    }
  }

  // ── Validation ───────────────────────────────────────────────────

  function validate() {
    const errs = {};
    if (!form.title.trim()) errs.title = 'Title is required.';
    else if (form.title.trim().length > 120) errs.title = 'Title must be 120 characters or fewer.';
    if (!form.description.trim()) errs.description = 'Description is required.';
    else if (form.description.trim().length < 10) errs.description = 'Description must be at least 10 characters.';
    if (!form.priority) errs.priority = 'Priority is required.';
    if (!form.dueDate) errs.dueDate = 'Due date is required.';
    else if (new Date(form.dueDate) < new Date(new Date().toDateString())) errs.dueDate = 'Due date cannot be in the past.';

    if (isEdit) {
      if (!assigneeId) errs.assigneeId = 'Assignee is required.';
    } else {
      if (assigneeIds.length === 0) errs.assigneeId = 'At least one assignee is required.';
    }

    return errs;
  }

  // ── Submit ───────────────────────────────────────────────────────

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSubmitting(true);
    try {
      const basePayload = {
        title: form.title.trim(),
        description: form.description.trim(),
        priority: form.priority,
        dueDate: form.dueDate,
        subtasks: subtasks.map((s) => ({ title: s.title.trim() || 'Untitled' })),
      };

      let savedTask;
      let batchId = null;

      if (isEdit) {
        const payload = { ...basePayload, assigneeId: parseInt(assigneeId, 10) };
        const res = await api.put(`/tasks/${task.id}`, payload);
        savedTask = res.data.task;
      } else {
        // Multi-assign: send assigneeIds array
        const payload = {
          ...basePayload,
          assigneeIds: assigneeIds.map((id) => parseInt(id, 10)),
        };
        const res = await api.post('/tasks', payload);
        // Server returns { task } for single, { tasks, batchId } for multi
        if (res.data.tasks) {
          savedTask = res.data.tasks[0];
          batchId = res.data.batchId;
        } else {
          savedTask = res.data.task;
        }
      }

      // Upload new REFERENCE files
      if (newFiles.length > 0) {
        const fd = new FormData();
        newFiles.forEach((f) => fd.append('files', f));
        fd.append('kind', 'REFERENCE');
        // Pass batchId so server links files to all task copies
        if (batchId) fd.append('batchId', batchId);
        await api.post(`/tasks/${savedTask.id}/attachments`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      toast.success(isEdit ? 'Task updated.' : 'Task created.');
      onSuccess?.(savedTask);
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Failed to save task.');
    } finally {
      setSubmitting(false);
    }
  }

  // In edit mode there's no tab; render only the manual form
  if (isEdit) {
    return (
      <form onSubmit={handleSubmit} className="space-y-5 max-w-2xl">
        <ManualFormFields
          form={form}
          set={set}
          errors={errors}
          isEdit={isEdit}
          preventEnterSubmit={preventEnterSubmit}
          assignees={assignees}
          assigneeId={assigneeId}
          setAssigneeId={setAssigneeId}
          setErrors={setErrors}
          assigneeIds={assigneeIds}
          setAssigneeIds={setAssigneeIds}
          subtasks={subtasks}
          addSubtask={addSubtask}
          removeSubtask={removeSubtask}
          updateSubtaskTitle={updateSubtaskTitle}
          moveSubtask={moveSubtask}
          existingAttachments={existingAttachments}
          removingAttId={removingAttId}
          removeExistingAttachment={removeExistingAttachment}
          newFiles={newFiles}
          removeNewFile={removeNewFile}
          dragging={dragging}
          setDragging={setDragging}
          addFiles={addFiles}
          fileInputRef={fileInputRef}
          submitting={submitting}
          onCancel={onCancel}
        />
      </form>
    );
  }

  // Create mode — two tabs
  return (
    <div className="space-y-4 max-w-2xl">
      {/* Tab bar */}
      <div className="flex border-b border-gray-200">
        <button
          type="button"
          onClick={() => setActiveTab('manual')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'manual'
              ? 'border-purple-600 text-purple-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Manual
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('ai')}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'ai'
              ? 'border-purple-600 text-purple-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Sparkles size={13} />
          AI Assistant
        </button>
      </div>

      {activeTab === 'manual' ? (
        <form onSubmit={handleSubmit} className="space-y-5">
          <ManualFormFields
            form={form}
            set={set}
            errors={errors}
            isEdit={isEdit}
            preventEnterSubmit={preventEnterSubmit}
            assignees={assignees}
            assigneeId={assigneeId}
            setAssigneeId={setAssigneeId}
            setErrors={setErrors}
            assigneeIds={assigneeIds}
            setAssigneeIds={setAssigneeIds}
            subtasks={subtasks}
            addSubtask={addSubtask}
            removeSubtask={removeSubtask}
            updateSubtaskTitle={updateSubtaskTitle}
            moveSubtask={moveSubtask}
            existingAttachments={existingAttachments}
            removingAttId={removingAttId}
            removeExistingAttachment={removeExistingAttachment}
            newFiles={newFiles}
            removeNewFile={removeNewFile}
            dragging={dragging}
            setDragging={setDragging}
            addFiles={addFiles}
            fileInputRef={fileInputRef}
            submitting={submitting}
            onCancel={onCancel}
          />
        </form>
      ) : (
        <AIAssistantTab
          assignees={assignees}
          onSuccess={onSuccess}
          onCancel={onCancel}
        />
      )}
    </div>
  );
}

// ── Manual form fields extracted as a render helper ──────────────────────────
function ManualFormFields({
  form, set, errors, isEdit, preventEnterSubmit,
  assignees, assigneeId, setAssigneeId, setErrors, assigneeIds, setAssigneeIds,
  subtasks, addSubtask, removeSubtask, updateSubtaskTitle, moveSubtask,
  existingAttachments, removingAttId, removeExistingAttachment,
  newFiles, removeNewFile, dragging, setDragging, addFiles, fileInputRef,
  submitting, onCancel,
}) {
  return (
    <>
      {/* Title */}
      <Field label="Title" required error={errors.title}>
        <input
          type="text"
          maxLength={120}
          value={form.title}
          onChange={(e) => set('title', e.target.value)}
          onKeyDown={preventEnterSubmit}
          className={inputCls(errors.title)}
          placeholder="Enter task title (max 120 chars)"
        />
        <p className="mt-0.5 text-xs text-gray-400 text-right">{form.title.length}/120</p>
      </Field>

      {/* Description */}
      <Field label="Description" required error={errors.description}>
        <textarea
          rows={4}
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
          className={`${inputCls(errors.description)} resize-y`}
          placeholder="Describe the task (min 10 chars)"
        />
      </Field>

      {/* Priority + Due Date */}
      <div className="grid grid-cols-2 gap-4">
        <Field label="Priority" required error={errors.priority}>
          <select
            value={form.priority}
            onChange={(e) => set('priority', e.target.value)}
            onKeyDown={preventEnterSubmit}
            className={inputCls(errors.priority)}
          >
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
          </select>
        </Field>

        <Field label="Due Date" required error={errors.dueDate}>
          <input
            type="date"
            min={todayStr()}
            value={form.dueDate}
            onChange={(e) => set('dueDate', e.target.value)}
            onKeyDown={preventEnterSubmit}
            className={inputCls(errors.dueDate)}
          />
        </Field>
      </div>

      {/* Assignee — grouped + searchable checkbox (create) or radio (edit) */}
      <Field
        label={isEdit ? 'Assignee' : `Assignees${assigneeIds.length > 0 ? ` (${assigneeIds.length} selected)` : ''}`}
        required
        error={errors.assigneeId}
      >
        {isEdit ? (
          <AssigneeRadioList
            assignees={assignees}
            selected={assigneeId}
            onChange={(id) => {
              setAssigneeId(id);
              setErrors((prev) => ({ ...prev, assigneeId: undefined }));
            }}
            error={errors.assigneeId}
          />
        ) : (
          <AssigneeCheckboxList
            assignees={assignees}
            selected={assigneeIds}
            onChange={(ids) => {
              setAssigneeIds(ids);
              setErrors((prev) => ({ ...prev, assigneeId: undefined }));
            }}
            error={errors.assigneeId}
          />
        )}
      </Field>

      {/* Subtasks */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700">Subtasks</label>
          <Button type="button" size="sm" variant="ghost" onClick={addSubtask}>
            <Plus size={14} /> Add subtask
          </Button>
        </div>
        {subtasks.length === 0 ? (
          <p className="text-xs text-gray-400 py-3 text-center border border-dashed border-gray-200 rounded-lg">
            No subtasks yet. Click "Add subtask" to create one.
          </p>
        ) : (
          <ul className="space-y-2">
            {subtasks.map((s, idx) => (
              <li key={s._key} className="flex items-center gap-2">
                <div className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={() => moveSubtask(idx, idx - 1)}
                    disabled={idx === 0}
                    className="text-gray-300 hover:text-gray-500 disabled:invisible p-0.5"
                  >
                    <GripVertical size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveSubtask(idx, idx + 1)}
                    disabled={idx === subtasks.length - 1}
                    className="text-gray-300 hover:text-gray-500 disabled:invisible p-0.5"
                  >
                    <GripVertical size={12} className="rotate-180" />
                  </button>
                </div>
                <input
                  type="text"
                  value={s.title}
                  onChange={(e) => updateSubtaskTitle(s._key, e.target.value)}
                  onKeyDown={preventEnterSubmit}
                  placeholder={`Subtask ${idx + 1}`}
                  className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
                <button
                  type="button"
                  onClick={() => removeSubtask(s._key)}
                  className="text-gray-400 hover:text-red-500 p-1"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Attachments */}
      <div>
        <label className="text-sm font-medium text-gray-700 block mb-2">
          Reference Attachments
        </label>

        {/* Existing attachments (edit mode) */}
        {existingAttachments.length > 0 && (
          <ul className="mb-2 space-y-1">
            {existingAttachments.map((att) => (
              <li key={att.id} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 text-sm">
                <div className="flex items-center gap-2 truncate">
                  <Paperclip size={13} className="text-gray-400 shrink-0" />
                  <span className="truncate text-gray-700">{att.fileName}</span>
                  <span className="text-xs text-gray-400 shrink-0">{formatBytes(att.size)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => removeExistingAttachment(att)}
                  disabled={removingAttId === att.id}
                  className="text-gray-400 hover:text-red-500 ml-2 shrink-0 disabled:opacity-50"
                >
                  <X size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* New files */}
        {newFiles.length > 0 && (
          <ul className="mb-2 space-y-1">
            {newFiles.map((f, i) => (
              <li key={i} className="flex items-center justify-between px-3 py-2 bg-purple-50 rounded-lg border border-purple-100 text-sm">
                <div className="flex items-center gap-2 truncate">
                  <Paperclip size={13} className="text-purple-400 shrink-0" />
                  <span className="truncate text-gray-700">{f.name}</span>
                  <span className="text-xs text-gray-400 shrink-0">{formatBytes(f.size)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => removeNewFile(i)}
                  className="text-gray-400 hover:text-red-500 ml-2 shrink-0"
                >
                  <X size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg px-4 py-5 text-center cursor-pointer transition-colors ${
            dragging ? 'border-purple-400 bg-purple-50' : 'border-gray-200 hover:border-purple-300 hover:bg-gray-50'
          }`}
        >
          <Paperclip size={18} className="mx-auto mb-1 text-gray-400" />
          <p className="text-xs text-gray-500">
            Drag & drop files here or <span className="text-purple-600 underline">browse</span>
          </p>
          <p className="text-xs text-gray-400 mt-0.5">pdf, docx, xlsx, png, jpg, zip — max 10 MB each</p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg,.zip"
            className="hidden"
            onChange={(e) => addFiles(e.target.files)}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-2">
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
        )}
        <Button type="submit" loading={submitting}>
          {isEdit ? 'Save Changes' : 'Create Task'}
        </Button>
      </div>
    </>
  );
}
