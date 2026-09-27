import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Clock, TrendingUp, AlertTriangle, Calendar } from 'lucide-react';
import api from '../../lib/api';

function ProgressRing({ pct }) {
  const r = 44;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="108" height="108" className="-rotate-90">
        <circle cx="54" cy="54" r={r} fill="none" stroke="#e5e7eb" strokeWidth="10" />
        <circle
          cx="54" cy="54" r={r}
          fill="none"
          stroke="#16a34a"
          strokeWidth="10"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <p className="text-2xl font-bold text-gray-900 -mt-16">{pct}%</p>
      <p className="text-xs text-gray-500 mt-12">Overall Done</p>
    </div>
  );
}

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

export default function MenteeOverview() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/tasks?scope=assigned')
      .then((res) => setTasks(res.data.tasks))
      .catch((err) => setError(err.response?.data?.error ?? 'Failed to load overview.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <svg className="animate-spin w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24">
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
  const overdueList = tasks.filter((t) => t.dueDate && new Date(t.dueDate) < now && t.status !== 'DONE');
  const pct = tasks.length === 0 ? 0 : Math.round((done / tasks.length) * 100);

  const upcoming = tasks
    .filter((t) => t.dueDate && new Date(t.dueDate) >= now && t.status !== 'DONE')
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
    .slice(0, 3);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900">Overview</h1>

      {overdueList.length > 0 && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          <AlertTriangle size={16} />
          <span>{overdueList.length} overdue task{overdueList.length !== 1 ? 's' : ''} — please action them.</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-start">
        <div className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col items-center justify-center">
          <ProgressRing pct={pct} />
          <p className="text-xs text-gray-500 mt-1">{tasks.length} total task{tasks.length !== 1 ? 's' : ''}</p>
        </div>
        <StatCard icon={Clock}        label="To Do"       value={todo}       color="bg-gray-500" />
        <StatCard icon={TrendingUp}   label="In Progress" value={inProgress}  color="bg-indigo-500" />
        <StatCard icon={CheckCircle2} label="Done"        value={done}        color="bg-green-600" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <Calendar size={16} /> Upcoming Due Dates
          </h2>
          <button onClick={() => navigate('/mentee/tasks')} className="text-xs text-green-600 hover:underline font-medium">
            View all →
          </button>
        </div>
        {upcoming.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-gray-400">No upcoming tasks.</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {upcoming.map((t) => (
              <div
                key={t.id}
                onClick={() => navigate(`/mentee/tasks/${t.id}`)}
                className="px-5 py-3 hover:bg-gray-50 cursor-pointer flex items-center justify-between text-sm"
              >
                <span className="font-medium text-gray-900 truncate max-w-xs">{t.title}</span>
                <span className="text-gray-500 shrink-0 ml-4">{new Date(t.dueDate).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
