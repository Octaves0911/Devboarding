import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, UserCheck, GraduationCap, ClipboardList, TrendingUp } from 'lucide-react';
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

export default function AdminOverview() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [recentUsers, setRecentUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const [usersRes, tasksRes] = await Promise.all([
          api.get('/users'),
          api.get('/tasks'),
        ]);
        const users = usersRes.data.users;
        const tasks = tasksRes.data.tasks;

        setStats({
          total: users.length,
          hr: users.filter((u) => u.role === 'HR').length,
          mentors: users.filter((u) => u.role === 'MENTOR').length,
          mentees: users.filter((u) => u.role === 'MENTEE').length,
          tasks: tasks.length,
        });

        setRecentUsers(
          [...users]
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 5)
        );
      } catch (err) {
        setError(err.response?.data?.error ?? 'Failed to load overview data.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <svg className="animate-spin w-8 h-8 text-slate-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-red-600 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900">Overview</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard icon={Users}        label="Total Users"  value={stats.total}   color="bg-slate-600" />
        <StatCard icon={UserCheck}    label="HR"           value={stats.hr}      color="bg-purple-600" />
        <StatCard icon={GraduationCap} label="Mentors"     value={stats.mentors} color="bg-blue-600" />
        <StatCard icon={Users}        label="Mentees"      value={stats.mentees} color="bg-green-600" />
        <StatCard icon={ClipboardList} label="Total Tasks" value={stats.tasks}   color="bg-orange-500" />
      </div>

      {/* Recent users */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <TrendingUp size={16} /> Recently Created Users
          </h2>
          <button
            onClick={() => navigate('/admin/users')}
            className="text-xs text-slate-600 hover:underline font-medium"
          >
            View all →
          </button>
        </div>

        {recentUsers.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-gray-400">No users yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-5 py-3 text-left font-medium">Name</th>
                  <th className="px-5 py-3 text-left font-medium">Email</th>
                  <th className="px-5 py-3 text-left font-medium">Role</th>
                  <th className="px-5 py-3 text-left font-medium">Status</th>
                  <th className="px-5 py-3 text-left font-medium">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recentUsers.map((u) => (
                  <tr
                    key={u.id}
                    onClick={() => navigate(`/admin/users/${u.id}`)}
                    className="hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="px-5 py-3 font-medium text-gray-900">{u.name}</td>
                    <td className="px-5 py-3 text-gray-600">{u.email}</td>
                    <td className="px-5 py-3"><StatusBadge type="role" value={u.role} /></td>
                    <td className="px-5 py-3"><StatusBadge type="active" value={u.isActive} /></td>
                    <td className="px-5 py-3 text-gray-500">
                      {new Date(u.createdAt).toLocaleDateString()}
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
