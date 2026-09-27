import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import StatusBadge from '../../components/StatusBadge';

export default function HRUsers() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get('/users');
        setUsers(res.data.users);
      } catch (err) {
        setError(err.response?.data?.error ?? 'Failed to load users.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = users.filter((u) => {
    if (roleFilter && u.role !== roleFilter) return false;
    if (search && !u.name.toLowerCase().includes(search.toLowerCase()) && !u.email.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-gray-900">Users</h1>
      <p className="text-sm text-gray-500">Read-only directory. Click a user to view their profile and tasks.</p>

      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="py-2 px-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 w-56"
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="py-2 px-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
        >
          <option value="">All Roles</option>
          <option value="HR">HR</option>
          <option value="MENTOR">Mentor</option>
          <option value="MENTEE">Mentee</option>
        </select>
        {(search || roleFilter) && (
          <button
            onClick={() => { setSearch(''); setRoleFilter(''); }}
            className="text-sm text-purple-600 hover:underline px-2"
          >
            Clear
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <svg className="animate-spin w-8 h-8 text-purple-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        </div>
      ) : error ? (
        <div className="text-center py-16 text-red-600 text-sm">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">No users found.</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-5 py-3 text-left font-medium">Name</th>
                  <th className="px-5 py-3 text-left font-medium">Email</th>
                  <th className="px-5 py-3 text-left font-medium">Role</th>
                  <th className="px-5 py-3 text-left font-medium">Status</th>
                  <th className="px-5 py-3 text-left font-medium">Department</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((u) => (
                  <tr
                    key={u.id}
                    onClick={() => navigate(`/hr/users/${u.id}`)}
                    className="hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="px-5 py-3 font-medium text-gray-900">{u.name}</td>
                    <td className="px-5 py-3 text-gray-600">{u.email}</td>
                    <td className="px-5 py-3"><StatusBadge type="role" value={u.role} /></td>
                    <td className="px-5 py-3"><StatusBadge type="active" value={u.isActive} /></td>
                    <td className="px-5 py-3 text-gray-500">{u.department ?? '—'}</td>
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
