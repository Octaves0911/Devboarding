import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, CheckCircle2, Clock, AlertTriangle, TrendingUp } from 'lucide-react';
import api from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import StatusBadge from '../../components/StatusBadge';

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div>
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value ?? '—'}</p>
      </div>
    </div>
  );
}

export default function HROverview() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get('/tasks?scope=created');
        setTasks(res.data.tasks);
      } catch (err) {
        setError(err.response?.data?.error ?? 'Failed to load overview.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <svg className="animate-spin w-8 h-8 text-purple-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      </div>
    );
  }

  if (error) {
    return <div className="flex items-center justify-center min-h-[60vh]"><p className="text-red-600 text-sm">{error}</p></div>;
  }

  const now = new Date();
  const todo = tasks.filter((t) => t.status === 'TODO').length;
  const inProgress = tasks.filter((t) => t.status === 'IN_PROGRESS').length;
  const done = tasks.filter((t) => t.status === 'DONE').length;
  const overdue = tasks.filter((t) => t.dueDate && new Date(t.dueDate) < now && t.status !== 'DONE').length;
  const recentDone = [...tasks]
    .filter((t) => t.status === 'DONE')
    .sort((a, b) => new Date(b.completedAt ?? b.updatedAt) - new Date(a.completedAt ?? a.updatedAt))
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900">Overview</h1>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard icon={ClipboardList} label="Total Created" value={tasks.length} color="bg-purple-600" />
        <StatCard icon={Clock}         label="To Do"          value={todo}         color="bg-gray-500" />
        <StatCard icon={TrendingUp}    label="In Progress"    value={inProgress}   color="bg-blue-600" />
        <StatCard icon={CheckCircle2}  label="Done"           value={done}         color="bg-green-600" />
        <StatCard icon={AlertTriangle} label="Overdue"        value={overdue}      color="bg-red-500" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <CheckCircle2 size={16} /> Recently Completed Tasks
          </h2>
          <button
            onClick={() => navigate('/hr/tasks')}
            className="text-xs text-purple-600 hover:underline font-medium"
          >
            View all →
          </button>
        </div>
        {recentDone.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-gray-400">No completed tasks yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-5 py-3 text-left font-medium">Title</th>
                  <th className="px-5 py-3 text-left font-medium">Assignee</th>
                  <th className="px-5 py-3 text-left font-medium">Priority</th>
                  <th className="px-5 py-3 text-left font-medium">Completed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recentDone.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => navigate(`/hr/tasks/${t.id}`)}
                    className="hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="px-5 py-3 font-medium text-gray-900 max-w-xs truncate">{t.title}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-gray-700">{t.assignee?.name ?? '—'}</span>
                        {t.assignee && <StatusBadge type="role" value={t.assignee.role} />}
                      </div>
                    </td>
                    <td className="px-5 py-3"><StatusBadge type="priority" value={t.priority} /></td>
                    <td className="px-5 py-3 text-gray-500">
                      {t.completedAt ? new Date(t.completedAt).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
