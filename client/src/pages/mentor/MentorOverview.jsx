import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, CheckCircle2, Clock, AlertTriangle, TrendingUp, GraduationCap } from 'lucide-react';
import api from '../../lib/api';
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

export default function MentorOverview() {
  const navigate = useNavigate();
  const [mentees, setMentees] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const [menteesRes, tasksRes] = await Promise.all([
          api.get('/users/my-mentees'),
          api.get('/tasks?scope=created'),
        ]);
        setMentees(menteesRes.data.mentees);
        setTasks(tasksRes.data.tasks);
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
        <svg className="animate-spin w-8 h-8 text-blue-500" fill="none" viewBox="0 0 24 24">
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

  // Per-mentee progress: tasks I created for each mentee
  const menteeProgress = mentees.map((m) => {
    const mt = tasks.filter((t) => t.assignee?.id === m.id);
    const pct = mt.length === 0 ? 0 : Math.round((mt.filter((t) => t.status === 'DONE').length / mt.length) * 100);
    return { ...m, taskCount: mt.length, pct };
  });

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900">Overview</h1>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard icon={GraduationCap}  label="My Mentees"   value={mentees.length} color="bg-blue-800" />
        <StatCard icon={ClipboardList}  label="Tasks Created" value={tasks.length}  color="bg-blue-600" />
        <StatCard icon={Clock}          label="To Do"         value={todo}          color="bg-gray-500" />
        <StatCard icon={TrendingUp}     label="In Progress"   value={inProgress}    color="bg-indigo-500" />
        <StatCard icon={CheckCircle2}   label="Done"          value={done}          color="bg-green-600" />
      </div>

      {overdue > 0 && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          <AlertTriangle size={16} />
          <span>{overdue} overdue task{overdue !== 1 ? 's' : ''} need attention.</span>
        </div>
      )}

      {/* Per-mentee progress */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <GraduationCap size={16} /> Mentee Progress
          </h2>
          <button onClick={() => navigate('/mentor/mentees')} className="text-xs text-blue-600 hover:underline font-medium">
            View all →
          </button>
        </div>
        {menteeProgress.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-gray-400">No mentees assigned yet.</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {menteeProgress.map((m) => (
              <div
                key={m.id}
                onClick={() => navigate(`/mentor/mentees/${m.id}`)}
                className="px-5 py-4 hover:bg-gray-50 cursor-pointer"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium text-gray-900">{m.name}</span>
                  <span className="text-xs text-gray-500">{m.pct}% ({m.taskCount} task{m.taskCount !== 1 ? 's' : ''})</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all"
                    style={{ width: `${m.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
