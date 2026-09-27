import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';
import api from '../../lib/api';

export default function MentorMentees() {
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
        setError(err.response?.data?.error ?? 'Failed to load mentees.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <svg className="animate-spin w-8 h-8 text-blue-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      </div>
    );
  }

  if (error) return <div className="text-center py-16 text-red-600 text-sm">{error}</div>;

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-gray-900">My Mentees</h1>
      <p className="text-sm text-gray-500">Click a mentee card to view their profile and all assigned tasks.</p>

      {mentees.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">No mentees assigned to you yet.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {mentees.map((m) => {
            const mt = tasks.filter((t) => t.assignee?.id === m.id);
            const doneCnt = mt.filter((t) => t.status === 'DONE').length;
            const pct = mt.length === 0 ? 0 : Math.round((doneCnt / mt.length) * 100);

            return (
              <div
                key={m.id}
                onClick={() => navigate(`/mentor/mentees/${m.id}`)}
                className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md cursor-pointer transition-shadow"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold shrink-0">
                    {m.name[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{m.name}</p>
                    <p className="text-xs text-gray-500 truncate">{m.email}</p>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs text-gray-500 mb-4">
                  {m.department && (
                    <p>
                      <span className="font-medium text-gray-600">Department:</span> {m.department}
                    </p>
                  )}
                  {m.joiningDate && (
                    <p>
                      <span className="font-medium text-gray-600">Joined:</span>{' '}
                      {new Date(m.joiningDate).toLocaleDateString()}
                    </p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1 text-xs">
                    <span className="text-gray-500 flex items-center gap-1">
                      <GraduationCap size={12} /> Progress
                    </span>
                    <span className="font-medium text-gray-700">{pct}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div
                      className="bg-blue-500 h-1.5 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{doneCnt}/{mt.length} task{mt.length !== 1 ? 's' : ''} done</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
