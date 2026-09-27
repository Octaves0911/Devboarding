import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import StatusBadge from '../../components/StatusBadge';

export default function MentorMyTasks() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get('/tasks?scope=assigned');
        setTasks(res.data.tasks);
      } catch (err) {
        setError(err.response?.data?.error ?? 'Failed to load tasks.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const overdue = (t) => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'DONE';

  const filtered = tasks.filter((t) => !statusFilter || t.status === statusFilter);

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-gray-900">My Tasks</h1>
      <p className="text-sm text-gray-500">Tasks assigned to you by HR.</p>

      <div className="flex gap-3">
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
        {statusFilter && (
          <button onClick={() => setStatusFilter('')} className="text-sm text-blue-600 hover:underline px-2">
            Clear
          </button>
        )}
      </div>

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
          {statusFilter ? 'No tasks match your filter.' : 'No tasks assigned to you yet.'}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-5 py-3 text-left font-medium">Title</th>
                  <th className="px-5 py-3 text-left font-medium">From</th>
                  <th className="px-5 py-3 text-left font-medium">Priority</th>
                  <th className="px-5 py-3 text-left font-medium">Status</th>
                  <th className="px-5 py-3 text-left font-medium">Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => navigate(`/mentor/my-tasks/${t.id}`)}
                    className="hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 max-w-xs truncate block">{t.title}</span>
                        {overdue(t) && (
                          <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-medium shrink-0">
                            Overdue
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-gray-700">{t.createdBy?.name ?? '—'}</span>
                        {t.createdBy && <StatusBadge type="role" value={t.createdBy.role} />}
                      </div>
                    </td>
                    <td className="px-5 py-3"><StatusBadge type="priority" value={t.priority} /></td>
                    <td className="px-5 py-3"><StatusBadge type="status" value={t.status} /></td>
                    <td className="px-5 py-3 text-gray-500">
                      {t.dueDate ? new Date(t.dueDate).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
