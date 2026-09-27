import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import TaskForm from '../../components/TaskForm';

export default function HRAssignTask() {
  const navigate = useNavigate();
  const [assignees, setAssignees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get('/users');
        setAssignees(
          res.data.users.filter(
            (u) => u.isActive && ['HR', 'MENTOR', 'MENTEE'].includes(u.role)
          )
        );
      } catch (err) {
        setError(err.response?.data?.error ?? 'Failed to load users.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <svg className="animate-spin w-8 h-8 text-purple-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      </div>
    );
  }

  if (error) {
    return <div className="text-center py-16 text-red-600 text-sm">{error}</div>;
  }

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-gray-900">Assign Task</h1>
      <TaskForm
        assignees={assignees}
        onSuccess={(task) => navigate(`/hr/tasks/${task.id}`)}
        onCancel={() => navigate('/hr/tasks')}
      />
    </div>
  );
}
