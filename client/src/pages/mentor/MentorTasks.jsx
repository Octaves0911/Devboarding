import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import StatusBadge from '../../components/StatusBadge';
import Button from '../../components/Button';
import ConfirmModal from '../../components/ConfirmModal';

export default function MentorTasks() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [mentees, setMentees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [statusFilter, setStatusFilter] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [search, setSearch] = useState('');

  const [deleteModal, setDeleteModal] = useState({ open: false, task: null });
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [tasksRes, menteesRes] = await Promise.all([
        api.get('/tasks?scope=created'),
        api.get('/users/my-mentees'),
      ]);
      setTasks(tasksRes.data.tasks);
      setMentees(menteesRes.data.mentees);
    } catch (err) {
      setError(err.response?.data?.error ?? 'Failed to load tasks.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleDelete() {
    setDeleting(true);
    try {
      await api.delete(`/tasks/${deleteModal.task.id}`);
      toast.success('Task deleted.');
      setDeleteModal({ open: false, task: null });
      await load();
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Failed to delete task.');
    } finally {
      setDeleting(false);
    }
  }

  const overdue = (t) => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'DONE';

  const filtered = tasks.filter((t) => {
    if (statusFilter && t.status !== statusFilter) return false;
    if (assigneeFilter && String(t.assignee?.id) !== assigneeFilter) return false;
    if (priorityFilter && t.priority !== priorityFilter) return false;
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const hasFilter = statusFilter || assigneeFilter || priorityFilter || search;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-gray-900">Tasks Assigned by Me</h1>
        <Button onClick={() => navigate('/mentor/tasks/new')}>+ Assign Task</Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search by title…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="py-2 px-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 w-52"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="py-2 px-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="">All Statuses</option>
          <option value="TODO">To Do</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="DONE">Done</option>
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="py-2 px-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="">All Priorities</option>
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
        </select>
        <select
          value={assigneeFilter}
          onChange={(e) => setAssigneeFilter(e.target.value)}
          className="py-2 px-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="">All Mentees</option>
          {mentees.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
        {hasFilter && (
          <button
            onClick={() => { setStatusFilter(''); setAssigneeFilter(''); setPriorityFilter(''); setSearch(''); }}
            className="text-sm text-blue-600 hover:underline px-2"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <svg className="animate-spin w-8 h-8 text-blue-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        </div>
      ) : error ? (
        <div className="text-center py-16 text-red-600 text-sm">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">
          {hasFilter ? 'No tasks match your filters.' : 'No tasks created yet. Assign a task to get started.'}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 text-xs text-gray-500">
            {filtered.length} task{filtered.length !== 1 ? 's' : ''}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-5 py-3 text-left font-medium">Title</th>
                  <th className="px-5 py-3 text-left font-medium">Assignee</th>
                  <th className="px-5 py-3 text-left font-medium">Priority</th>
                  <th className="px-5 py-3 text-left font-medium">Status</th>
                  <th className="px-5 py-3 text-left font-medium">Due</th>
                  <th className="px-5 py-3 text-left font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => navigate(`/mentor/tasks/${t.id}`)}
                          className="font-medium text-gray-900 hover:underline text-left max-w-xs truncate block"
                        >
                          {t.title}
                        </button>
                        {overdue(t) && (
                          <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-medium shrink-0">
                            Overdue
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-gray-700">{t.assignee?.name ?? '—'}</span>
                        {t.assignee && <StatusBadge type="role" value={t.assignee.role} />}
                      </div>
                    </td>
                    <td className="px-5 py-3"><StatusBadge type="priority" value={t.priority} /></td>
                    <td className="px-5 py-3"><StatusBadge type="status" value={t.status} /></td>
                    <td className="px-5 py-3 text-gray-500">
                      {t.dueDate ? new Date(t.dueDate).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="ghost" onClick={() => navigate(`/mentor/tasks/${t.id}`)}>
                          View
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => navigate(`/mentor/tasks/${t.id}/edit`)}>
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => setDeleteModal({ open: true, task: t })}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmModal
        open={deleteModal.open}
        title="Delete Task"
        message={`Permanently delete "${deleteModal.task?.title}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteModal({ open: false, task: null })}
      />
    </div>
  );
}
